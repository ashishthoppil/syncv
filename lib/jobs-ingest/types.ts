/**
 * The daily job ingest. Each source turns its own API into `SourceJob`s;
 * normalize.ts turns those into `JobRow`s, the shape of the `jobs` table.
 */

/** What a source adapter hands back — its own data, lightly mapped. */
export type SourceJob = {
  externalId: string;
  /** ATS company slug. Set for per-company boards, so pruning can be scoped. */
  board?: string;
  sourceUrl: string;
  applicationUrl?: string;
  title: string;
  companyName: string;
  companyLogo?: string;
  companyWebsite?: string;
  /**
   * The description as the source sent it (HTML, or plain text). `undefined`
   * means "already stored — leave it": a board whose descriptions cost a
   * request each only fetches them for jobs we haven't seen.
   */
  descriptionHtml?: string;
  /** Location as the source prints it, for display. */
  location: string;
  /** Extra location strings to read countries and regions from. */
  places?: string[];
  /** As the source states it; null when it doesn't. */
  workplaceType: "remote" | "hybrid" | "onsite" | null;
  employmentType?: string | null;
  seniority?: string | null;
  salary?: {
    min?: number | null;
    max?: number | null;
    currency?: string | null;
    /** year | month | week | day | hour, or the source's own word for it. */
    period?: string | null;
    /** The source's own formatted line, used when there are no numbers. */
    text?: string | null;
  } | null;
  categories?: string[];
  /** The company's industry, when the source states one. */
  industry?: string | null;
  isStartup?: boolean;
  postedAt: string | number | Date | null | undefined;
  expiresAt?: string | number | Date | null;
};

/** A row of the `jobs` table, as written. */
export type JobRow = {
  id: string;
  source: string;
  external_id: string;
  board: string | null;
  source_url: string;
  application_url: string;
  title: string;
  company_name: string;
  company_key: string;
  company_logo: string;
  /** Omitted for jobs whose stored description should be kept. */
  description_html?: string;
  location: string;
  countries: string[];
  regions: string[];
  workplace_type: "remote" | "hybrid";
  employment_type: string | null;
  seniority: string | null;
  salary_text: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  salary_period: string | null;
  salary_usd_annual: number | null;
  tech_stack: string[];
  categories: string[];
  source_industry: string | null;
  source_is_startup: boolean | null;
  posted_at: string;
  expires_at: string | null;
  dedupe_key: string;
  search_text: string;
  last_seen_at: string;
};

export type CompanyRow = {
  key: string;
  name: string;
  website: string | null;
};

export type SourceContext = {
  /** Epoch ms after which no new upstream request should start. */
  deadline: number;
  /** Oldest posting worth keeping (now − JOB_RETENTION_DAYS). */
  windowStart: Date;
  /**
   * Newest `posted_at` already stored for this source, so a feed can stop
   * paging once it reaches jobs it already has. null on the first run.
   */
  newestStored: Date | null;
  /** Ids already stored for this source — loaded on first call. */
  existingIds: () => Promise<Set<string>>;
};

export type SourceFetchResult = {
  jobs: SourceJob[];
  /**
   * Boards that were read completely. A stored job from one of these boards
   * that didn't come back has been taken down, and is deleted.
   */
  completeBoards?: string[];
  /** The whole source was read completely (a single small feed). */
  complete?: boolean;
  /** Some of the source was skipped — a board failed, a rate limit, time ran out. */
  partial?: boolean;
  /** A short line for the report, e.g. "stopped at the time limit". */
  note?: string;
};

export type IngestSource = {
  id: string;
  name: string;
  /** Requires configuration (an API key) before it can run. */
  isConfigured?: () => boolean;
  fetchJobs: (ctx: SourceContext) => Promise<SourceFetchResult>;
};

export type SourceRunSummary = {
  source: string;
  status: "ok" | "partial" | "failed" | "skipped";
  fetched: number;
  newJobs: number;
  removed: number;
  note: string | null;
};
