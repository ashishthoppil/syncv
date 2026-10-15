/**
 * The curated ATS board lists.
 *
 * Greenhouse, Ashby, Lever, Workable, SmartRecruiters and Recruitee publish one
 * board per employer — there is no cross-company search — so these lists *are*
 * the coverage of those six sources. Adding a company is a one-line change.
 *
 * Before adding a token, check it against the URL in each comment: a wrong
 * slug is a silent 404 that just makes the ingest quieter, and a big board with
 * no remote or hybrid roles is pure overhead.
 */

/**
 * https://boards-api.greenhouse.io/v1/boards/<token>/jobs
 * Verified 2026-09-19: each resolves and carries remote roles.
 */
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
 * Found by probing 238 candidate slugs on 2026-09-22; these carried remote
 * roles. Lever slugs can't be guessed reliably — most companies people assume
 * use Lever answer 404. Binance alone carries ~260 remote roles.
 */
export const LEVER_BOARDS: Record<string, string> = {
  binance: "Binance",
  deputy: "Deputy",
  metabase: "Metabase",
  olo: "Olo",
  outreach: "Outreach",
  spotify: "Spotify",
  tala: "Tala",
  wealthfront: "Wealthfront",
};

/**
 * https://api.ashbyhq.com/posting-api/job-board/<token>
 * Ashby's and Lever's APIs don't return the company's name, hence the maps.
 */
export const ASHBY_BOARDS: Record<string, string> = {
  clerk: "Clerk",
  cursor: "Cursor",
  linear: "Linear",
  notion: "Notion",
  openai: "OpenAI",
  perplexity: "Perplexity",
  posthog: "PostHog",
  ramp: "Ramp",
  replit: "Replit",
  supabase: "Supabase",
  vanta: "Vanta",
};

/**
 * https://apply.workable.com/api/v1/widget/accounts/<token>
 *
 * Verified 2026-10-15; each has remote or hybrid roles. Workable rate-limits
 * hard — 280 of 335 rapid probes that day were refused — so the adapter reads
 * these one at a time. Grow this list slowly and check each slug by hand.
 * "caring-hand-home-health-solutions" (138 roles flagged telecommute) was left
 * out: they read as in-home care roles, not remote work.
 */
export const WORKABLE_BOARDS = [
  "huggingface",
  "blueground",
  "skroutz",
  "persado",
  "epignosis",
  "celsius",
  "allucent",
] as const;

/**
 * https://api.smartrecruiters.com/v1/companies/<identifier>/postings
 *
 * Verified 2026-10-15 — each had at least five remote or hybrid roles. The
 * identifier is case-sensitive, and an unknown one answers 200 with zero
 * postings rather than 404 (Visa, IKEA and SAP all do), so check the count.
 */
export const SMARTRECRUITERS_BOARDS = [
  "AbbVie",
  "AveryDennison",
  "BoschGroup",
  "Canva",
  "Continental",
  "Endava",
  "Experian",
  "NielsenIQ",
  "ServiceNow",
  "Sixt",
  "Sodexo",
  "Wise",
  "Wix2",
] as const;

/**
 * https://<token>.recruitee.com/api/offers/
 * Verified 2026-10-15. Recruitee is mostly European SMEs and has no
 * cross-company directory, so this list grows by hand.
 */
export const RECRUITEE_BOARDS = ["bunq", "channable", "effectory", "hostaway"] as const;
