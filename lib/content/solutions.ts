import type { ArticleSection } from "./articles";
import { EXAMPLES } from "./examples";
import { FAQ_POOL, pickFaqs, type Faq } from "./faqs";

/**
 * Product / intent landing pages.
 *
 * Every page answers the same eight questions — what it is, who it's for, what
 * problem it solves, how SynCV solves it, how it works, what makes it
 * different, what it does *not* do, and how to try it — but answers them with
 * page-specific content. The `limits` field is required on purpose: a landing
 * page that only lists capabilities overstates the product, and the honest
 * boundary is the most useful thing on several of these pages.
 *
 * There is exactly one page per search intent. "resume tailoring tool",
 * "resume customization tool" and "customize resume for a job" are one intent
 * and share /resume-tailor rather than becoming three near-duplicate pages;
 * the broader "job-specific resume tailoring" query belongs to the homepage. `primaryKeyword`
 * and `alsoTargets` document that split so the next page added can be checked
 * against it.
 */
export type Solution = {
  path: string;
  title: string;
  h1: string;
  description: string;
  primaryKeyword: string;
  /** Other queries this page is the intended answer for. Documents the map and prevents cannibalisation. */
  alsoTargets: string[];
  /** Direct, quotable answer to "what is this". */
  answer: string;
  sections: ArticleSection[];
  /** What the feature explicitly does not do. Rendered, not hidden. */
  limits: string[];
  faqs: Faq[];
  cta: { heading: string; body: string; action: string };
  internalLinks: { label: string; href: string }[];
  /** Whether this page carries the SoftwareApplication entity. Exactly one should. */
  isPrimaryProductPage?: boolean;
};

export const SOLUTIONS = {
  resumeTailor: {
    path: "/resume-tailor",
    title: "Tailor Your Resume to a Job Description in 2 Clicks",
    h1: "Tailor your resume to a job description",
    description:
      "Upload your resume once, paste a job description, and SynCV rewrites it for that job using the experience you already have. Tailor, don't fabricate.",
    // The homepage owns the broad "job-specific resume tailoring" query; this page owns the
    // specific action. Splitting them this way is what stops the two pages
    // competing for the same result.
    primaryKeyword: "tailor resume to job description",
    alsoTargets: [
      "resume tailoring tool",
      "resume customization tool",
      "customize resume for a job",
      "targeted resume",
    ],
    isPrimaryProductPage: true,
    answer:
      "SynCV is a job-specific resume tailor: it reads your resume and a job description together, then produces a version of your resume aimed at that one posting. It reorders bullets, rewrites phrasing and re-leads your summary and skills so the experience the employer cares about appears first. It works only from what is already on your resume — it does not add skills, employers or achievements you have not claimed.",
    sections: [
      {
        heading: "What resume tailoring actually changes",
        body: [
          "Tailoring is a redistribution of attention, not a rewrite of your history. The same roles, the same dates, the same achievements — presented so the parts that matter for one job are the parts a reviewer reads first.",
          "Concretely, four things move:",
        ],
        bullets: [
          "Your professional summary, rewritten around the requirements this posting repeats",
          "Bullet order inside each role, so the relevant work leads",
          "Bullet phrasing, so work you did is described in the posting's vocabulary",
          "Your skills section, re-led with the tools this employer names",
        ],
        example: EXAMPLES.frontend,
      },
      {
        heading: "Who it's for",
        body: [
          "Anyone applying to more than a handful of jobs, and particularly people whose experience spans more than one specialism — where a generic resume has to bury half of what they can do.",
        ],
        bullets: [
          "Applicants sending the same resume everywhere and hearing nothing back",
          "Engineers, analysts and managers whose background spans several specialisms",
          "Career changers who need transferable experience to read as relevant",
          "Anyone who tailors by hand and is losing 30 minutes per application to it",
        ],
      },
      {
        heading: "How it works",
        body: [
          "Two clicks, after a one-time setup. The base resume is stored so you never upload it again.",
        ],
        steps: [
          {
            title: "Upload your resume once",
            detail:
              "PDF or Word. SynCV parses it into structured sections — experience, skills, education — which becomes your base resume. Keep it complete; breadth here is what makes tailoring possible.",
          },
          {
            title: "Paste the job description",
            detail:
              "The full posting. SynCV extracts the requirements that repeat, the tools it names, and the vocabulary the team uses.",
          },
          {
            title: "Review the tailored version",
            detail:
              "You get a resume aimed at that posting, plus a match breakdown showing which requirements your resume addresses and which it doesn't. Edit any line, then export.",
          },
        ],
      },
      {
        heading: "Tailor. Don't fabricate.",
        body: [
          "The default behaviour of a language model asked to make a resume match a posting is to write the missing experience. It reads beautifully and it is not yours, and you find out in the interview.",
          "SynCV is bounded by your uploaded resume. It can promote, reorder, combine and rephrase what is there. It cannot introduce a technology you have not listed, a job you have not held, or a metric you have not recorded. That constraint is the product, not a limitation of it.",
        ],
        example: EXAMPLES.careerChange,
        callout:
          "If a tailored line in your output names something unfamiliar, that is a bug worth reporting — not a feature.",
      },
      {
        heading: "Why not just use a general-purpose chatbot?",
        body: [
          "You can, and for one application it is a reasonable choice. The differences show up at volume and around the guardrails.",
        ],
        bullets: [
          "Your base resume is stored and structured, so applications two through fifty don't start with a re-upload",
          "Output is constrained to your actual experience rather than free to invent a match",
          "You get a match breakdown against the posting, not just a rewritten document",
          "Formatting stays ATS-parseable — single column, standard headings, real text",
          "Every version is saved against the job you applied to",
        ],
      },
    ],
    limits: [
      "It does not decide whether you are qualified for a job, or whether to apply. It shows where your resume and the posting overlap; the judgement is yours.",
      "It does not guarantee interviews, and no tool can. Tailoring affects how clearly your experience reads, which is one factor among many.",
      "It does not guarantee that any applicant tracking system will pass you through. Vendors score differently and employers configure them differently.",
      "It does not add skills, experience or achievements that are not already on your resume.",
      "It does not apply to jobs for you or send anything on your behalf. You review and export the file yourself.",
    ],
    faqs: pickFaqs([
      "whatIsJobSpecificTailor",
      "doesSyncvInvent",
      "multipleJobs",
      "tailoringVsRewriting",
      "canEdit",
      "differentCareers",
      "qualified",
      "guarantee",
      "freeScans",
    ]),
    cta: {
      heading: "Tailor your resume in two clicks",
      body: "Upload your resume, paste the job you're applying to, and see what changes — before you spend an evening doing it by hand.",
      action: "Tailor your resume free",
    },
    internalLinks: [
      { label: "how to tailor your resume to a job description", href: "/resources/how-to-tailor-your-resume-to-a-job-description" },
      { label: "how to tailor a resume without lying", href: "/resources/how-to-tailor-a-resume-without-lying" },
      { label: "check your resume against an ATS", href: "/ats-resume-checker" },
      { label: "analyse a job description", href: "/job-description-analyzer" },
      { label: "tailoring guides by role", href: "/resume-for" },
    ],
  },

  atsChecker: {
    path: "/ats-resume-checker",
    title: "ATS Resume Checker — Match Your Resume to a Job",
    h1: "Check your resume against the job you're applying to",
    description:
      "See how closely your resume matches a specific job description, which requirements it misses, and whether its formatting will parse cleanly in an ATS.",
    primaryKeyword: "ATS resume checker",
    alsoTargets: [
      "resume scanner",
      "ATS resume scanner",
      "resume checker",
      "resume match score",
      "ATS score checker",
    ],
    answer:
      "SynCV's ATS resume checker compares your resume against one job description and reports where they overlap: which requirements your resume addresses, which keywords from the posting are missing, and whether your formatting will survive parsing. The score describes the match between two documents. It is not a verdict on your candidacy, and it is not a number the employer sees.",
    sections: [
      {
        heading: "What the check actually measures",
        body: [
          "A resume has to clear two different bars before a human reads it properly: it has to parse, and it has to look relevant. The check covers both, and they fail for unrelated reasons.",
        ],
        bullets: [
          "Requirement coverage — which of the posting's stated requirements your resume speaks to",
          "Keyword overlap — terms the posting uses that your resume never does",
          "Placement — whether a matched skill appears in your experience or only in a list",
          "Parse safety — columns, headers, tables and images that break extraction",
          "Section structure — whether standard headings are present and detectable",
        ],
      },
      {
        heading: "What the score means, and what it doesn't",
        body: [
          "The score is an estimate of how well your document matches this posting. That is a genuinely useful diagnostic, because it is measurable and you can act on it.",
          "It is not the employer's score. Every ATS vendor computes matching differently and every employer configures theirs differently, so no third-party tool can reproduce the number a specific company sees. Treat a low score as a prompt to check which requirements you've left unaddressed, not as a rejection.",
        ],
        callout:
          "Chasing 100% is the wrong goal. A resume engineered to maximise overlap reads like it was engineered to maximise overlap.",
      },
      {
        heading: "From gaps to a fixed resume",
        body: [
          "The report is only half the job. Most gaps fall into three categories, and two of them are fixable in minutes.",
        ],
        steps: [
          {
            title: "Terms you match but never say",
            detail:
              "The most common gap by a distance. You have done the work; the resume describes it in different words. This is what tailoring fixes.",
          },
          {
            title: "Skills listed but never evidenced",
            detail:
              "A tool that appears only in your skills list and never in a bullet. Move it into the role where you used it.",
          },
          {
            title: "Genuine gaps",
            detail:
              "Requirements you do not meet. Leave these alone — they are information about the fit, not something to paper over.",
          },
        ],
        example: EXAMPLES.dataAnalyst,
      },
      {
        heading: "Who it's for",
        body: [
          "Anyone who has applied to a lot of roles without response and cannot tell whether the problem is the resume, the targeting, or the market. The check separates the first from the other two.",
        ],
      },
    ],
    limits: [
      "The score is SynCV's estimate of how well your resume matches one job description. It is not the score the employer's system produces.",
      "It cannot guarantee that any ATS will pass your resume through.",
      "It does not assess whether you are qualified for the role, or advise you whether to apply.",
      "It reports gaps; it will not close a gap by inventing experience to fill it.",
    ],
    faqs: [
      FAQ_POOL.atsHelp,
      {
        question: "What is a good ATS score?",
        answer:
          "There is no universal threshold, because every vendor scores differently. Use the breakdown rather than the number: if the posting's main requirements are each addressed somewhere in your experience section, the resume is doing its job.",
      },
      {
        question: "Why did my score change when my resume didn't?",
        answer:
          "Because the score is relative to a job description. Scan the same resume against a different posting and you get a different result — which is the entire argument for tailoring per application.",
      },
      FAQ_POOL.whereScans,
      FAQ_POOL.freeScans,
      FAQ_POOL.qualified,
    ],
    cta: {
      heading: "Check your resume against a real posting",
      body: "Paste a job description you're about to apply to and see which of its requirements your resume currently answers.",
      action: "Check your resume free",
    },
    internalLinks: [
      { label: "how to optimise a resume for ATS", href: "/resources/how-to-optimize-a-resume-for-ats" },
      { label: "resume keywords without keyword stuffing", href: "/resources/resume-keywords-without-keyword-stuffing" },
      { label: "tailor the resume after checking it", href: "/resume-tailor" },
    ],
  },

  jdAnalyzer: {
    path: "/job-description-analyzer",
    title: "Job Description Analyzer — What a Posting Really Asks",
    h1: "Work out what a job description is really asking for",
    description:
      "Break a job posting down into the requirements that actually matter, the keywords it screens on, and the parts of your experience worth leading with.",
    primaryKeyword: "job description analyzer",
    alsoTargets: [
      "job description keyword extractor",
      "analyse job description",
      "job posting analysis",
      "resume job description matching",
    ],
    answer:
      "SynCV's job description analyzer reads a posting and separates the requirements that matter from the boilerplate that doesn't. It surfaces the named tools and qualifications, the responsibilities the posting repeats, and the vocabulary the team uses — then shows which of them your resume already addresses. It is the step that tells you what to tailor towards.",
    sections: [
      {
        heading: "Most of a job posting is not a requirement",
        body: [
          "A typical posting is 600 words, of which maybe 60 describe what the employer will actually screen on. The rest is company boilerplate, legal text and aspirational language recycled between roles.",
          "Reading for the real requirements is a learnable skill — repetition and specificity are the two signals — but it is tedious to do carefully for every application, and doing it carelessly is how people end up tailoring towards the wrong things.",
        ],
      },
      {
        heading: "What the analysis surfaces",
        body: ["The output is a structured view of the posting rather than a summary of it."],
        bullets: [
          "Named tools, technologies, platforms and certifications",
          "Responsibilities that appear more than once — the genuine priorities",
          "Scale and seniority signals: team size, budget, volume, scope",
          "The verbs attached to the role: owned, built, migrated, facilitated",
          "Which of these your current resume already addresses, and which it doesn't",
        ],
        example: EXAMPLES.productManager,
      },
      {
        heading: "Reading the output honestly",
        body: [
          "The list of requirements you don't meet is as useful as the list you do. It tells you what the interview will probe, and sometimes it tells you the role is not the one the title suggested.",
          "What the analysis does not do is score you. It describes the posting and compares it to your document — it will not tell you whether to apply, and a gap in the list is information rather than a verdict.",
        ],
      },
      {
        heading: "Who it's for",
        body: [
          "People applying across job families, where the same title means different work at different companies, and anyone who has tailored a resume towards the wrong half of a posting and wants a second read before spending the effort.",
        ],
      },
    ],
    limits: [
      "It analyses the posting as written. A vague posting produces a vague analysis, and no tool can recover requirements the employer left out.",
      "It does not evaluate you against the role or recommend whether to apply.",
      "It does not contact employers, verify postings, or detect fraudulent listings.",
    ],
    faqs: [
      {
        question: "What does a job description analyzer do?",
        answer:
          "It breaks a posting into its checkable parts — named tools, repeated responsibilities, seniority signals and screening vocabulary — so you can see what the employer will actually assess rather than re-reading 600 words of prose per application.",
      },
      {
        question: "How do I find the keywords in a job description?",
        answer:
          "Look for terms that are both specific and repeated: tools, methodologies, credentials and domain nouns. Anything that could appear in any posting in the industry — \"fast-paced,\" \"team player\" — is not a keyword and nobody filters on it.",
      },
      {
        question: "Should I apply if I only match some requirements?",
        answer:
          "That is your call to make, and partial matches get hired routinely. SynCV shows you the overlap; it does not advise on whether to apply, and it will not manufacture a match you don't have.",
      },
      FAQ_POOL.freeScans,
    ],
    cta: {
      heading: "Analyse the posting before you rewrite anything",
      body: "Paste a job description and see the requirements it actually screens on — then tailor towards those.",
      action: "Analyse a job description free",
    },
    internalLinks: [
      { label: "how to tailor your resume to a job description", href: "/resources/how-to-tailor-your-resume-to-a-job-description" },
      { label: "tailor your resume to the posting", href: "/resume-tailor" },
      { label: "check keyword coverage", href: "/ats-resume-checker" },
    ],
  },

  coverLetter: {
    path: "/ai-cover-letter-generator",
    title: "Cover Letter Generator From Your Resume",
    h1: "Generate a cover letter from your actual resume",
    description:
      "A cover letter drafted from the experience on your resume and the requirements in the posting — specific enough to be worth reading, and true enough to defend.",
    primaryKeyword: "cover letter generator",
    alsoTargets: [
      "cover letter writer",
      "cover letter for job application",
    ],
    answer:
      "SynCV generates a cover letter from two inputs: the resume you have uploaded and the job description you are applying to. It picks the two or three pieces of your experience most relevant to that posting and explains them in a few paragraphs. Like the resume tailoring, it is bounded by what your resume says — it will not claim enthusiasm-backed experience you do not have.",
    sections: [
      {
        heading: "Why most generated cover letters are useless",
        body: [
          "The standard output is three paragraphs of fluent nothing: excitement about the company, a restatement of the job title, and a closing that thanks the reader for their time. It is grammatical, it is instant, and it gives a hiring manager no reason to keep reading.",
          "The failure is structural. A model with only the job description to work from can describe the job back to the employer; it has nothing to say about you. A useful letter needs the resume as the source.",
        ],
      },
      {
        heading: "What SynCV writes instead",
        body: [
          "The letter is built around specific overlap between your history and the posting's requirements, which means it says things only you could say.",
        ],
        bullets: [
          "An opening that states which of your experience is relevant and why",
          "Two or three specifics drawn from your actual resume, not restated job duties",
          "The posting's vocabulary where it honestly describes your work",
          "A close that is short and doesn't thank anyone for their time",
        ],
        example: EXAMPLES.summary,
      },
      {
        heading: "Edit it before you send it",
        body: [
          "A generated letter is a draft, and the parts worth adding are the ones the model cannot know: why this company, what you noticed about the product, who you spoke to. Those two sentences do more than the rest of the letter combined.",
          "Read it aloud before sending. Anything that could appear in a letter to a different company should be cut or replaced.",
        ],
        callout:
          "Cover letters are available on the Free and Pro plans. The Smart plan does not include them.",
      },
    ],
    limits: [
      "It writes from your resume and the posting. It does not research the company, and it will not invent a reason you admire them.",
      "It does not claim experience that is not on your resume.",
      "It does not send applications or emails on your behalf.",
      "A generated letter is a first draft. The specifics only you know still have to be added by you.",
    ],
    faqs: [
      {
        question: "Are cover letters still worth writing?",
        answer:
          "It depends on the employer. Many never open them; smaller companies and hiring managers filling their own roles often do. The realistic position: never let it delay the application, and always write one where the posting asks for it.",
      },
      {
        question: "How long should a cover letter be?",
        answer:
          "Three short paragraphs, under 300 words. A letter that restates the resume at length is worse than none — its only job is to connect two or three specifics to what the employer asked for.",
      },
      {
        question: "Will employers know it was AI-generated?",
        answer:
          "There is no reliable detector, but generic letters are recognisable regardless of origin. Specificity is what makes a letter read as genuine, which is why drafting from your real resume matters more than the writing itself.",
      },
      FAQ_POOL.doesSyncvInvent,
      FAQ_POOL.freeScans,
    ],
    cta: {
      heading: "Draft a cover letter from your resume",
      body: "Paste the posting and get a letter built from experience you can actually defend in the interview.",
      action: "Generate a cover letter free",
    },
    internalLinks: [
      { label: "tailor the resume it is attached to", href: "/resume-tailor" },
      { label: "how AI tailors a resume", href: "/resources/how-ai-tailors-a-resume" },
      { label: "analyse the job description first", href: "/job-description-analyzer" },
    ],
  },

  jobTracker: {
    path: "/job-application-tracker",
    title: "Job Application Tracker for Tailored Resumes",
    h1: "Track applications alongside the resume you sent",
    description:
      "Keep every application, the tailored resume you sent, and its match score in one place — so you know which version went where when the call comes.",
    primaryKeyword: "job application tracker",
    alsoTargets: ["job search tracker", "track job applications", "application tracking spreadsheet alternative"],
    answer:
      "SynCV's job tracker records each application together with the tailored resume you sent and the job description you sent it for. Because tailoring produces a different resume per application, the thing a spreadsheet cannot do is tell you which version an employer actually has — which matters the moment somebody calls you about a role you applied to five weeks ago.",
    sections: [
      {
        heading: "The problem with a spreadsheet",
        body: [
          "Most people track applications in a spreadsheet, and for dates and statuses it works fine. It breaks once you start tailoring, because the resume becomes a per-application artefact and the spreadsheet has nowhere to put it.",
          "You end up with a folder of files named resume_final_v3_acme.pdf and no reliable way to know which one you sent. When a recruiter calls about a role from last month, you are reconstructing your own application from memory.",
        ],
      },
      {
        heading: "What gets stored per application",
        body: ["Each entry keeps the full context of the application rather than a row of metadata."],
        bullets: [
          "The job description you applied against",
          "The exact tailored resume version you exported",
          "The match breakdown from that scan",
          "Status and dates as the application moves",
        ],
      },
      {
        heading: "Why it matters at interview stage",
        body: [
          "Interviewers ask about bullets on the resume in front of them. If you have sent five tailored versions, you want the one they are reading — including which achievements you led with and how you phrased them.",
          "It also makes the next application cheaper: a similar role usually starts from a version you already tailored rather than from your base resume.",
        ],
      },
      {
        heading: "Who it's for",
        body: [
          "Anyone running more than a handful of applications at once, particularly across different role types where the tailored versions genuinely diverge.",
        ],
        callout:
          "The job tracker is included on the Free and Pro plans. The Smart plan does not include it.",
      },
    ],
    limits: [
      "It does not apply to jobs for you or submit applications on your behalf.",
      "It does not import applications automatically from job boards or your email.",
      "It does not tell you your odds on any application.",
    ],
    faqs: [
      FAQ_POOL.whereScans,
      {
        question: "Can I see which resume version I sent to a specific company?",
        answer:
          "Yes — that is the main reason the tracker exists. Each application stores the tailored resume you exported for it alongside the job description it was aimed at.",
      },
      {
        question: "Which plans include the job tracker?",
        answer:
          "Free and Pro. The Smart plan is built around fast scanning and resume generation and does not include tracking.",
      },
      FAQ_POOL.multipleJobs,
    ],
    cta: {
      heading: "Keep your applications and their resumes together",
      body: "Every scan you run is saved against the job it was for, with the version you sent.",
      action: "Start tracking free",
    },
    internalLinks: [
      { label: "tailor a resume per application", href: "/resume-tailor" },
      { label: "should you tailor your resume for every job", href: "/resources/should-you-tailor-your-resume-for-every-job" },
    ],
  },
} satisfies Record<string, Solution>;

export const SOLUTION_LIST: Solution[] = Object.values(SOLUTIONS);
