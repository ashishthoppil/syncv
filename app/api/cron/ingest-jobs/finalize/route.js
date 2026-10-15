import { after, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isCronRequest } from "@/lib/jobs-ingest/cron-auth";
import { finalizeIngestRun } from "@/lib/jobs-ingest/finalize";
import { JOB_LISTINGS_CACHE_TAG } from "@/lib/remote-jobs/search";
import { getSupabaseAdminClient } from "@/lib/server/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Leaves this long for a run's sources before the safety net may report on it,
 * so it never emails about a run that is still going.
 */
const SAFETY_NET_MIN_AGE_MS = 10 * 60 * 1000;

/**
 * Clean-up, company classification and the daily report email.
 *
 * With `?run=<id>`: the dispatcher's hand-off, straight after the sources.
 * Without: the safety-net cron (vercel.json), which reports on the latest run
 * if that hand-off never happened. The report is claimed atomically, so it
 * goes out once either way.
 *
 * Replies immediately and works in the background, so the dispatcher isn't
 * held past its own time limit waiting for it.
 */
export async function GET(req) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  const runId = new URL(req.url).searchParams.get("run");

  if (!runId) {
    const { data: latest } = await getSupabaseAdminClient()
      .from("job_ingest_runs")
      .select("started_at, report_sent_at")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!latest || latest.report_sent_at) {
      return NextResponse.json({ success: true, status: latest ? "already-sent" : "no-run" });
    }
    if (Date.now() - new Date(latest.started_at).getTime() < SAFETY_NET_MIN_AGE_MS) {
      return NextResponse.json({ success: true, status: "too-recent" });
    }
  }

  after(async () => {
    try {
      const result = await finalizeIngestRun(runId);
      // Expired jobs were just deleted.
      revalidateTag(JOB_LISTINGS_CACHE_TAG);
      console.log("Job ingest: finalize", result);
    } catch (error) {
      console.error("Job ingest: finalize failed", error);
    }
  });

  return NextResponse.json({ success: true, status: "queued" }, { status: 202 });
}
