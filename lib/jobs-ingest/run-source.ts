import { getSupabaseAdminClient } from "@/lib/server/subscriptions";
import { JOB_RETENTION_DAYS } from "@/lib/remote-jobs/types";
import { toCompanyRow, toJobRow } from "./normalize";
import { getIngestSource } from "./sources";
import {
  ensureCompanies,
  getNewestPostedAt,
  loadExistingIds,
  pruneUnseen,
  recordSourceResult,
  recordSourceStart,
  upsertJobs,
} from "./store";
import type { CompanyRow, JobRow, SourceRunSummary } from "./types";

/**
 * How long a source may spend talking to its API. Each source runs in its own
 * function invocation capped at 60s (the Hobby-plan limit), and the rest of
 * that minute is for normalising and writing to Supabase.
 */
export const SOURCE_FETCH_BUDGET_MS = 35_000;

/**
 * Pulls one source and writes it to Supabase: new jobs inserted, known jobs
 * refreshed, and — where the source was read completely — jobs it no longer
 * lists deleted. Never throws; the outcome is recorded against the run and
 * returned for the report.
 */
export const runIngestSource = async (sourceId: string, runId: string): Promise<SourceRunSummary> => {
  const startedAt = new Date();
  const deadline = startedAt.getTime() + SOURCE_FETCH_BUDGET_MS;
  const supabase = getSupabaseAdminClient();
  const source = getIngestSource(sourceId);
  const summary: SourceRunSummary = {
    source: sourceId,
    status: "ok",
    fetched: 0,
    newJobs: 0,
    removed: 0,
    note: null,
  };

  if (!source) {
    return { ...summary, status: "failed", note: "Unknown source" };
  }
  if (source.isConfigured && !source.isConfigured()) {
    const skipped = { ...summary, status: "skipped" as const, note: "API key not set" };
    await recordSourceResult(supabase, runId, skipped);
    return skipped;
  }

  await recordSourceStart(supabase, runId, sourceId);
  try {
    const windowStart = new Date(startedAt.getTime() - JOB_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    let existing: Promise<Set<string>> | null = null;
    const result = await source.fetchJobs({
      deadline,
      windowStart,
      newestStored: await getNewestPostedAt(supabase, sourceId),
      existingIds: () => (existing ??= loadExistingIds(supabase, sourceId)),
    });

    const rows = new Map<string, JobRow>();
    const companies: CompanyRow[] = [];
    for (const job of result.jobs) {
      const row = toJobRow(sourceId, job, { now: startedAt, windowStart });
      if (!row || rows.has(row.id)) continue;
      rows.set(row.id, row);
      companies.push(toCompanyRow(job, row));
    }

    await ensureCompanies(supabase, companies);
    summary.fetched = rows.size;
    summary.newJobs = await upsertJobs(supabase, [...rows.values()], startedAt);
    if (result.complete) {
      summary.removed = await pruneUnseen(supabase, sourceId, null, startedAt);
    } else if (result.completeBoards) {
      summary.removed = await pruneUnseen(supabase, sourceId, result.completeBoards, startedAt);
    }
    summary.status = result.partial ? "partial" : "ok";
    summary.note = result.note || null;
  } catch (error) {
    console.error(`Job ingest: ${sourceId} failed`, error);
    summary.status = "failed";
    summary.note = error instanceof Error ? error.message.slice(0, 300) : "Unknown error";
  }

  await recordSourceResult(supabase, runId, summary);
  return summary;
};
