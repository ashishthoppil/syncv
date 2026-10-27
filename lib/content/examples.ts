/**
 * Reusable before/after tailoring examples.
 *
 * House rule for every example in this file: the "after" text may only surface
 * information a candidate could reasonably have written in the "before" text.
 * Tools, metrics and responsibilities are made *visible*, never invented. If an
 * example would require the candidate to have done something new, it is wrong
 * and belongs nowhere on this site.
 */
export type BeforeAfterExample = {
  id: string;
  /** The role the job description is for. */
  role: string;
  /** The line from the job description that drives the rewrite. */
  jobAsk: string;
  /** A generic bullet as it commonly appears on an untailored resume. */
  before: string;
  /** The same claim, re-angled for this job description. */
  after: string;
  /** Why it is a better match — and what was *not* added. */
  whatChanged: string;
};

export const EXAMPLES: Record<string, BeforeAfterExample> = {
  frontend: {
    id: "frontend",
    role: "Frontend Developer",
    jobAsk: "Looking for experience with React, TypeScript and REST APIs.",
    before: "Developed web applications and worked with backend APIs.",
    after:
      "Built responsive web applications in React and TypeScript, integrating REST APIs for search, checkout and account flows.",
    whatChanged:
      "The candidate already listed React, TypeScript and REST APIs in their skills section — the bullet just didn't say so. Naming the stack inside the experience bullet puts the evidence where a recruiter reads it, and where keyword matching looks. No new technology was claimed.",
  },
  backendScale: {
    id: "backendScale",
    role: "Backend Engineer",
    jobAsk: "You will own services handling high request volume and improve p95 latency.",
    before: "Improved performance of internal services.",
    after:
      "Reduced p95 latency on an internal orders service by adding query indexes and a Redis cache layer, cutting average response time from 800ms to 240ms.",
    whatChanged:
      "The work and the numbers came from the candidate's own notes; the original bullet just compressed them into one vague verb. Specific latency figures answer the exact thing the job description asks about. If the candidate has no measurements, the honest tailored version names the techniques and drops the numbers.",
  },
  productManager: {
    id: "productManager",
    role: "Product Manager",
    jobAsk: "Experience running discovery interviews and prioritising a roadmap with engineering.",
    before: "Managed the product roadmap and worked with stakeholders.",
    after:
      "Ran fortnightly discovery interviews with 8–10 customers and used the findings to prioritise a quarterly roadmap with engineering leads, sequencing 14 shipped features.",
    whatChanged:
      "\"Stakeholders\" hid the two activities this job actually screens for: discovery interviews and prioritisation with engineering. Same job, same quarter, described in the vocabulary the hiring team uses.",
  },
  dataAnalyst: {
    id: "dataAnalyst",
    role: "Data Analyst",
    jobAsk: "SQL, dashboarding in Tableau or Power BI, and partnering with marketing teams.",
    before: "Created reports and dashboards for various teams.",
    after:
      "Built weekly SQL-backed Power BI dashboards for the marketing team, tracking campaign spend and lead quality across five channels.",
    whatChanged:
      "The original bullet is true for almost any analyst, so it matched almost nothing. Naming SQL, Power BI and the marketing partnership — all already on the resume elsewhere — makes the same work legible to this employer.",
  },
  dataAnalystSummary: {
    id: "dataAnalystSummary",
    role: "Marketing Data Analyst — the summary",
    jobAsk: "Analyst with SQL and Looker experience to support the growth marketing team.",
    before: "Results-driven data analyst skilled in turning complex data into actionable insights.",
    after:
      "Data analyst with 4 years in marketing and growth analytics, working daily in SQL and Looker on campaign, funnel and retention reporting.",
    whatChanged:
      "The marketing work, SQL and Looker were all on the resume, inside the candidate's second and third roles. The tailored summary names the stack and the team this posting supports in the first line. \"Actionable insights\" went because it describes every analyst and proves nothing.",
  },
  careerChange: {
    id: "careerChange",
    role: "Customer Success Manager (from a support background)",
    jobAsk: "Own renewals, drive adoption and reduce churn for mid-market accounts.",
    before: "Handled customer support tickets and escalations for enterprise clients.",
    after:
      "Owned escalations for 40+ enterprise accounts, running adoption check-ins after each resolution and flagging at-risk accounts to the renewals team.",
    whatChanged:
      "A genuine reframing, not a promotion. The candidate did run adoption check-ins and did flag at-risk accounts — support work that maps onto retention language. What the tailored version does not do is claim they owned renewals or carried a churn target, because they didn't.",
  },
  summary: {
    id: "summary",
    role: "Any role — the professional summary",
    jobAsk: "Senior Backend Engineer, Go and distributed systems, fintech.",
    before:
      "Experienced software engineer with a passion for building great products and solving complex problems.",
    after:
      "Backend engineer with 6 years building payment and ledger services in Go, focused on correctness and recovery in distributed systems.",
    whatChanged:
      "The generic summary could sit on top of anyone's resume. The tailored one states the years, the language and the domain the candidate actually has — the three facts this posting screens on — in the first line a recruiter reads.",
  },
  nurseCriticalCare: {
    id: "nurseCriticalCare",
    role: "ICU Registered Nurse",
    jobAsk: "Critical care experience, including titrated vasoactive drips and ventilated patients.",
    before: "Provided patient care on a cardiac step-down unit and helped out in the ICU when needed.",
    after:
      "Cared for 3–4 cardiac step-down patients per shift and floated to the ICU during overflow, managing titrated vasoactive drips and ventilated patients alongside the ICU charge nurse.",
    whatChanged:
      "The ICU float shifts were already on the resume as \"helped out when needed\". The rewrite says what that work involved, in the posting's terms, and keeps the context honest: ICU was a float assignment with support, not the candidate's home unit.",
  },
  nurseSummary: {
    id: "nurseSummary",
    role: "Emergency Department RN — the summary",
    jobAsk: "RN with emergency or trauma experience; TNCC and ACLS required.",
    before:
      "Compassionate, hard-working registered nurse with 6 years of experience in fast-paced hospital environments.",
    after:
      "Registered nurse with 6 years in acute care, the last 2 in a Level II trauma emergency department. TNCC and ACLS certified; BLS current.",
    whatChanged:
      "Every fact in the new summary was already further down the resume: the ED role, the trauma level and the certifications. Moving them into the first two lines answers the posting's hard requirements before a recruiter has to look for them. \"Compassionate\" and \"hard-working\" went because every applicant says them.",
  },
  marketingPipeline: {
    id: "marketingPipeline",
    role: "Demand Generation Manager",
    jobAsk: "Own paid acquisition and report on pipeline and customer acquisition cost.",
    before: "Managed paid advertising campaigns on Google and LinkedIn.",
    after:
      "Managed paid search and LinkedIn campaigns on a $90K quarterly budget, reporting weekly to sales on cost per SQL and sourced pipeline.",
    whatChanged:
      "The budget and the weekly pipeline reporting were already in the candidate's own notes; the original bullet stopped at the channel names. The rewrite uses the posting's measures — pipeline and acquisition cost — and claims no result the candidate didn't report.",
  },
  marketingBrand: {
    id: "marketingBrand",
    role: "Brand Marketing Manager",
    jobAsk: "Lead integrated brand campaigns and manage creative agencies.",
    before: "Responsible for social media, events and agency relationships.",
    after:
      "Led two integrated brand campaigns a year across social, events and out-of-home, briefing and managing the creative agency from concept to launch.",
    whatChanged:
      "The same three responsibilities, organised around what the posting asks for: integrated campaigns and agency management. \"Responsible for\" became what the candidate actually did with them. No reach or results were added because the original resume had none — if those figures exist, they belong here too.",
  },
  accountantClose: {
    id: "accountantClose",
    role: "Senior Accountant",
    jobAsk: "Own the month-end close and drive process improvement.",
    before: "Responsible for month-end close and reconciliations.",
    after:
      "Owned the month-end close for two entities, cutting it from 8 working days to 5 by standardising reconciliation templates and booking accruals earlier in the month.",
    whatChanged:
      "The candidate had led that improvement — it was in their appraisal, not their resume. The posting asks for ownership and process improvement, so the rewrite states both using figures the candidate already had. The scope of the role is unchanged.",
  },
  accountantSummary: {
    id: "accountantSummary",
    role: "Financial Reporting Accountant — the summary",
    jobAsk: "Qualified accountant with IFRS consolidation experience; SAP preferred.",
    before:
      "Detail-oriented accounting professional with strong analytical skills and a passion for numbers.",
    after:
      "ACCA-qualified accountant with 5 years in financial reporting, including monthly IFRS consolidations for a 6-entity group in SAP.",
    whatChanged:
      "The qualification, the consolidation work and SAP were all listed further down the resume. The new summary puts the posting's three screening points in the first line. \"Detail-oriented\" went because every accountant says it.",
  },
};

export const exampleList = (ids: string[]): BeforeAfterExample[] =>
  ids.map((id) => EXAMPLES[id]).filter(Boolean);
