import { unstable_cache } from "next/cache";
import { getSupabaseAdminClient } from "@/lib/server/subscriptions";
import { keywordGroups, keywordRelevance, matchesKeyword, RELEVANCE_TIERS } from "./filters";
import { htmlToPlainText, sanitizeJobHtml } from "./sanitize";
import {
  COMPANY_SIZES,
  EMPLOYMENT_TYPES,
  INDUSTRY_VALUES,
  JOB_RETENTION_DAYS,
  LOCATION_OPTIONS,
  MAX_SEARCH_OFFSET,
  SALARY_OPTIONS,
  SENIORITY_LEVELS,
  SOURCE_NAMES,
  TECH_STACK_FILTERS,
  WORKPLACE_TYPES,
  type RemoteJob,
  type RemoteJobSearchParams,
  type WorkplaceType,
} from "./types";

/**
 * Remote Jobs search, over the jobs the daily ingest stores in Supabase.
 *
 * SQL (`search_job_listings`) applies the filters and returns the newest
 * matches from each source; this file then does what SQL can't express
 * cheaply: the precise keyword match, de-duplication across sources, and the
 * relevance-then-source-diversity ordering the list has always used.
 *
 * The data changes once a day, so candidate sets are cached and the cron
 * clears the cache (JOB_LISTINGS_CACHE_TAG) when it has written.
 */

export const JOB_LISTINGS_CACHE_TAG = "job-listings";
const CACHE_SECONDS = 30 * 60;
/**
 * Newest matches kept per source. PostgREST caps a response at 1,000 rows, so
 * this × the 11 sources has to stay under that.
 */
const PER_SOURCE_CANDIDATES = 90;
const HOUR_MS = 60 * 60 * 1000;

const LISTING_COLUMNS = [
  "id",
  "source",
  "external_id",
  "source_url",
  "application_url",
  "title",
  "company_name",
  "company_logo",
  "location",
  "countries",
  "regions",
  "workplace_type",
  "employment_type",
  "seniority",
  "salary_text",
  "tech_stack",
  "categories",
  "is_startup",
  "company_size",
  "industry",
  "posted_at",
  "dedupe_key",
].join(",");

type ListingRow = {
  id: string;
  source: string;
  external_id: string;
  source_url: string;
  application_url: string;
  title: string;
  company_name: string;
  company_logo: string;
  location: string;
  countries: string[] | null;
  regions: string[] | null;
  workplace_type: WorkplaceType;
  employment_type: string | null;
  seniority: string | null;
  salary_text: string;
  tech_stack: string[] | null;
  categories: string[] | null;
  is_startup: boolean | null;
  company_size: string | null;
  industry: string | null;
  posted_at: string;
  dedupe_key: string;
};

const toRemoteJob = (row: ListingRow, body?: { html: string; plain: string }): RemoteJob => ({
  id: row.id,
  externalId: row.external_id,
  source: row.source,
  sourceName: SOURCE_NAMES[row.source] || row.source,
  sourceUrl: row.source_url,
  applicationUrl: row.application_url || row.source_url,
  title: row.title,
  companyName: row.company_name,
  companyLogo: row.company_logo || "",
  description: body?.plain || "",
  descriptionHtml: body?.html || "",
  location: row.location || "",
  countries: row.countries || [],
  regions: row.regions || [],
  workplaceType: row.workplace_type,
  employmentType: row.employment_type || "",
  seniority: row.seniority || "",
  salary: row.salary_text || "",
  skills: row.tech_stack || [],
  categories: row.categories || [],
  industry: row.industry || "",
  isStartup: row.is_startup ?? null,
  companySize: row.company_size || "",
  postedAt: row.posted_at,
  detailLoaded: Boolean(body),
});

const oneOf = (value: string, allowed: readonly string[]) => (allowed.includes(value) ? value : null);
const valuesOf = (options: readonly { value: string }[]) => options.map((option) => option.value);

/**
 * The search's SQL arguments. Every value is checked against its option list,
 * so the cache key only ever holds known values. "Posted within" is rounded to
 * the hour for the same reason — a timestamp to the millisecond would make
 * every request a cache miss.
 */
const toRpcArgs = (params: RemoteJobSearchParams) => {
  const location = LOCATION_OPTIONS.find((option) => option.value === params.location);
  const salary = SALARY_OPTIONS.find((option) => option.value === params.salary);
  const days =
    params.postedWithinDays > 0 ? Math.min(params.postedWithinDays, JOB_RETENTION_DAYS) : 0;
  const hour = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
  return {
    p_workplace: oneOf(params.workplaceType, valuesOf(WORKPLACE_TYPES)),
    p_countries: location?.countries.length ? [...location.countries] : null,
    p_regions: location ? [...location.regions] : null,
    p_employment: oneOf(params.employmentType, valuesOf(EMPLOYMENT_TYPES)),
    p_seniority: oneOf(params.seniority, valuesOf(SENIORITY_LEVELS)),
    p_startup:
      params.companyType === "startup" ? true : params.companyType === "established" ? false : null,
    p_sizes: oneOf(params.companySize, valuesOf(COMPANY_SIZES)) ? [params.companySize] : null,
    p_tech: oneOf(params.techStack, TECH_STACK_FILTERS) ? [params.techStack] : null,
    p_industry: oneOf(params.industry, INDUSTRY_VALUES),
    p_posted_since: days ? new Date(hour - days * 24 * HOUR_MS).toISOString() : null,
    p_salary_listed: salary?.value === "listed",
    p_min_salary_usd: salary && salary.minUsd > 0 ? salary.minUsd : null,
    p_keyword_groups: keywordGroups(params.query),
    p_per_source: PER_SOURCE_CANDIDATES,
  };
};

const fetchCandidates = unstable_cache(
  async (argsJson: string): Promise<ListingRow[]> => {
    const { data, error } = await getSupabaseAdminClient()
      .rpc("search_job_listings", JSON.parse(argsJson))
      .select(LISTING_COLUMNS);
    if (error) throw new Error(`Job search failed: ${error.message}`);
    return (data || []) as unknown as ListingRow[];
  },
  ["job-listings-candidates"],
  { revalidate: CACHE_SECONDS, tags: [JOB_LISTINGS_CACHE_TAG] }
);

/**
 * On a duplicate, the source with the better record wins. The ATS boards are
 * the employer's own posting: first-party description, direct apply link, no
 * aggregator redirect. Aggregators that re-list other boards' jobs come last.
 */
const DEDUPE_PRIORITY = [
  "greenhouse",
  "ashby",
  "lever",
  "workable",
  "smartrecruiters",
  "recruitee",
  "startupjobs",
  "himalayas",
  "jobicy",
  "workingnomads",
  "arbeitnow",
];

/** Best match first: title phrase, then all words, some words, tag-only. */
const RELEVANCE_TIERS_DESC = [
  RELEVANCE_TIERS.PHRASE,
  RELEVANCE_TIERS.ALL_WORDS,
  RELEVANCE_TIERS.SOME_WORDS,
  RELEVANCE_TIERS.TAG,
] as const;

/**
 * Relevance first, source diversity second.
 *
 * Sorting by date alone let whichever source posts most often take the whole
 * page — and Himalayas posts ~3,000 jobs a day to everyone else's few hundred.
 * Plain round-robin, on the other hand, could lead with a job that only
 * matched on a team label while an actual "Senior Frontend Engineer" sat
 * further down. That is worst for users without a plan, who see just a few
 * results — those have to be the best few, not one-from-each-source.
 *
 * So jobs are bucketed by relevance tier and round-robin runs *inside* each
 * bucket: every title match is exhausted before any tag-only match appears, and
 * no single source can monopolise a bucket. With no keyword every job lands in
 * the same bucket, which is plain round-robin by recency.
 */
const interleaveByRelevanceThenSource = (groups: RemoteJob[][], take: number, query: string) => {
  const merged: RemoteJob[] = [];
  for (const tier of RELEVANCE_TIERS_DESC) {
    if (merged.length >= take) break;
    const banded = groups.map((group) => group.filter((job) => keywordRelevance(job, query) === tier));
    merged.push(...interleaveBySource(banded, take - merged.length));
  }
  return merged;
};

const interleaveBySource = (groups: RemoteJob[][], take: number) => {
  const merged: RemoteJob[] = [];
  const cursors = new Array(groups.length).fill(0);
  let placed = true;
  while (merged.length < take && placed) {
    placed = false;
    for (let i = 0; i < groups.length && merged.length < take; i += 1) {
      const group = groups[i];
      if (cursors[i] >= group.length) continue;
      merged.push(group[cursors[i]]);
      cursors[i] += 1;
      placed = true;
    }
  }
  return merged;
};

export type SearchResult = {
  jobs: RemoteJob[];
  /** Whether another page exists past this one. */
  hasMore: boolean;
};

export const searchJobListings = async (params: RemoteJobSearchParams): Promise<SearchResult> => {
  const rows = await fetchCandidates(JSON.stringify(toRpcArgs(params)));

  const bySource = new Map<string, { row: ListingRow; job: RemoteJob }[]>();
  for (const row of rows) {
    const job = toRemoteJob(row);
    if (!matchesKeyword(job, params.query)) continue;
    const list = bySource.get(row.source) || [];
    list.push({ row, job });
    bySource.set(row.source, list);
  }

  // Drop cross-source duplicates before allocating slots, so a job listed on
  // both an ATS board and an aggregator doesn't take two of them.
  const claimed = new Set<string>();
  const ordered = [...bySource.keys()].sort(
    (a, b) => DEDUPE_PRIORITY.indexOf(a) - DEDUPE_PRIORITY.indexOf(b)
  );
  const groups: RemoteJob[][] = [];
  for (const source of ordered) {
    const unique: RemoteJob[] = [];
    for (const { row, job } of bySource.get(source) || []) {
      if (claimed.has(row.dedupe_key)) continue;
      claimed.add(row.dedupe_key);
      unique.push(job);
    }
    // Best match first, then newest; the interleave decides across sources.
    unique.sort(
      (a, b) =>
        keywordRelevance(b, params.query) - keywordRelevance(a, params.query) ||
        b.postedAt.localeCompare(a.postedAt)
    );
    groups.push(unique);
  }

  // Interleave one past the requested page so we know whether "Load more"
  // would actually yield anything.
  const offset = Math.max(0, params.offset);
  const merged = interleaveByRelevanceThenSource(groups, offset + params.limit + 1, params.query);
  return {
    jobs: merged.slice(offset, offset + params.limit),
    hasMore: merged.length > offset + params.limit && offset + params.limit < MAX_SEARCH_OFFSET,
  };
};

/**
 * One job with its description, for the detail view and the scanner. The
 * stored HTML is the source's own, so it is sanitized here, on the way out.
 */
export const getJobListing = async (id: string): Promise<RemoteJob | null> => {
  const supabase = getSupabaseAdminClient();
  const [listing, body] = await Promise.all([
    supabase.from("job_listings").select(LISTING_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("jobs").select("description_html").eq("id", id).maybeSingle(),
  ]);
  if (listing.error) throw new Error(`Loading job failed: ${listing.error.message}`);
  if (body.error) throw new Error(`Loading job failed: ${body.error.message}`);
  if (!listing.data) return null;

  const row = listing.data as unknown as ListingRow;
  const raw = (body.data?.description_html as string) || "";
  // startup.jobs' terms require their attribution link to stay a normal,
  // followed link.
  const followHosts = row.source === "startupjobs" ? ["startup.jobs"] : [];
  return toRemoteJob(row, {
    html: sanitizeJobHtml(raw, { followHosts }),
    plain: htmlToPlainText(raw),
  });
};

/** PostgREST puts `in` filters in the URL, so long id lists go in batches. */
const ID_BATCH = 100;

/**
 * The listings (no descriptions) for these ids that are still live, keyed by
 * id — for the saved list. An id is missing from the result once its row is
 * gone (expired, or taken down at the source) or past its own expiry date.
 */
export const getLiveJobListings = async (ids: string[]): Promise<Map<string, RemoteJob>> => {
  const supabase = getSupabaseAdminClient();
  const live = new Map<string, RemoteJob>();
  const now = new Date().toISOString();
  for (let index = 0; index < ids.length; index += ID_BATCH) {
    const batch = ids.slice(index, index + ID_BATCH);
    const [listings, lapsed] = await Promise.all([
      supabase.from("job_listings").select(LISTING_COLUMNS).in("id", batch),
      // Still stored, but its closing date has passed since the nightly clean-up.
      supabase.from("jobs").select("id").in("id", batch).lte("expires_at", now),
    ]);
    if (listings.error) throw new Error(`Loading saved jobs failed: ${listings.error.message}`);
    if (lapsed.error) throw new Error(`Loading saved jobs failed: ${lapsed.error.message}`);
    const lapsedIds = new Set((lapsed.data || []).map((row) => row.id as string));
    for (const row of (listings.data || []) as unknown as ListingRow[]) {
      if (!lapsedIds.has(row.id)) live.set(row.id, toRemoteJob(row));
    }
  }
  return live;
};
