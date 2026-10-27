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
      "The skills and keywords engineering screens look for, example achievement bullets, common mistakes, and how to aim one resume at frontend, backend or platform roles.",
    primaryKeyword: "software engineer resume tailoring",
    updated: "2026-10-28",
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
      {
        label: "Practices",
        items: [
          "System design",
          "Code review",
          "Automated testing",
          "Observability",
          "Incident response",
          "Agile delivery",
        ],
      },
    ],
    strongBullets: [
      "Rebuilt the order-import pipeline in Go, cutting nightly processing from 4 hours to 35 minutes for 2M records.",
      "Introduced contract tests across six internal services, reducing integration failures in staging by roughly half over two quarters.",
      "Led the migration of authentication to OAuth 2.0 across three products, coordinating rollout with two other teams and zero downtime.",
      "Cut p95 API latency from 800ms to 240ms by adding query indexes and a Redis cache layer.",
      "Rewrote the on-call runbook and alerting for the checkout service after two repeat incidents; pages for that service fell from about 12 a month to 3.",
      "Shipped the React Native onboarding flow end to end — API, client and analytics events — lifting completed sign-ups from 41% to 52% in an A/B test.",
      "Reduced monthly AWS spend by about $18K by rightsizing EC2 instances and moving nightly batch jobs to spot capacity.",
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
      {
        mistake: "Leaving your level of ownership ambiguous",
        instead:
          "Say whether you designed, led or implemented. All three are fine; when a bullet doesn't say, reviewers assume the smallest.",
      },
      {
        mistake: "Internal names nobody outside your company knows",
        instead:
          "\"Migrated Hermes to Atlas\" means nothing to a reviewer. \"Migrated the internal job scheduler to Kubernetes\" says what the system was and what you did to it.",
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
      {
        question: "Which keywords should a software engineer resume include?",
        answer:
          "The languages, frameworks, cloud platforms and practices the posting names — and only the ones you have used. Put each inside the experience bullet where you used it, not just in the skills list, because that is where a reviewer looks for evidence.",
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
      "The SQL, BI and domain keywords analyst screens look for, example achievement bullets, common mistakes, and how to lead with the right stack for each posting.",
    primaryKeyword: "data analyst resume tailoring",
    updated: "2026-10-28",
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
        items: ["Power BI", "Tableau", "Looker", "Metabase", "Looker Studio"],
      },
      {
        label: "Languages and libraries",
        items: ["Python", "pandas", "R", "NumPy"],
      },
      {
        label: "Warehouses",
        items: ["Snowflake", "BigQuery", "Redshift", "PostgreSQL"],
      },
      {
        label: "Analysis methods",
        items: [
          "A/B testing",
          "Cohort analysis",
          "Regression",
          "Forecasting",
          "Funnel analysis",
          "Metric definition",
        ],
      },
    ],
    strongBullets: [
      "Built weekly SQL-backed Power BI dashboards for the marketing team, tracking campaign spend and lead quality across five channels.",
      "Rebuilt the churn definition after finding three teams measuring it differently, aligning reporting across sales, success and finance.",
      "Analysed 18 months of delivery data to identify two routes responsible for 40% of late shipments, informing a carrier renegotiation.",
      "Automated a monthly reconciliation previously done by hand in Excel, saving about two days of analyst time per month.",
      "Designed and analysed a pricing-page A/B test across 46,000 visitors; the winning variant lifted trial starts by 9% and was rolled out to all traffic.",
      "Modelled order and inventory data in dbt, replacing 14 hand-maintained queries with three tested models used by finance and operations.",
      "Built a cohort retention analysis showing paid-social customers churned twice as fast as search customers, which moved 20% of the next quarter's budget to search.",
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
      {
        mistake: "\"Delivered actionable insights\" with no insight named",
        instead:
          "It is the analyst version of \"hard-working\". Name one finding and what the business did with it.",
      },
      {
        mistake: "Listing methods you can't defend",
        instead:
          "Regression, A/B testing and machine learning on a resume invite questions about them. Include the methods you have applied to real data and can explain your choices for.",
      },
    ],
    examples: [EXAMPLES.dataAnalyst, EXAMPLES.dataAnalystSummary],
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
      {
        question: "What keywords should a data analyst resume include?",
        answer:
          "The query language, BI tool, warehouse and methods the posting names — usually SQL plus one of Tableau, Power BI or Looker, and often Python. Name the business domain as well, such as marketing, finance or product, because many postings screen on it as much as on tools.",
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
  {
    slug: "nurse",
    role: "Registered Nurse",
    title: "Registered Nurse Resume: Skills, Keywords and Examples",
    h1: "How to write and tailor a registered nurse resume",
    description:
      "The licenses, certifications and clinical keywords nurse recruiters screen for, example achievement bullets, common mistakes, and how to tailor for each unit.",
    primaryKeyword: "registered nurse resume",
    updated: "2026-10-28",
    answer:
      "A strong registered nurse resume leads with what nurse recruiters check first: an active license, current certifications such as BLS and ACLS, and experience in the same specialty and unit type as the opening. Tailoring it means re-leading for each posting — an ICU application should see your critical care and ventilator experience first, an emergency department application your triage work and trauma certification — and describing every role by its unit, patient load and acuity rather than by duties every nurse performs.",
    intro: [
      "Nursing resumes have a problem most professions don't: the core duties are the same for every candidate. Every RN assesses patients, administers medications and documents care, so a resume built from those lines gives a recruiter nothing to choose between applicants.",
      "What does differ is specific and checkable — the specialty, the unit, the patient ratio, the acuity, the certifications and the systems you have charted in. Nurse recruiters also screen on credentials before anything else, so where your license and certifications sit on the page matters more than it does in most fields.",
    ],
    responsibilities: [
      "Assessing patients, planning care and recognising when a patient's condition is changing",
      "Administering medications and IV therapy, and monitoring how patients respond",
      "Escalating concerns to physicians and rapid response teams, and acting on new orders",
      "Educating patients and families, especially around discharge, medications and wound care",
      "Documenting assessments and interventions in the electronic health record",
      "Coordinating with physicians, therapists, pharmacists and case managers across a shift",
    ],
    recruiterSignals: [
      "An active RN license, where it is valid, and multistate or compact status if the posting is in another state",
      "Current certifications the posting requires — BLS almost always, ACLS, PALS, NRP or TNCC depending on the unit",
      "Experience in the same specialty and unit type: med-surg, telemetry, ICU, emergency, labor and delivery, pediatrics",
      "Patient load and acuity: how many patients per shift, on what kind of unit, in what size of hospital",
      "Leadership beyond the assignment: charge shifts, precepting, rapid response, unit committees",
      "The EHR you have charted in, when the posting names one",
    ],
    sectionsThatMatter: [
      {
        section: "Licenses and certifications",
        guidance:
          "Give them their own section near the top, with the license type, where it is valid and each certification's expiry date. This is the first thing a nurse recruiter checks, and a credential buried at the bottom of page two can be missed by both the reader and the parser.",
      },
      {
        section: "Summary",
        guidance:
          "Two lines: years of experience, your specialty and unit type, and the certifications the posting asks for. \"RN, 6 years in acute care, the last 2 in a Level II trauma ED; TNCC and ACLS\" tells a recruiter more than any list of qualities.",
      },
      {
        section: "Experience",
        guidance:
          "Open each role with the unit, its size and your usual patient load, then two to four bullets on what you did beyond the baseline. Lead with the role or float experience closest to the unit you are applying to.",
      },
      {
        section: "Clinical rotations",
        guidance:
          "Essential for new graduates and worth keeping for a specialty change. List the unit, the facility and the hours, and put your preceptorship first — it is the closest thing to independent practice on the page.",
      },
    ],
    skills: [
      {
        label: "Licenses and certifications",
        items: ["RN license (state or compact)", "BLS", "ACLS", "PALS", "NRP", "TNCC", "CCRN", "CEN"],
      },
      {
        label: "Clinical skills",
        items: [
          "Patient assessment",
          "Medication administration",
          "IV insertion and therapy",
          "Telemetry monitoring",
          "Wound care",
          "Central line care",
          "Sepsis protocols",
          "Ventilator management",
        ],
      },
      {
        label: "Specialties and settings",
        items: [
          "Medical-surgical",
          "Telemetry and step-down",
          "Intensive care",
          "Emergency department",
          "Labor and delivery",
          "Pediatrics",
          "Oncology",
          "Perioperative",
        ],
      },
      {
        label: "Systems and quality",
        items: [
          "Epic",
          "Oracle Health (Cerner)",
          "MEDITECH",
          "Infection prevention",
          "Falls prevention",
          "Patient and family education",
          "Discharge planning",
        ],
      },
    ],
    strongBullets: [
      "Cared for 4–5 patients per shift on a 32-bed cardiac step-down unit, managing titrated drips, telemetry and post-catheterisation recovery.",
      "Took charge 3–4 shifts a month on a 28-bed med-surg unit, coordinating admissions, discharges and assignments for 6 RNs and 3 nursing assistants.",
      "Precepted 9 new-graduate nurses through a 12-week orientation; all completed it, and 8 were still on the unit a year later.",
      "Introduced hourly rounding for high-fall-risk patients through the unit practice council; reported falls dropped from 11 to 4 over the next two quarters.",
      "Responded as a member of the rapid response team for a 400-bed teaching hospital, averaging 5–6 calls per shift.",
      "Served as an Epic super-user for go-live, training 40 nurses across two units and giving at-the-elbow support for the first two weeks.",
      "Completed a 180-hour emergency department preceptorship, triaging with the Emergency Severity Index and caring for up to 3 patients under supervision.",
    ],
    mistakes: [
      {
        mistake: "Burying your license and certifications",
        instead:
          "Put them in their own section near the top with where the license is valid and when each certification expires. Recruiters check credentials first; make them impossible to miss.",
      },
      {
        mistake: "Bullets that describe every nurse's job",
        instead:
          "\"Administered medications and monitored vital signs\" is true of every applicant. State the unit, the patient load and the acuity, then spend your bullets on what went beyond the assignment: charge shifts, precepting, committees, outcomes.",
      },
      {
        mistake: "Naming the hospital but not the unit",
        instead:
          "\"Registered Nurse, City General Hospital\" says nothing about fit. \"Registered Nurse, 24-bed medical ICU, City General Hospital\" tells an ICU recruiter in one line that you belong in the pile.",
      },
      {
        mistake: "Sending the same resume to every specialty",
        instead:
          "An emergency department and a labor and delivery unit screen for different experience. Lead with the role, rotation or float work closest to the unit you are applying to, and move the rest down.",
      },
      {
        mistake: "Including details that could identify a patient",
        instead:
          "Keep examples aggregate — patient load, unit outcomes, numbers over a quarter. A memorable case is fine to describe in an interview in general terms; it does not belong on a document you send to strangers.",
      },
      {
        mistake: "Leaving clinical rotations off as a new graduate",
        instead:
          "Rotations are your clinical experience. List each with the unit and hours, preceptorship first, before any non-nursing jobs.",
      },
    ],
    examples: [EXAMPLES.nurseCriticalCare, EXAMPLES.nurseSummary],
    workflow: [
      {
        title: "Put every unit, rotation and certification in your base resume",
        detail:
          "Include the unit type, bed count, usual patient load and each certification with its expiry date. SynCV can only bring forward what is already there, so a complete base resume is what makes each application quick.",
      },
      {
        title: "Paste the posting",
        detail:
          "SynCV picks out the specialty, the required certifications and the clinical skills the posting names, grouped as must-have, important and nice to have.",
      },
      {
        title: "Check that your credentials and closest unit lead",
        detail:
          "If the posting requires ACLS or TNCC and you hold it, it belongs in the top third of page one, and the experience nearest to this unit should be the first thing in your work history.",
      },
      {
        title: "Review every change before you download",
        detail:
          "Each rewritten line is shown against your original, to accept or reject. Make sure nothing claims a unit, certification or skill you do not have.",
      },
    ],
    faqs: [
      {
        question: "What certifications should go on a nursing resume?",
        answer:
          "Every current certification the posting asks for, plus any others relevant to the unit, each with its expiry date. BLS is expected almost everywhere; ACLS, PALS, NRP, TNCC, CCRN and CEN matter for the units that use them. Leave off certifications that have lapsed unless you are renewing them and say so.",
      },
      {
        question: "Should I include my nursing license number on my resume?",
        answer:
          "It is optional. What a resume needs is the license type, where it is valid and that it is active. Employers verify licenses with the issuing board either way, and many ask for the number on the application form instead.",
      },
      {
        question: "How do I tailor a nursing resume when changing specialty?",
        answer:
          "Lead with the experience that overlaps with the new specialty — float shifts, rotations, patients you cared for who would also appear on the new unit, and any certifications it uses. Be accurate about where that experience came from; do not present float or rotation work as a home-unit role.",
      },
      {
        question: "How should a new graduate nurse structure their resume?",
        answer:
          "License (or your exam date if you are still waiting), certifications, education, then clinical rotations with units and hours, preceptorship first. Earlier healthcare jobs such as nursing assistant work go after the rotations.",
      },
    ],
    relatedArticles: [
      "how-to-tailor-your-resume-to-a-job-description",
      "how-to-optimize-a-resume-for-ats",
      "resume-keywords-without-keyword-stuffing",
    ],
  },
  {
    slug: "marketing-manager",
    role: "Marketing Manager",
    title: "Marketing Manager Resume: Keywords and Bullet Examples",
    h1: "How to tailor a marketing manager resume to the job",
    description:
      "The channels, tools and metrics marketing hiring managers screen for, example achievement bullets, common mistakes, and how to tailor for brand or growth roles.",
    primaryKeyword: "marketing manager resume",
    updated: "2026-10-28",
    answer:
      "A marketing manager resume is screened on three things: which channels you have run, the numbers you were accountable for, and the size of what you managed. Tailoring it means leading with the channel mix and metrics the posting cares about — a demand generation role wants pipeline and cost per lead first, a brand role wants campaigns, positioning and awareness — and being precise about your share of a result when a whole team moved the number.",
    intro: [
      "Marketing manager is one title covering several different jobs. A growth role at a software company, a brand role at a consumer business and a product marketing role at an enterprise vendor share a title and very little else, and each screens for its own channels and metrics.",
      "Marketing resumes also have an attribution problem. Results are almost always shared with sales, product or an agency, and reviewers know it. The bullets that hold up say what you owned, what you measured and what moved — without claiming the whole revenue line.",
    ],
    responsibilities: [
      "Planning and running campaigns across paid, owned and earned channels",
      "Owning a budget and allocating it across channels and agencies",
      "Setting targets for pipeline, acquisition or awareness, and reporting against them",
      "Positioning and messaging, usually with product and sales",
      "Managing a team, freelancers or agencies",
      "Testing and improving landing pages, creative, audiences and email flows",
    ],
    recruiterSignals: [
      "Channel experience that matches the posting: paid search and social, SEO, lifecycle and email, events, product marketing or brand",
      "Metrics you owned, with numbers: pipeline, MQLs and SQLs, acquisition cost, return on ad spend, conversion, retention",
      "Budget and team size — the clearest seniority signal in marketing",
      "B2B or B2C, and the sales motion behind it: self-serve, sales-led, retail, marketplace",
      "The platforms the team runs on: HubSpot, Salesforce, Marketo, GA4, Google Ads, Meta Ads Manager",
      "Campaigns and launches you led, as distinct from ones you supported",
    ],
    sectionsThatMatter: [
      {
        section: "Summary",
        guidance:
          "Channel, market and scale in one line: \"Marketing manager, 7 years in B2B software demand generation, $1.2M annual paid budget, team of 3.\" That line does more than \"creative and data-driven\" ever will.",
      },
      {
        section: "Experience",
        guidance:
          "Open each role with your scope — budget, channels, team — then the results. Reorder per posting so the channel the role is built around comes first.",
      },
      {
        section: "Skills and platforms",
        guidance:
          "Separate channels from platforms, and lead with the platforms the posting names. A HubSpot team and a Marketo team both want to know which one you have actually run.",
      },
      {
        section: "Portfolio",
        guidance:
          "For brand, content and creative roles, a link to campaign work often decides the shortlist. Make sure it shows your part in the work, not only the agency's.",
      },
    ],
    skills: [
      {
        label: "Channels",
        items: [
          "Paid search",
          "Paid social",
          "SEO",
          "Content marketing",
          "Email and lifecycle",
          "Events",
          "Partnerships",
          "Product marketing",
        ],
      },
      {
        label: "Metrics",
        items: [
          "Pipeline",
          "MQLs and SQLs",
          "Customer acquisition cost",
          "Return on ad spend",
          "Conversion rate",
          "Lifetime value",
          "Retention",
          "Brand awareness",
        ],
      },
      {
        label: "Platforms",
        items: [
          "HubSpot",
          "Salesforce",
          "Marketo",
          "Google Analytics 4",
          "Google Ads",
          "Meta Ads Manager",
          "LinkedIn Campaign Manager",
        ],
      },
      {
        label: "Strategy and management",
        items: [
          "Go-to-market planning",
          "Positioning and messaging",
          "Budget management",
          "Agency management",
          "A/B testing",
          "Marketing attribution",
        ],
      },
    ],
    strongBullets: [
      "Managed a $1.2M annual paid media budget across Google, LinkedIn and Meta, lowering cost per SQL from $410 to $290 over three quarters.",
      "Launched a lifecycle email programme in HubSpot for trial users; trial-to-paid conversion rose from 11% to 15% within two quarters.",
      "Led go-to-market for a new analytics product, coordinating sales enablement, launch content and a six-week paid campaign; marketing-sourced pipeline reached $2.4M in the first quarter.",
      "Rebuilt the site's structure and content plan with an SEO agency; organic sign-ups grew 62% year over year.",
      "Hired and managed a team of 3 marketers and two agencies, introducing a shared campaign calendar and weekly pipeline reviews with sales.",
      "Ran more than 40 landing-page and ad-creative tests in a year, recording each in a test log that became the team's standard.",
      "Repositioned a regional consumer brand for a younger audience; aided awareness in the target group rose from 18% to 27% in the post-campaign survey.",
    ],
    mistakes: [
      {
        mistake: "Claiming the company's growth as your own",
        instead:
          "Reviewers know marketing shares results with sales and product. Say what you owned and what moved — pipeline sourced, cost per lead, conversion on your channel — and say \"contributed to\" where a result was shared.",
      },
      {
        mistake: "Campaigns with no numbers attached",
        instead:
          "\"Ran social campaigns for product launches\" gives a reviewer nothing to compare. Add the budget, reach or conversion figure that was actually measured.",
      },
      {
        mistake: "Leaving out budget and team size",
        instead:
          "They are the clearest seniority signals in marketing. State them for each role, even as a range.",
      },
      {
        mistake: "One resume for brand and growth roles",
        instead:
          "A demand generation posting wants pipeline and acquisition cost in the first bullets; a brand posting wants campaigns, positioning and awareness. Re-lead for each.",
      },
      {
        mistake: "Vanity metrics without context",
        instead:
          "Followers, impressions and open rates matter only when they connect to something the business cared about. Pair them with the outcome, or lead with the outcome instead.",
      },
      {
        mistake: "Platforms listed but never shown",
        instead:
          "Name the platform inside a bullet. \"Built the lead-scoring model in HubSpot\" proves more than HubSpot in a skills list.",
      },
    ],
    examples: [EXAMPLES.marketingPipeline, EXAMPLES.marketingBrand],
    workflow: [
      {
        title: "Keep every channel, budget and result in your base resume",
        detail:
          "Including channels you only ran for a quarter. Tailoring for a role built around a channel you have touched depends on that work being written down somewhere.",
      },
      {
        title: "Paste the posting",
        detail:
          "SynCV picks out the channels, platforms and metrics it names, grouped as must-have, important and nice to have.",
      },
      {
        title: "Check the lead channel and metric",
        detail:
          "A demand generation posting should open on pipeline and cost per lead; a brand posting on campaigns and awareness. The first bullet in each role should match.",
      },
      {
        title: "Review the numbers before you download",
        detail:
          "Accept or reject each change against your original. Any figure that isn't on your base resume is flagged for you to confirm — keep only the ones you can source.",
      },
    ],
    faqs: [
      {
        question: "What metrics should a marketing manager put on a resume?",
        answer:
          "The ones the role is judged on, with numbers you can source: pipeline, SQLs, acquisition cost and conversion for growth roles; reach, engagement and awareness for brand roles; budget and team size for every role. Give the starting figure or the time period, so a reviewer can see the size of the change.",
      },
      {
        question: "How do I show results when the whole team moved the number?",
        answer:
          "Say what you owned and how it contributed — \"ran the paid channel that sourced 40% of pipeline\" rather than \"tripled revenue\". Interviewers will ask, and a precise claim survives the question.",
      },
      {
        question: "Should I include a marketing portfolio?",
        answer:
          "For brand, content and creative roles, yes: a link to two or three campaigns with your role stated can matter more than the resume. For performance roles, a short case study with the numbers does the same job.",
      },
      {
        question: "How do I tailor between B2B and B2C marketing roles?",
        answer:
          "Lead with the experience that matches the buying motion — sales-led pipeline and account-based work for B2B, acquisition, retention and brand for B2C. Name the motion you worked in plainly rather than relabelling it.",
      },
    ],
    relatedArticles: [
      "how-to-tailor-your-resume-to-a-job-description",
      "resume-keywords-without-keyword-stuffing",
      "how-to-tailor-a-resume-without-lying",
    ],
  },
  {
    slug: "accountant",
    role: "Accountant",
    title: "Accountant Resume: Certifications, Skills and Examples",
    h1: "How to tailor an accountant resume for each posting",
    description:
      "The qualifications, software and month-end keywords accounting recruiters screen for, example bullets, common mistakes and how to tailor for each posting.",
    primaryKeyword: "accountant resume",
    updated: "2026-10-28",
    answer:
      "An accountant resume is screened first on qualification and specialism — CPA, ACCA, CA or CMA status, and whether your experience is in general ledger, payables and receivables, tax, audit or financial reporting — and then on the standards and systems you have worked with. Tailoring it means leading with the specialism and standards the posting names, such as US GAAP or IFRS, SOX or a specific ERP, and describing your work by its cycle, volume and accuracy: how fast you closed, how many entities or accounts you handled, and what you fixed.",
    intro: [
      "Accounting postings are unusually precise about what they want. A senior accountant role at a listed company and a staff accountant role at a small firm might share a title, but one screens for SOX controls, consolidation and IFRS, and the other for full-cycle bookkeeping in QuickBooks or Xero.",
      "Because the core vocabulary — reconciliations, journal entries, month-end close — appears on every applicant's resume, those words alone separate nobody. What does is scale, speed, the standards and systems involved, and the problems you fixed along the way.",
    ],
    responsibilities: [
      "Preparing journal entries, accruals and reconciliations through the month-end close",
      "Maintaining the general ledger and chart of accounts",
      "Preparing financial statements and management reports",
      "Supporting internal and external audits",
      "Running accounts payable and receivable, or reviewing the team that does",
      "Preparing tax filings and compliance returns, or supporting the tax team",
    ],
    recruiterSignals: [
      "Qualification status — CPA, ACCA, CA, CIMA or CMA — whether qualified, part-qualified or in progress, stated plainly",
      "A specialism that matches the role: general ledger, payables and receivables, financial reporting, tax, audit or FP&A",
      "The standards you have worked under: US GAAP, IFRS, local GAAP, SOX controls",
      "ERP and accounting systems: SAP, Oracle NetSuite, Microsoft Dynamics 365, QuickBooks, Xero, Sage",
      "Close speed and scale: days to close, number of entities, accounts and transaction volume",
      "Excel depth, where the posting asks for it: lookups, pivot tables, Power Query",
    ],
    sectionsThatMatter: [
      {
        section: "Qualifications",
        guidance:
          "Give professional qualifications their own section near the top, with the year you qualified, or the exams passed if you are part-qualified. A CPA buried under education is easy to miss.",
      },
      {
        section: "Summary",
        guidance:
          "Specialism, years, standards and systems in one line: \"Accountant, 5 years in general ledger and month-end close for multi-entity groups; US GAAP; NetSuite.\"",
      },
      {
        section: "Experience",
        guidance:
          "Open each role with its scope — entities, company size, team — then two to four bullets on what you improved, not only what you processed.",
      },
      {
        section: "Systems",
        guidance:
          "List the ERP and tools you have done real work in, leading with the one the posting names. A system migration you led belongs in experience, not here.",
      },
    ],
    skills: [
      {
        label: "Qualifications and standards",
        items: ["CPA", "ACCA", "CA", "CMA", "US GAAP", "IFRS", "SOX compliance"],
      },
      {
        label: "Core accounting",
        items: [
          "General ledger",
          "Month-end close",
          "Account reconciliations",
          "Accruals and prepayments",
          "Fixed assets",
          "Intercompany and consolidation",
          "Revenue recognition (ASC 606 / IFRS 15)",
        ],
      },
      {
        label: "Systems",
        items: [
          "SAP",
          "Oracle NetSuite",
          "Microsoft Dynamics 365",
          "QuickBooks",
          "Xero",
          "Sage",
          "BlackLine",
        ],
      },
      {
        label: "Reporting and analysis",
        items: [
          "Financial statements",
          "Variance analysis",
          "Budgeting and forecasting",
          "Advanced Excel",
          "Power Query",
          "Audit support",
        ],
      },
    ],
    strongBullets: [
      "Cut the month-end close from 9 working days to 5 by standardising reconciliation templates and moving accruals onto a shared close calendar.",
      "Prepared monthly consolidations for 6 entities in three currencies under IFRS, including intercompany eliminations and FX revaluation.",
      "Reconciled more than 120 balance sheet accounts each month, clearing an $85K backlog of unreconciled items inherited from a previous team.",
      "Led the accounting workstream of a NetSuite migration, mapping the chart of accounts and validating opening balances for 3 entities.",
      "Acted as the main contact for the external audit, preparing the PBC list and supporting schedules; the audit closed with no adjustments for the second year running.",
      "Documented and tested 24 SOX controls over revenue and payables, remediating two deficiencies before year end.",
      "Built a Power Query model to replace a manual vendor-payment reconciliation, saving about 10 hours a month and catching $14K in duplicate invoices.",
    ],
    mistakes: [
      {
        mistake: "Listing tasks every accountant does",
        instead:
          "\"Prepared journal entries and reconciliations\" describes the job, not you. Add the scale — entities, accounts, transactions — and what improved: speed, accuracy, a backlog cleared.",
      },
      {
        mistake: "Being vague about qualification status",
        instead:
          "Write \"CPA, licensed 2021\", \"ACCA, 9 of 13 exams passed\" or \"CMA candidate, exam scheduled\". Recruiters screen on this, and ambiguity reads as overclaiming.",
      },
      {
        mistake: "Leaving out the standards",
        instead:
          "US GAAP and IFRS are not interchangeable for many employers, and SOX experience is often a requirement at listed companies. Name what you have worked under.",
      },
      {
        mistake: "Hiding the ERP",
        instead:
          "Name the system inside a bullet as well as in your skills. Employers running the same ERP often treat it as a strong preference, sometimes a requirement.",
      },
      {
        mistake: "Sharing figures that aren't yours to share",
        instead:
          "Describe scale with ranges and percentages — \"a group with around $40M in revenue\" — rather than an employer's confidential or unreported numbers.",
      },
      {
        mistake: "One resume for audit, tax and industry roles",
        instead:
          "An audit posting wants your client portfolio, sectors and standards; an in-house general ledger role wants close, reconciliations and systems. Lead with the half of your experience the posting is about.",
      },
    ],
    examples: [EXAMPLES.accountantClose, EXAMPLES.accountantSummary],
    workflow: [
      {
        title: "Record every entity, system and standard in your base resume",
        detail:
          "Include close times, account counts and any migrations or audits you led. SynCV can only bring forward what is already there.",
      },
      {
        title: "Paste the posting",
        detail:
          "SynCV picks out the qualifications, standards, systems and specialism the posting names, grouped as must-have, important and nice to have.",
      },
      {
        title: "Check that your specialism and qualification lead",
        detail:
          "A financial reporting role should open on consolidation and standards; a payables-heavy role on volume and controls. Your qualification belongs in the top third either way.",
      },
      {
        title: "Review every change before you download",
        detail:
          "Each rewritten line is shown against your original, to accept or reject. Make sure no standard, system or qualification appears that you don't have.",
      },
    ],
    faqs: [
      {
        question: "Should I put CPA or ACCA on my resume if I'm not fully qualified?",
        answer:
          "Yes, stated precisely: the exams you have passed, the ones remaining, or the date you sit next. Part-qualified status is valuable to many employers, but the letters on their own imply you hold the qualification.",
      },
      {
        question: "What software should an accountant list?",
        answer:
          "The ERP and accounting systems you have done real work in, led by the one the posting names, plus Excel at the level you can demonstrate. Reconciliation and close tools such as BlackLine are worth listing when you have used them.",
      },
      {
        question: "How do I move from audit to an in-house accounting role?",
        answer:
          "Lead with work that maps onto the in-house job: the areas you audited closely, the controls you tested, the client systems you worked in. Describe them in in-house terms — close, reconciliations, reporting — without presenting audit work as though you ran the client's books.",
      },
      {
        question: "How long should an accountant's resume be?",
        answer:
          "One page early in your career, two once you have several roles or a qualification history to show. Either way, the first page should carry your qualification, specialism and most relevant role on its own.",
      },
    ],
    relatedArticles: [
      "how-to-tailor-your-resume-to-a-job-description",
      "how-to-optimize-a-resume-for-ats",
      "resume-tailoring-vs-resume-optimization",
    ],
  },
];

export const ROLE_BY_SLUG: Record<string, RoleGuide> = Object.fromEntries(
  ROLE_GUIDES.map((role) => [role.slug, role])
);

export const getRoleGuide = (slug: string): RoleGuide | undefined => ROLE_BY_SLUG[slug];
