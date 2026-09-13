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
};

export const exampleList = (ids: string[]): BeforeAfterExample[] =>
  ids.map((id) => EXAMPLES[id]).filter(Boolean);
