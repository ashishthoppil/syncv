import { NextResponse } from "next/server";
import {
  authorizeInterviewRequest,
  buildInterviewScript,
  buildMockQuestionsPrompt,
  experienceLevel,
  getCandidateContext,
  getInterviewAllowance,
  hasKeywordData,
  interviewSetupMissing,
  interviewUpgradeRequired,
  INTERVIEWER_NAME,
  isMissingSchemaError,
  jobKeywords,
  keywordDataMissing,
  loadOwnedJob,
  MOCK_QUESTION_COUNT,
  MOCK_SECTIONS,
  MOCK_SYSTEM,
  normalizeMockQuestions,
  parseModelJson,
  sessionForClient,
  transcriptionVocabulary,
  trialMockInterviewsUsed,
} from "@/lib/server/interview";
import { MOCK_ATTEMPTS_PER_JOB } from "@/lib/interview-config";
import { getRequestCountry } from "@/lib/server/pricing-region";
import {
  chatCompletion,
  countModelCalls,
  HOURLY_MODEL_CALL_LIMITS,
  INTERVIEW_TRANSCRIPTION_MODE,
  INTERVIEW_VOICE_MODE,
  LARGE_MODEL,
  TOO_MANY_MODEL_CALLS_MESSAGE,
} from "@/lib/server/openai";

const attemptLimitReached = (trial) =>
  NextResponse.json(
    {
      success: false,
      code: trial ? "upgrade" : "attempt_limit",
      message: trial
        ? `You've used your free mock interview. Upgrade to Pro for ${MOCK_ATTEMPTS_PER_JOB} with every job you scan.`
        : `You've used all ${MOCK_ATTEMPTS_PER_JOB} mock interviews for this job.`,
    },
    { status: 403 }
  );

/**
 * GET ?jobId=…     what the lobby needs: the job, the level the questions
 *                  will be pitched at, and this job's attempts so far.
 * GET ?sessionId=… one interview in full, for its report.
 */
export async function GET(req) {
  try {
    const auth = await authorizeInterviewRequest(req);
    if (auth.response) return auth.response;
    const { user, supabase } = auth;
    const { searchParams } = new URL(req.url);

    const sessionId = searchParams.get("sessionId");
    if (sessionId) {
      const { data: row, error } = await supabase
        .from("mock_interviews")
        .select("*")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        if (isMissingSchemaError(error)) return interviewSetupMissing();
        throw error;
      }
      if (!row) {
        return NextResponse.json({ success: false, message: "Interview not found." }, { status: 404 });
      }
      return NextResponse.json({ success: true, session: sessionForClient(row) });
    }

    const job = await loadOwnedJob(
      supabase,
      user.id,
      searchParams.get("jobId"),
      "id, organization, designation"
    );
    if (!job) {
      return NextResponse.json({ success: false, message: "Job not found." }, { status: 404 });
    }

    const [candidate, allowance, attemptsResult] = await Promise.all([
      getCandidateContext(supabase, user.id),
      getInterviewAllowance(supabase, user.id),
      // Every attempt, finished or not: each one counts towards the limit,
      // and an unfinished one with answers can still be scored from here.
      supabase
        .from("mock_interviews")
        .select("id, status, overall_score, experience_years, answers, created_at, completed_at")
        .eq("user_id", user.id)
        .eq("job_id", job.id)
        .order("created_at", { ascending: false }),
    ]);
    // The lobby still opens on a database without the table; starting is
    // where the missing migration gets reported.
    if (attemptsResult.error) {
      console.error("Could not read mock interviews:", attemptsResult.error.message);
    }

    return NextResponse.json({
      success: true,
      job,
      candidate: {
        firstName: candidate.firstName,
        title: candidate.title,
        experienceYears: candidate.experienceYears,
      },
      attempts: (attemptsResult.data || []).map((row) => ({
        id: row.id,
        status: row.status,
        overallScore: row.overall_score,
        experienceYears: row.experience_years,
        answeredCount: Array.isArray(row.answers) ? row.answers.length : 0,
        createdAt: row.created_at,
        completedAt: row.completed_at,
      })),
      // A paid plan counts attempts per job. The free trial has one interview
      // for the whole account, so one used on another job shows as used here.
      trial: allowance.trial,
      attemptLimit: allowance.mockLimit,
      attemptsUsed: allowance.trial
        ? Math.max(
            (attemptsResult.data || []).length,
            Math.min(allowance.mockLimit, await trialMockInterviewsUsed(supabase, user.id))
          )
        : (attemptsResult.data || []).length,
      sections: MOCK_SECTIONS.map(({ name, count }) => ({ name, count })),
      questionCount: MOCK_QUESTION_COUNT,
      interviewer: INTERVIEWER_NAME,
      voice: INTERVIEW_VOICE_MODE,
      transcription: INTERVIEW_TRANSCRIPTION_MODE,
      // Picks the accent for the browser's recognizer; null without a
      // hosting edge, where the page falls back to the device's time zone.
      country: getRequestCountry(req),
    });
  } catch (error) {
    console.error("Mock interview lookup failed:", error);
    return NextResponse.json(
      { success: false, message: "Couldn't load your mock interview." },
      { status: 500 }
    );
  }
}

/**
 * Starts a mock interview: writes this attempt's questions, pitched at the
 * candidate's experience (or the level they picked in the lobby), and stores
 * them with the interviewer's script. Each job allows MOCK_ATTEMPTS_PER_JOB.
 */
export async function POST(req) {
  try {
    const auth = await authorizeInterviewRequest(req);
    if (auth.response) return auth.response;
    const { user, supabase } = auth;

    const body = await req.json().catch(() => ({}));
    const job = await loadOwnedJob(supabase, user.id, String(body?.jobId || ""));
    if (!job) {
      return NextResponse.json({ success: false, message: "Job not found." }, { status: 404 });
    }
    if (!hasKeywordData(job)) return keywordDataMissing();

    // Checked before any model call, so a job that is out of attempts costs
    // nothing. The earlier attempts' questions also go to the model as ones
    // not to repeat: a retake should feel like a new interview.
    const { data: previous, error: previousError } = await supabase
      .from("mock_interviews")
      .select("questions")
      .eq("user_id", user.id)
      .eq("job_id", job.id)
      .order("created_at", { ascending: false });
    if (previousError) {
      if (isMissingSchemaError(previousError)) return interviewSetupMissing();
      throw previousError;
    }
    const allowance = await getInterviewAllowance(supabase, user.id);
    if (!allowance.allowed) return interviewUpgradeRequired();
    const used = allowance.trial
      ? await trialMockInterviewsUsed(supabase, user.id)
      : (previous || []).length;
    if (used >= allowance.mockLimit) return attemptLimitReached(allowance.trial);
    const previousQuestions = (previous || [])
      .flatMap((row) => (Array.isArray(row.questions) ? row.questions : []))
      .map((question) => String(question?.question || ""))
      .filter(Boolean);

    const recentCalls = await countModelCalls(supabase, user.id, ["mock_interview_questions"], 60);
    if (recentCalls >= HOURLY_MODEL_CALL_LIMITS.mockInterviewQuestions) {
      return NextResponse.json(
        { success: false, message: TOO_MANY_MODEL_CALLS_MESSAGE },
        { status: 429 }
      );
    }

    const candidate = await getCandidateContext(supabase, user.id);
    const requestedYears = Number(body?.experienceYears);
    const experienceYears =
      body?.experienceYears !== null &&
      body?.experienceYears !== undefined &&
      body?.experienceYears !== "" &&
      Number.isFinite(requestedYears)
        ? Math.min(50, Math.max(0, Math.round(requestedYears)))
        : candidate.experienceYears;

    const keywords = jobKeywords(job);
    const prompt = buildMockQuestionsPrompt({
      job,
      candidate,
      keywords,
      experienceYears,
      previousQuestions,
    });
    const generate = async () =>
      normalizeMockQuestions(
        parseModelJson(
          await chatCompletion({
            model: LARGE_MODEL,
            system: MOCK_SYSTEM,
            prompt,
            maxTokens: 4000,
            // Warmer than the other calls: two attempts at the same job should
            // not come out word for word the same.
            temperature: 0.8,
            jsonMode: true,
            userId: user.id,
            purpose: "mock_interview_questions",
          })
        )
      );

    let questions = await generate();
    if (questions.length < MOCK_QUESTION_COUNT) questions = await generate();
    if (questions.length < MOCK_QUESTION_COUNT - 2) {
      throw new Error(`Only ${questions.length} interview questions came back.`);
    }

    const script = buildInterviewScript({
      firstName: candidate.firstName,
      designation: job.designation,
      organization: job.organization,
      questions,
      vocabulary: transcriptionVocabulary(keywords, candidate),
    });

    const { data: row, error } = await supabase
      .from("mock_interviews")
      .insert({
        user_id: user.id,
        job_id: job.id,
        status: "in_progress",
        experience_years: experienceYears,
        questions,
        script,
        answers: [],
      })
      .select("*")
      .single();
    if (error) {
      if (isMissingSchemaError(error)) return interviewSetupMissing();
      throw error;
    }

    // The check above can be raced by two starts at once (a double tap, two
    // tabs). Once saved, only the first attempts up to the limit stand (the
    // job's on a paid plan, the account's on the trial); a later one is
    // removed before any voice is paid for.
    let savedQuery = supabase.from("mock_interviews").select("id").eq("user_id", user.id);
    if (!allowance.trial) savedQuery = savedQuery.eq("job_id", job.id);
    const { data: saved } = await savedQuery
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    const standing = (saved || []).slice(0, allowance.mockLimit).map((item) => item.id);
    if (saved && !standing.includes(row.id)) {
      await supabase.from("mock_interviews").delete().eq("id", row.id).eq("user_id", user.id);
      return attemptLimitReached(allowance.trial);
    }

    return NextResponse.json({
      success: true,
      session: sessionForClient(row),
      level: experienceLevel(experienceYears).label,
      trial: allowance.trial,
      voice: INTERVIEW_VOICE_MODE,
      transcription: INTERVIEW_TRANSCRIPTION_MODE,
    });
  } catch (error) {
    console.error("Starting a mock interview failed:", error);
    return NextResponse.json(
      { success: false, message: "Couldn't set up your interview. Please try again." },
      { status: 500 }
    );
  }
}
