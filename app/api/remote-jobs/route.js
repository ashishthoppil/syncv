import { NextResponse } from "next/server";
import { getJobListing, searchJobListings } from "@/lib/remote-jobs/search";
import {
  DEFAULT_SEARCH_PARAMS,
  FREE_PLAN_PREVIEW_JOBS,
  FREE_PLAN_VISIBLE_JOBS,
  MAX_SEARCH_OFFSET,
} from "@/lib/remote-jobs/types";
import {
  countFreeTrialScans,
  FREE_TRIAL_SCAN_LIMIT,
  getPlanForUser,
  getSupabaseAdminClient,
} from "@/lib/server/subscriptions";

const MAX_LIMIT = 50;

/**
 * The full list comes with a plan that includes Remote Jobs (Remote Jobs or
 * Pro). Without one, browsing the preview needs free-trial scans left, since
 * a job you can't scan is a dead end. The same conditions the dashboard uses
 * to draw the locks — enforced here too, because a screen that merely hides
 * the search still answers `curl`.
 */
const getAccess = async (userId) => {
  const supabase = getSupabaseAdminClient();
  const plan = await getPlanForUser(supabase, userId);
  if (plan?.includesRemoteJobs) return { canBrowse: true, fullList: true };
  const used = await countFreeTrialScans(supabase, userId);
  return { canBrowse: used < FREE_TRIAL_SCAN_LIMIT, fullList: false };
};

/**
 * Remote Jobs search, over the jobs the daily ingest stores
 * (app/api/cron/ingest-jobs). Nothing here calls a job API.
 *
 * `?id=<source:externalId>` resolves a single job, with its description.
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    // Same gate the rest of the dashboard APIs use: the feature is only
    // reachable from an authenticated screen, which always sends the user id.
    if (!userId) {
      return NextResponse.json({
        success: false,
        message: "Please log in to browse remote jobs.",
      });
    }

    const access = await getAccess(userId);
    if (!access.canBrowse) {
      return NextResponse.json({
        success: false,
        locked: true,
        message: "Your free trial is used up. Get the Remote Jobs or Pro plan to browse remote jobs.",
      });
    }

    const jobId = searchParams.get("id");
    if (jobId) {
      const job = await getJobListing(jobId);
      if (!job) {
        return NextResponse.json({
          success: false,
          message: "This job is no longer available.",
        });
      }
      return NextResponse.json({ success: true, data: job });
    }

    const requestedLimit = Number(searchParams.get("limit"));
    const requestedOffset = Number(searchParams.get("offset"));
    const read = (name) => searchParams.get(name) || "";
    const params = {
      ...DEFAULT_SEARCH_PARAMS,
      query: read("query").slice(0, 100),
      workplaceType: read("workplaceType"),
      location: read("location"),
      employmentType: read("employmentType"),
      seniority: read("seniority"),
      companyType: read("companyType"),
      companySize: read("companySize"),
      techStack: read("techStack"),
      industry: read("industry"),
      salary: read("salary"),
      postedWithinDays: Number(searchParams.get("postedWithinDays")) || 0,
      limit:
        Number.isFinite(requestedLimit) && requestedLimit > 0
          ? Math.min(requestedLimit, MAX_LIMIT)
          : DEFAULT_SEARCH_PARAMS.limit,
      offset:
        Number.isFinite(requestedOffset) && requestedOffset > 0
          ? Math.min(Math.floor(requestedOffset), MAX_SEARCH_OFFSET)
          : 0,
    };
    // Without a plan: the open preview plus the blurred run beneath it, and
    // no further pages.
    if (!access.fullList) {
      params.limit = Math.min(params.limit, FREE_PLAN_VISIBLE_JOBS + FREE_PLAN_PREVIEW_JOBS);
      params.offset = 0;
    }

    const { jobs, hasMore } = await searchJobListings(params);
    return NextResponse.json({
      success: true,
      data: jobs,
      hasMore: access.fullList && hasMore,
    });
  } catch (error) {
    console.error("Remote jobs search failed:", error);
    return NextResponse.json({
      success: false,
      message: "Job search is unavailable right now. Please try again shortly.",
    });
  }
}
