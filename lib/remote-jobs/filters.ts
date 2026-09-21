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

/**
 * Words that say what *kind* of job a posting is rather than what it is about.
 *
 * Titles use these interchangeably — the same role is a Developer at one
 * company and an Engineer at the next — so requiring them made "React
 * Developer" a strictly narrower search than "React", dropping every React job
 * that happened to call itself an Engineer. That is the opposite of what typing
 * a fuller job title implies. They no longer gate a match; they still count
 * towards relevance, so a title that does say "Developer" ranks above one that
 * doesn't.
 */
const GENERIC_ROLE_WORDS =
  /^(developers?|devs?|engineers?|engineering|programmers?|managers?|designers?|analysts?|specialists?|consultants?|architects?|senior|junior|entry|mid|lead|staff|principal|remote|jobs?|roles?)$/i;

/**
 * The words a job actually has to contain. A query made only of role words
 * ("Engineering Manager") has nothing distinctive left to require, so it falls
 * back to needing all of them rather than matching the entire board.
 */
const requiredWords = (query: string) => {
  const words = queryWords(query);
  const distinctive = words.filter((word) => !GENERIC_ROLE_WORDS.test(word));
  return distinctive.length ? distinctive : words;
};

/**
 * Terms that name the same field in different words.
 *
 * Employers almost never use the phrase a person searches with. Of the 200 jobs
 * Jobicy returns for "human resource", nine are actually HR roles — and not one
 * of them has "human" or "resource" anywhere in its title or tags. They are
 * called People Operations Generalist, Talent Acquisition, Employee Relations
 * Business Partner. Literal matching cannot find those, however lenient it is
 * about which words are required.
 *
 * A query matches if ANY line of its group matches, so what someone types no
 * longer has to be what the employer wrote. The canonical short form leads each
 * group; the longest phrase present in a query wins, which is what keeps
 * "business development" out of the software-development group.
 */
const TERM_ALIASES: string[][] = [
  // "HR & Recruiting" is the industry label the sources tag these with, which
  // is why the bare acronym finds them and the spelled-out phrase does not.
  [
    "hr",
    "human resources",
    "human resource",
    "people operations",
    "people ops",
    "talent acquisition",
    "recruiting",
    "recruiter",
    "employee relations",
  ],
  ["qa", "quality assurance", "test engineer", "test automation", "sdet", "tester"],
  ["product management", "product manager", "product owner"],
  [
    "business development",
    "bizdev",
    "biz dev",
    "sales development",
    "account executive",
    "partnerships",
  ],
  [
    "development",
    "developer",
    "engineering",
    "engineer",
    "programming",
    "programmer",
    "software development",
  ],
];

/** Titles where "development" means the sales pipeline, not software. */
const FOREIGN_DEVELOPMENT =
  /\b(business|sales|corporate|partnership|market|customer|account)\s+development\b/i;

const ALIAS_LOOKUPS = TERM_ALIASES.flatMap((group) =>
  group.map((phrase) => ({
    phrase,
    group,
    pattern: new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "i"),
  }))
).sort((a, b) => b.phrase.length - a.phrase.length);

// One query drives a whole request — and relevance is evaluated per job, twice
// per sort comparison — so the variant list is built once and reused.
let variantCache: { query: string; variants: string[] } | null = null;

/**
 * The query, plus the same query with its domain term swapped for each known
 * equivalent. The original always leads, so the words someone actually typed
 * still decide ranking and what gets asked of a source.
 */
const queryVariants = (query: string): string[] => {
  const needle = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!needle) return [""];
  if (variantCache?.query === needle) return variantCache.variants;
  const hit = ALIAS_LOOKUPS.find(({ pattern }) => pattern.test(needle));
  const variants = [
    ...new Set(
      hit
        ? [needle, ...hit.group.map((phrase) => needle.replace(hit.pattern, phrase))]
        : [needle]
    ),
  ];
  variantCache = { query: needle, variants };
  return variants;
};

/**
 * What to hand a provider that runs its own keyword search upstream: the
 * distinctive words only. "React Developer" and "React" then ask the source the
 * same question, so the broader query's results can't go missing from the
 * narrower one — the ranking below decides the order, not the source.
 *
 * `minLength`/`maxLength` are the source's own limits on what it will accept.
 * The first equivalent that fits wins, so a source that rejects "qa" as too
 * short is asked for "quality assurance" instead of being dropped from the
 * search. An empty return means "send no keyword and filter locally".
 */
export const upstreamKeyword = (
  query: string,
  { minLength = 0, maxLength = Number.POSITIVE_INFINITY } = {}
) => {
  for (const variant of queryVariants(query)) {
    const keyword = requiredWords(variant).join(" ");
    if (keyword.length >= minLength && keyword.length <= maxLength) return keyword;
  }
  return "";
};

/** Role words that name the same job, for ranking only. Hard matching must
 *  never consult these — that would make "developer" a requirement again by
 *  the back door. */
const ROLE_SYNONYMS = ["developer", "dev", "engineer", "programmer"];

const hasRoleWord = (haystack: string, word: string) =>
  (ROLE_SYNONYMS.includes(word) ? ROLE_SYNONYMS : [word]).some((variant) =>
    hasWord(haystack, variant)
  );

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
  const variants = queryVariants(query);
  if (!variants[0]) return RELEVANCE_TIERS.TAG;
  const title = titleOf(job);

  // Best tier any wording of the query reaches: a People Operations role found
  // through the HR group still deserves its title match, not the tag-only floor
  // that would bury it below every literal match.
  let best: number = RELEVANCE_TIERS.TAG;
  for (const variant of variants) {
    const words = queryWords(variant);
    const tier = hasWord(title, variant)
      ? RELEVANCE_TIERS.PHRASE
      : words.every((word) => hasRoleWord(title, word))
      ? RELEVANCE_TIERS.ALL_WORDS
      : words.some((word) => hasRoleWord(title, word))
      ? RELEVANCE_TIERS.SOME_WORDS
      : RELEVANCE_TIERS.TAG;
    if (tier > best) best = tier;
    if (best === RELEVANCE_TIERS.PHRASE) break;
  }
  return best;
};

/**
 * Keyword filter. Deliberately scoped to the short fields: the ATS list
 * endpoints either omit the description or make it far too expensive to hold,
 * so "React Developer" matches a title or a tag, never a passing mention of
 * React in paragraph nine.
 */
export const matchesKeyword = (job: RemoteJob, query: string) => {
  const title = titleOf(job);
  const tags = tagsOf(job);
  const variants = queryVariants(query);
  // Two fields share the word "development". Longest-phrase matching already
  // keeps a *query* for "business development" in the sales group; this is the
  // other direction — the business-development *titles* a software search would
  // otherwise drag in through that shared word. A query that does name the
  // other field keeps them, because then they are the point.
  const wantsBusinessDevelopment = FOREIGN_DEVELOPMENT.test(variants[0]);
  // Any wording of the query will do, but within one wording every
  // *distinctive* word has to appear somewhere — so "senior react" still can't
  // match a job that merely says "senior". Seniority is what the Experience
  // level filter is for, and ranking floats senior titles up.
  return variants.some((variant) => {
    const words = requiredWords(variant);
    if (!words.length) return true;
    if (!words.every((word) => hasWord(title, word) || hasWord(tags, word))) {
      return false;
    }
    return (
      wantsBusinessDevelopment ||
      !words.includes("development") ||
      !FOREIGN_DEVELOPMENT.test(title)
    );
  });
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
