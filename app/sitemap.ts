import { ARTICLES } from "@/lib/content/articles";
import { ROLE_GUIDES } from "@/lib/content/roles";
import { PUBLIC_ROUTES } from "@/lib/seo/routes";
import { absoluteUrl } from "@/lib/seo/site";
import type { MetadataRoute } from "next";

/**
 * Every URL here is canonical, indexable and returns 200.
 *
 * Previously this file interpolated a SITE_URL that ended in "/", so it shipped
 * `https://syncv.app//login` — a 308 redirect — and included login/sign-up,
 * which are not pages we want ranking. absoluteUrl() now guarantees the shape,
 * and PUBLIC_ROUTES is the single list of what is public.
 *
 * lastmod comes from each piece of content's own `updated` date rather than
 * `new Date()`, so a redeploy doesn't falsely tell Google the whole site changed.
 */
/**
 * Bumped by hand when the marketing pages are genuinely rewritten. An accurate
 * stale date is worth more to a crawler than a fresh lie.
 */
const LAST_REVIEWED = new Date("2026-09-14T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: LAST_REVIEWED,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const articleRoutes: MetadataRoute.Sitemap = ARTICLES.map((article) => ({
    url: absoluteUrl(`/resources/${article.slug}`),
    lastModified: new Date(article.updated),
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  const roleRoutes: MetadataRoute.Sitemap = ROLE_GUIDES.map((role) => ({
    url: absoluteUrl(`/resume-for/${role.slug}`),
    lastModified: new Date(role.updated),
    changeFrequency: "yearly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...articleRoutes, ...roleRoutes];
}
