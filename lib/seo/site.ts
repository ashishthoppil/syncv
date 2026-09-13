/**
 * Canonical site identity. Everything that builds a URL — canonicals, Open
 * Graph, sitemap, robots, JSON-LD @id values — must read SITE_URL from here.
 *
 * The env var is normalised because a trailing slash in NEXT_PUBLIC_SITE_URL
 * used to leak into `${SITE_URL}/...` interpolations, which shipped
 * `https://syncv.app//login` into the sitemap and `https://syncv.app//sitemap.xml`
 * into robots.txt. Every one of those URLs 308-redirects, so the sitemap was
 * advertising redirects instead of canonical pages.
 */
const RAW_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://syncv.app";

/** Origin with no trailing slash, e.g. `https://syncv.app`. */
export const SITE_URL = RAW_SITE_URL.trim().replace(/\/+$/, "");

export const SITE_NAME = "SynCV";
export const SITE_TAGLINE =
  "Your resume should change for every job. Your experience shouldn't.";
export const SUPPORT_EMAIL = "info@syncv.app";

/**
 * Official profiles only. These feed Organization.sameAs, which is an identity
 * claim — never add a URL here that isn't a profile SynCV actually controls.
 */
export const SOCIAL_PROFILES = [
  "https://www.linkedin.com/company/syncv-app",
  "https://www.instagram.com/syncv.app/",
  "https://www.youtube.com/@syncv.app5",
] as const;

export const DEFAULT_OG_IMAGE = {
  url: "/preview.png",
  width: 1200,
  height: 630,
  alt: "SynCV — tailor your resume to any job description using the experience you already have",
} as const;

/**
 * Joins a path onto the origin. Collapses duplicate slashes so a stray leading
 * slash in a caller can't recreate the `//` bug above.
 */
export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  const normalised = `/${path}`.replace(/\/{2,}/g, "/");
  return normalised === "/" ? `${SITE_URL}/` : `${SITE_URL}${normalised}`;
}
