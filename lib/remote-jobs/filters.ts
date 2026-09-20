import type { RemoteJob, RemoteJobSearchParams } from "@/lib/remote-jobs/types";

/**
 * Filters shared by every provider. Boards that can't filter server-side (the
 * ATS ones) run all of these locally; Jobicy delegates keyword and region
 * upstream and only uses the rest.
 */

export const EMPLOYMENT_MATCHERS: Record<string, RegExp> = {
  "full-time": /full[\s-]?time/i,
  "part-time": /part[\s-]?time/i,
  contract: /contract|freelance|temporary/i,
  internship: /intern/i,
};

export const EXPERIENCE_MATCHERS: Record<string, RegExp> = {
  entry: /entry|junior|graduate|intern|new grad/i,
  mid: /mid|intermediate/i,
  senior: /senior|lead|principal|staff/i,
  executive: /director|executive|head|chief|vp|president/i,
};

/**
 * Where a candidate may be based, per "Remote from". Regions are matched
 * whole-word against whatever the source printed, so "United States" matches a
 * job scoped to "United States" but not one scoped to "United Kingdom".
 */
/**
 * Note what is NOT in here: the bare word "remote".
 *
 * "Remote" describes how the job is worked, not where you may live — the ATS
 * boards are full of entries like "Remote, San Francisco, CA" and "US -
 * Remote", which are remote *and* geographically restricted. Treating that word
 * as a wildcard is precisely the "assume remote means global" mistake, and it
 * put SF- and London-anchored roles into a "Remote from India" search. Only an
 * explicit anywhere/worldwide/global claim counts as unrestricted; a job that
 * says only "Remote" stays out of country searches, because we genuinely don't
 * know, and it still appears under "Any location".
 */
const LOCATION_MATCHERS: Record<string, RegExp> = {
  india: /\b(india|apac|asia|anywhere|worldwide|global)\b/i,
  "united-states":
    /\b(usa|u\.s\.|us|united states|north america|americas|namer|anywhere|worldwide|global)\b/i,
  "united-kingdom":
    /\b(uk|u\.k\.|united kingdom|england|britain|europe|emea|anywhere|worldwide|global)\b/i,
  europe: /\b(europe|european|emea|eu|anywhere|worldwide|global)\b/i,
  anywhere: /\b(anywhere|worldwide|global)\b/i,
};

/** Does this job's stated eligibility include the requested location? */
export const matchesLocation = (job: RemoteJob, remoteLocation: string) => {
  if (!remoteLocation) return true;
  const matcher = LOCATION_MATCHERS[remoteLocation];
  if (!matcher) return true;
  // Nothing stated means we don't know — and guessing would be exactly the
  // "assume remote means global" mistake. Leave it out of a location search.
  if (!job.remoteCountries.length) return false;
  return job.remoteCountries.some((region) => matcher.test(region));
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Matches at the start of a word, not anywhere in the string.
 *
 * A plain `includes` made short queries nonsense — "ai" matched "em*ai*l" and
 * "go" matched "Djan*go*". Anchoring to a word start kills those while still
 * letting "engineer" match "engineering" and "front" match "frontend", which is
 * what people expect from a search box.
 */
const hasWord = (haystack: string, word: string) =>
  new RegExp(`\\b${escapeRegExp(word)}`, "i").test(haystack);

const queryWords = (query: string) =>
  query.trim().toLowerCase().split(/\s+/).filter(Boolean);

const titleOf = (job: RemoteJob) => job.title.toLowerCase();
const tagsOf = (job: RemoteJob) =>
  [...job.categories, ...job.skills, job.companyName].join(" ").toLowerCase();

/**
 * How well a job answers the query, used to order results.
 *
 * Without this, a search for "Frontend" put "Applied AI Engineer, Fullstack"
 * beside "Senior Frontend Software Engineer" — the first only matched because
 * its Ashby *team* is called Frontend. A tag match is a weak signal and now
 * ranks below every title match instead of level with it.
 *
 * Returns a tier, not a raw score: results are grouped by tier so that source
 * diversity is arranged *within* a relevance band rather than across them.
 */
export const RELEVANCE_TIERS = { PHRASE: 3, ALL_WORDS: 2, SOME_WORDS: 1, TAG: 0 } as const;

export const keywordRelevance = (job: RemoteJob, query: string): number => {
  const needle = query.trim().toLowerCase();
  if (!needle) return RELEVANCE_TIERS.TAG;
  const title = titleOf(job);
  const words = queryWords(needle);

  if (hasWord(title, needle)) return RELEVANCE_TIERS.PHRASE;
  if (words.every((word) => hasWord(title, word))) return RELEVANCE_TIERS.ALL_WORDS;
  if (words.some((word) => hasWord(title, word))) return RELEVANCE_TIERS.SOME_WORDS;
  return RELEVANCE_TIERS.TAG;
};

/**
 * Keyword filter. Deliberately scoped to the short fields: the ATS list
 * endpoints either omit the description or make it far too expensive to hold,
 * so "React Developer" matches a title or a tag, never a passing mention of
 * React in paragraph nine.
 */
export const matchesKeyword = (job: RemoteJob, query: string) => {
  const words = queryWords(query);
  if (!words.length) return true;
  const title = titleOf(job);
  const tags = tagsOf(job);
  // Every word has to appear somewhere, so "senior react" doesn't match every
  // job that merely says "senior".
  return words.every((word) => hasWord(title, word) || hasWord(tags, word));
};

export const matchesEmploymentType = (job: RemoteJob, employmentType: string) => {
  if (!employmentType) return true;
  const matcher = EMPLOYMENT_MATCHERS[employmentType];
  if (!matcher) return true;
  // An unstated type can't be excluded without guessing.
  return !job.employmentType || matcher.test(job.employmentType);
};

export const matchesExperienceLevel = (job: RemoteJob, experienceLevel: string) => {
  if (!experienceLevel) return true;
  const matcher = EXPERIENCE_MATCHERS[experienceLevel];
  if (!matcher) return true;
  // A posting with no stated level is open to every level, so it stays in.
  return !job.experienceLevel || matcher.test(job.experienceLevel);
};

/**
 * Ceiling on how old a posting can be and still be shown, even with the
 * "Posted date" filter set to Any time.
 *
 * ATS boards don't reliably retire dead listings — the Ashby boards carry
 * postings up to 1,971 days old and Greenhouse up to 879. Surfacing those
 * wastes the user's time and, worse, one of their scans. 90 days is the widest
 * window where a listing is still plausibly open.
 */
export const MAX_JOB_AGE_DAYS = 90;

export const matchesPostedWithin = (job: RemoteJob, postedWithinDays: number) => {
  const windowDays =
    postedWithinDays > 0
      ? Math.min(postedWithinDays, MAX_JOB_AGE_DAYS)
      : MAX_JOB_AGE_DAYS;
  // An undated posting can't be shown to be recent. Sources that date their
  // jobs are the norm; the ones that don't are usually the stale ones.
  if (!job.postedAt) return false;
  const posted = new Date(job.postedAt).getTime();
  if (!Number.isFinite(posted)) return false;
  return posted >= Date.now() - windowDays * 24 * 60 * 60 * 1000;
};

/** Everything except keyword and location, which some providers do upstream. */
export const matchesMetadataFilters = (
  job: RemoteJob,
  params: RemoteJobSearchParams
) =>
  matchesEmploymentType(job, params.employmentType) &&
  matchesExperienceLevel(job, params.experienceLevel) &&
  matchesPostedWithin(job, params.postedWithinDays);

/** The full set, for providers that can't filter anything upstream. */
export const matchesAllFilters = (job: RemoteJob, params: RemoteJobSearchParams) =>
  matchesKeyword(job, params.query) &&
  matchesLocation(job, params.remoteLocation) &&
  matchesMetadataFilters(job, params);
