import { PRICING_REGION_BY_KEY, pricingRegionForCountry } from "@/lib/subscription-plans";

/**
 * The pricing region (rupees or US dollars) for a request, from the visitor's
 * country as the hosting edge reports it — Vercel's `x-vercel-ip-country`, or
 * Cloudflare's `cf-ipcountry` behind Cloudflare. Both the pricing display (via
 * /api/pricing-region) and checkout read it from here, so the price a visitor
 * is shown is the price they are charged.
 *
 * Neither header exists on a local `next dev`, which therefore prices in the
 * default region. PRICING_REGION_OVERRIDE ("in" or "intl") forces a region, to
 * try the other currency locally; leave it unset in production.
 */
export const getPricingRegionForRequest = (request) => {
  const override = process.env.PRICING_REGION_OVERRIDE;
  if (override && Object.hasOwn(PRICING_REGION_BY_KEY, override)) return override;

  const country =
    request.headers.get("x-vercel-ip-country") || request.headers.get("cf-ipcountry");
  return pricingRegionForCountry(country);
};
