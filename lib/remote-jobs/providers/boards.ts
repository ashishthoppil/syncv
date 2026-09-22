import { recallJob, rememberJobs } from "@/lib/remote-jobs/detail-cache";
import { matchesAllFilters } from "@/lib/remote-jobs/filters";
import type { RemoteJob, RemoteJobSearchParams } from "@/lib/remote-jobs/types";

/**
 * Shared machinery for the ATS providers (Greenhouse, Lever, Ashby).
 *
 * These are per-company job boards, not searchable indexes: there is no "find
 * React jobs across Greenhouse", only "give me Anthropic's 610 jobs". So a
 * search fans out across a curated company list and filters locally.
 *
 * Two measurements shape everything here (taken 2026-09-19):
 *  - 29 boards fetched in parallel complete in ~1.7s, so latency is fine.
 *  - The same 29 boards carry 79MB of job descriptions, and 12 of them exceed
 *    Next's 2MB per-entry fetch-cache limit, so they don't cache. One Ashby
 *    board (OpenAI) is 12.9MB on its own.
 *
 * Hence: descriptions never travel in a search response — see detail-cache.ts,
 * which parks them and hands them out one at a time to getJob.
 */

const BOARD_CACHE_SECONDS = 3600;
/** Simultaneous board fetches. Low enough that a few 10MB boards can't land at once. */
const FETCH_CONCURRENCY = 6;

/**
 * Ceiling on how long one board may hold up a search.
 *
 * Measured 2026-09-22: Lever's API is an order of magnitude slower than
 * Greenhouse or Ashby — single boards took 2-3.5s, and running all twelve in
 * parallel still took 8.4s, so it appears to throttle per caller. Without a
 * bound, one degraded source decides the latency of the whole feature.
 *
 * Implemented as a race rather than an AbortSignal on purpose: aborting would
 * also discard the in-flight response, and passing a signal risks bypassing
 * Next's fetch cache. Letting the slow request run on means it still warms the
 * cache for the next search, which is exactly what a slow board needs.
 */
const BOARD_TIMEOUT_MS = 8000;

const withTimeout = <T>(work: Promise<T>, label: string): Promise<T> =>
  Promise.race([
    work,
    new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`${label} timed out after ${BOARD_TIMEOUT_MS}ms`)),
        BOARD_TIMEOUT_MS
      );
    }),
  ]);

/** Splits `company~externalId` — company slugs and ids never contain "~". */
const ID_SEPARATOR = "~";

export const buildBoardJobId = (company: string, externalId: string) =>
  `${company}${ID_SEPARATOR}${externalId}`;

export const parseBoardJobId = (value: string) => {
  const index = value.indexOf(ID_SEPARATOR);
  if (index < 1) return null;
  return {
    company: value.slice(0, index),
    externalId: value.slice(index + ID_SEPARATOR.length),
  };
};

export const fetchBoardJson = async <T>(
  url: string,
  sourceName: string
): Promise<T> => {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: BOARD_CACHE_SECONDS },
  });
  if (!response.ok) {
    throw new Error(`${sourceName} board responded with ${response.status}`);
  }
  return response.json() as Promise<T>;
};

/** Runs `task` over `items`, at most `limit` at a time. */
const pooled = async <T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> => {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { status: "fulfilled", value: await task(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(workers);
  return results;
};

export type BoardSearchOptions = {
  providerId: string;
  companies: readonly string[];
  /** Returns every posting on one company's board, already normalized. */
  loadBoard: (company: string) => Promise<RemoteJob[]>;
  params: RemoteJobSearchParams;
};

/**
 * Fans out across a provider's boards and returns this provider's matches, in
 * full. The registry merges these with the other providers' candidates, picks
 * the page, and only then drops descriptions. A board that fails is skipped —
 * one company's outage must not empty the whole search.
 */
export const searchBoards = async ({
  providerId,
  companies,
  loadBoard,
  params,
}: BoardSearchOptions): Promise<RemoteJob[]> => {
  const settled = await pooled(companies, FETCH_CONCURRENCY, (company) =>
    withTimeout(loadBoard(company), `${providerId}/${company}`)
  );

  const matched: RemoteJob[] = [];
  settled.forEach((outcome, index) => {
    if (outcome.status === "rejected") {
      console.error(
        `Remote jobs: ${providerId} board "${companies[index]}" failed`,
        outcome.reason
      );
      return;
    }
    for (const job of outcome.value) {
      if (!job.remote) continue;
      if (!matchesAllFilters(job, params)) continue;
      matched.push(job);
    }
  });

  matched.sort((a, b) => (b.postedAt || "").localeCompare(a.postedAt || ""));
  // Enough candidates to cover the requested page once interleaved.
  return matched.slice(0, params.offset + params.limit);
};

export type BoardGetJobOptions = {
  providerId: string;
  loadBoard: (company: string) => Promise<RemoteJob[]>;
  /** `company~externalId`, as produced by buildBoardJobId. */
  value: string;
};

/**
 * Resolves one job in full. The common path — search, then tap a result — is a
 * cache hit. A direct link or a restarted instance falls back to reloading just
 * that company's board, which is one cached fetch rather than a full fan-out.
 */
export const getBoardJob = async ({
  providerId,
  loadBoard,
  value,
}: BoardGetJobOptions): Promise<RemoteJob | null> => {
  const parsed = parseBoardJobId(value);
  if (!parsed) return null;

  const cached = recallJob(`${providerId}:${value}`);
  if (cached) return cached;

  try {
    const jobs = await loadBoard(parsed.company);
    const job = jobs.find((entry) => entry.externalId === parsed.externalId);
    if (job) rememberJobs([job]);
    return job || null;
  } catch (error) {
    console.error(`Remote jobs: ${providerId} getJob failed for ${value}`, error);
    return null;
  }
};
