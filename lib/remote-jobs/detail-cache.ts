import type { RemoteJob } from "@/lib/remote-jobs/types";

/**
 * Job descriptions never travel in a search response.
 *
 * Measured 2026-09-19: the 29 curated ATS boards carry 79MB of description
 * text, and a single page of 50 results would still be a few hundred KB of
 * prose the user mostly won't read — on a product whose users are mostly on
 * phones. So a search ships header fields only, and the description is fetched
 * for the one job someone actually opens.
 *
 * This cache makes that fetch free in the common case (search, then tap a
 * result). It lives in module scope, so it survives between requests on a warm
 * serverless instance and is simply cold after a restart — a miss costs one
 * cached upstream fetch, never a wrong answer.
 */

/** ~600 descriptions held at most; beyond that the oldest are dropped. */
const DETAIL_CACHE_LIMIT = 600;

/** Insertion-ordered Map used as an LRU. */
const cache = new Map<string, RemoteJob>();

/**
 * Parks the descriptions of the jobs about to be shown. Called once the page
 * has been chosen — remembering the whole candidate pool would churn the LRU
 * on every search for no benefit.
 *
 * Jobs with no description (Greenhouse's lite listing) are skipped: they would
 * occupy a slot and then answer a later lookup with an empty body.
 */
export const rememberJobs = (jobs: RemoteJob[]) => {
  for (const job of jobs) {
    if (!job.detailLoaded || !job.description) continue;
    if (cache.has(job.id)) cache.delete(job.id);
    cache.set(job.id, job);
  }
  while (cache.size > DETAIL_CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
};

export const recallJob = (id: string): RemoteJob | null => {
  const job = cache.get(id);
  if (!job) return null;
  // Refresh recency.
  cache.delete(id);
  cache.set(id, job);
  return job;
};

/** The list-safe copy: no description, flagged so the UI hydrates on open. */
export const stripDescription = (job: RemoteJob): RemoteJob => ({
  ...job,
  description: "",
  descriptionHtml: "",
  detailLoaded: false,
});
