import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { cronHeaders, isCronRequest } from "@/lib/jobs-ingest/cron-auth";
import { INGEST_SOURCES } from "@/lib/jobs-ingest/sources";
import { createRun } from "@/lib/jobs-ingest/store";
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

  const origin = new URL(req.url).origin;
  const runId = await createRun(getSupabaseAdminClient());

  const settled = await Promise.allSettled(
    INGEST_SOURCES.map(async (source) => {
      const response = await fetch(
        `${origin}/api/cron/ingest-jobs/${source.id}?run=${encodeURIComponent(runId)}`,
        { headers: cronHeaders(), cache: "no-store", signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) }
      );
      return response.json();
    })
  );
  const sources = settled.map((outcome, index) =>
    outcome.status === "fulfilled"
      ? outcome.value
      : { source: INGEST_SOURCES[index].id, status: "failed", note: String(outcome.reason) }
  );

  // Searches are cached until the data changes; it just did.
  revalidateTag(JOB_LISTINGS_CACHE_TAG);

  let reportQueued = false;
  try {
    const response = await fetch(
      `${origin}/api/cron/ingest-jobs/finalize?run=${encodeURIComponent(runId)}`,
      { headers: cronHeaders(), cache: "no-store", signal: AbortSignal.timeout(5_000) }
    );
    reportQueued = response.ok;
  } catch (error) {
    // The safety-net cron (vercel.json) sends the report if this hand-off fails.
    console.error("Job ingest: handing off the report failed", error);
  }

  return NextResponse.json({ success: true, runId, reportQueued, sources });
}
