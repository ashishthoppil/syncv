import type { Faq } from "./faqs";
import { EXAMPLES, type BeforeAfterExample } from "./examples";

/**
 * The resource-hub content model.
 *
 * Shape notes that exist to keep quality up rather than to satisfy a renderer:
 *
 * - `answer` is a standalone, quotable paragraph that answers the title
 *   question in full. It is the first thing on the page and the thing an AI
 *   answer engine is most likely to lift, so it must make sense with no
 *   surrounding context.
 * - `sections` require a heading and prose. An article that can't fill them
 *   with something specific shouldn't be published.
 * - `related` and `productLinks` are mandatory, because an orphan article earns
 *   nothing and converts nobody.
 */
export type ArticleSection = {
  heading: string;
  body: string[];
  bullets?: string[];
  /** Ordered steps, rendered as <ol>. */
  steps?: { title: string; detail: string }[];
  example?: BeforeAfterExample;
  callout?: string;
};

export type Article = {
  slug: string;
  /** SERP title, without the brand suffix. */
  title: string;
  h1: string;
  description: string;
  primaryKeyword: string;
  intent: "informational" | "commercial";
  published: string;
  updated: string;
  readingMinutes: number;
  answer: string;
  sections: ArticleSection[];
  faqs: Faq[];
  /** Slugs of other articles. Validated by the SEO test suite. */
  related: string[];
  productLinks: { label: string; href: string }[];
};

export const ARTICLES: Article[] = [
  {
    slug: "how-to-tailor-your-resume-to-a-job-description",
    title: "How to Tailor Your Resume to a Job Description",
    h1: "How to tailor your resume to a job description",
    description:
      "A step-by-step method for matching your resume to one job posting: how to read the job description, what to reorder, what to rewrite, and what to leave alone.",
    primaryKeyword: "how to tailor resume to job description",
    intent: "informational",
    published: "2026-09-14",
    updated: "2026-09-14",
    readingMinutes: 8,
    answer:
      "To tailor a resume to a job description, read the posting for the four or five requirements it repeats, then make sure each one is answered somewhere in the top third of your resume — in the posting's own words, using work you have actually done. In practice that means rewriting your professional summary, reordering your bullet points so the relevant ones come first, and adjusting your skills section to lead with the tools the job names. You are not adding anything; you are deciding what a recruiter sees first.",
    sections: [
      {
        heading: "Start by reading the job description twice",
        body: [
          "The first read tells you whether you want the job. The second read is the one that matters for tailoring, and it has a specific goal: find the requirements the posting cares about most.",
          "Two signals give it away. The first is repetition — anything mentioned in both the summary paragraph and the responsibilities list is a genuine priority, not boilerplate. The second is specificity. \"Strong communication skills\" appears in every posting ever written and tells you nothing. \"Experience presenting roadmap trade-offs to non-technical stakeholders\" is a real requirement someone argued for in a hiring meeting.",
          "Write down the four or five items that pass both tests. That short list, not the full posting, is what you tailor against.",
        ],
        bullets: [
          "Requirements repeated in more than one section of the posting",
          "Named tools, languages, frameworks and platforms",
          "The scale words: team size, budget, user counts, request volume",
          "The verbs attached to the role — owned, built, migrated, facilitated",
          "Anything under a heading like \"you'll be successful if\"",
        ],
      },
      {
        heading: "Fix the top third of the page first",
        body: [
          "Recruiters do not read resumes top to bottom. Screening is closer to a scan for disqualifiers, and it concentrates on what is visible without scrolling: your title line, your summary, and the first two or three bullets of your most recent role.",
          "That is where tailoring pays. If a posting is built around Go and distributed systems and your summary says you are a passionate problem-solver, the scan finds nothing, regardless of what page two contains.",
        ],
        example: EXAMPLES.summary,
      },
      {
        heading: "Reorder before you rewrite",
        body: [
          "The cheapest tailoring move is reordering, and most people skip straight past it to rewriting.",
          "Within each role, your bullets are almost never in priority order — they are in the order you thought of them. Promote the two that speak to the job's top requirements and demote the ones that don't. Do the same with your skills section: lead with the tools this posting names, keep the rest, and drop nothing you genuinely know.",
          "Reordering changes what gets read without changing a single claim, which makes it both the fastest edit and the safest one.",
        ],
      },
      {
        heading: "Rewrite bullets to answer the posting's questions",
        body: [
          "A bullet earns its place by answering something the employer asked. Most generic bullets fail because they describe a job title rather than the work: \"responsible for managing the product roadmap\" tells a hiring manager only that you were a product manager, which they already know from your title.",
          "The rewrite keeps the same underlying fact and adds the detail this employer is screening for — the tool, the scale, the outcome, the audience.",
        ],
        example: EXAMPLES.productManager,
        callout:
          "If a rewrite requires a fact you would not be comfortable being asked about in an interview, it is not tailoring. Cut it.",
      },
      {
        heading: "Match the posting's vocabulary, not its exact string",
        body: [
          "Employers and applicant tracking systems compare your wording to the posting's. If the posting says \"client relationship management\" and your resume says \"account handling,\" a human reviewer will make the connection and a keyword match may not.",
          "So use the posting's term where it honestly describes your work. What you should not do is paste the phrase in somewhere it doesn't belong, or stack synonyms at the bottom of the page. Keyword stuffing is visible to every reader who matters and does not help ranking.",
        ],
      },
      {
        heading: "A repeatable checklist",
        body: [
          "Once you have done this a few times it takes ten minutes per application. The order matters more than the speed.",
        ],
        steps: [
          {
            title: "Extract the top five requirements",
            detail: "From the second read of the posting, using repetition and specificity as your filter.",
          },
          {
            title: "Rewrite the summary",
            detail: "Three lines that state your years, your domain and the two requirements you match best.",
          },
          {
            title: "Reorder bullets inside each role",
            detail: "Relevant first. Nothing deleted, just resequenced.",
          },
          {
            title: "Rewrite the two or three weakest relevant bullets",
            detail: "Add the tool, the scale or the outcome the posting asks about.",
          },
          {
            title: "Re-lead the skills section",
            detail: "The posting's named tools first, in the posting's words where they are accurate.",
          },
          {
            title: "Read it as the hiring manager",
            detail:
              "Can you answer each of the five requirements from the first half of page one? If not, the tailoring is not finished.",
          },
        ],
      },
    ],
    faqs: [
      {
        question: "How long should tailoring a resume take?",
        answer:
          "Manually, about 20–40 minutes for the first few and ten minutes once you have a method. The time goes into reading the posting properly, not into formatting. Tools like SynCV compress the editing part, but the judgement about which experience matters is still yours.",
      },
      {
        question: "Should I change my resume for every single application?",
        answer:
          "For any job you genuinely want, yes. For a high-volume application spree, tailor the summary and skills section at minimum — those two edits carry most of the benefit for a fraction of the effort.",
      },
      {
        question: "What if I do not match some of the requirements?",
        answer:
          "Tailor around what you do match and leave the gap alone. Do not manufacture experience to cover it. Plenty of hires are made against partial matches, and none are made against a claim that collapses in the interview.",
      },
    ],
    related: [
      "should-you-tailor-your-resume-for-every-job",
      "how-to-tailor-a-resume-without-lying",
      "resume-keywords-without-keyword-stuffing",
    ],
    productLinks: [
      { label: "tailor your resume to a job description with SynCV", href: "/resume-tailor" },
      { label: "analyse a job description", href: "/job-description-analyzer" },
    ],
  },

  {
    slug: "should-you-tailor-your-resume-for-every-job",
    title: "Should You Tailor Your Resume for Every Job?",
    h1: "Should you tailor your resume for every job?",
    description:
      "Sending one resume everywhere is faster per application and worse per outcome. Here's when tailoring is worth the time, and the minimum version when it isn't.",
    primaryKeyword: "should you customize your resume for every job",
    intent: "informational",
    published: "2026-09-14",
    updated: "2026-09-14",
    readingMinutes: 6,
    answer:
      "Yes for any job you actually want, and a reduced version for the rest. A single generic resume has to serve every posting at once, so it ends up describing your job titles instead of your fit for one role — which is exactly what a screener is trying to assess. The compromise most people should run: fully tailor applications you care about, and for volume applications edit only the summary and skills section, which carries most of the benefit in about two minutes.",
    sections: [
      {
        heading: "Why one resume for everything underperforms",
        body: [
          "A generic resume is optimised for an average of all jobs, and no employer is hiring for the average. The stronger your background, the more this costs you: a resume covering eight years across three specialisms has to bury two of them to describe all three.",
          "There is a mechanical version of the same problem. Most applicant tracking systems rank applicants by overlap between the resume and the posting. A resume written for nobody in particular overlaps moderately with everything and strongly with nothing.",
        ],
      },
      {
        heading: "The real cost is attention, not honesty",
        body: [
          "Tailoring gets confused with embellishment, and they are unrelated. Tailoring changes which true things are prominent. It is the same instinct that makes you lead with different parts of your background depending on who you meet at a conference — nobody calls that lying.",
          "What changes between applications is order, emphasis and vocabulary. What never changes is the underlying record: same employers, same dates, same achievements.",
        ],
      },
      {
        heading: "When full tailoring is worth it",
        body: ["Spend the full effort when at least two of these are true:"],
        bullets: [
          "You would accept the job today if offered",
          "The posting is specific enough to tell you what they actually want",
          "Your relevant experience is currently below the fold or inside an older role",
          "You are changing industry, function or seniority",
          "The company is small enough that a human reads every application",
        ],
      },
      {
        heading: "The two-minute version for everything else",
        body: [
          "For a long list of similar roles, tailoring every bullet is not a good use of an evening. Two edits do most of the work:",
        ],
        steps: [
          {
            title: "Rewrite the summary for this posting",
            detail:
              "Three lines naming your years, your domain, and the two requirements you match best. This is the single highest-leverage edit on the page.",
          },
          {
            title: "Re-lead the skills section",
            detail:
              "Move the tools this posting names to the front. Keep the rest. Takes thirty seconds and fixes most keyword-match gaps.",
          },
        ],
        callout:
          "Batching helps: group similar postings and tailor once per group, then adjust the summary line per application.",
      },
      {
        heading: "What tailoring cannot fix",
        body: [
          "It will not make you a match for a job you are not a match for, and it should not try. If a posting requires a certification you do not hold, no amount of rewriting closes that gap — and a tool that closes it for you has produced a claim you will have to defend.",
          "Tailoring makes an existing case legible. It does not make a case.",
        ],
      },
    ],
    faqs: [
      {
        question: "Do recruiters notice a tailored resume?",
        answer:
          "They notice the result rather than the technique. A tailored resume reads as though the applicant understood the role, which is a signal recruiters respond to even when they are not consciously tracking why.",
      },
      {
        question: "Is it dishonest to have several versions of my resume?",
        answer:
          "No, provided every version is true. Multiple versions of a resume are as normal as having several versions of a portfolio. The problem would be versions that disagree about facts — different dates, titles or employers.",
      },
      {
        question: "How many versions should I keep?",
        answer:
          "One base resume containing everything, plus a tailored export per application. Keeping the base complete is what makes tailoring fast, because you are always selecting from a full record rather than rewriting from memory.",
      },
    ],
    related: [
      "how-to-tailor-your-resume-to-a-job-description",
      "how-to-tailor-a-resume-without-lying",
      "resume-tailoring-vs-resume-optimization",
    ],
    productLinks: [
      { label: "tailor a resume per application", href: "/resume-tailor" },
      { label: "keep applications in one place", href: "/job-application-tracker" },
    ],
  },

  {
    slug: "how-to-tailor-a-resume-without-lying",
    title: "How to Tailor a Resume Without Lying",
    h1: "How to tailor a resume without lying",
    description:
      "Where tailoring ends and fabrication begins, with concrete examples of rewrites that stay true and rewrites that quietly cross the line.",
    primaryKeyword: "how to tailor resume without lying",
    intent: "informational",
    published: "2026-09-14",
    updated: "2026-09-14",
    readingMinutes: 7,
    answer:
      "Tailoring is honest as long as every statement on the tailored resume would survive being asked about in an interview. The test is practical rather than philosophical: for each rewritten line, ask whether you could talk for two minutes about doing that work. Re-ordering, re-phrasing, adding detail you actually remember and using the employer's vocabulary all pass. Adding a tool you have only read about, inflating scope, or borrowing a teammate's accomplishment do not.",
    sections: [
      {
        heading: "The interview test",
        body: [
          "Every tailored line should be one you would be happy to be questioned on. Interviewers do exactly this — they pick a bullet and ask you to walk through it. A line that was stretched to match a posting is where the conversation stops going well.",
          "It is a better test than trying to define honesty in the abstract, because it is the test you will actually face.",
        ],
      },
      {
        heading: "Four rewrites that are fine",
        body: ["Each of these changes presentation, not substance."],
        bullets: [
          "Naming a tool in a bullet that was already listed in your skills section",
          "Adding a number you know to be true but had left out",
          "Using the employer's term for work you did under a different internal name",
          "Moving a relevant project up from a previous role so it appears on page one",
        ],
        example: EXAMPLES.frontend,
      },
      {
        heading: "Four rewrites that are not",
        body: [
          "These are the ones that appear when someone lets a tool rewrite unsupervised, and they are the reason SynCV works only from what is already on your resume.",
        ],
        bullets: [
          "Adding a technology from the job description that you have not used",
          "Upgrading \"contributed to\" into \"led\" or \"owned\"",
          "Attaching a team result to yourself without saying it was the team's",
          "Inventing a metric because a quantified bullet looks stronger",
        ],
      },
      {
        heading: "The grey area: reframing for a career change",
        body: [
          "Career changers face the hardest version of this, because the honest reframe and the dishonest one use similar language. The distinction is whether the underlying activity actually happened.",
          "The example below reframes support work in retention vocabulary. It works because the candidate genuinely ran adoption check-ins. It stops short of claiming they owned renewals, which they did not.",
        ],
        example: EXAMPLES.careerChange,
      },
      {
        heading: "What to do about a real gap",
        body: [
          "Sometimes the posting asks for something you simply do not have. The useful options are to leave it alone, or to point at the nearest genuine equivalent and let the employer judge the distance.",
          "Applying without a perfect match is normal and frequently successful. Applying with an invented match is a problem that arrives later, in the interview or in a reference check, when it is more expensive.",
        ],
        callout:
          "This is also why SynCV will not tell you whether you are qualified or whether to apply. It shows you where your resume and the posting overlap; the judgement stays with you.",
      },
    ],
    faqs: [
      {
        question: "Is using AI to rewrite my resume dishonest?",
        answer:
          "Not by itself — a tool that improves how you describe real work is no different from an editor. It becomes dishonest when the tool generates claims you cannot support, which is why it matters whether the tool is constrained to your actual resume or free to write whatever matches the posting.",
      },
      {
        question: "Can I list a skill I am currently learning?",
        answer:
          "Yes, if you label it honestly. A \"currently learning\" or \"familiar with\" line is fine; the same skill listed alongside ones you have shipped with is not, because it implies a level you cannot demonstrate.",
      },
      {
        question: "What if my previous employer used unusual job titles?",
        answer:
          "Use the official title and add a plain-language equivalent in brackets or in the role's first line. Replacing the official title outright creates a mismatch with background checks and references.",
      },
    ],
    related: [
      "how-to-tailor-your-resume-to-a-job-description",
      "how-ai-tailors-a-resume",
      "should-you-tailor-your-resume-for-every-job",
    ],
    productLinks: [
      { label: "tailoring that works only from your real experience", href: "/resume-tailor" },
      { label: "how SynCV uses AI", href: "/about" },
    ],
  },

  {
    slug: "how-ai-tailors-a-resume",
    title: "Can AI Tailor Your Resume? What It Should Change",
    h1: "Can AI tailor your resume?",
    description:
      "What AI is genuinely good at when tailoring a resume, where it goes wrong, and the specific changes you should never let it make unsupervised.",
    primaryKeyword: "can ai tailor my resume",
    intent: "informational",
    published: "2026-09-14",
    updated: "2026-09-14",
    readingMinutes: 7,
    answer:
      "Yes — AI is well suited to the mechanical half of tailoring: comparing a resume against a job description, spotting which of your experience is relevant, and rephrasing it in the posting's vocabulary. It is badly suited to deciding what is true about you. A language model asked to make a resume match a posting will invent the missing pieces unless it is constrained to the source resume, which is the single most important thing to check about any AI resume tool.",
    sections: [
      {
        heading: "What AI is genuinely good at here",
        body: [
          "Comparing two documents for overlap is a task models do well and humans do inconsistently, mostly because humans already know what their resume says and read past its gaps.",
        ],
        bullets: [
          "Pulling the real requirements out of a long posting",
          "Noticing that a skill in your skills list never appears in your experience bullets",
          "Rephrasing a true bullet in the posting's vocabulary",
          "Reordering bullets and sections by relevance to one job",
          "Spotting what the posting asks for that your resume never addresses",
        ],
      },
      {
        heading: "Where it goes wrong",
        body: [
          "The failure mode is consistent and worth naming, because it is the default behaviour of an unconstrained model: asked to make a resume match a job description, it closes the gap by writing new experience. It reads well, it matches beautifully, and it is not yours.",
          "The second failure is quieter. Models escalate verbs — \"supported\" becomes \"drove,\" \"contributed to\" becomes \"led\" — because stronger phrasing is statistically more common in polished resumes. Each individual upgrade looks like editing. Collectively they promote you.",
        ],
        callout:
          "A tailored resume you cannot defend is worse than a generic one you can. The interview is where that bill arrives.",
      },
      {
        heading: "How SynCV is constrained",
        body: [
          "SynCV tailors from your uploaded resume and the job description you paste, and its output is bounded by the first of those. It changes which experience leads, how bullets are phrased, and what the summary emphasises. It does not add skills, employers, dates or achievements that are not already in your resume.",
          "It also does not assess you. SynCV reports how well the document matches the posting; it does not decide whether you are qualified, and it does not tell you whether to apply.",
        ],
        example: EXAMPLES.dataAnalyst,
      },
      {
        heading: "How to review AI-tailored output in two minutes",
        body: [
          "Whatever tool you use, read the output with these four checks before you send it. They catch nearly everything.",
        ],
        steps: [
          {
            title: "Check every proper noun",
            detail:
              "Tools, companies, certifications, frameworks. Any name you do not recognise as yours is a fabrication, not a rewrite.",
          },
          {
            title: "Check every number",
            detail: "If you cannot source a percentage or a headcount, delete it rather than defend it.",
          },
          {
            title: "Check the verbs",
            detail: "Anything that promotes you — led, owned, managed — has to match what you actually did.",
          },
          {
            title: "Read it aloud",
            detail:
              "Generated copy has a tell: it is fluent and says nothing. If a bullet could sit on anyone's resume, it is not worth its line.",
          },
        ],
      },
    ],
    faqs: [
      {
        question: "Will an employer know my resume was written with AI?",
        answer:
          "There is no reliable detector, and it is largely the wrong worry. What is noticeable is generic output — fluent bullets with no specifics read as automated regardless of how they were produced. Specific, true detail is what makes a resume read as yours.",
      },
      {
        question: "Is it safe to upload my resume to an AI tool?",
        answer:
          "Check what the tool does with the file. Your resume contains your contact details and full employment history, so the questions worth asking are whether it is stored, whether it is used for model training, and whether you can delete it. SynCV's handling is set out in the privacy policy.",
      },
      {
        question: "Can AI write my resume from scratch?",
        answer:
          "It can produce a document, but not a truthful one, because it has no source for your experience beyond what you tell it. Tailoring an existing resume is a fundamentally different task from generating one, and much safer.",
      },
    ],
    related: [
      "how-to-tailor-a-resume-without-lying",
      "how-to-tailor-your-resume-to-a-job-description",
      "how-to-optimize-a-resume-for-ats",
    ],
    productLinks: [
      { label: "Job-specific resume tailoring bounded by your real experience", href: "/resume-tailor" },
      { label: "see what a job description is really asking for", href: "/job-description-analyzer" },
    ],
  },

  {
    slug: "how-to-optimize-a-resume-for-ats",
    title: "How to Optimize a Resume for ATS",
    h1: "How to optimise a resume for an ATS",
    description:
      "What an applicant tracking system actually does with your resume, which formatting choices break parsing, and how to improve your match without keyword stuffing.",
    primaryKeyword: "how to optimize resume for ats",
    intent: "informational",
    published: "2026-09-14",
    updated: "2026-09-14",
    readingMinutes: 8,
    answer:
      "Optimising for an ATS means two separate things: making the file parse correctly, and making its content match the job description. Parsing is solved by structure — a single-column layout, standard section headings, real text rather than images, and a .pdf or .docx export. Matching is solved by describing your real experience in the words the posting uses. Most advice conflates the two, which is why people reformat endlessly and never fix the wording.",
    sections: [
      {
        heading: "What an ATS actually does",
        body: [
          "An applicant tracking system is mostly a database with a parser bolted on. It ingests your file, tries to split it into fields — name, contact details, employment history, education, skills — and stores the result so a recruiter can search and filter.",
          "The popular image of a robot rejecting resumes is largely wrong. Most systems do not auto-reject; they rank, and a recruiter works down the ranking. That distinction matters, because it means your goal is to be sorted upward and to survive parsing intact, not to defeat a gatekeeper.",
        ],
      },
      {
        heading: "Formatting choices that break parsing",
        body: [
          "Parsers fail on layout, not on content. These are the recurring causes, roughly in order of how often they cause real damage:",
        ],
        bullets: [
          "Multi-column layouts, where a parser reads straight across and interleaves two columns into nonsense",
          "Contact details inside the page header or footer, which some parsers never read",
          "Text baked into an image or a logo — invisible to a parser",
          "Tables used for layout, which scramble reading order",
          "Invented section headings (\"Where I've Made an Impact\" instead of \"Experience\")",
          "Text boxes and sidebars, which are frequently dropped entirely",
        ],
        callout:
          "Quick self-check: open your PDF, select all, copy, and paste into a plain text editor. What you see is roughly what the parser sees. If it is jumbled, the layout is the problem.",
      },
      {
        heading: "Matching: the part that actually moves your ranking",
        body: [
          "Once the file parses, ranking is driven by overlap between your resume and the posting. This is where tailoring and ATS optimisation turn out to be the same activity described in different language.",
          "The practical move is to use the posting's own terms wherever they honestly describe your work, and to make sure any skill in your skills list also appears inside an experience bullet. A skill that appears only in a list is a claim; the same skill attached to a project is evidence, and it reads better to the human too.",
        ],
        example: EXAMPLES.frontend,
      },
      {
        heading: "What not to do",
        body: [
          "Every few years a trick circulates — pasting the whole job description in white text, stacking keywords in a hidden footer, repeating a term twenty times. They range from ineffective to disqualifying. Recruiters see the parsed text, where white-on-white is simply text, and a keyword block with no supporting experience reads as exactly what it is.",
          "There is no version of this where the trick works and nobody notices.",
        ],
      },
      {
        heading: "A sane ATS checklist",
        body: ["Do these once for the file, then re-check the match per application."],
        steps: [
          {
            title: "Single column, standard headings",
            detail: "Experience, Education, Skills. Boring headings parse correctly everywhere.",
          },
          {
            title: "Contact details in the body",
            detail: "Top of page one, in the document body — not in the header or footer.",
          },
          {
            title: "Export as PDF or DOCX",
            detail:
              "Both parse well when the layout is simple. Avoid exotic formats and never send a screenshot.",
          },
          {
            title: "Spell out abbreviations once",
            detail: "\"Search engine optimisation (SEO)\" matches both forms; \"SEO\" alone matches one.",
          },
          {
            title: "Re-check wording against each posting",
            detail:
              "This is the per-application step, and it is the one that changes your ranking.",
          },
        ],
      },
    ],
    faqs: [
      {
        question: "What is a good ATS score?",
        answer:
          "There is no universal score. Every vendor computes matching differently, and scores shown by third-party tools — including SynCV's — are that tool's estimate of overlap between your resume and one posting, not a number the employer sees. Use it to find gaps, not as a target to max out.",
      },
      {
        question: "Do ATS systems reject resumes automatically?",
        answer:
          "Some can be configured with knockout questions, usually on things like work authorisation. Automatic rejection based on resume content is far rarer than the folklore suggests. Ranking, not rejection, is the normal behaviour.",
      },
      {
        question: "Is a PDF or a Word document better for ATS?",
        answer:
          "Both are parsed reliably by every mainstream system today. Structure matters far more than format — a clean PDF beats a multi-column DOCX comfortably. Follow the posting's instruction if it states one.",
      },
    ],
    related: [
      "resume-keywords-without-keyword-stuffing",
      "how-to-tailor-your-resume-to-a-job-description",
      "resume-tailoring-vs-resume-optimization",
    ],
    productLinks: [
      { label: "check your resume against a job description", href: "/ats-resume-checker" },
      { label: "tailor the wording per application", href: "/resume-tailor" },
    ],
  },

  {
    slug: "resume-keywords-without-keyword-stuffing",
    title: "Resume Keywords: How to Use Them Without Keyword Stuffing",
    h1: "Resume keywords without the keyword stuffing",
    description:
      "How to find the keywords that matter in a job posting and place them where they carry evidence — instead of padding a skills list nobody believes.",
    primaryKeyword: "resume keywords",
    intent: "informational",
    published: "2026-09-14",
    updated: "2026-09-14",
    readingMinutes: 6,
    answer:
      "Resume keywords are the specific terms a job posting uses for the skills, tools and responsibilities it is hiring for. They work when they appear inside your experience bullets, attached to something you did, and they stop working the moment they are piled into a list. The rule of thumb: every keyword on your resume should have a sentence somewhere that proves it.",
    sections: [
      {
        heading: "Which words are actually keywords",
        body: [
          "Not everything in a posting counts. Keywords are the concrete, checkable terms — the ones a recruiter could search for and get a meaningful shortlist.",
        ],
        bullets: [
          "Tools and technologies: Kubernetes, Figma, Salesforce, Power BI",
          "Methods and frameworks: agile, double-entry accounting, HACCP, SOC 2",
          "Domain nouns: claims adjudication, supply chain, clinical trials",
          "Credentials: CPA, PMP, RN, AWS Solutions Architect",
          "Named responsibilities: incident response, capacity planning, renewals",
        ],
        callout:
          "\"Team player,\" \"detail-oriented\" and \"results-driven\" are not keywords. Nobody filters for them, and they cost you a line each.",
      },
      {
        heading: "Placement beats frequency",
        body: [
          "One mention inside a real accomplishment outperforms five mentions scattered around the page. This is true for the human reviewer for obvious reasons, and true for keyword matching because most systems weight where a term appears — a skill in your current role counts for more than one in a list at the bottom.",
          "So the question to ask of each keyword is not \"is it on my resume\" but \"does the reader learn what I did with it.\"",
        ],
        example: EXAMPLES.backendScale,
      },
      {
        heading: "The skills section is a summary, not a stash",
        body: [
          "A skills section should be a short index of things proven elsewhere on the page. When it grows past about fifteen items it stops being informative — a list of forty technologies tells a reader you have touched forty things and are expert in none of them.",
          "Cut anything you would not want to be interviewed on. Then reorder what remains so the posting's named tools come first.",
        ],
      },
      {
        heading: "Handling synonyms and abbreviations",
        body: [
          "Employers use different names for the same thing, and exact-match systems do not know they are the same. Spell out an abbreviation on first use and put the short form in brackets, which matches both without repetition.",
          "Where the posting's term honestly describes your work, prefer the posting's term. Where it does not, keep yours — a mismatch you have to explain is better than a match you cannot.",
        ],
      },
    ],
    faqs: [
      {
        question: "How many keywords should a resume have?",
        answer:
          "There is no number worth targeting. Cover the four or five requirements the posting actually repeats and make sure each is evidenced in your experience. Coverage of the important ones beats volume every time.",
      },
      {
        question: "Does keyword stuffing still work on modern ATS?",
        answer:
          "No, and it carries real downside. Recruiters read the parsed text, so hidden or padded keywords are plainly visible, and a term with no supporting experience is a credibility problem rather than a ranking win.",
      },
      {
        question: "Should I copy phrases directly from the job description?",
        answer:
          "Borrow the vocabulary, not the sentences. Using the employer's term for work you did is good practice; pasting their responsibilities list into your experience section is both obvious and untrue.",
      },
    ],
    related: [
      "how-to-optimize-a-resume-for-ats",
      "how-to-tailor-your-resume-to-a-job-description",
      "how-to-tailor-a-resume-without-lying",
    ],
    productLinks: [
      { label: "find the keywords in a job description", href: "/job-description-analyzer" },
      { label: "check keyword coverage against a posting", href: "/ats-resume-checker" },
    ],
  },

  {
    slug: "resume-tailoring-vs-resume-optimization",
    title: "Resume Tailoring vs Resume Optimization",
    h1: "Resume tailoring vs resume optimisation",
    description:
      "Two terms used interchangeably that describe different work. One improves your resume once; the other aims it at a single job. You need both, in order.",
    primaryKeyword: "difference between resume optimization and resume tailoring",
    intent: "informational",
    published: "2026-09-14",
    updated: "2026-09-14",
    readingMinutes: 4,
    answer:
      "Resume optimisation is improving your resume in general — clearer structure, stronger bullets, clean formatting that parses correctly. You do it once and it holds for every application. Resume tailoring is adapting that optimised resume to one specific job description, by changing emphasis, order and wording. Optimisation makes the document good; tailoring makes it relevant. Doing them in that order saves repeating the same fixes on every version.",
    sections: [
      {
        heading: "Optimisation: done once, applies everywhere",
        body: [
          "Optimisation fixes properties of the document that are true regardless of where you send it.",
        ],
        bullets: [
          "A layout that parses correctly: single column, standard headings",
          "Bullets that state outcomes rather than duties",
          "Consistent tense, dates and formatting",
          "No gaps left unexplained, no filler adjectives",
          "Length appropriate to your experience",
        ],
      },
      {
        heading: "Tailoring: done per application",
        body: [
          "Tailoring changes nothing about the underlying record and everything about what is prominent in it.",
        ],
        bullets: [
          "A summary rewritten for this posting's top requirements",
          "Bullets reordered so relevant work appears first",
          "Skills re-led with the tools this employer names",
          "The employer's vocabulary used where it honestly fits",
        ],
      },
      {
        heading: "Why the order matters",
        body: [
          "Tailoring a badly structured resume produces several badly structured resumes. Every weakness you skipped — the header that does not parse, the bullets that list duties — gets copied into each version, and you fix it repeatedly or not at all.",
          "Optimise the base resume until you would be happy sending it cold. Then tailor from it, per job.",
        ],
        callout:
          "This is why SynCV keeps one base resume and generates tailored versions from it, rather than editing a single file in place.",
      },
      {
        heading: "Where ATS checking fits",
        body: [
          "An ATS check spans both. The parsing half is an optimisation problem you solve once. The matching half — how closely your wording tracks the posting — is a tailoring problem you re-solve per application, which is why match scores move when the job description changes and your resume has not.",
        ],
      },
    ],
    faqs: [
      {
        question: "Which should I do first?",
        answer:
          "Optimise, then tailor. Fixing structure and bullet quality once means every tailored version inherits the improvement instead of each needing its own repair.",
      },
      {
        question: "Is resume tailoring the same as resume customisation?",
        answer:
          "Yes — customisation, targeting and tailoring all describe adapting a resume to a specific job. Optimisation is the one that means something different.",
      },
      {
        question: "Do I need both?",
        answer:
          "For a serious search, yes. An optimised generic resume is clear but aimed at nobody. A tailored version of a weak resume is aimed well but still weak.",
      },
    ],
    related: [
      "how-to-optimize-a-resume-for-ats",
      "should-you-tailor-your-resume-for-every-job",
      "how-to-tailor-your-resume-to-a-job-description",
    ],
    productLinks: [
      { label: "tailor a resume to one job description", href: "/resume-tailor" },
      { label: "run an ATS and match check", href: "/ats-resume-checker" },
    ],
  },
];

export const ARTICLES_BY_SLUG: Record<string, Article> = Object.fromEntries(
  ARTICLES.map((article) => [article.slug, article])
);

export const getArticle = (slug: string): Article | undefined => ARTICLES_BY_SLUG[slug];
