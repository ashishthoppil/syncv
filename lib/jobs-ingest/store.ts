import type { SupabaseClient } from "@supabase/supabase-js";
import { JOB_RETENTION_DAYS } from "@/lib/remote-jobs/types";
import type { CompanyRow, JobRow, SourceRunSummary } from "./types";

/**
 * Everything the ingest reads from and writes to Supabase. PostgREST returns
 * at most 1,000 rows per request, hence the paging in the reads.
 */

const PAGE = 1000;
const WRITE_BATCH = 200;
/** startup.jobs' terms: refresh or delete what we fetched within seven days. */
const STARTUP_JOBS_REFRESH_DAYS = 7;
const STARTUP_JOBS_STALE_DAYS = 6;

const DAY_MS = 24 * 60 * 60 * 1000;

export const getNewestPostedAt = async (supabase: SupabaseClient, source: string) => {
  const { data, error } = await supabase
    .from("jobs")
    .select("posted_at")
    .eq("source", source)
    .order("posted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Reading ${source}'s newest job failed: ${error.message}`);
  return data?.posted_at ? new Date(data.posted_at) : null;
};

export const loadExistingIds = async (supabase: SupabaseClient, source: string) => {
  const ids = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("jobs")
      .select("id")
      .eq("source", source)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Reading ${source}'s stored jobs failed: ${error.message}`);
    for (const row of data || []) ids.add(row.id);
    if (!data || data.length < PAGE) break;
  }
  return ids;
};

/** New companies are inserted as "pending"; known ones are left alone. */
export const ensureCompanies = async (supabase: SupabaseClient, companies: CompanyRow[]) => {
  const unique = [...new Map(companies.map((company) => [company.key, company])).values()];
  for (let index = 0; index < unique.length; index += WRITE_BATCH) {
    const { error } = await supabase
      .from("job_companies")
      .upsert(unique.slice(index, index + WRITE_BATCH), { onConflict: "key", ignoreDuplicates: true });
    if (error) throw new Error(`Saving companies failed: ${error.message}`);
  }
};

/**
 * What a refresh of an already-stored job may overwrite when its description
 * wasn't re-fetched. Everything else — tech stack, salary, categories, and
 * the office countries Greenhouse only gives in its per-job response — was
 * derived from the full posting and is left as stored.
 */
const HEADER_COLUMNS = [
  "id",
  "source",
  "external_id",
  "board",
  "source_url",
  "application_url",
  "title",
  "company_name",
  "company_key",
  "company_logo",
  "location",
  "workplace_type",
  "posted_at",
  "dedupe_key",
  "last_seen_at",
] as const;

const headerOnly = (row: JobRow) =>
  Object.fromEntries(HEADER_COLUMNS.map((column) => [column, row[column]]));

/**
 * Inserts or refreshes jobs and returns how many were new. Full rows and
 * header-only refreshes go in separate requests: PostgREST fills a column
 * missing from some rows of a batch with NULL, which would wipe stored data.
 */
export const upsertJobs = async (supabase: SupabaseClient, rows: JobRow[], runStartedAt: Date) => {
  const groups = [
    rows.filter((row) => row.description_html !== undefined),
    rows.filter((row) => row.description_html === undefined).map(headerOnly),
  ];
  // first_seen_at is the database's clock; allow for it trailing ours.
  const newSince = runStartedAt.getTime() - 5 * 60 * 1000;
  let inserted = 0;
  for (const group of groups) {
    for (let index = 0; index < group.length; index += WRITE_BATCH) {
      const { data, error } = await supabase
        .from("jobs")
        .upsert(group.slice(index, index + WRITE_BATCH), { onConflict: "id" })
        .select("first_seen_at");
      if (error) throw new Error(`Saving jobs failed: ${error.message}`);
      inserted += (data || []).filter((row) => new Date(row.first_seen_at).getTime() >= newSince).length;
    }
  }
  return inserted;
};

/**
 * Deletes stored jobs a complete read didn't return — taken down at the
 * source. `boards` limits this to the boards that were read in full; null
 * means the whole source was.
 */
export const pruneUnseen = async (
  supabase: SupabaseClient,
  source: string,
  boards: string[] | null,
  runStartedAt: Date
) => {
  if (boards && !boards.length) return 0;
  let query = supabase
    .from("jobs")
    .delete({ count: "exact" })
    .eq("source", source)
    .lt("last_seen_at", runStartedAt.toISOString());
  if (boards) query = query.in("board", boards);
  const { count, error } = await query;
  if (error) throw new Error(`Removing closed ${source} jobs failed: ${error.message}`);
  return count || 0;
};

/**
 * The daily clean-up: jobs past the retention window or their own expiry date,
 * and startup.jobs rows not refreshed for six days (their terms).
 */
export const deleteExpiredJobs = async (supabase: SupabaseClient) => {
  const now = Date.now();
  const deletions = [
    supabase
      .from("jobs")
      .delete({ count: "exact" })
      .lt("posted_at", new Date(now - JOB_RETENTION_DAYS * DAY_MS).toISOString()),
    supabase.from("jobs").delete({ count: "exact" }).lt("expires_at", new Date(now).toISOString()),
    supabase
      .from("jobs")
      .delete({ count: "exact" })
      .eq("source", "startupjobs")
      .lt("last_seen_at", new Date(now - STARTUP_JOBS_STALE_DAYS * DAY_MS).toISOString()),
  ];
  let removed = 0;
  for (const deletion of deletions) {
    const { count, error } = await deletion;
    if (error) throw new Error(`Removing expired jobs failed: ${error.message}`);
    removed += count || 0;
  }
  return removed;
};

/**
 * startup.jobs' seven-day refresh-or-delete term reaches the copies kept in
 * users' saved lists too: the SQL function deletes a saved one of theirs a
 * week after the posting left the listings.
 */
export const pruneSavedJobs = async (supabase: SupabaseClient) => {
  const { data, error } = await supabase.rpc("prune_saved_jobs", {
    p_stale_days: STARTUP_JOBS_REFRESH_DAYS,
  });
  if (error) throw new Error(`Pruning saved jobs failed: ${error.message}`);
  return Number(data) || 0;
};

export const countJobs = async (supabase: SupabaseClient) => {
  const { count, error } = await supabase.from("jobs").select("id", { count: "exact", head: true });
  if (error) throw new Error(`Counting jobs failed: ${error.message}`);
  return count || 0;
};

// ---------------------------------------------------------------------------
// Run bookkeeping
// ---------------------------------------------------------------------------

export const createRun = async (supabase: SupabaseClient) => {
  const { data, error } = await supabase
    .from("job_ingest_runs")
    .insert({ started_at: new Date().toISOString() })
    .select("id")
    .single();
  if (error) throw new Error(`Starting the ingest run failed: ${error.message}`);
  return data.id as string;
};

export const recordSourceStart = async (supabase: SupabaseClient, runId: string, source: string) => {
  const { error } = await supabase
    .from("job_ingest_source_runs")
    .upsert({ run_id: runId, source, status: "running", started_at: new Date().toISOString() });
  if (error) console.error(`Job ingest: recording ${source}'s start failed`, error.message);
};

export const recordSourceResult = async (
  supabase: SupabaseClient,
  runId: string,
  summary: SourceRunSummary
) => {
  const { error } = await supabase.from("job_ingest_source_runs").upsert({
    run_id: runId,
    source: summary.source,
    status: summary.status,
    fetched: summary.fetched,
    new_jobs: summary.newJobs,
    removed: summary.removed,
    note: summary.note,
    finished_at: new Date().toISOString(),
  });
  if (error) console.error(`Job ingest: recording ${summary.source}'s result failed`, error.message);
};

export const loadSourceResults = async (supabase: SupabaseClient, runId: string) => {
  const { data, error } = await supabase
    .from("job_ingest_source_runs")
    .select("source, status, fetched, new_jobs, removed, note")
    .eq("run_id", runId);
  if (error) throw new Error(`Reading the run's results failed: ${error.message}`);
  return data || [];
};

export const finishRun = async (
  supabase: SupabaseClient,
  runId: string,
  fields: {
    jobs_expired?: number;
    companies_enriched?: number;
    jobs_total?: number | null;
    report_sent_at?: string | null;
    error?: string | null;
  }
) => {
  const { error } = await supabase
    .from("job_ingest_runs")
    .update({ ...fields, finished_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) console.error("Job ingest: finishing the run failed", error.message);
};
