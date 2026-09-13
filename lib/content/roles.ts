import { EXAMPLES, type BeforeAfterExample } from "./examples";
import type { Faq } from "./faqs";

/**
 * The programmatic layer — /resume-for/[role].
 *
 * This is deliberately a content model rather than a template. The renderer
 * cannot produce a page from a role name alone: every guide has to supply its
 * own responsibilities, recruiter signals, section guidance, bullets, mistakes
 * and examples. That constraint is the point. A keyword-substitution template
 * ("Best resume for X") scales to thousands of pages and deserves to rank for
 * none of them; this scales at the rate someone can write genuinely different
 * advice, which is the rate it should scale at.
 *
 * To add a role: write the entry. It appears on /resume-for, in the sitemap and
 * in internal links automatically. Do not add one you cannot fill honestly.
 */
export type RoleGuide = {
  slug: string;
  /** Display name, e.g. "Software Engineer". */
  role: string;
  title: string;
  h1: string;
  description: string;
  primaryKeyword: string;
  updated: string;
  /** One-paragraph direct answer: what tailoring looks like for this role. */
  answer: string;
  intro: string[];
  /** What the job actually involves — used to ground the rest of the page. */
  responsibilities: string[];
  /** What screeners look for first, in this discipline specifically. */
  recruiterSignals: string[];
  sectionsThatMatter: { section: string; guidance: string }[];
  skills: { label: string; items: string[] }[];
  strongBullets: string[];
  mistakes: { mistake: string; instead: string }[];
  examples: BeforeAfterExample[];
  /** How a SynCV run works for this role, concretely. */
  workflow: { title: string; detail: string }[];
  faqs: Faq[];
  /** Article slugs. */
  relatedArticles: string[];
};

export const ROLE_GUIDES: RoleGuide[] = [
  {
    slug: "software-engineer",
    role: "Software Engineer",
    title: "How to Tailor a Software Engineer Resume",
    h1: "How to tailor a software engineer resume",
    description:
      "What engineering hiring managers screen for, which bullets carry weight, and how to re-aim the same resume at a frontend, backend or platform posting.",
    primaryKeyword: "software engineer resume tailoring",
    updated: "2026-09-14",
    answer:
      "Tailoring a software engineer resume comes down to three moves: lead with the part of the stack the posting names, turn duty bullets into bullets about systems you changed and what happened as a result, and make sure any language or tool in your skills list also appears inside a project. Engineering screens are unusually specific — a backend posting and a platform posting want different halves of the same career — so the resume that works for both is usually the one working well for neither.",
    intro: [
      "Engineering resumes fail screening for a predictable reason: they describe the team's product rather than the engineer's work. A reviewer finishes the bullet knowing what the company shipped and not what you built.",
      "The second reason is stack ambiguity. Most engineers with a few years of experience have touched frontend, backend and infrastructure. A generic resume gives all three equal weight, which reads as generalist to every specialist posting you send it to.",
    ],
    responsibilities: [
      "Designing, building and reviewing features across a service or product area",
      "Owning code quality: tests, reviews, refactors, technical debt",
      "Debugging production issues and participating in on-call rotations",
      "Working with product and design to scope and sequence work",
      "Improving performance, reliability and cost of systems you own",
    ],
    recruiterSignals: [
      "The specific stack, named in the experience section rather than only in a skills list",
      "Evidence of ownership — you designed or led something, not just implemented tickets",
      "Scale signals: request volume, data size, team size, user counts",
      "Outcomes with numbers, especially latency, reliability, cost and cycle time",
      "Shipped work with links, where you can share them",
    ],
    sectionsThatMatter: [
      {
        section: "Summary",
        guidance:
          "Three lines: years, the part of the stack this posting is about, and the domain. \"Backend engineer, 6 years, payments and ledger systems in Go\" beats any adjective you could use.",
      },
      {
        section: "Experience",
        guidance:
          "Two to four bullets per role, each naming a system, a change and a result. Reorder per posting so the relevant system is first.",
      },
      {
        section: "Skills",
        guidance:
          "Group by category and lead with the posting's stack. Cut anything you would not want to be interviewed on — a forty-item list reads as noise.",
      },
      {
        section: "Projects",
        guidance:
          "Worth keeping if you are early-career or changing specialism, because it is where you can show the stack a posting wants when your day job doesn't use it. Label it honestly as personal work.",
      },
    ],
    skills: [
      {
        label: "Languages",
        items: ["TypeScript", "Python", "Go", "Java", "C#", "Rust", "SQL"],
      },
      {
        label: "Frameworks and runtimes",
        items: ["React", "Next.js", "Node.js", "Django", "Spring Boot", ".NET"],
      },
      {
        label: "Infrastructure",
        items: ["AWS", "GCP", "Docker", "Kubernetes", "Terraform", "CI/CD pipelines"],
      },
      {
        label: "Data stores",
        items: ["PostgreSQL", "MySQL", "Redis", "DynamoDB", "Elasticsearch", "Kafka"],
      },
    ],
    strongBullets: [
      "Rebuilt the order-import pipeline in Go, cutting nightly processing from 4 hours to 35 minutes for 2M records.",
      "Introduced contract tests across six internal services, reducing integration failures in staging by roughly half over two quarters.",
      "Led the migration of authentication to OAuth 2.0 across three products, coordinating rollout with two other teams and zero downtime.",
      "Cut p95 API latency from 800ms to 240ms by adding query indexes and a Redis cache layer.",
    ],
    mistakes: [
      {
        mistake: "Listing the team's product instead of your contribution",
        instead:
          "Name the component you owned. \"Built the payment retry scheduler\" is checkable; \"worked on the payments platform\" is not.",
      },
      {
        mistake: "A skills list with forty entries and no evidence",
        instead:
          "Keep what you can discuss, and make sure each appears in at least one experience bullet.",
      },
      {
        mistake: "Treating every posting as the same job",
        instead:
          "Reorder bullets so the system closest to the posting's stack leads. A frontend posting should not have to read three infrastructure bullets first.",
      },
      {
        mistake: "Bullets with no result",
        instead:
          "End with what changed — latency, error rate, cost, release cadence. If nothing was measured, describe the technical outcome rather than inventing a number.",
      },
    ],
    examples: [EXAMPLES.frontend, EXAMPLES.backendScale],
    workflow: [
      {
        title: "Upload your full engineering resume once",
        detail:
          "Everything you have shipped, across all three layers of the stack. Completeness is what makes tailoring possible later.",
      },
      {
        title: "Paste the posting you are applying to",
        detail:
          "SynCV pulls out the named stack, the scale words and the responsibilities that repeat.",
      },
      {
        title: "Review what moved",
        detail:
          "The relevant systems lead, the summary names this posting's stack, and the skills section re-leads. Your other work is still there, lower down.",
      },
      {
        title: "Check the proper nouns before exporting",
        detail:
          "Every technology in the output should be one you have used. Anything else is a bug, not a feature.",
      },
    ],
    faqs: [
      {
        question: "Should a software engineer resume be one page or two?",
        answer:
          "One page under about five years of experience, two after that. Two pages is normal for senior engineers and nobody screens you out for it — what gets you screened out is a second page of duties nobody needed.",
      },
      {
        question: "Do I need a GitHub link on my resume?",
        answer:
          "Only if the profile is worth opening. An active profile with real projects helps, particularly for early-career applications. An empty one with three forks is worse than no link.",
      },
      {
        question: "How do I tailor when I've only worked on one product?",
        answer:
          "Tailor at the component level. One product still contains many systems — pick the ones closest to the posting and lead with those, and describe the technical problem rather than the business feature.",
      },
    ],
    relatedArticles: [
      "how-to-tailor-your-resume-to-a-job-description",
      "resume-keywords-without-keyword-stuffing",
      "how-ai-tailors-a-resume",
    ],
  },

  {
    slug: "product-manager",
    role: "Product Manager",
    title: "How to Tailor a Product Manager Resume",
    h1: "How to tailor a product manager resume",
    description:
      "Product roles vary more than the title suggests. How to work out which kind of PM a posting wants, and re-aim your resume at it without overstating ownership.",
    primaryKeyword: "product manager resume tailoring",
    updated: "2026-09-14",
    answer:
      "Tailoring a product manager resume starts with identifying which kind of PM the posting is for — growth, platform, B2B enterprise, consumer — because each screens for a different half of the same skill set. Then replace ownership language with evidence: what you decided, what you shipped, and what moved as a result. PM resumes are the ones most often inflated, so hiring managers read them sceptically and reward specificity.",
    intro: [
      "\"Product manager\" covers jobs with almost nothing in common. A growth PM at a consumer app and a platform PM at an infrastructure company share a title and little else, and both postings will use the words roadmap, stakeholders and metrics.",
      "So the first tailoring decision is diagnostic: what is this team actually hiring for? The answer determines which of your experience leads, and it is usually visible in what the posting measures success by.",
    ],
    responsibilities: [
      "Running discovery — customer interviews, data analysis, competitive review",
      "Defining and sequencing a roadmap with engineering and design",
      "Writing specs, acceptance criteria and launch plans",
      "Defining success metrics and reporting against them after launch",
      "Managing trade-offs and communicating them to stakeholders and leadership",
    ],
    recruiterSignals: [
      "Decisions you made, not features that shipped near you",
      "Evidence of discovery: how you learned what to build, not just what you built",
      "Metrics tied to your work, with an honest description of your contribution",
      "The scope you operated at: team size, surface area, revenue or user reach",
      "Domain familiarity where the posting is in a regulated or technical field",
    ],
    sectionsThatMatter: [
      {
        section: "Summary",
        guidance:
          "State the kind of PM you are, the domain and the scope. \"B2B product manager, 5 years in logistics SaaS, two engineering teams\" places you immediately.",
      },
      {
        section: "Experience",
        guidance:
          "Structure bullets as decision → action → outcome. Skip the ones that only prove you attended the process.",
      },
      {
        section: "Impact / metrics",
        guidance:
          "Attach numbers to work you genuinely influenced, and say what your role was. Claiming a company-wide revenue number for a feature you specced is the fastest way to lose a PM interview.",
      },
      {
        section: "Tools",
        guidance:
          "Worth a short line — analytics, experimentation, prototyping, ticketing. Keep it brief; tools are rarely the deciding factor for PM roles.",
      },
    ],
    skills: [
      {
        label: "Discovery and research",
        items: [
          "Customer interviews",
          "Usability testing",
          "Competitive analysis",
          "Jobs-to-be-done",
        ],
      },
      {
        label: "Delivery",
        items: ["Roadmapping", "Prioritisation frameworks", "Agile / Scrum", "Release planning"],
      },
      {
        label: "Analytics",
        items: ["SQL", "Amplitude", "Mixpanel", "Google Analytics", "A/B testing"],
      },
      {
        label: "Tooling",
        items: ["Jira", "Linear", "Figma", "Notion", "Confluence"],
      },
    ],
    strongBullets: [
      "Ran fortnightly discovery interviews with 8–10 customers and used the findings to prioritise a quarterly roadmap with engineering leads, sequencing 14 shipped features.",
      "Killed a planned integration after discovery showed only 4% of surveyed accounts would use it, redirecting a quarter of engineering capacity to billing improvements.",
      "Defined activation metrics for a new onboarding flow and ran three A/B tests, lifting week-one activation from 31% to 44%.",
      "Wrote the specification and rollout plan for a permissions rebuild across three products, coordinating a phased migration for 1,200 enterprise accounts.",
    ],
    mistakes: [
      {
        mistake: "Claiming ownership of outcomes you influenced",
        instead:
          "Say what you did and what followed. \"Specced and prioritised X; the team shipped it and activation rose 13 points\" is both honest and stronger than an unqualified claim.",
      },
      {
        mistake: "Process bullets that prove attendance",
        instead:
          "\"Ran sprint ceremonies\" describes a calendar. Replace it with a decision you made and its consequence.",
      },
      {
        mistake: "Ignoring which kind of PM the posting wants",
        instead:
          "Read what the posting measures. Growth postings talk in funnel metrics; platform postings talk in adoption and reliability. Lead with the matching half of your experience.",
      },
      {
        mistake: "Metrics with no baseline",
        instead:
          "\"Increased conversion 40%\" is unreadable without a starting point. Give both numbers or describe the change qualitatively.",
      },
    ],
    examples: [EXAMPLES.productManager, EXAMPLES.summary],
    workflow: [
      {
        title: "Keep one base resume with every product you have worked on",
        detail:
          "Including the ones you would not lead with. Breadth in the base resume is what gives tailoring something to select from.",
      },
      {
        title: "Paste the posting",
        detail:
          "SynCV surfaces the responsibilities that repeat and the vocabulary the team uses for them.",
      },
      {
        title: "Check which experience moved up",
        detail:
          "A growth posting should pull your experimentation work forward; an enterprise posting should pull the stakeholder and migration work forward.",
      },
      {
        title: "Verify the ownership verbs",
        detail:
          "This is where AI rewriting is most likely to promote you. Confirm that led, owned and drove match what you actually did.",
      },
    ],
    faqs: [
      {
        question: "How do I show impact when the metrics were confidential?",
        answer:
          "Use relative figures or ranges — \"cut support contacts by roughly a third\" — or describe the outcome qualitatively. A vague-but-true bullet is fine; an invented precise one is not.",
      },
      {
        question: "Do I need technical experience on a PM resume?",
        answer:
          "Only to the degree the posting asks for it. Platform and developer-tool roles screen on it; consumer roles usually screen on discovery and metrics. Tailoring here means leading with whichever you have when it is the one being asked for.",
      },
      {
        question: "Should I include failed products?",
        answer:
          "Yes, if you can say what you learned and what you did about it. A bullet about killing a feature after discovery is one of the strongest PM signals available, and almost nobody includes one.",
      },
    ],
    relatedArticles: [
      "how-to-tailor-your-resume-to-a-job-description",
      "how-to-tailor-a-resume-without-lying",
      "should-you-tailor-your-resume-for-every-job",
    ],
  },

  {
    slug: "data-analyst",
    role: "Data Analyst",
    title: "How to Tailor a Data Analyst Resume",
    h1: "How to tailor a data analyst resume",
    description:
      "Analyst postings screen on stack, domain and whether your analysis changed anything. How to lead with the right one for each job description.",
    primaryKeyword: "data analyst resume tailoring",
    updated: "2026-09-14",
    answer:
      "A data analyst resume is tailored along three axes: the stack the posting names (SQL dialect, BI tool, Python or R), the business domain it sits in (marketing, finance, operations, product), and evidence that your analysis led to a decision. Most analyst resumes describe outputs — dashboards built, reports delivered — when the thing being screened for is what somebody did differently as a result.",
    intro: [
      "Analyst hiring has an unusually literal screen: the posting names a BI tool and a database, and the reviewer looks for those words attached to real work. Getting them into your experience section rather than a skills list is most of the battle.",
      "The subtler screen is business context. An analyst who understands marketing attribution and one who understands supply chain forecasting are not interchangeable, and the posting will tell you which it needs.",
    ],
    responsibilities: [
      "Writing and maintaining SQL against warehouse and production data",
      "Building and maintaining dashboards for specific teams",
      "Defining metrics and keeping their definitions consistent across reports",
      "Ad-hoc analysis to answer questions from business stakeholders",
      "Data quality investigation and validation",
    ],
    recruiterSignals: [
      "SQL depth, shown through the kind of work rather than a skills-list mention",
      "The named BI tool: Tableau, Power BI, Looker, Metabase",
      "Business domain familiarity matching the team you would join",
      "Analysis that changed a decision, not just analysis that was delivered",
      "Any pipeline or modelling work — dbt, Airflow, warehouse modelling",
    ],
    sectionsThatMatter: [
      {
        section: "Summary",
        guidance:
          "Name the stack and the domain in one line: \"Analyst, 4 years, SQL and Power BI, marketing and campaign analytics.\" This is the single most-read line on an analyst resume.",
      },
      {
        section: "Experience",
        guidance:
          "Each bullet should name the data, the tool and the decision. Reorder per posting so the matching domain leads.",
      },
      {
        section: "Technical skills",
        guidance:
          "Split databases, BI tools and languages. Lead with what the posting names. Avoid listing Excel alongside Spark as though they are comparable claims.",
      },
      {
        section: "Projects",
        guidance:
          "Useful for career changers and juniors. Describe the question you were answering, not the dataset you downloaded.",
      },
    ],
    skills: [
      {
        label: "Querying and modelling",
        items: ["SQL", "dbt", "Window functions", "Dimensional modelling"],
      },
      {
        label: "BI and visualisation",
        items: ["Power BI", "Tableau", "Looker", "Metabase", "Google Data Studio"],
      },
      {
        label: "Languages and libraries",
        items: ["Python", "pandas", "R", "NumPy"],
      },
      {
        label: "Warehouses",
        items: ["Snowflake", "BigQuery", "Redshift", "PostgreSQL"],
      },
    ],
    strongBullets: [
      "Built weekly SQL-backed Power BI dashboards for the marketing team, tracking campaign spend and lead quality across five channels.",
      "Rebuilt the churn definition after finding three teams measuring it differently, aligning reporting across sales, success and finance.",
      "Analysed 18 months of delivery data to identify two routes responsible for 40% of late shipments, informing a carrier renegotiation.",
      "Automated a monthly reconciliation previously done by hand in Excel, saving about two days of analyst time per month.",
    ],
    mistakes: [
      {
        mistake: "Counting dashboards instead of decisions",
        instead:
          "\"Built 30 dashboards\" says you were busy. Say what one of them changed.",
      },
      {
        mistake: "Listing every tool ever opened",
        instead:
          "Keep the ones you would be comfortable being tested on, and lead with the posting's.",
      },
      {
        mistake: "Hiding the business domain",
        instead:
          "Name the team you supported. Domain familiarity is a genuine differentiator and costs you nothing to state.",
      },
      {
        mistake: "Vague data scale",
        instead:
          "Row counts, time ranges and channel counts give a reviewer a sense of the work. \"Large datasets\" does not.",
      },
    ],
    examples: [EXAMPLES.dataAnalyst, EXAMPLES.summary],
    workflow: [
      {
        title: "Upload a base resume covering every domain you have supported",
        detail:
          "Marketing, finance, operations, product — all of it, even where a single role spanned several.",
      },
      {
        title: "Paste the analyst posting",
        detail: "SynCV extracts the named BI tool, database and business area.",
      },
      {
        title: "Confirm the right domain leads",
        detail:
          "A marketing analytics posting should surface your campaign work first, even if it was not your most recent project.",
      },
      {
        title: "Check the tool names are yours",
        detail:
          "If the posting says Looker and you have used Tableau, the tailored resume should still say Tableau.",
      },
    ],
    faqs: [
      {
        question: "How do I tailor if my experience is in a different industry?",
        answer:
          "Lead with the analytical work itself — the questions, the methods, the scale — and name your industry plainly rather than obscuring it. Method transfers across domains more readily than most applicants assume, but pretending the domain matches does not survive an interview.",
      },
      {
        question: "Should I include a portfolio?",
        answer:
          "For junior roles, yes — it is often the only evidence available. Link two or three analyses with a stated question and conclusion, not a gallery of charts.",
      },
      {
        question: "Is Excel worth listing?",
        answer:
          "Only if the posting asks for it, in which case it matters a great deal. In a SQL-and-BI posting it reads as filler next to your real stack.",
      },
    ],
    relatedArticles: [
      "resume-keywords-without-keyword-stuffing",
      "how-to-tailor-your-resume-to-a-job-description",
      "how-to-optimize-a-resume-for-ats",
    ],
  },

  {
    slug: "project-manager",
    role: "Project Manager",
    title: "How to Tailor a Project Manager Resume",
    h1: "How to tailor a project manager resume",
    description:
      "Project management resumes read alike because the vocabulary is shared. How to show scope, method and delivery in terms one specific employer screens for.",
    primaryKeyword: "project manager resume tailoring",
    updated: "2026-09-14",
    answer:
      "Project manager resumes suffer from shared vocabulary: everyone managed scope, timelines, budgets and stakeholders, so those words separate nobody. Tailoring means replacing them with the three things that do differ — the scale you ran (budget, headcount, duration), the methodology the employer uses, and the domain the projects sat in — and leading with whichever the posting emphasises.",
    intro: [
      "Read five project manager resumes and they converge on the same sentences. It is not laziness; the discipline genuinely shares a vocabulary, and that vocabulary is what the posting uses too.",
      "The consequence is that generic PM language matches every posting weakly. What separates candidates is scale, method and domain — all of which are concrete, and all of which most resumes state vaguely or not at all.",
    ],
    responsibilities: [
      "Planning scope, schedule and resourcing across a project or programme",
      "Running delivery governance: status reporting, steering committees, escalation",
      "Managing risks, issues and dependencies across teams and vendors",
      "Budget tracking and forecasting",
      "Coordinating change management and go-live for delivered work",
    ],
    recruiterSignals: [
      "Concrete scale: budget size, team size, project duration, number of workstreams",
      "The methodology in use — Agile, waterfall, hybrid, SAFe — matched to the employer's",
      "Domain: construction, IT, pharma and financial services are not interchangeable",
      "Certifications where the posting asks for them: PMP, PRINCE2, CSM",
      "Delivery outcomes: on time, to budget, and what happened when they weren't",
    ],
    sectionsThatMatter: [
      {
        section: "Summary",
        guidance:
          "Scale, method and domain in one line: \"Project manager, 8 years, IT infrastructure programmes up to £4M across hybrid delivery.\" This is the line that separates you from the other applicants.",
      },
      {
        section: "Experience",
        guidance:
          "Lead each role with its largest or most relevant project, with the numbers attached. Reorder per posting by domain match.",
      },
      {
        section: "Certifications",
        guidance:
          "Give them their own section when the posting names one. Buried in education, a PMP can be missed by both the parser and the reader.",
      },
      {
        section: "Methodology",
        guidance:
          "State which frameworks you have actually delivered under. An employer running SAFe cares whether you have, and a one-line mention answers it.",
      },
    ],
    skills: [
      {
        label: "Delivery methods",
        items: ["Agile", "Scrum", "Waterfall", "Hybrid delivery", "SAFe", "Kanban"],
      },
      {
        label: "Governance",
        items: [
          "Risk and issue management",
          "Dependency management",
          "Steering committee reporting",
          "Change control",
        ],
      },
      {
        label: "Tools",
        items: ["MS Project", "Jira", "Smartsheet", "Asana", "Confluence"],
      },
      {
        label: "Commercial",
        items: ["Budget forecasting", "Vendor management", "Statement of work scoping"],
      },
    ],
    strongBullets: [
      "Delivered a £3.2M warehouse management rollout across 11 sites in 14 months, coordinating three vendors and an internal team of 18.",
      "Recovered a programme running nine weeks late by re-sequencing two workstreams and renegotiating vendor scope, landing go-live within the original quarter.",
      "Ran governance for a 40-person hybrid delivery, reporting fortnightly to a steering committee of six directors.",
      "Managed the dependency map across four concurrent workstreams, cutting cross-team blocked time from roughly 15% to 5% of sprint capacity.",
    ],
    mistakes: [
      {
        mistake: "Listing responsibilities every PM shares",
        instead:
          "\"Managed scope, schedule and budget\" is the job description, not your record. Attach the numbers that make it yours.",
      },
      {
        mistake: "Omitting project scale",
        instead:
          "Budget, headcount and duration for each significant project. Without them a reviewer cannot place your seniority.",
      },
      {
        mistake: "Hiding the methodology",
        instead:
          "Say which frameworks you have delivered under. It is frequently a hard filter, and silence reads as inexperience.",
      },
      {
        mistake: "Only listing successes",
        instead:
          "A recovered project is a strong signal. Describe what went wrong, what you changed, and where it landed.",
      },
    ],
    examples: [EXAMPLES.summary, EXAMPLES.careerChange],
    workflow: [
      {
        title: "Build a base resume with every project and its numbers",
        detail:
          "Budget, duration, team size and domain for each. Most tailoring for this role is selecting the right project to lead with.",
      },
      {
        title: "Paste the posting",
        detail:
          "SynCV picks up the methodology, the domain and the scale language the employer uses.",
      },
      {
        title: "Check the lead project matches",
        detail:
          "A construction programme posting should surface your construction work first, even if your most recent project was IT.",
      },
      {
        title: "Confirm certifications are visible",
        detail:
          "If the posting names PMP or PRINCE2 and you hold it, it belongs in the top third of page one.",
      },
    ],
    faqs: [
      {
        question: "Do I need a PMP to be shortlisted?",
        answer:
          "It depends entirely on the employer. Some treat it as a hard requirement and filter on it; many weigh delivery record more heavily. Where a posting names it and you hold it, make it impossible to miss.",
      },
      {
        question: "How do I tailor between Agile and waterfall employers?",
        answer:
          "Lead with projects delivered under the matching method and use that method's vocabulary. Most experienced PMs have run both, and the resume that mentions neither reads as a mismatch for both.",
      },
      {
        question: "Should I list every project I have managed?",
        answer:
          "Keep them all in your base resume, then lead with three to five relevant ones per application. A twenty-project list buries the two that matter to this employer.",
      },
    ],
    relatedArticles: [
      "should-you-tailor-your-resume-for-every-job",
      "how-to-tailor-your-resume-to-a-job-description",
      "resume-tailoring-vs-resume-optimization",
    ],
  },
];

export const ROLE_BY_SLUG: Record<string, RoleGuide> = Object.fromEntries(
  ROLE_GUIDES.map((role) => [role.slug, role])
);

export const getRoleGuide = (slug: string): RoleGuide | undefined => ROLE_BY_SLUG[slug];
