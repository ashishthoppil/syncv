import { timingSafeEqual } from "crypto";

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

export const cronHeaders = () => ({ Authorization: `Bearer ${process.env.CRON_SECRET}` });
