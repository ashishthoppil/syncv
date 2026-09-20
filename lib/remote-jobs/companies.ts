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

/** https://api.lever.co/v0/postings/<token>?mode=json */
export const LEVER_BOARDS = ["spotify", "tala"] as const;

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
