import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "./auth";
import {
  FREE_TRIAL_INTERVIEW_PREPS,
  FREE_TRIAL_MOCK_INTERVIEWS,
  MOCK_ATTEMPTS_PER_JOB,
} from "@/lib/interview-config";
import { countModelCalls } from "./openai";
import { getPlanForUser, getSupabaseAdminClient } from "./subscriptions";

// Interview prep and the mock interview both work from what a scan stored on
// the tracked job (its keyword lists) plus who the candidate is (their level,
// from the base resume). The routes under app/api/interview are thin: the
// prompts, the shape checks on what the model returns, the interviewer's
// script and the scoring all live here.

const str = (value, max = 2000) => String(value ?? "").trim().slice(0, max);
const strList = (value, maxItems, maxLength = 400) =>
  (Array.isArray(value) ? value : [])
    .map((item) => str(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
const clampInt = (value, min, max) => {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return null;
  return Math.min(max, Math.max(min, number));
};

/** Parses the model's JSON, tolerating a stray code fence around it. */
export const parseModelJson = (content) => {
  const text = String(content || "").trim();
  try {
    return JSON.parse(text);
  } catch {
    const block = text.match(/\{[\s\S]*\}/)?.[0];
    if (!block) throw new Error("The model did not return JSON.");
    return JSON.parse(block);
  }
};

// ---------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------

/**
 * What an account may do with interview practice. Checked here because these
 * routes spend money, and what the page shows is only what the page shows.
 *
 * - A paid plan that includes the tracker: prep for every scanned job, and
 *   MOCK_ATTEMPTS_PER_JOB mock interviews per job.
 * - No plan (the free trial, or a subscription that has lapsed): `trial`. A
 *   prep guide for one job and one mock interview, ever; see the two
 *   `trial…Used` counts below.
 */
export const getInterviewAllowance = async (supabase, userId) => {
  const plan = await getPlanForUser(supabase, userId);
  if (plan) {
    return { allowed: Boolean(plan.allowsJobTracker), trial: false, mockLimit: MOCK_ATTEMPTS_PER_JOB };
  }
  return { allowed: true, trial: true, mockLimit: FREE_TRIAL_MOCK_INTERVIEWS };
};

// The trial's allowances are per account, not per job, and counted two ways.
// What is saved (interviews, jobs with a guide) is the plain count. The usage
// log is the backstop: saved rows go when their job is deleted, the log
// doesn't, so deleting the job can't hand the trial back more than once. It
// takes two logged generations to count as one use, because a generation
// that came back unusable is logged too and shouldn't cost someone their trial.
const countRows = async (query) => {
  const { count, error } = await query;
  return error ? 0 : Number(count || 0);
};

/** Mock interviews a trial account has used, across all its jobs. */
export const trialMockInterviewsUsed = async (supabase, userId) => {
  const [saved, generated] = await Promise.all([
    countRows(
      supabase.from("mock_interviews").select("id", { count: "exact", head: true }).eq("user_id", userId)
    ),
    countModelCalls(supabase, userId, ["mock_interview_questions"]),
  ]);
  return Math.max(saved, Math.floor(generated / 2));
};

/** Jobs a trial account has had a prep guide written for. */
export const trialInterviewPrepsUsed = async (supabase, userId) => {
  const [saved, generated] = await Promise.all([
    countRows(
      supabase
        .from("job_tracker")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("interview_prep", "is", null)
    ),
    countModelCalls(supabase, userId, ["interview_prep_questions"]),
  ]);
  return Math.max(saved, Math.floor(generated / 2));
};

export const TRIAL_PREP_USED_MESSAGE = `Your free trial includes an interview prep guide for ${
  FREE_TRIAL_INTERVIEW_PREPS === 1 ? "one job" : `${FREE_TRIAL_INTERVIEW_PREPS} jobs`
}. Upgrade to Pro to get one for every job you scan.`;

/**
 * Resolves the caller for an interview route. Returns `{ user, supabase }`, or
 * `{ response }` holding the error to send back as-is.
 */
export const authorizeInterviewRequest = async (req) => {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return {
      response: NextResponse.json(
        { success: false, message: "Please log in to use interview practice." },
        { status: 401 }
      ),
    };
  }
  return { user, supabase: getSupabaseAdminClient() };
};

/**
 * The response for something the account's plan doesn't cover. `code` tells
 * the page to offer the plans instead of a retry.
 */
export const interviewUpgradeRequired = (
  message = "Interview practice comes with the Job Tracker. Upgrade to keep using it."
) => NextResponse.json({ success: false, code: "upgrade", message }, { status: 403 });

/** The response for a database that hasn't had the interview migration run. */
export const interviewSetupMissing = () =>
  NextResponse.json(
    {
      success: false,
      message:
        "Interview practice isn't set up on this database yet. Run the latest supabase-migration.sql.",
    },
    { status: 500 }
  );

/** Whether a Supabase error is a missing table or column. */
export const isMissingSchemaError = (error) =>
  /interview_prep|mock_interviews|does not exist|schema cache/i.test(String(error?.message || ""));

/** A tracked job, only if it belongs to `userId`. */
export const loadOwnedJob = async (supabase, userId, jobId, columns = "*") => {
  if (!jobId) return null;
  const { data, error } = await supabase
    .from("job_tracker")
    .select(columns)
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
};

// ---------------------------------------------------------------------------
// Who the candidate is
// ---------------------------------------------------------------------------

const parseYears = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text) || Number(text.match(/\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(number) && number >= 0 ? Math.min(50, Math.round(number)) : null;
};

/**
 * Name, title, years of experience and top skills, from the default base
 * resume, falling back to the profile row for anything it lacks. Each read is
 * allowed to fail on its own: a missing detail makes the material more
 * generic, it shouldn't stop it being made.
 */
export const getCandidateContext = async (supabase, userId) => {
  const [resumeResult, profileResult] = await Promise.allSettled([
    supabase
      .from("base_resumes")
      .select("resume")
      .eq("user_id", userId)
      .order("is_default", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase
      .from("profiles")
      .select("full_name, headline, experience_years")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const draft =
    resumeResult.status === "fulfilled" ? resumeResult.value.data?.[0]?.resume?.draft || null : null;
  const profile = profileResult.status === "fulfilled" ? profileResult.value.data || null : null;

  const fullName = str(draft?.candidateName || profile?.full_name, 120);
  const skills = (Array.isArray(draft?.skillCategories) ? draft.skillCategories : [])
    .flatMap((category) => (Array.isArray(category?.items) ? category.items : []))
    .map((skill) => str(skill, 60))
    .filter(Boolean)
    .slice(0, 25);

  return {
    firstName: fullName.split(/\s+/)[0] || "",
    title: str(draft?.designation || profile?.headline, 120),
    experienceYears: parseYears(draft?.experienceYears) ?? parseYears(profile?.experience_years),
    skills,
  };
};

/**
 * What an interviewer expects at a given number of years. Unknown experience
 * is treated as mid-level, the band most postings are written for.
 */
export const experienceLevel = (years) => {
  if (years === null || years === undefined) {
    return {
      label: "Mid-level",
      guidance:
        "experience unknown, so pitch at a mid-level professional: hands-on depth, owning features end to end, sound judgement on trade-offs",
    };
  }
  if (years <= 1) {
    return {
      label: "Entry level",
      guidance:
        "a fresher or early-career candidate: test fundamentals, learning ability, internships, academic or personal projects and eagerness; never expect people management or large-scale ownership",
    };
  }
  if (years <= 4) {
    return {
      label: "Early career",
      guidance:
        "a junior to mid-level individual contributor: test hands-on execution, debugging and problem solving, owning well-scoped work, collaboration and growth",
    };
  }
  if (years <= 8) {
    return {
      label: "Mid-senior",
      guidance:
        "an experienced professional: test depth, design decisions and trade-offs, owning outcomes end to end, handling ambiguity, mentoring others and cross-team impact",
    };
  }
  if (years <= 14) {
    return {
      label: "Senior / lead",
      guidance:
        "a senior or lead: test architecture and strategy, leading teams or initiatives, stakeholder management, raising the bar for others and business impact",
    };
  }
  return {
    label: "Principal / leadership",
    guidance:
      "a principal or leadership candidate: test vision and strategy, organisation building, executive communication, driving business outcomes and leading through change",
  };
};

// ---------------------------------------------------------------------------
// The job, as the scan saw it
// ---------------------------------------------------------------------------

const cleanKeywords = (value, max) => {
  const seen = new Set();
  const out = [];
  for (const keyword of Array.isArray(value) ? value : []) {
    const text = str(keyword, 80);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
};

/** The scan's keyword lists, most important first, trimmed for a prompt. */
export const jobKeywords = (job) => ({
  universe: cleanKeywords(job?.keyword_universe, 40),
  matched: cleanKeywords(job?.matched_keywords, 30),
  missing: cleanKeywords(job?.missing_keywords, 15),
});

/**
 * Whether a scan saved keywords for this job. Prep and the mock interview are
 * built from them, so a job typed into the tracker's form by hand, which has
 * none, gets neither (the tracker hides both buttons for it too).
 */
export const hasKeywordData = (job) => {
  const keywords = jobKeywords(job);
  return Boolean(keywords.universe.length || keywords.matched.length || keywords.missing.length);
};

export const keywordDataMissing = () =>
  NextResponse.json(
    {
      success: false,
      message: "Interview practice needs a scanned job description. Scan this job to unlock it.",
    },
    { status: 400 }
  );

const describeContext = ({ job, candidate, keywords, experienceYears }) => {
  const level = experienceLevel(experienceYears);
  const lines = [
    `Role: ${str(job.designation, 160) || "(not given)"}`,
    `Company: ${str(job.organization, 160) || "(not given)"}`,
    `Candidate level: ${level.label}${
      experienceYears !== null && experienceYears !== undefined
        ? ` (${experienceYears} year${experienceYears === 1 ? "" : "s"} of experience)`
        : ""
    } — ${level.guidance}.`,
  ];
  if (candidate.title) lines.push(`Candidate's current title: ${candidate.title}`);
  if (candidate.skills.length) lines.push(`Candidate's listed skills: ${candidate.skills.join(", ")}`);
  lines.push(`Job description keywords, most important first: ${keywords.universe.join(", ") || "(none)"}`);
  lines.push(
    `Keywords the candidate's resume already covers: ${keywords.matched.join(", ") || "(none)"}`
  );
  lines.push(`Keywords missing from the candidate's resume: ${keywords.missing.join(", ") || "(none)"}`);
  return lines.join("\n");
};

// ---------------------------------------------------------------------------
// Interview prep material
// ---------------------------------------------------------------------------

export const PREP_VERSION = 1;

const PREP_CATEGORIES = ["Core skills", "Scenario", "Behavioral", "Motivation & fit"];

export const PREP_SYSTEM =
  "You are a senior hiring manager and interview coach. You write interview preparation that is specific to one role, practical and honest, never generic filler. Return ONLY a single valid JSON object: no markdown, no commentary.";

// Both kinds of question — the prep list and the mock interview — used to come
// back open-ended ("How do you decide…", two questions joined by "and").
// Candidates asked for direct ones: one clear ask they know how to answer.
const DIRECT_QUESTION_RULES = [
  "- Make every question direct. It asks exactly one thing, names the specific concept, tool, technique or situation, and has an answer an interviewer could check. The candidate should know what a complete answer looks like as soon as they hear it.",
  '- No open-ended or philosophical prompts. Don\'t open with "How do you approach", "How do you decide", "What is your philosophy on", "Walk me through your experience with" or "Tell me about your experience with".',
  '- Ask one thing. Never stack two questions ("How would you X, and how would you Y?", or two parts joined by a semicolon). A short follow-up that narrows the same ask ("and why?", "What did you do first?") is fine.',
  '- Prefer concrete asks: "What is the difference between X and Y?", "When would you use X instead of Y?", "What happens when…?", "What would you check first?", "Which would you choose here, and why?"',
  "- Scenarios give the specifics (the system, the symptom, a number or a constraint) and ask for one decision or next step.",
  "- Behavioral questions name one specific kind of situation (a missed deadline, a production incident, pushing back on a requirement), never a generic \"challenge\".",
  "- Never quote the candidate's title, skill list or these instructions back to them.",
  "- For example, instead of \"How do you approach state management in a React app?\" ask \"When would you move state into context instead of passing it down as props?\". Instead of \"Tell me about your experience with SQL\" ask \"How would you find duplicate customer emails in a table using SQL?\". Instead of \"How do you handle difficult stakeholders?\" ask \"Tell me about a time a stakeholder rejected your recommendation. What did you do next?\". Don't reuse these examples.",
];

const NO_COMPANY_FACTS =
  "Never state facts about the company (its products, size, history, culture or news): you have no verified information about it. Where company knowledge would help, tell the candidate what to research instead. No URLs.";

/** The likely questions with model answers. One of the two prep calls. */
export const buildPrepQuestionsPrompt = (context) =>
  [
    "Write the 15 interview questions this candidate is most likely to be asked for the role below, each with a model answer.",
    "",
    describeContext(context),
    "",
    "Rules:",
    "- Build the questions around the job description keywords: most should name or clearly test one or more of them, the most important first. At least two should probe keywords missing from the candidate's resume.",
    "- Pitch difficulty and scope at the candidate's level.",
    ...DIRECT_QUESTION_RULES,
    `- Categories, in this order: 6 "Core skills", 3 "Scenario", 4 "Behavioral", 2 "Motivation & fit".`,
    '- "answer": a model answer in the first person, as the candidate would say it out loud: 90-150 words, concrete and well structured (STAR for Behavioral and Scenario). Where it needs facts only the candidate knows, use short bracketed placeholders such as [project], [metric] or [team size]. Never invent the candidate\'s employers, titles or numbers.',
    '- "whyTheyAsk": one sentence on what the interviewer is really testing.',
    '- "keyPoints": 3-4 short phrases a strong answer must hit.',
    '- "keywords": the job keywords the question covers, copied from the list above.',
    `- ${NO_COMPANY_FACTS}`,
    "",
    'Return JSON: {"questions":[{"category":"Core skills","question":"string","whyTheyAsk":"string","answer":"string","keyPoints":["string"],"keywords":["string"]}]}',
  ].join("\n");

/** Everything around the questions: study plan, gaps, pitch, checklist. */
export const buildPrepStudyPrompt = (context) =>
  [
    "Build a study plan and interview strategy for the candidate below.",
    "",
    describeContext(context),
    "",
    "Return JSON with exactly these keys:",
    '{"overview":{"summary":"2-3 sentences: what this interview will most likely focus on, and how to approach it at this level","focusAreas":["3-5 short phrases"]},',
    '"studyGuide":[{"topic":"string","priority":"high | medium","why":"one sentence tying it to this role","concepts":["4-6 specific concepts, terms or techniques to revise"],"practice":"one concrete exercise to do before the interview"}],',
    '"gaps":[{"keyword":"string","howToAddress":"how to answer honestly if asked about it without direct experience, bridging from related experience","quickPrep":"what to learn or build in a day or two to discuss it credibly"}],',
    '"strengths":[{"keyword":"string","howToShowcase":"how to turn it into a strong story in the interview"}],',
    '"pitch":{"outline":["4-5 beats for answering \'Tell me about yourself\', in order, each a short instruction"],"tip":"one sentence"},',
    '"questionsToAsk":["5 thoughtful questions for the candidate to ask the interviewer, specific to this role"],',
    '"checklist":["6 short, practical to-dos for the day before and the day of the interview"]}',
    "",
    "Rules:",
    "- studyGuide: 6-8 topics, most important first. Cover the top job keywords, and give every missing keyword a topic of its own or fold it into one.",
    "- gaps: one entry per missing keyword, up to 8, most important first; an empty array if none are missing.",
    "- strengths: up to 6 of the keywords the candidate already covers, the ones most valuable for this role; an empty array if none.",
    "- Specific to this role and level throughout.",
    `- ${NO_COMPANY_FACTS}`,
  ].join("\n");

/** Shapes the two prep responses into what is stored on the job. */
export const normalizePrep = ({ questionsOut, studyOut, keywords, experienceYears }) => {
  const questions = (Array.isArray(questionsOut?.questions) ? questionsOut.questions : [])
    .map((item, index) => {
      const category = PREP_CATEGORIES.find(
        (name) => name.toLowerCase() === str(item?.category, 40).toLowerCase()
      );
      return {
        id: `p${index + 1}`,
        category: category || "Core skills",
        question: str(item?.question, 400),
        whyTheyAsk: str(item?.whyTheyAsk, 400),
        answer: str(item?.answer, 1600),
        keyPoints: strList(item?.keyPoints, 5, 160),
        keywords: strList(item?.keywords, 6, 80),
      };
    })
    .filter((item) => item.question && item.answer)
    .slice(0, 20);

  const studyGuide = (Array.isArray(studyOut?.studyGuide) ? studyOut.studyGuide : [])
    .map((item, index) => ({
      id: `s${index + 1}`,
      topic: str(item?.topic, 120),
      priority: str(item?.priority, 10).toLowerCase() === "high" ? "high" : "medium",
      why: str(item?.why, 400),
      concepts: strList(item?.concepts, 8, 200),
      practice: str(item?.practice, 400),
    }))
    .filter((item) => item.topic)
    .slice(0, 10);

  const gaps = (Array.isArray(studyOut?.gaps) ? studyOut.gaps : [])
    .map((item) => ({
      keyword: str(item?.keyword, 80),
      howToAddress: str(item?.howToAddress, 600),
      quickPrep: str(item?.quickPrep, 400),
    }))
    .filter((item) => item.keyword && item.howToAddress)
    .slice(0, 10);

  const strengths = (Array.isArray(studyOut?.strengths) ? studyOut.strengths : [])
    .map((item) => ({
      keyword: str(item?.keyword, 80),
      howToShowcase: str(item?.howToShowcase, 500),
    }))
    .filter((item) => item.keyword && item.howToShowcase)
    .slice(0, 8);

  return {
    version: PREP_VERSION,
    basis: {
      keywordCount: keywords.universe.length,
      matchedCount: keywords.matched.length,
      missingCount: keywords.missing.length,
      experienceYears,
      level: experienceLevel(experienceYears).label,
    },
    overview: {
      summary: str(studyOut?.overview?.summary, 800),
      focusAreas: strList(studyOut?.overview?.focusAreas, 6, 120),
    },
    questions,
    studyGuide,
    gaps,
    strengths,
    pitch: {
      outline: strList(studyOut?.pitch?.outline, 6, 300),
      tip: str(studyOut?.pitch?.tip, 300),
    },
    questionsToAsk: strList(studyOut?.questionsToAsk, 7, 300),
    checklist: strList(studyOut?.checklist, 8, 300),
  };
};

// ---------------------------------------------------------------------------
// Mock interview: questions
// ---------------------------------------------------------------------------

export const MOCK_QUESTION_COUNT = 12;

// Four sections, always in this order and with these counts, so every
// interview has the same arc and the progress bar can show it up front.
export const MOCK_SECTIONS = [
  { name: "Introduction", count: 2, spoken: "a little about you" },
  { name: "Role expertise", count: 4, spoken: "the core skills for this role" },
  { name: "Problem solving", count: 3, spoken: "a few problem-solving scenarios" },
  { name: "Behavioral", count: 3, spoken: "how you've handled situations in the past" },
];

export const MOCK_SYSTEM =
  "You are an experienced interviewer and hiring manager. You write sharp, realistic interview questions and score answers fairly and honestly. Return ONLY a single valid JSON object: no markdown, no commentary.";

export const buildMockQuestionsPrompt = ({ previousQuestions = [], ...context }) =>
  [
    `You are about to interview the candidate below. Write the ${MOCK_QUESTION_COUNT} questions you will ask, in order, in four sections.`,
    "",
    describeContext(context),
    "",
    "Sections, in this order:",
    `1. "Introduction": 2 short questions: what they do in their current role, and why this role.`,
    `2. "Role expertise": 4 knowledge questions, each on one of the most important job keywords, named in the question: how it works, the difference between two options, when to use it, or a common mistake with it.`,
    `3. "Problem solving": 3 concrete scenarios from this role's day-to-day work, each giving the specifics and asking for one decision or first step. At least one should touch a keyword missing from the candidate's resume.`,
    `4. "Behavioral": 3 questions, each about one specific kind of past situation: ownership, collaboration, conflict, a setback${
      (context.experienceYears ?? 0) >= 5 ? ", leading others" : ""
    }.`,
    "",
    "Rules:",
    "- A voice interviewer will read the questions aloud, so write them as spoken: conversational, 8-30 words. No lists, code, URLs or markdown.",
    ...DIRECT_QUESTION_RULES,
    "- Pitch every question at the candidate's level.",
    "- No two questions on the same topic.",
    '- For each question also give "assesses" (one sentence: what a strong answer demonstrates) and "idealPoints" (3-5 short points a strong answer at this level covers). They are used to score the answer and are never shown to the candidate.',
    '- "keywords": the job keywords the question tests, copied from the list above.',
    previousQuestions.length
      ? `- The candidate has practised this role before. Do not repeat these earlier questions:\n${previousQuestions
          .map((question) => `  - ${question}`)
          .join("\n")}`
      : "",
    "",
    'Return JSON: {"sections":[{"name":"Introduction","questions":[{"question":"string","assesses":"string","idealPoints":["string"],"keywords":["string"]}]}]}',
  ]
    .filter((line) => line !== "")
    .join("\n");

/**
 * Flattens the model's sections into the stored question list: ids q1…q12,
 * each tagged with its section. Sections are matched by name so a reordered
 * reply still lands correctly, and each is capped at its planned count.
 */
export const normalizeMockQuestions = (raw) => {
  const sections = Array.isArray(raw?.sections) ? raw.sections : [];
  const questions = [];
  for (const plan of MOCK_SECTIONS) {
    const match =
      sections.find((section) => str(section?.name, 60).toLowerCase() === plan.name.toLowerCase()) ||
      sections[MOCK_SECTIONS.indexOf(plan)];
    const items = (Array.isArray(match?.questions) ? match.questions : [])
      .map((item) => ({
        section: plan.name,
        question: str(item?.question, 500),
        assesses: str(item?.assesses, 300),
        idealPoints: strList(item?.idealPoints, 6, 200),
        keywords: strList(item?.keywords, 6, 80),
      }))
      .filter((item) => item.question)
      .slice(0, plan.count);
    questions.push(...items);
  }
  return questions.map((question, index) => ({ id: `q${index + 1}`, ...question }));
};

/** What the page may see of a question while the interview is running. */
export const publicQuestion = ({ id, section, question }) => ({ id, section, question });

/**
 * A mock_interviews row as the page gets it. The rubric behind each question
 * is only included once the interview is over, where the report shows it.
 */
export const sessionForClient = (row) => ({
  id: row.id,
  jobId: row.job_id,
  status: row.status,
  experienceYears: row.experience_years ?? null,
  level: experienceLevel(row.experience_years ?? null).label,
  createdAt: row.created_at,
  completedAt: row.completed_at || null,
  questions: (Array.isArray(row.questions) ? row.questions : []).map((question) =>
    row.status === "completed"
      ? {
          ...publicQuestion(question),
          assesses: question.assesses || "",
          idealPoints: question.idealPoints || [],
        }
      : publicQuestion(question)
  ),
  script: row.status === "completed" ? null : row.script || null,
  answers: Array.isArray(row.answers) ? row.answers : [],
  evaluation: row.evaluation || null,
  overallScore: row.overall_score ?? null,
  interviewer: INTERVIEWER_NAME,
});

// ---------------------------------------------------------------------------
// Mock interview: what the interviewer says
// ---------------------------------------------------------------------------

export const INTERVIEWER_NAME = "Maya";

const ACKNOWLEDGEMENTS = [
  "Thank you.",
  "Okay, thanks for that.",
  "Alright.",
  "Got it, thank you.",
  "Thanks.",
];

/**
 * Every line the interviewer speaks, fixed when the interview starts and
 * stored with it. `lines[i]` leads into question i (the welcome before the
 * first, an acknowledgement and any change of section before the rest);
 * `questions[i]` is the bare question, for "repeat the question".
 * `transcriptionContext` is what the transcriber is told about the answers
 * it will hear: the role, and `vocabulary`, the terms likely to be said.
 */
export const buildInterviewScript = ({
  firstName,
  designation,
  organization,
  questions,
  vocabulary = [],
}) => {
  const role = str(designation, 120) || "this";
  const company = str(organization, 120);
  const welcome = [
    `Hi${firstName ? ` ${firstName}` : ""}, I'm ${INTERVIEWER_NAME}, and I'll be interviewing you today for the ${role} role${
      company ? ` at ${company}` : ""
    }.`,
    `I'll ask you ${questions.length} questions in ${MOCK_SECTIONS.length} short sections.`,
    "Take a moment to think before you answer, and speak as you would in a real interview. When you've finished an answer, press Done.",
  ].join(" ");

  const lines = questions.map((question, index) => {
    const previous = questions[index - 1];
    const section = MOCK_SECTIONS.find((plan) => plan.name === question.section);
    const parts = [index === 0 ? welcome : ACKNOWLEDGEMENTS[index % ACKNOWLEDGEMENTS.length]];
    if (!previous || previous.section !== question.section) {
      parts.push(
        index === 0
          ? `Let's start with ${section?.spoken || question.section.toLowerCase()}.`
          : `Now let's move on to ${section?.spoken || question.section.toLowerCase()}.`
      );
    }
    parts.push(question.question);
    return parts.join(" ");
  });

  return {
    lines,
    questions: questions.map((question) => question.question),
    outro: `That was the last question. Thank you for your time${
      firstName ? `, ${firstName}` : ""
    }. Give me a moment while I review your answers.`,
    transcriptionContext: [
      `A candidate is answering job interview questions for a ${role} role.`,
      vocabulary.length ? `Terms that may come up: ${vocabulary.join(", ")}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
  };
};

/**
 * The job's keywords and the candidate's own skills, as the vocabulary the
 * transcriber is primed with: these are the words a generic speech model
 * gets wrong.
 */
export const transcriptionVocabulary = (keywords, candidate) =>
  cleanKeywords([...keywords.universe.slice(0, 30), ...candidate.skills.slice(0, 15)], 40);

/**
 * What the transcriber is told for one clip of an answer: the interview's
 * context, plus the last words already transcribed so a clip that starts
 * mid-thought is read in continuity with them.
 */
export const transcriptionPrompt = (script, previous) => {
  const context =
    str(script?.transcriptionContext, 900) || "A candidate is answering job interview questions.";
  const tail = String(previous || "").trim().slice(-200);
  return tail ? `${context} So far they have said: "${tail}"` : context;
};

/** The text behind a voice key: "line-3", "question-3" or "outro". */
export const scriptLine = (script, key) => {
  if (!script) return "";
  if (key === "outro") return str(script.outro, 1000);
  const match = String(key || "").match(/^(line|question)-(\d{1,2})$/);
  if (!match) return "";
  const list = match[1] === "line" ? script.lines : script.questions;
  return str(Array.isArray(list) ? list[Number(match[2])] : "", 2000);
};

// ---------------------------------------------------------------------------
// Mock interview: answers and scoring
// ---------------------------------------------------------------------------

/** One stored answer, from whatever the page sent. */
export const normalizeAnswer = (value) => ({
  questionId: str(value?.questionId, 10),
  answer: str(value?.answer, 6000),
  durationSec: clampInt(value?.durationSec, 0, 3600) ?? 0,
  skipped: Boolean(value?.skipped),
  answeredAt: new Date().toISOString(),
});

/** Merges answers into a stored list, keyed by question id; newest wins. */
export const mergeAnswers = (existing, incoming, questions) => {
  const known = new Set(questions.map((question) => question.id));
  const byId = new Map();
  for (const answer of Array.isArray(existing) ? existing : []) {
    if (known.has(answer?.questionId)) byId.set(answer.questionId, answer);
  }
  for (const answer of incoming) {
    if (known.has(answer.questionId)) byId.set(answer.questionId, answer);
  }
  return questions.map((question) => byId.get(question.id)).filter(Boolean);
};

const countWords = (text) => (String(text || "").match(/\S+/g) || []).length;

const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes}m ${rest}s` : `${rest}s`;
};

/** Answers worth sending to the model: said something, and weren't skipped. */
export const answersToScore = (answers) =>
  answers.filter((answer) => !answer.skipped && countWords(answer.answer) > 0);

export const buildEvaluationPrompt = ({ questions, answers, ...context }) => {
  const byId = new Map(answers.map((answer) => [answer.questionId, answer]));
  const blocks = questions
    .filter((question) => byId.has(question.id))
    .map((question) => {
      const answer = byId.get(question.id);
      return [
        `[${question.id}] Section: ${question.section}`,
        `Question: ${question.question}`,
        `A strong answer covers: ${question.idealPoints.join("; ") || question.assesses || "(no rubric)"}`,
        `Answer (${countWords(answer.answer)} words, ${formatDuration(answer.durationSec)}): "${answer.answer}"`,
      ].join("\n");
    });

  return [
    "Score this mock interview. The answers were transcribed from speech, so ignore filler words, missing punctuation and obvious transcription errors: judge the substance, and how clearly it was communicated.",
    "",
    describeContext(context),
    "Judge every answer against what is expected at the candidate's level.",
    "",
    "Score each answer from 0 to 10: 0-2 missing, off-topic or a non-answer; 3-4 touches the question but vague or largely wrong; 5-6 adequate but generic or thin on specifics; 7-8 strong, specific and well structured; 9-10 exceptional for this level. Be honest and calibrated: an average answer is a 5 or 6, and an answer under about 25 words rarely deserves more than 4.",
    "",
    "Questions and answers:",
    blocks.join("\n\n"),
    "",
    "Return JSON:",
    '{"answers":[{"id":"q1","score":0,"feedback":"2-3 sentences on what worked and what was missing, specific to what they said","betterAnswer":"a stronger version of their answer, 60-110 words, first person, keeping their own facts and using [brackets] for details they did not give"}],',
    '"strengths":[{"title":"3-6 words","detail":"one or two sentences, pointing to what they said"}],',
    '"improvements":[{"title":"3-6 words","detail":"what held their answers back","action":"one concrete thing to practise"}],',
    '"communication":{"clarity":0,"structure":0,"relevance":0,"depth":0},',
    '"summary":"2-3 sentences addressed to the candidate as you: how it went overall, and the single most important thing to work on"}',
    "Give one entry in answers for each question above. strengths and improvements: 2-4 each. communication: 0-10 each, across all answers.",
  ].join("\n");
};

export const readinessFor = (score) => {
  if (score >= 80) return "Interview-ready";
  if (score >= 65) return "Almost there";
  if (score >= 45) return "Getting there";
  return "Needs more practice";
};

/**
 * The stored evaluation. Scores are worked out here from the per-answer
 * marks, not taken from the model, so the headline number always agrees with
 * the breakdown underneath it. A skipped or empty answer scores 0; questions
 * never reached (the interview ended early) are left out, and `scoredCount`
 * says how many the score covers.
 */
export const buildEvaluation = ({ questions, answers, raw }) => {
  const rawById = new Map(
    (Array.isArray(raw?.answers) ? raw.answers : []).map((item) => [str(item?.id, 10), item])
  );
  const answerById = new Map(answers.map((answer) => [answer.questionId, answer]));

  const perQuestion = questions.map((question) => {
    const answer = answerById.get(question.id);
    if (!answer) {
      return { id: question.id, status: "not_reached", score: null, feedback: "", betterAnswer: "" };
    }
    if (answer.skipped || !countWords(answer.answer)) {
      return {
        id: question.id,
        status: "skipped",
        score: 0,
        feedback: "Skipped. In a real interview, even a partial answer that shows how you'd think it through beats passing.",
        betterAnswer: "",
      };
    }
    const item = rawById.get(question.id);
    return {
      id: question.id,
      status: "answered",
      score: clampInt(item?.score, 0, 10) ?? 0,
      feedback: str(item?.feedback, 800),
      betterAnswer: str(item?.betterAnswer, 1200),
    };
  });

  const scored = perQuestion.filter((item) => item.score !== null);
  const average = (items) =>
    items.length ? Math.round((items.reduce((sum, item) => sum + item.score, 0) / items.length) * 10) : 0;
  const overallScore = average(scored);

  const sectionScores = MOCK_SECTIONS.map((plan) => {
    const items = perQuestion.filter(
      (item, index) => questions[index].section === plan.name && item.score !== null
    );
    return { section: plan.name, score: items.length ? average(items) : null, answered: items.length };
  });

  const answered = perQuestion.filter((item) => item.status === "answered");
  const totalSeconds = answers.reduce((sum, answer) => sum + (answer.skipped ? 0 : answer.durationSec), 0);
  const totalWords = answers.reduce((sum, answer) => sum + (answer.skipped ? 0 : countWords(answer.answer)), 0);
  const communication = raw?.communication || {};

  return {
    overallScore,
    readiness: readinessFor(overallScore),
    summary: str(raw?.summary, 800),
    scoredCount: scored.length,
    totalQuestions: questions.length,
    sectionScores,
    communication: {
      clarity: clampInt(communication.clarity, 0, 10),
      structure: clampInt(communication.structure, 0, 10),
      relevance: clampInt(communication.relevance, 0, 10),
      depth: clampInt(communication.depth, 0, 10),
    },
    stats: {
      answered: answered.length,
      skipped: perQuestion.filter((item) => item.status === "skipped").length,
      averageSeconds: answered.length ? Math.round(totalSeconds / answered.length) : 0,
      averageWords: answered.length ? Math.round(totalWords / answered.length) : 0,
      wordsPerMinute: totalSeconds > 0 ? Math.round((totalWords / totalSeconds) * 60) : 0,
    },
    strengths: (Array.isArray(raw?.strengths) ? raw.strengths : [])
      .map((item) => ({ title: str(item?.title, 80), detail: str(item?.detail, 500) }))
      .filter((item) => item.title)
      .slice(0, 4),
    improvements: (Array.isArray(raw?.improvements) ? raw.improvements : [])
      .map((item) => ({
        title: str(item?.title, 80),
        detail: str(item?.detail, 500),
        action: str(item?.action, 400),
      }))
      .filter((item) => item.title)
      .slice(0, 4),
    questions: perQuestion,
  };
};
