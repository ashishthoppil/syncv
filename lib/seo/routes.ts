import type { MetadataRoute } from "next";

/**
 * The indexing boundary for the whole site, in one place.
 *
 * PUBLIC_ROUTES is what the sitemap advertises and what the SEO test suite
 * asserts is reachable, canonical and indexable. PRIVATE_PREFIXES is the
 * product application — dashboards, auth, user-generated resume content — which
 * must never become indexable. Anything not listed here is neither, and that is
 * deliberate: adding a public page means adding it to this list.
 */

type ChangeFrequency = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

export type PublicRoute = {
  path: string;
  changeFrequency: ChangeFrequency;
  priority: number;
};

/** Static public pages. Dynamic collections are appended in app/sitemap.ts. */
export const PUBLIC_ROUTES: PublicRoute[] = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },

  // Product / intent pages
  { path: "/resume-tailor", changeFrequency: "monthly", priority: 0.9 },
  { path: "/ats-resume-checker", changeFrequency: "monthly", priority: 0.8 },
  { path: "/job-description-analyzer", changeFrequency: "monthly", priority: 0.8 },
  { path: "/ai-cover-letter-generator", changeFrequency: "monthly", priority: 0.7 },
  { path: "/job-application-tracker", changeFrequency: "monthly", priority: 0.6 },

  // Hubs
  { path: "/resources", changeFrequency: "weekly", priority: 0.7 },
  { path: "/resume-for", changeFrequency: "monthly", priority: 0.7 },

  // Trust / E-E-A-T
  { path: "/about", changeFrequency: "yearly", priority: 0.5 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.4 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/refund-policy", changeFrequency: "yearly", priority: 0.3 },
];

/**
 * Routes that are served to humans but must stay out of the index.
 *
 * `crawlable` matters: a noindex directive only works if the crawler is allowed
 * to fetch the page and read it. /scan and /job-tracker are linked from the
 * public navbar and footer, so blocking them in robots.txt (as we used to)
 * meant Google saw the links, could not fetch the noindex, and was free to
 * index a URL-only entry. They are now crawlable-but-noindex. Routes nothing
 * links to are Disallow'd instead, to save crawl budget.
 */
export const PRIVATE_ROUTES: { path: string; crawlable: boolean }[] = [
  { path: "/login", crawlable: true },
  { path: "/sign-up", crawlable: true },
  { path: "/scan", crawlable: true },
  { path: "/job-tracker", crawlable: true },
  { path: "/onboarding", crawlable: false },
  { path: "/reset-password", crawlable: false },
  { path: "/auth/", crawlable: false },
  { path: "/template", crawlable: false },
  { path: "/static-template", crawlable: false },
];

/** Paths robots.txt should Disallow: the API plus every uncrawlable private route. */
export const DISALLOWED_PATHS: string[] = [
  "/api/",
  ...PRIVATE_ROUTES.filter((route) => !route.crawlable).map((route) => route.path),
];

export const isPublicRoute = (path: string) =>
  PUBLIC_ROUTES.some((route) => route.path === path);
