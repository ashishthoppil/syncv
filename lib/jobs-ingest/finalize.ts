import { sendJobIngestReportEmail } from "@/lib/server/email";
import { getSupabaseAdminClient } from "@/lib/server/subscriptions";
import { JOB_RETENTION_DAYS, SOURCE_NAMES } from "@/lib/remote-jobs/types";
import { enrichPendingCompanies } from "./enrich-companies";
import { INGEST_SOURCES } from "./sources";
import {
  countJobs,
  deleteExpiredJobs,
  finishRun,
  loadSourceResults,
  pruneSavedJobs,
} from "./store";

/** What finalize may spend classifying companies before the report goes out. */
const ENRICH_BUDGET_MS = 35_000;

/**
 * The run's last step: delete expired jobs, classify new companies, and email
 * the per-source report. Called by the dispatcher once every source has
 * answered, and again by a later safety-net cron in case that hand-off was
 * lost — the report is claimed atomically, so it is only ever sent once.
 *
 * `runId` null means "the latest run".
 */
export const finalizeIngestRun = async (runId: string | null) => {
  const supabase = getSupabaseAdminClient();
  const startedAt = Date.now();

  let query = supabase.from("job_ingest_runs").select("id, started_at, report_sent_at");
  query = runId ? query.eq("id", runId) : query.order("started_at", { ascending: false }).limit(1);
  const { data: run, error } = await query.maybeSingle();
  if (error) throw new Error(`Reading the ingest run failed: ${error.message}`);
  if (!run) return { status: "no-run" as const };
  if (run.report_sent_at) return { status: "already-sent" as const, runId: run.id };

  // Claim the report before doing anything slow, so a concurrent call (the
  // safety-net cron landing while the dispatcher's hand-off is still running)
  // backs off instead of sending a second email.
  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from("job_ingest_runs")
    .update({ report_sent_at: claimedAt })
    .eq("id", run.id)
    .is("report_sent_at", null)
    .select("id");
  if (claimError) throw new Error(`Claiming the report failed: ${claimError.message}`);
  if (!claimed?.length) return { status: "already-sent" as const, runId: run.id };

  let expired = 0;
  let companiesEnriched = 0;
  const problems: string[] = [];
  try {
    expired = await deleteExpiredJobs(supabase);
  } catch (cleanupError) {
    problems.push(String(cleanupError));
  }
  try {
    await pruneSavedJobs(supabase);
  } catch (pruneError) {
    problems.push(String(pruneError));
  }
  try {
    companiesEnriched = await enrichPendingCompanies(supabase, startedAt + ENRICH_BUDGET_MS);
  } catch (enrichError) {
    problems.push(String(enrichError));
  }

  const results = await loadSourceResults(supabase, run.id);
  const byId = new Map(results.map((row) => [row.source, row]));
  const sources = INGEST_SOURCES.map((source) => {
    const row = byId.get(source.id);
    return {
      name: SOURCE_NAMES[source.id] || source.name,
      status: row?.status || "missing",
      fetched: row?.fetched || 0,
      newJobs: row?.new_jobs || 0,
      removed: row?.removed || 0,
      note: row?.note || (row ? null : "The source's function never reported back."),
    };
  });
  const jobsLive = await countJobs(supabase).catch(() => null);

  try {
    await sendJobIngestReportEmail({
      ranAt: run.started_at,
      sources,
      totals: {
        fetched: sources.reduce((sum, source) => sum + source.fetched, 0),
        newJobs: sources.reduce((sum, source) => sum + source.newJobs, 0),
        removed: sources.reduce((sum, source) => sum + source.removed, 0),
        expired,
        companiesEnriched,
        jobsLive,
        retentionDays: JOB_RETENTION_DAYS,
      },
    });
  } catch (sendError) {
    // Release the claim so the safety-net cron can try again.
    await supabase.from("job_ingest_runs").update({ report_sent_at: null }).eq("id", run.id);
    throw sendError;
  }

  await finishRun(supabase, run.id, {
    jobs_expired: expired,
    companies_enriched: companiesEnriched,
    jobs_total: jobsLive,
    report_sent_at: claimedAt,
    error: problems.length ? problems.join("; ").slice(0, 1000) : null,
  });
  return { status: "sent" as const, runId: run.id, expired, companiesEnriched };
};
