import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { getSupabaseAdminClient } from "@/lib/server/subscriptions";
import { getLiveJobListings } from "@/lib/remote-jobs/search";
import { MAX_SAVED_JOBS } from "@/lib/remote-jobs/types";

/**
 * A user's saved Remote Jobs.
 *
 *   GET           the list, newest first, each marked `expired` once its
 *                 posting has left the listings
 *   POST {jobId}  save a posting
 *   DELETE ?id=   remove one; `?expired=1` removes every expired one
 *
 * The caller is resolved from their access token (lib/server/auth.js), never
 * from a user id in the request. Any signed-in user may keep a list: the
 * preview everyone browses can be saved from, plan or no plan.
 */

const fail = (status, message, extra = {}) =>
  NextResponse.json({ success: false, message, ...extra }, { status });

const requireUser = async (req) => {
  const user = await getAuthenticatedUser(req);
  return user ? { user } : { response: fail(401, "Please log in to save jobs.") };
};

/** Newest first. A live posting shows as it is now; an expired one as saved. */
const loadSavedJobs = async (supabase, userId) => {
  const { data, error } = await supabase
    .from("saved_jobs")
    .select("job_id, job, saved_at")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false })
    .limit(MAX_SAVED_JOBS);
  if (error) throw new Error(`Loading saved jobs failed: ${error.message}`);
  const rows = data || [];
  const live = await getLiveJobListings(rows.map((row) => row.job_id));
  return rows.map((row) => {
    const current = live.get(row.job_id);
    return { ...(current || row.job), id: row.job_id, savedAt: row.saved_at, expired: !current };
  });
};

export async function GET(req) {
  try {
    const { user, response } = await requireUser(req);
    if (response) return response;
    const jobs = await loadSavedJobs(getSupabaseAdminClient(), user.id);
    return NextResponse.json({ success: true, data: jobs });
  } catch (error) {
    console.error("Loading saved jobs failed:", error);
    return fail(500, "Your saved jobs couldn't be loaded right now. Please try again.");
  }
}

export async function POST(req) {
  try {
    const { user, response } = await requireUser(req);
    if (response) return response;
    const body = await req.json().catch(() => ({}));
    const jobId = typeof body?.jobId === "string" ? body.jobId.trim() : "";
    if (!jobId || jobId.length > 300) return fail(400, "Which job should be saved?");

    // The copy kept for later comes from our own listing, never from the
    // request, and only a live posting can be saved.
    const job = (await getLiveJobListings([jobId])).get(jobId);
    if (!job) return fail(404, "This job is no longer available.");

    const supabase = getSupabaseAdminClient();
    const { data: existing, error: existingError } = await supabase
      .from("saved_jobs")
      .select("saved_at")
      .eq("user_id", user.id)
      .eq("job_id", jobId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) {
      return NextResponse.json({
        success: true,
        data: { ...job, savedAt: existing.saved_at, expired: false },
      });
    }

    const { count, error: countError } = await supabase
      .from("saved_jobs")
      .select("job_id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if (countError) throw new Error(countError.message);
    if ((count || 0) >= MAX_SAVED_JOBS) {
      return fail(
        409,
        `You've saved ${MAX_SAVED_JOBS} jobs, the most we keep. Remove a few to save more.`
      );
    }

    const savedAt = new Date().toISOString();
    const { error: saveError } = await supabase.from("saved_jobs").upsert(
      { user_id: user.id, job_id: jobId, job, saved_at: savedAt, refreshed_at: savedAt },
      { onConflict: "user_id,job_id", ignoreDuplicates: true }
    );
    if (saveError) throw new Error(saveError.message);
    return NextResponse.json({ success: true, data: { ...job, savedAt, expired: false } });
  } catch (error) {
    console.error("Saving job failed:", error);
    return fail(500, "We couldn't save that job. Please try again.");
  }
}

export async function DELETE(req) {
  try {
    const { user, response } = await requireUser(req);
    if (response) return response;
    const supabase = getSupabaseAdminClient();
    const { searchParams } = new URL(req.url);

    let jobIds;
    if (searchParams.get("expired") === "1") {
      const jobs = await loadSavedJobs(supabase, user.id);
      jobIds = jobs.filter((job) => job.expired).map((job) => job.id);
    } else {
      const jobId = (searchParams.get("id") || "").trim();
      if (!jobId) return fail(400, "Which job should be removed?");
      jobIds = [jobId];
    }

    // In batches: PostgREST carries an `in` filter in the URL.
    for (let index = 0; index < jobIds.length; index += 100) {
      const { error } = await supabase
        .from("saved_jobs")
        .delete()
        .eq("user_id", user.id)
        .in("job_id", jobIds.slice(index, index + 100));
      if (error) throw new Error(error.message);
    }
    return NextResponse.json({ success: true, removed: jobIds.length });
  } catch (error) {
    console.error("Removing saved job failed:", error);
    return fail(500, "We couldn't remove that job. Please try again.");
  }
}
