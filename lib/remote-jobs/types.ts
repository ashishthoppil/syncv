/**
 * Remote Jobs — the normalized shape every provider must produce.
 *
 * SynCV is not a job board: this exists so a user can find a remote role and
 * hand its description straight to the existing scanner, instead of leaving the
 * app to copy a JD. Keep this object to what a source actually returns — an
 * empty string or array means "the source didn't tell us", and the UI hides the
 * field rather than inventing one.
 */
export type RemoteJob = {
  /** Stable, provider-prefixed id — safe to put in a URL. */
  id: string;
  /** The id as the provider knows it. */
  externalId: string;
  /** Provider id, e.g. "jobicy". */
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
  remote: boolean;
  /** Countries/regions the source says a candidate may be based in. */
  remoteCountries: string[];
  employmentType: string;
  experienceLevel: string;
  salary: string;
  skills: string[];
  /** Source's own categorisation — shown when the source gives no skills. */
  categories: string[];
  /** ISO date string, or "" when the source omits it. */
  postedAt: string;
  /**
   * False when this came from a search response that withheld the description —
   * the ATS boards carry far too much text to ship in a list. The detail view
   * fetches the full record by id before showing or scanning it.
   */
  detailLoaded: boolean;
};

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
export const dedupeLabels = (values: (string | undefined)[]): string[] => {
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
  /** One of REMOTE_LOCATIONS' values; "" means no location filter. */
  remoteLocation: string;
  /** One of EMPLOYMENT_TYPES' values; "" means any. */
  employmentType: string;
  /** One of EXPERIENCE_LEVELS' values; "" means any. */
  experienceLevel: string;
  /** 0 means any age. */
  postedWithinDays: number;
  limit: number;
  /** How many results to skip — the page cursor behind "Load more". */
  offset: number;
};

/**
 * A job source. Adding another board means adding one of these and listing it
 * in the registry — nothing else in the feature needs to know.
 */
export type JobProvider = {
  id: string;
  name: string;
  /** Shown next to results; providers grant API access on condition of credit. */
  attributionUrl: string;
  searchJobs: (params: RemoteJobSearchParams) => Promise<RemoteJob[]>;
  getJob: (externalId: string) => Promise<RemoteJob | null>;
};

/**
 * "Remote from" — where the candidate may be based, which is not the same as
 * where the company is. A job is only offered here if the source says that
 * location is eligible (or that the role is open to anywhere).
 */
export const REMOTE_LOCATIONS = [
  { value: "india", label: "India" },
  { value: "united-states", label: "United States" },
  { value: "united-kingdom", label: "United Kingdom" },
  { value: "europe", label: "Europe" },
  { value: "anywhere", label: "Anywhere" },
] as const;

export const EMPLOYMENT_TYPES = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
] as const;

export const EXPERIENCE_LEVELS = [
  { value: "entry", label: "Entry / Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "executive", label: "Director / Executive" },
] as const;

export const POSTED_WITHIN_OPTIONS = [
  { value: "1", label: "Last 24 hours" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
] as const;

/**
 * Results per page. Small on purpose: the list loads the next page as the user
 * scrolls, so the first screen should arrive fast on a phone rather than
 * shipping fifty cards nobody has scrolled to yet.
 */
export const REMOTE_JOBS_PAGE_SIZE = 10;

/**
 * What a user without an active Smart or Pro plan gets: two jobs they can open
 * and scan, then a short blurred run underneath so the depth of the list is
 * visible. They don't page on scroll — the rest is behind the plan.
 */
export const FREE_PLAN_VISIBLE_JOBS = 2;
export const FREE_PLAN_PREVIEW_JOBS = 3;

export const DEFAULT_SEARCH_PARAMS: RemoteJobSearchParams = {
  query: "",
  remoteLocation: "",
  employmentType: "",
  experienceLevel: "",
  postedWithinDays: 0,
  limit: REMOTE_JOBS_PAGE_SIZE,
  offset: 0,
};

/**
 * Ceiling on how deep "Load more" can page. Every page re-runs the whole
 * fan-out (cheap — the upstream fetches are cached for an hour) and asks each
 * provider for `offset + limit` jobs, so the work grows with depth. Nobody
 * scrolls 500 remote jobs looking for one to scan; past this the answer is a
 * better search, not more pages.
 */
export const MAX_SEARCH_OFFSET = 500;
