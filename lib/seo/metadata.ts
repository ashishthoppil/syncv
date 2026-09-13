import type { Metadata } from "next";
import { DEFAULT_OG_IMAGE, SITE_NAME, absoluteUrl } from "./site";

type BuildMetadataInput = {
  /** Title without the " | SynCV" suffix — the root layout template adds it. */
  title: string;
  description: string;
  /** Route path, e.g. "/resume-tailor". Drives canonical and og:url. */
  path: string;
  /** Overrides the social title when the SERP title is too clipped to share well. */
  socialTitle?: string;
  socialDescription?: string;
  image?: { url: string; width: number; height: number; alt: string };
  type?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  /** Set for pages that are served to users but must not be indexed. */
  noIndex?: boolean;
};

/**
 * Single builder for every public page's metadata, so a page can never ship
 * with a canonical that disagrees with its og:url, or a social card that
 * silently falls back to the site-wide default.
 */
export function buildMetadata({
  title,
  description,
  path,
  socialTitle,
  socialDescription,
  image = DEFAULT_OG_IMAGE,
  type = "website",
  publishedTime,
  modifiedTime,
  noIndex = false,
}: BuildMetadataInput): Metadata {
  const url = absoluteUrl(path);
  const ogTitle = socialTitle ?? `${title} | ${SITE_NAME}`;
  const ogDescription = socialDescription ?? description;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type,
      siteName: SITE_NAME,
      locale: "en_US",
      url,
      title: ogTitle,
      description: ogDescription,
      images: [{ ...image, type: "image/png" }],
      ...(type === "article" ? { publishedTime, modifiedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [image.url],
    },
    robots: noIndex
      ? { index: false, follow: true }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
          },
        },
  };
}
