import { hasTimeLeft, pooled } from "../http";
import type { SourceFetchResult, SourceJob } from "../types";

/**
 * Shared machinery for the per-company ATS sources. A board that fails is
 * skipped — one company's outage must not empty the whole source — and only
 * boards that were read completely are offered for pruning, so a failed board
 * never has its stored jobs deleted.
 */

export type BoardRead = {
  jobs: SourceJob[];
  /** False when part of the board was skipped (a page cap, a rate limit). */
  complete: boolean;
  /** New postings whose description couldn't be fetched in time. */
  deferred?: number;
};

export const readBoards = async ({
  boards,
  concurrency,
  deadline,
  read,
}: {
  boards: readonly string[];
  concurrency: number;
  deadline: number;
  read: (board: string) => Promise<BoardRead>;
}): Promise<SourceFetchResult> => {
  const settled = await pooled(boards, concurrency, async (board) => {
    if (!hasTimeLeft(deadline)) throw new Error("out of time");
    return read(board);
  });

  const jobs: SourceJob[] = [];
  const completeBoards: string[] = [];
  const failed: string[] = [];
  let incomplete = 0;
  let deferred = 0;
  settled.forEach((outcome, index) => {
    const board = boards[index];
    if (outcome.status === "rejected") {
      failed.push(board);
      console.error(`Job ingest: board "${board}" failed`, outcome.reason);
      return;
    }
    jobs.push(...outcome.value.jobs);
    deferred += outcome.value.deferred || 0;
    if (outcome.value.complete) completeBoards.push(board);
    else incomplete += 1;
  });

  const notes = [
    failed.length ? `${failed.length} of ${boards.length} boards failed (${failed.slice(0, 4).join(", ")})` : "",
    incomplete ? `${incomplete} boards read in part` : "",
    deferred ? `${deferred} new jobs left for the next run (time limit)` : "",
  ].filter(Boolean);

  return {
    jobs,
    completeBoards,
    partial: failed.length > 0 || incomplete > 0 || deferred > 0,
    note: notes.join("; ") || undefined,
  };
};

/**
 * Fetches descriptions for the postings we don't have yet, until `deadline`.
 * Postings we already store come back as header-only jobs (description left
 * undefined) so they stay listed without being re-downloaded.
 */
export const hydrateNew = async <T>({
  candidates,
  existingIds,
  idOf,
  deadline,
  concurrency,
  toHeader,
  fetchFull,
}: {
  candidates: T[];
  existingIds: Set<string>;
  idOf: (candidate: T) => string;
  deadline: number;
  concurrency: number;
  toHeader: (candidate: T) => SourceJob | null;
  fetchFull: (candidate: T) => Promise<SourceJob | null>;
}): Promise<{ jobs: SourceJob[]; deferred: number }> => {
  const jobs: SourceJob[] = [];
  const fresh: T[] = [];
  for (const candidate of candidates) {
    if (existingIds.has(idOf(candidate))) {
      const header = toHeader(candidate);
      if (header) jobs.push(header);
    } else {
      fresh.push(candidate);
    }
  }

  let deferred = 0;
  const settled = await pooled(fresh, concurrency, async (candidate) => {
    // Leave room to write what we have.
    if (!hasTimeLeft(deadline)) {
      deferred += 1;
      return null;
    }
    return fetchFull(candidate);
  });
  for (const outcome of settled) {
    if (outcome.status === "fulfilled" && outcome.value) jobs.push(outcome.value);
    if (outcome.status === "rejected") deferred += 1;
  }
  return { jobs, deferred };
};
