import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/jobs-ingest/cron-auth";
import { runIngestSource } from "@/lib/jobs-ingest/run-source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Pulls one source into Supabase for the given run. Called by the dispatcher
 * (../route.js), one invocation per source.
 */
export async function GET(req, { params }) {
  if (!isCronRequest(req)) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  const { source } = await params;
  const runId = new URL(req.url).searchParams.get("run");
  if (!runId) {
    return NextResponse.json({ success: false, message: "Missing run id." }, { status: 400 });
  }
  const summary = await runIngestSource(source, runId);
  return NextResponse.json(summary);
}
