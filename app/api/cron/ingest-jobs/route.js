import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { cronHeaders, internalBaseUrl, isCronRequest } from "@/lib/jobs-ingest/cron-auth";
import { INGEST_SOURCES } from "@/lib/jobs-ingest/sources";
import { createRun, recordSourceResult } from "@/lib/jobs-ingest/store";
import { JOB_LISTINGS_CACHE_TAG } from "@/lib/remote-jobs/search";
import { getSupabaseAdminClient } from "@/lib/server/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The Hobby-plan ceiling, so this works on any plan.
export const maxDuration = 60;

/** Sources get 35s of fetching plus their writes; past this they've overrun. */
const SOURCE_TIMEOUT_MS = 50_000;

/**
 * The daily Remote Jobs ingest — Vercel Cron, 23:59 IST (vercel.json).
 *
 * Each source runs in its own function invocation, so one slow API (Himalayas
 * pages 20 jobs at a time) can't run another out of time, and they all run in
 * parallel. Once every source has answered, the report step is handed off; it
 * replies at once and does its work in the background.
 *
 * Manual run: curl -H "Authorization: Bearer $CRON_SECRET" https://syncv.app/api/cron/ingest-jobs
 */
export async function GET(req) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const base = internalBaseUrl();
  const supabase = getSupabaseAdminClient();
  const runId = await createRun(supabase);

  const sources = await Promise.all(
    INGEST_SOURCES.map(async (source) => {
      const url = `${base}/api/cron/ingest-jobs/${source.id}?run=${encodeURIComponent(runId)}`;
      let failure;
      try {
        const response = await fetch(url, {
          headers: cronHeaders(),
          cache: "no-store",
          signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS),
        });
        if (response.ok) return await response.json();
        // Refused before the source could start (protection, auth, routing),
        // so nothing recorded it. Say why, or the report can only say the
        // source "never reported back".
        const body = (await response.text()).replace(/\s+/g, " ").slice(0, 120);
        failure = `HTTP ${response.status} calling ${url}: ${body}`;
      } catch (error) {
        // Timed out: the source may still be running and will record its own
        // result, so leave its row alone.
        if (error?.name === "TimeoutError" || error?.name === "AbortError") {
          return { source: source.id, status: "running", note: "still running at the dispatcher's time limit" };
        }
        failure = `Couldn't call ${url}: ${error?.message || error}`;
      }
      const summary = { source: source.id, status: "failed", fetched: 0, newJobs: 0, removed: 0, note: failure };
      await recordSourceResult(supabase, runId, summary);
      return summary;
    })
  );

  // Searches are cached until the data changes; it just did.
  revalidateTag(JOB_LISTINGS_CACHE_TAG);

  let reportQueued = false;
  try {
    const response = await fetch(
      `${base}/api/cron/ingest-jobs/finalize?run=${encodeURIComponent(runId)}`,
      { headers: cronHeaders(), cache: "no-store", signal: AbortSignal.timeout(5_000) }
    );
    reportQueued = response.ok;
    if (!response.ok) console.error("Job ingest: report hand-off refused", response.status);
  } catch (error) {
    // The safety-net cron (vercel.json) sends the report if this hand-off fails.
    console.error("Job ingest: handing off the report failed", error);
  }

  return NextResponse.json({ success: true, runId, reportQueued, sources });
}
