import { timingSafeEqual } from "crypto";
import { SITE_URL } from "@/lib/seo/site";

/**
 * Vercel Cron calls with `Authorization: Bearer $CRON_SECRET`, and the
 * dispatcher forwards the same header to the per-source routes. Without the
 * secret set, every call is refused — these routes spend upstream rate limits
 * and model calls, so they fail closed.
 */
export const isCronRequest = (request: Request) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") || "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export const cronHeaders = () => ({
  Authorization: `Bearer ${process.env.CRON_SECRET}`,
  // Vercel sets this when "Protection Bypass for Automation" is turned on; it
  // lets these internal calls through Deployment Protection if they ever have
  // to go to a protected URL.
  ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET }
    : {}),
});

/**
 * Where the dispatcher calls its own routes: the site's public address
 * (SITE_URL — NEXT_PUBLIC_SITE_URL, else https://syncv.app), never the address
 * the request came in on.
 *
 * Built from the incoming request, these calls worked for a manual run made
 * through syncv.app, but failed for every scheduled run from 2026-10-15 on:
 * no source ever started, and the report came from the safety-net cron. The
 * likely cause is that Vercel Cron reaches a deployment URL (*.vercel.app),
 * which Deployment Protection guards; the production domain isn't guarded.
 */
export const internalBaseUrl = () => SITE_URL;
