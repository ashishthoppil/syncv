import { FREE_PLAN_SCAN_LIMIT, PLAN_BY_KEY, formatScanCount } from "@/lib/subscription-plans";

export type Faq = { question: string; answer: string };

/**
 * A shared pool so the same question is answered identically everywhere it
 * appears. Pages pick the subset that matches their intent via `pickFaqs`.
 *
 * Answers are written to be quotable on their own, because that is the unit an
 * AI answer engine extracts — and to stay inside what SynCV actually does. Note
 * what several of them explicitly decline to promise.
 */
export const FAQ_POOL = {
  whatIsResumeTailoring: {
    question: "What is resume tailoring?",
    answer:
      "Resume tailoring is editing an existing resume so that the experience most relevant to one specific job appears first, in the words that job posting uses. Nothing is added: the same roles, dates and achievements stay on the page, but the emphasis, ordering and phrasing change to match what the employer asked for.",
  },
  whatIsJobSpecificTailor: {
    question: "What is job-specific resume tailoring?",
    answer:
      "Job-specific resume tailoring reads your resume and a job description together, works out which of your existing experience matters most for that role, and rewrites the resume to lead with it. SynCV does this in two clicks: upload your resume once, paste a job description, and get a version aimed at that posting.",
  },
  doesSyncvInvent: {
    question: "Does SynCV invent experience or skills?",
    answer:
      "No. SynCV only works with what is already on your resume. It reorders sections, rewrites bullet points and changes emphasis so your real experience reads as relevant to a specific job. It will not add a technology you have never used or a job you have never held — that is the difference between tailoring and fabricating, and it is a line the product does not cross.",
  },
  freeScans: {
    question: "How many free scans do I get?",
    answer: `Every account includes ${formatScanCount(FREE_PLAN_SCAN_LIMIT, "free resume")} to start, with no card required; it does not refill. Paid plans refill scans every week, whether you pay weekly, monthly, quarterly or yearly — Smart includes ${PLAN_BY_KEY.smart.weeklyScanLimit} per week and Pro includes ${PLAN_BY_KEY.pro.weeklyScanLimit} per week.`,
  },
  multipleJobs: {
    question: "Can I tailor the same resume to multiple jobs?",
    answer:
      "Yes, and that is the intended workflow. You keep one base resume in SynCV and generate a separate tailored version for each job description you apply to. Your base resume stays untouched, so every new application starts from the same complete record of your experience.",
  },
  tailoringVsRewriting: {
    question: "How is resume tailoring different from resume rewriting?",
    answer:
      "Rewriting changes how your whole resume reads, once, for every application. Tailoring changes which parts of it are prominent, each time you apply. A rewrite improves the document; tailoring aims it at one posting. SynCV does the second, which is why you run it per job rather than once.",
  },
  atsHelp: {
    question: "Does tailoring a resume help with ATS?",
    answer:
      "It helps, because most applicant tracking systems rank or filter on how closely a resume's wording matches the job description. If you describe the same work in the words the posting uses, you score better on that comparison. No tool can guarantee an ATS will pass you through, and SynCV does not claim to — a recruiter still reads the result.",
  },
  canEdit: {
    question: "Can I edit the tailored resume before downloading it?",
    answer:
      "Yes. Every tailored resume opens in an editor where you can change any line, then re-check the match score before downloading. Nothing is sent anywhere on your behalf — you review and export the file yourself.",
  },
  differentCareers: {
    question: "Can I use SynCV if I am changing careers?",
    answer:
      "Yes, and that is where tailoring does the most work. SynCV surfaces the transferable parts of your current experience in the vocabulary of the role you are targeting. It cannot give you experience you do not have, so a career change still depends on you having genuinely relevant work to point at.",
  },
  guarantee: {
    question: "Does SynCV guarantee interviews?",
    answer:
      "No. SynCV improves how clearly your relevant experience comes across for a specific job, which is one factor among many in a hiring decision. Anyone promising guaranteed interviews or guaranteed ATS approval is selling something they cannot control.",
  },
  qualified: {
    question: "Does SynCV tell me whether I am qualified for a job?",
    answer:
      "No. SynCV compares your resume to a job description and shows where the two overlap and where they do not. Deciding whether you are a fit — and whether to apply — is yours to make. The match score describes your document, not your candidacy.",
  },
  whereScans: {
    question: "Where can I find my previous resume scans?",
    answer:
      "Every scan and the application it belongs to is saved in the Job Tracker, so you can reopen a tailored resume, compare versions, or pick up an application you started earlier.",
  },
  payments: {
    question: "What payment methods do you accept?",
    answer:
      "Payments are processed through Razorpay. We plan to add more providers.",
  },
  refunds: {
    question: "Do you offer refunds?",
    answer:
      `We do not offer refunds. Every account gets ${formatScanCount(FREE_PLAN_SCAN_LIMIT, "free")} before any payment so you can judge the output first, and support will help with anything that does not work as described.`,
  },
  support: {
    question: "How do I contact support?",
    answer:
      "Email info@syncv.app. We usually reply within 24 hours, and it is the fastest route for parsing, scoring or download problems.",
  },
} satisfies Record<string, Faq>;

export type FaqKey = keyof typeof FAQ_POOL;

export const pickFaqs = (keys: FaqKey[]): Faq[] => keys.map((key) => FAQ_POOL[key]);
