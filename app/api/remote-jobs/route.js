import { NextResponse } from "next/server";
import { getJobById, searchAllProviders } from "@/lib/remote-jobs/providers";
import { DEFAULT_SEARCH_PARAMS, MAX_SEARCH_OFFSET } from "@/lib/remote-jobs/types";

const MAX_LIMIT = 50;

/**
 * Remote Jobs search. Reads from public job-board APIs only — nothing here
 * touches user data, and provider responses are cached for an hour inside the
 * provider (their terms ask for at most hourly polling).
 *
 * `?id=<provider:externalId>` resolves a single job for a direct link.
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

    const jobId = searchParams.get("id");
    if (jobId) {
      const job = await getJobById(jobId);
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
    const params = {
      ...DEFAULT_SEARCH_PARAMS,
      query: searchParams.get("query") || "",
      remoteLocation: searchParams.get("remoteLocation") || "",
      employmentType: searchParams.get("employmentType") || "",
      experienceLevel: searchParams.get("experienceLevel") || "",
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

    const { jobs, failedProviders, hasMore } = await searchAllProviders(params);

    // Every provider is down: that is an outage, not an empty result set. Only
    // on the first page — a failed provider mid-scroll just ends the list.
    if (!jobs.length && failedProviders.length && !params.offset) {
      return NextResponse.json({
        success: false,
        message: "Job search is unavailable right now. Please try again shortly.",
      });
    }

    return NextResponse.json({
      success: true,
      data: jobs,
      hasMore,
      // Set when some (but not all) sources failed, so the UI can note that
      // results are partial instead of implying the search was exhaustive.
      partialSources: failedProviders,
    });
  } catch (error) {
    console.error("Remote jobs search failed:", error);
    return NextResponse.json({
      success: false,
      message: "Job search is unavailable right now. Please try again shortly.",
    });
  }
}
