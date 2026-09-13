import { DISALLOWED_PATHS } from "@/lib/seo/routes";
import { absoluteUrl } from "@/lib/seo/site";
import type { MetadataRoute } from "next";

/**
 * Crawl rules.
 *
 * Two deliberate changes from the previous version:
 *
 * 1. /scan and /job-tracker are no longer Disallow'd. Both are linked from the
 *    public navbar and footer, so blocking the fetch stopped Google from ever
 *    reading their `noindex`, which is what actually keeps them out of the
 *    index. They are crawlable-but-noindex now; see lib/seo/routes.ts.
 * 2. The blanket GPTBot / CCBot blocks are gone, so answer engines can read and
 *    cite the public marketing pages. Re-add a rule here to reverse that.
 *
 * Nothing blocks /_next/, images or CSS — blocking those breaks rendering for
 * the crawler and is one of the easiest ways to tank a JS site.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOWED_PATHS,
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    // `host` is omitted: it is a non-standard directive Google ignores, and the
    // old value ("https://syncv.app/") was malformed for the crawlers that do
    // read it, which expect a bare hostname.
  };
}
