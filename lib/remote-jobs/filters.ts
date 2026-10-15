import type { RemoteJob } from "@/lib/remote-jobs/types";

/**
 * Keyword matching and ranking for Remote Jobs. The structured filters
 * (location, seniority, salary…) run in SQL (`search_job_listings`); keyword
 * search is a loose substring pre-filter there, and the precise word-by-word
 * match and the relevance ranking happen here, over the candidates it returns.
 */

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
 * The SQL pre-filter's input: for each wording of the query, the words a match
 * must contain. A job passes if every word of ANY group appears somewhere in
 * its title, company, categories or tech stack — a superset of what
 * `matchesKeyword` accepts, which then has the final say.
 */
export const keywordGroups = (query: string): string[][] | null => {
  if (!query.trim()) return null;
  const groups = queryVariants(query)
    .map((variant) => requiredWords(variant))
    .filter((words) => words.length);
  return groups.length ? groups : null;
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
