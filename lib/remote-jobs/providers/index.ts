import { rememberJobs, stripDescription } from "@/lib/remote-jobs/detail-cache";
import { keywordRelevance, RELEVANCE_TIERS } from "@/lib/remote-jobs/filters";
import { ashbyProvider } from "@/lib/remote-jobs/providers/ashby";
import { greenhouseProvider } from "@/lib/remote-jobs/providers/greenhouse";
import { jobicyProvider } from "@/lib/remote-jobs/providers/jobicy";
import { leverProvider } from "@/lib/remote-jobs/providers/lever";
import {
  MAX_SEARCH_OFFSET,
  type JobProvider,
  type RemoteJob,
  type RemoteJobSearchParams,
} from "@/lib/remote-jobs/types";

/**
 * The registry. Adding a source means writing a provider and appending it here
 * — search fans out across all of them and merges.
 *
 * Jobicy is an aggregator (one API, many employers, real keyword search). The
 * other three are ATS boards: first-party postings with far better description
 * text, but searchable only across the companies listed in companies.ts.
 */
export const JOB_PROVIDERS: JobProvider[] = [
  jobicyProvider,
  greenhouseProvider,
  ashbyProvider,
  leverProvider,
];

export const getProvider = (id: string) =>
  JOB_PROVIDERS.find((provider) => provider.id === id) || null;

export type SearchResult = {
  jobs: RemoteJob[];
  /** Providers that failed, so the UI can say results are incomplete. */
  failedProviders: string[];
  /** Whether another page exists past this one. */
  hasMore: boolean;
};

/**
 * On a duplicate, the source with the better record wins. The ATS boards are
 * the employer's own posting: first-party description, direct apply link, no
 * aggregator redirect. Jobicy is last because it re-lists other boards' jobs.
 */
const DEDUPE_PRIORITY = ["greenhouse", "ashby", "lever", "jobicy"];

/** Best match first: title phrase, then all words, some words, tag-only. */
const RELEVANCE_TIERS_DESC = [
  RELEVANCE_TIERS.PHRASE,
  RELEVANCE_TIERS.ALL_WORDS,
  RELEVANCE_TIERS.SOME_WORDS,
  RELEVANCE_TIERS.TAG,
] as const;

/** Same role at the same company, however the source spelled it. */
const dedupeKey = (job: RemoteJob) =>
  `${job.title}|${job.companyName}`.toLowerCase().replace(/[^a-z0-9|]+/g, "");

/**
 * Round-robin across sources instead of one global newest-first sort.
 *
 * Sorting by date alone let whichever source posts most often take the whole
 * page: measured on "engineer", Jobicy (median job age 4.5 days) took 41 of 50
 * slots while Greenhouse (45 days) and Ashby (72 days) split 9 between them and
 * Lever got none — despite those three offering 778 matching jobs. A plain
 * browse was 100% Jobicy. Recency still orders jobs *within* a source; it just
 * no longer decides how many slots each one gets.
 */
/**
 * Relevance first, source diversity second.
 *
 * Plain round-robin allocated slots by recency, so a search for "Frontend"
 * could lead with a job that only matched on a team label while an actual
 * "Senior Frontend Engineer" sat further down. That is worst for users without
 * a plan, who see just three results — those three have to be the best three,
 * not one-from-each-source.
 *
 * So jobs are bucketed by relevance tier and round-robin runs *inside* each
 * bucket: every title match is exhausted before any tag-only match appears, and
 * no single source can monopolise a bucket. With no keyword every job lands in
 * the same bucket, which is plain round-robin by recency.
 */
const interleaveByRelevanceThenSource = (
  groups: RemoteJob[][],
  take: number,
  query: string
) => {
  const tiers = [...RELEVANCE_TIERS_DESC];
  const merged: RemoteJob[] = [];
  for (const tier of tiers) {
    if (merged.length >= take) break;
    const banded = groups.map((group) =>
      group.filter((job) => keywordRelevance(job, query) === tier)
    );
    merged.push(...interleaveBySource(banded, take - merged.length));
  }
  return merged;
};

const interleaveBySource = (groups: RemoteJob[][], take: number) => {
  const merged: RemoteJob[] = [];
  const cursors = new Array(groups.length).fill(0);
  let placed = true;
  while (merged.length < take && placed) {
    placed = false;
    for (let i = 0; i < groups.length && merged.length < take; i += 1) {
      const group = groups[i];
      if (cursors[i] >= group.length) continue;
      merged.push(group[cursors[i]]);
      cursors[i] += 1;
      placed = true;
    }
  }
  return merged;
};

export const searchAllProviders = async (
  params: RemoteJobSearchParams
): Promise<SearchResult> => {
  const settled = await Promise.allSettled(
    JOB_PROVIDERS.map((provider) => provider.searchJobs(params))
  );

  const byProvider = new Map<string, RemoteJob[]>();
  const failedProviders: string[] = [];
  settled.forEach((outcome, index) => {
    const provider = JOB_PROVIDERS[index];
    if (outcome.status === "fulfilled") {
      byProvider.set(provider.id, outcome.value);
      return;
    }
    failedProviders.push(provider.name);
    console.error(`Remote jobs: ${provider.id} search failed`, outcome.reason);
  });

  // Drop cross-source duplicates before allocating slots, so a job listed on
  // both an ATS board and Jobicy doesn't consume two of them.
  const claimed = new Set<string>();
  const ordered = [...byProvider.keys()].sort(
    (a, b) => DEDUPE_PRIORITY.indexOf(a) - DEDUPE_PRIORITY.indexOf(b)
  );
  const groups: RemoteJob[][] = [];
  for (const providerId of ordered) {
    const unique: RemoteJob[] = [];
    for (const job of byProvider.get(providerId) || []) {
      const key = dedupeKey(job);
      if (claimed.has(key)) continue;
      claimed.add(key);
      unique.push(job);
    }
    // Best match first, then newest; the interleave decides across sources.
    unique.sort(
      (a, b) =>
        keywordRelevance(b, params.query) - keywordRelevance(a, params.query) ||
        (b.postedAt || "").localeCompare(a.postedAt || "")
    );
    groups.push(unique);
  }

  // Interleave one past the requested page so we can tell the UI whether a
  // "Load more" would actually yield anything.
  const offset = Math.max(0, params.offset);
  const merged = interleaveByRelevanceThenSource(
    groups,
    offset + params.limit + 1,
    params.query
  );
  const page = merged.slice(offset, offset + params.limit);

  // Hold descriptions only for the jobs being shown, then ship them without:
  // the ATS boards carry far too much text to put in a list response, and the
  // detail view hydrates whichever one the user opens.
  rememberJobs(page);

  return {
    jobs: page.map(stripDescription),
    failedProviders,
    hasMore:
      merged.length > offset + params.limit &&
      offset + params.limit < MAX_SEARCH_OFFSET,
  };
};

/** `id` is the provider-prefixed form, e.g. "jobicy:149527". */
export const getJobById = async (id: string): Promise<RemoteJob | null> => {
  const separator = id.indexOf(":");
  if (separator < 1) return null;
  const provider = getProvider(id.slice(0, separator));
  if (!provider) return null;
  return provider.getJob(id.slice(separator + 1));
};
