import { recallJob, rememberJobs } from "@/lib/remote-jobs/detail-cache";
import {
  matchesKeyword,
  matchesMetadataFilters,
  upstreamKeyword,
} from "@/lib/remote-jobs/filters";
import {
  decodeEntities,
  htmlToPlainText,
  sanitizeJobHtml,
} from "@/lib/remote-jobs/sanitize";
import {
  dedupeLabels,
  type JobProvider,
  type RemoteJob,
  type RemoteJobSearchParams,
} from "@/lib/remote-jobs/types";

/**
 * Jobicy's public remote-jobs API (no key). Their terms ask that we keep them
 * credited as the source, preserve the canonical job URL, and poll at most
 * hourly — hence `revalidate: 3600` on every request below, and the "via
 * Jobicy" line the UI renders next to each result.
 *
 * https://jobicy.com/jobs-rss-feed
 */
const API_BASE = "https://jobicy.com/api/v2/remote-jobs";
const SOURCE_ID = "jobicy";
const SOURCE_NAME = "Jobicy";
const CACHE_SECONDS = 3600;

/**
 * Jobicy answers a `tag` outside these bounds with
 * `success:false, error: "The length of the 'tag' value should be between 3 and
 * 50 characters"` — which `fetchFeed` raises, losing the entire source for the
 * search. Every two-letter query did this: hr, qa, ai, ux, ml, go.
 */
const TAG_MIN_LENGTH = 3;
const TAG_MAX_LENGTH = 50;

type JobicyJob = {
  id: number | string;
  url?: string;
  jobTitle?: string;
  companyName?: string;
  companyLogo?: string;
  jobIndustry?: string[] | string;
  jobType?: string[] | string;
  jobGeo?: string;
  jobLevel?: string;
  jobExcerpt?: string;
  jobDescription?: string;
  pubDate?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: string | null;
};

/**
 * "Remote from <X>" maps to the set of Jobicy regions an applicant based in X
 * is actually eligible for. Jobicy has no India slug, so an India-based
 * candidate gets APAC-eligible roles plus worldwide ones — we never relabel
 * those as "India", the card shows whatever region the source printed.
 */
const GEO_SLUGS: Record<string, string[]> = {
  india: ["apac", "anywhere"],
  "united-states": ["usa", "anywhere"],
  "united-kingdom": ["uk", "anywhere"],
  europe: ["europe", "anywhere"],
  anywhere: ["anywhere"],
};

const toArray = (value: string[] | string | undefined): string[] => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
};

const formatSalary = (job: JobicyJob): string => {
  const min = Number(job.salaryMin) || 0;
  const max = Number(job.salaryMax) || 0;
  if (!min && !max) return "";
  const currency = (job.salaryCurrency || "").toUpperCase();
  const period = job.salaryPeriod ? ` / ${job.salaryPeriod}` : "";
  const amount =
    min && max
      ? `${min.toLocaleString()} - ${max.toLocaleString()}`
      : `${(min || max).toLocaleString()}`;
  return `${currency} ${amount}${period}`.trim();
};

export const normalizeJob = (job: JobicyJob): RemoteJob | null => {
  const externalId = String(job.id || "").trim();
  const title = decodeEntities((job.jobTitle || "").trim());
  if (!externalId || !title) return null;

  const descriptionHtml = sanitizeJobHtml(job.jobDescription || "");
  const description =
    htmlToPlainText(job.jobDescription || "") || (job.jobExcerpt || "").trim();
  // jobGeo arrives as "LATAM,  Canada,  USA" — one entry per eligible region.
  const remoteCountries = (job.jobGeo || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    id: `${SOURCE_ID}:${externalId}`,
    externalId,
    source: SOURCE_ID,
    sourceName: SOURCE_NAME,
    sourceUrl: job.url || "",
    applicationUrl: job.url || "",
    title,
    companyName: decodeEntities((job.companyName || "").trim()),
    companyLogo: job.companyLogo || "",
    description,
    descriptionHtml,
    location: "",
    remote: true,
    remoteCountries,
    employmentType: toArray(job.jobType).join(", "),
    // "Any" is Jobicy's way of saying the posting names no level. Treat it as
    // absent so the UI doesn't print a meaningless "Any" chip.
    experienceLevel:
      (job.jobLevel || "").trim().toLowerCase() === "any"
        ? ""
        : (job.jobLevel || "").trim(),
    salary: formatSalary(job),
    skills: [],
    categories: dedupeLabels(toArray(job.jobIndustry)),
    postedAt: job.pubDate ? new Date(job.pubDate).toISOString() : "",
    // Jobicy ships the whole description in its list response.
    detailLoaded: true,
  };
};

const fetchFeed = async (
  params: Record<string, string>
): Promise<JobicyJob[]> => {
  const url = new URL(API_BASE);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: CACHE_SECONDS },
  });
  if (!response.ok) {
    throw new Error(`${SOURCE_NAME} responded with ${response.status}`);
  }
  const payload = await response.json();
  // Jobicy answers a filter it doesn't recognise with 200 + success:false.
  if (payload?.success === false) {
    throw new Error(payload?.error || `${SOURCE_NAME} rejected the request.`);
  }
  return Array.isArray(payload?.jobs) ? payload.jobs : [];
};

const searchJobs = async (
  params: RemoteJobSearchParams
): Promise<RemoteJob[]> => {
  const geos = GEO_SLUGS[params.remoteLocation] || [""];
  // Only the distinctive words go upstream. `tag` is Jobicy's own full-text
  // search, capped and ranked by them, so asking it for "React Developer"
  // returned a different 200 jobs than "React" — not a subset. Asking for
  // "react" either way makes the pool stable; `matchesKeyword` below and the
  // relevance tiers do the narrowing.
  //
  // A query Jobicy would reject falls back to an equivalent it accepts ("qa" →
  // "quality assurance"), and failing that to no tag at all: the recent feed,
  // filtered locally, the way the ATS providers work. Anything beats throwing
  // away the source.
  const tag = upstreamKeyword(params.query, {
    minLength: TAG_MIN_LENGTH,
    maxLength: TAG_MAX_LENGTH,
  });
  // One request per eligible region. Each is cached for an hour, so the common
  // case costs nothing beyond the first search of the hour.
  const pages = await Promise.all(
    geos.map((geo) =>
      fetchFeed({
        count: "200",
        ...(geo ? { geo } : {}),
        ...(tag ? { tag } : {}),
      })
    )
  );

  const seen = new Set<string>();
  const jobs: RemoteJob[] = [];
  for (const page of pages) {
    for (const raw of page) {
      const job = normalizeJob(raw);
      if (!job || seen.has(job.id)) continue;
      // Region was applied upstream by `geo`. The keyword is re-checked here:
      // Jobicy's `tag` searches the whole job body, so "frontend" returned a
      // Ruby-on-Rails role that merely mentioned the word. Re-filtering on
      // title and tags keeps this source's relevance in line with the others.
      if (!matchesKeyword(job, params.query)) continue;
      if (!matchesMetadataFilters(job, params)) continue;
      seen.add(job.id);
      jobs.push(job);
    }
  }

  jobs.sort((a, b) => (b.postedAt || "").localeCompare(a.postedAt || ""));
  // Enough candidates to cover the requested page once interleaved — slicing
  // to `limit` alone would starve this source out of every page but the first.
  return jobs.slice(0, params.offset + params.limit);
};

/**
 * Jobicy has no single-job endpoint, so a direct link is resolved against the
 * cached recent feed. A job that has aged out of it is gone — the caller
 * surfaces that as "no longer available" rather than guessing.
 */
const getJob = async (externalId: string): Promise<RemoteJob | null> => {
  // The search that produced this id parked its description; a direct link or
  // a restarted instance falls through to the (cached) feed.
  const cached = recallJob(`${SOURCE_ID}:${externalId}`);
  if (cached) return cached;

  const page = await fetchFeed({ count: "200" });
  const raw = page.find((job) => String(job.id) === String(externalId));
  const job = raw ? normalizeJob(raw) : null;
  if (job) rememberJobs([job]);
  return job;
};

export const jobicyProvider: JobProvider = {
  id: SOURCE_ID,
  name: SOURCE_NAME,
  attributionUrl: "https://jobicy.com",
  searchJobs,
  getJob,
};
