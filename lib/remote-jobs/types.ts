/**
 * Remote Jobs — the shape the screen works with, and the filter options it
 * offers. Shared by the client, the search route and the daily ingest.
 *
 * SynCV is not a job board: this exists so a user can find a remote or hybrid
 * role and hand its description straight to the existing scanner, instead of
 * leaving the app to copy a JD. Keep this object to what a source actually
 * returns — an empty string, empty array or null means "the source didn't tell
 * us", and the UI hides the field rather than inventing one.
 */
export type RemoteJob = {
  /** Stable, provider-prefixed id — safe to put in a URL. */
  id: string;
  /** The id as the provider knows it. */
  externalId: string;
  /** Source id, e.g. "jobicy". */
  source: string;
  /** Human label for the attribution line, e.g. "Jobicy". */
  sourceName: string;
  /** Canonical listing URL on the source. Providers require we link back here. */
  sourceUrl: string;
  /** Where "Apply" sends the user — falls back to sourceUrl. */
  applicationUrl: string;
  title: string;
  companyName: string;
  companyLogo: string;
  /** Plain text. This is what gets handed to the existing scanner. */
  description: string;
  /** Server-sanitized HTML, for the detail view only. */
  descriptionHtml: string;
  /** Free-text location as printed by the source, if any. */
  location: string;
  /**
   * ISO 3166-1 alpha-2 codes. For a remote job, where a candidate may be based;
   * for a hybrid job, where the office is.
   */
  countries: string[];
  /** Region slugs — see REGION_LABELS. "worldwide" means open to anywhere. */
  regions: string[];
  workplaceType: WorkplaceType;
  /** One of EMPLOYMENT_TYPES' values, or "" when the posting doesn't say. */
  employmentType: string;
  /** One of SENIORITY_LEVELS' values, or "" when the posting doesn't say. */
  seniority: string;
  salary: string;
  /** Technologies named in the posting. */
  skills: string[];
  /** Source's own categorisation — shown when the posting names no tech. */
  categories: string[];
  /** One of INDUSTRIES' values, or "". */
  industry: string;
  /** null when we couldn't tell. */
  isStartup: boolean | null;
  /** One of COMPANY_SIZES' values, or "". */
  companySize: string;
  /** ISO date string. */
  postedAt: string;
  /**
   * False in search results, which never carry descriptions — a page of them
   * would be hundreds of KB on a phone. The detail view fetches the full record
   * by id before showing or scanning it.
   */
  detailLoaded: boolean;
};

export type WorkplaceType = "remote" | "hybrid";

/**
 * Feeds occasionally carry a posting whose body never made it across — we have
 * seen a one-character description come back. Handing that to the scanner would
 * spend one of the user's scans on nothing, so anything shorter than this is
 * treated as having no description at all. Real listings run 2,000–7,000 chars.
 */
export const MIN_SCANNABLE_DESCRIPTION = 200;

export const isScannable = (job: RemoteJob) =>
  job.description.trim().length >= MIN_SCANNABLE_DESCRIPTION;

/**
 * Case-insensitive de-duplication for label lists, preserving order and the
 * original casing.
 *
 * Sources routinely repeat themselves: Ashby exposes both `department` and
 * `team`, and on plenty of postings they are the same string ("Product
 * Design"). That rendered the same chip twice and, because the label is the
 * React key, produced a duplicate-key error.
 */
export const dedupeLabels = (values: (string | undefined | null)[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const value of values) {
    const label = (value || "").trim();
    const key = label.toLowerCase();
    if (!label || seen.has(key)) continue;
    seen.add(key);
    unique.push(label);
  }
  return unique;
};

export type RemoteJobSearchParams = {
  /** Free-text keyword, e.g. "React Developer". */
  query: string;
  /** One of WORKPLACE_TYPES' values; "" means remote or hybrid. */
  workplaceType: string;
  /** One of LOCATION_OPTIONS' values; "" means no location filter. */
  location: string;
  /** One of EMPLOYMENT_TYPES' values; "" means any. */
  employmentType: string;
  /** One of SENIORITY_LEVELS' values; "" means any. */
  seniority: string;
  /** "startup", "established", or "" for any. */
  companyType: string;
  /** One of COMPANY_SIZES' values; "" means any. */
  companySize: string;
  /** One of TECH_STACK_FILTERS; "" means any. */
  techStack: string;
  /** One of INDUSTRIES' values; "" means any. */
  industry: string;
  /** One of SALARY_OPTIONS' values; "" means any. */
  salary: string;
  /** 0 means anything still stored (the last JOB_RETENTION_DAYS). */
  postedWithinDays: number;
  limit: number;
  /** How many results to skip — the page cursor behind "Load more". */
  offset: number;
};

/**
 * Jobs are kept this long after they were posted, then deleted by the daily
 * ingest. It also bounds what "Any time" means in the posted-date filter.
 */
export const JOB_RETENTION_DAYS = 14;

export const WORKPLACE_TYPES = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
] as const;

/**
 * Region slugs stored on a job. A remote job open to "EMEA" carries `emea`;
 * someone filtering for Germany sees it because Germany's regions include it.
 */
export const REGION_LABELS: Record<string, string> = {
  worldwide: "Anywhere",
  europe: "Europe",
  emea: "EMEA",
  apac: "APAC",
  asia: "Asia",
  americas: "Americas",
  "north-america": "North America",
  latam: "Latin America",
  africa: "Africa",
  "middle-east": "Middle East",
  oceania: "Oceania",
};

/**
 * "Location" — where the candidate is. For a remote job that means "may I
 * work from here?"; for a hybrid job, "is the office here?". A job matches if
 * it names one of `countries` or is open to one of `regions`.
 *
 * Each country's regions are the remote-eligibility areas it falls inside, so
 * "Remote from India" also returns APAC-wide and worldwide roles — but never a
 * job that only says "Remote" with no region, because that one may well be
 * restricted to somewhere else.
 */
export const LOCATION_OPTIONS = [
  { value: "anywhere", label: "Anywhere (worldwide)", countries: [], regions: ["worldwide"] },
  { value: "IN", label: "India", countries: ["IN"], regions: ["apac", "asia", "worldwide"] },
  { value: "US", label: "United States", countries: ["US"], regions: ["americas", "north-america", "worldwide"] },
  { value: "GB", label: "United Kingdom", countries: ["GB"], regions: ["europe", "emea", "worldwide"] },
  { value: "CA", label: "Canada", countries: ["CA"], regions: ["americas", "north-america", "worldwide"] },
  { value: "DE", label: "Germany", countries: ["DE"], regions: ["europe", "emea", "worldwide"] },
  { value: "NL", label: "Netherlands", countries: ["NL"], regions: ["europe", "emea", "worldwide"] },
  { value: "FR", label: "France", countries: ["FR"], regions: ["europe", "emea", "worldwide"] },
  { value: "ES", label: "Spain", countries: ["ES"], regions: ["europe", "emea", "worldwide"] },
  { value: "PL", label: "Poland", countries: ["PL"], regions: ["europe", "emea", "worldwide"] },
  { value: "IE", label: "Ireland", countries: ["IE"], regions: ["europe", "emea", "worldwide"] },
  { value: "AE", label: "United Arab Emirates", countries: ["AE"], regions: ["middle-east", "emea", "asia", "worldwide"] },
  { value: "SG", label: "Singapore", countries: ["SG"], regions: ["apac", "asia", "worldwide"] },
  { value: "AU", label: "Australia", countries: ["AU"], regions: ["apac", "oceania", "worldwide"] },
  { value: "BR", label: "Brazil", countries: ["BR"], regions: ["americas", "latam", "worldwide"] },
  { value: "europe", label: "Anywhere in Europe", countries: [], regions: ["europe", "emea", "worldwide"] },
  { value: "apac", label: "Anywhere in APAC", countries: [], regions: ["apac", "asia", "worldwide"] },
  { value: "americas", label: "Anywhere in the Americas", countries: [], regions: ["americas", "north-america", "latam", "worldwide"] },
] as const;

export const EMPLOYMENT_TYPES = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
] as const;

export const SENIORITY_LEVELS = [
  { value: "entry", label: "Entry / Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead / Staff / Manager" },
  { value: "executive", label: "Director / Executive" },
] as const;

export const COMPANY_TYPES = [
  { value: "startup", label: "Startups" },
  { value: "established", label: "Established companies" },
] as const;

export const COMPANY_SIZES = [
  { value: "1-50", label: "1–50 employees" },
  { value: "51-200", label: "51–200 employees" },
  { value: "201-1000", label: "201–1,000 employees" },
  { value: "1001-5000", label: "1,001–5,000 employees" },
  { value: "5000+", label: "5,000+ employees" },
] as const;

/**
 * The fixed industry list. Sources that state an industry are mapped onto it,
 * and the company lookup must answer with one of these values — a free-text
 * industry would make the filter useless.
 */
export const INDUSTRIES = [
  { value: "software", label: "Software & SaaS" },
  { value: "ai", label: "AI & Machine Learning" },
  { value: "devtools", label: "Developer Tools & Cloud" },
  { value: "security", label: "Cybersecurity" },
  { value: "fintech", label: "Fintech & Financial Services" },
  { value: "crypto", label: "Crypto & Web3" },
  { value: "ecommerce", label: "E-commerce & Retail" },
  { value: "healthcare", label: "Healthcare & Life Sciences" },
  { value: "education", label: "Education" },
  { value: "media", label: "Media & Entertainment" },
  { value: "gaming", label: "Gaming" },
  { value: "marketing", label: "Marketing & Advertising" },
  { value: "hr", label: "HR & Recruiting" },
  { value: "travel", label: "Travel & Hospitality" },
  { value: "logistics", label: "Logistics & Mobility" },
  { value: "manufacturing", label: "Manufacturing & Industrial" },
  { value: "energy", label: "Energy & Climate" },
  { value: "real-estate", label: "Real Estate & Construction" },
  { value: "consulting", label: "Consulting & IT Services" },
  { value: "telecom", label: "Telecommunications" },
  { value: "consumer", label: "Food & Consumer Goods" },
  { value: "public", label: "Nonprofit & Government" },
  { value: "other", label: "Other" },
] as const;

export const INDUSTRY_VALUES: string[] = INDUSTRIES.map((option) => option.value);

/**
 * The tech offered in the filter. Jobs can carry any technology the extractor
 * knows (lib/jobs-ingest/tech-stack.ts); this is the short list worth a menu
 * entry. Values must match the extractor's canonical names exactly.
 */
export const TECH_STACK_FILTERS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Angular",
  "Vue",
  "Next.js",
  "Node.js",
  "Python",
  "Django",
  "FastAPI",
  "Java",
  "Spring Boot",
  "Kotlin",
  "Go",
  "Rust",
  "C#",
  ".NET",
  "C++",
  "Ruby on Rails",
  "PHP",
  "Laravel",
  "Swift",
  "iOS",
  "Android",
  "Flutter",
  "React Native",
  "SQL",
  "PostgreSQL",
  "MongoDB",
  "AWS",
  "GCP",
  "Azure",
  "Kubernetes",
  "Docker",
  "Terraform",
  "Spark",
  "Snowflake",
  "PyTorch",
  "TensorFlow",
  "Tableau",
  "Power BI",
  "Salesforce",
  "Figma",
] as const;

/**
 * Salary filter. The thresholds compare against the posting's lower bound,
 * annualised and converted to USD at a fixed rate — close enough to sort
 * "around $50k" from "around $150k", which is all a filter needs.
 */
export const SALARY_OPTIONS = [
  { value: "listed", label: "Salary listed", minUsd: 0 },
  { value: "25000", label: "$25k+ / ₹20 LPA+ a year", minUsd: 25000 },
  { value: "50000", label: "$50k+ / ₹40 LPA+ a year", minUsd: 50000 },
  { value: "100000", label: "$100k+ a year", minUsd: 100000 },
  { value: "150000", label: "$150k+ a year", minUsd: 150000 },
] as const;

export const POSTED_WITHIN_OPTIONS = [
  { value: "1", label: "Last 24 hours" },
  { value: "3", label: "Last 3 days" },
  { value: "7", label: "Last 7 days" },
] as const;

/**
 * Results per page. Small on purpose: the list loads the next page as the user
 * scrolls, so the first screen should arrive fast on a phone rather than
 * shipping fifty cards nobody has scrolled to yet.
 */
export const REMOTE_JOBS_PAGE_SIZE = 10;

/**
 * What a user without an active Pro plan gets: two jobs they can open
 * and scan, then a short blurred run underneath so the depth of the list is
 * visible. They don't page on scroll — the rest is behind the plan.
 */
export const FREE_PLAN_VISIBLE_JOBS = 2;
export const FREE_PLAN_PREVIEW_JOBS = 3;

export const DEFAULT_SEARCH_PARAMS: RemoteJobSearchParams = {
  query: "",
  workplaceType: "",
  location: "",
  employmentType: "",
  seniority: "",
  companyType: "",
  companySize: "",
  techStack: "",
  industry: "",
  salary: "",
  postedWithinDays: 0,
  limit: REMOTE_JOBS_PAGE_SIZE,
  offset: 0,
};

/** A job the user saved, as the saved list shows it. */
export type SavedRemoteJob = RemoteJob & {
  /** ISO date string. */
  savedAt: string;
  /**
   * The posting has left the listings — closed, past the retention window, or
   * taken down at the source. The job is then the copy kept when it was saved.
   */
  expired: boolean;
};

/** Saved jobs per user. A list longer than this has stopped being a shortlist. */
export const MAX_SAVED_JOBS = 200;

/**
 * Ceiling on how deep "Load more" can page. Nobody scrolls 500 jobs looking
 * for one to scan; past this the answer is a better search, not more pages.
 */
export const MAX_SEARCH_OFFSET = 500;

/** Display names for the sources, keyed by source id. */
export const SOURCE_NAMES: Record<string, string> = {
  jobicy: "Jobicy",
  greenhouse: "Greenhouse",
  ashby: "Ashby",
  lever: "Lever",
  workable: "Workable",
  smartrecruiters: "SmartRecruiters",
  recruitee: "Recruitee",
  arbeitnow: "Arbeitnow",
  workingnomads: "Working Nomads",
  himalayas: "Himalayas",
  startupjobs: "Startup Jobs",
};

/**
 * Sources whose terms ask for a credit linking to their own site, not just to
 * the posting. Shown beside every job from them.
 */
export const SOURCE_HOMEPAGES: Record<string, string> = {
  jobicy: "https://jobicy.com",
  arbeitnow: "https://www.arbeitnow.com",
  workingnomads: "https://www.workingnomads.com",
  himalayas: "https://himalayas.app",
  startupjobs: "https://startup.jobs",
};
