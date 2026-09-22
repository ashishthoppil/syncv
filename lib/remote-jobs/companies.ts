/**
 * The curated ATS board list.
 *
 * Greenhouse, Lever and Ashby publish one board per employer — there is no
 * cross-company search — so this file *is* the coverage of those three
 * providers. Adding a company is a one-line change; nothing else needs to know.
 *
 * Every token below was verified live on 2026-09-19: the board resolves, it has
 * postings, and at least some of them are remote. Boards that answered 200 but
 * were empty (Deel, Mercury) or had no remote roles at all (Palantir, Match
 * Group) were left out — they cost a fetch and contribute nothing.
 *
 * Before adding a token, check it: a wrong slug is a silent 404 that just makes
 * searches quieter, and a huge board with no remote roles is pure overhead.
 */

/** https://boards-api.greenhouse.io/v1/boards/<token>/jobs */
export const GREENHOUSE_BOARDS = [
  "anthropic",
  "asana",
  "cloudflare",
  "databricks",
  "discord",
  "dropbox",
  "elastic",
  "figma",
  "gitlab",
  "instacart",
  "mongodb",
  "reddit",
  "robinhood",
  "stripe",
  "twilio",
  "vercel",
] as const;

/**
 * https://api.lever.co/v0/postings/<token>?mode=json
 *
 * Found by probing 238 candidate slugs on 2026-09-22: only 14 resolved, and
 * these 12 are the ones carrying remote roles (375 between them). Lever slugs
 * cannot be guessed reliably — most companies people assume use Lever answer
 * 404 — so verify a token against the URL above before adding it.
 *
 * Trimmed by cost as well as coverage. Lever is slow, so a board earns its
 * place by remote roles per second: aircall (5 roles, 3.6s), alloy (2, 2.3s),
 * restaurant365 (4, 1.5s) and zeta (2, 1.0s) were dropped — together they cost
 * 8.4s of the 13s total and contributed 13 of 375 roles.
 *
 * Binance is the opposite: 263 remote roles in 1.4s, the single best board in
 * the whole registry. Its 2.9MB payload is over Next's 2MB fetch-cache limit so
 * it re-fetches each search, which is why FETCH_CONCURRENCY and the per-board
 * timeout in boards.ts exist.
 */
export const LEVER_BOARDS = [
  "binance",
  "deputy",
  "metabase",
  "olo",
  "outreach",
  "spotify",
  "tala",
  "wealthfront",
] as const;

/** https://api.ashbyhq.com/posting-api/job-board/<token> */
export const ASHBY_BOARDS = [
  "clerk",
  "cursor",
  "linear",
  "notion",
  "openai",
  "perplexity",
  "posthog",
  "ramp",
  "replit",
  "supabase",
  "vanta",
] as const;
