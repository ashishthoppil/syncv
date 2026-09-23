import {
  BILLING_PERIODS,
  FREE_PLAN,
  SUBSCRIPTION_PLANS,
  getPlanPrice,
} from "@/lib/subscription-plans";
import {
  SITE_NAME,
  SITE_URL,
  SOCIAL_PROFILES,
  SUPPORT_EMAIL,
  absoluteUrl,
} from "./site";

/**
 * Structured data is emitted as one linked @graph per page rather than a pile
 * of disconnected blocks, so crawlers resolve a single SynCV entity instead of
 * re-deriving it from every page. Stable @ids let nodes reference each other.
 */

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const SOFTWARE_ID = `${SITE_URL}/#software`;

type JsonLdNode = Record<string, unknown>;

export const organizationNode = (): JsonLdNode => ({
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: SITE_NAME,
  url: absoluteUrl("/"),
  logo: {
    "@type": "ImageObject",
    "@id": `${SITE_URL}/#logo`,
    url: absoluteUrl("/logo.png"),
    contentUrl: absoluteUrl("/logo.png"),
    caption: SITE_NAME,
  },
  image: { "@id": `${SITE_URL}/#logo` },
  description:
    "SynCV is a job-specific resume tailoring tool: it rewrites a candidate's existing resume to match one job description at a time, without inventing experience.",
  sameAs: [...SOCIAL_PROFILES],
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: SUPPORT_EMAIL,
      url: absoluteUrl("/contact"),
      availableLanguage: ["English"],
    },
  ],
});

export const websiteNode = (): JsonLdNode => ({
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  url: absoluteUrl("/"),
  name: SITE_NAME,
  description:
    "Tailor your resume to any job description in two clicks using the experience you already have.",
  publisher: { "@id": ORGANIZATION_ID },
  inLanguage: "en",
  // No SearchAction: the site has no internal search endpoint, and claiming one
  // that 404s is invalid markup.
});

/** One billing cycle of each period, in UN/CEFACT units (WEE, MON, ANN). */
const BILLING_UNITS: Record<string, { unitCode: string; units: number }> = {
  weekly: { unitCode: "WEE", units: 1 },
  monthly: { unitCode: "MON", units: 1 },
  quarterly: { unitCode: "MON", units: 3 },
  yearly: { unitCode: "ANN", units: 1 },
};

/**
 * Prices come from lib/subscription-plans.js — the same module that renders the
 * pricing table and drives checkout — so the markup cannot drift from what a
 * user is actually charged. (It previously advertised ₹945 for a ₹999 plan.)
 */
export const softwareApplicationNode = (): JsonLdNode => ({
  "@type": "SoftwareApplication",
  "@id": SOFTWARE_ID,
  name: SITE_NAME,
  url: absoluteUrl("/"),
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Resume tailoring",
  operatingSystem: "Web browser",
  browserRequirements: "Requires JavaScript. Works in any modern browser.",
  publisher: { "@id": ORGANIZATION_ID },
  description:
    "SynCV tailors an existing resume to a specific job description in two clicks. It reorders, rewrites and re-emphasises the experience already on the resume, and reports how well the result matches the job description. It does not add skills or experience the candidate has not claimed.",
  featureList: [
    "Resume tailoring against a pasted job description",
    "Job description keyword and requirement analysis",
    "Resume and job description match scoring",
    "ATS-friendly resume generation",
    "Cover letter generation",
    "Job application tracking",
  ],
  // One offer per plan and billing period, since each is its own price.
  offers: [
    {
      "@type": "Offer",
      name: FREE_PLAN.name,
      price: "0",
      priceCurrency: "INR",
      description: FREE_PLAN.description,
      url: absoluteUrl("/#pricing"),
      availability: "https://schema.org/InStock",
    },
    ...SUBSCRIPTION_PLANS.flatMap((plan) =>
      BILLING_PERIODS.map((period) => {
        const price = String(getPlanPrice(plan, period.key));
        const { unitCode, units } = BILLING_UNITS[period.key];
        return {
          "@type": "Offer",
          name: `${plan.name} (${period.label})`,
          price,
          priceCurrency: "INR",
          description: plan.description,
          url: absoluteUrl("/#pricing"),
          availability: "https://schema.org/InStock",
          priceSpecification: {
            "@type": "UnitPriceSpecification",
            price,
            priceCurrency: "INR",
            billingDuration: units,
            billingIncrement: 1,
            unitCode,
          },
        };
      })
    ),
  ],
  // No aggregateRating / review: SynCV has no verified review corpus, and
  // inventing one is both a Google violation and a lie.
});

/**
 * The homepage demo. Every value here is read off the actual YouTube video —
 * title, upload date and a 104-second runtime. Google requires `uploadDate` on
 * VideoObject, and guessing it would be fabricating structured data, so this
 * node must be updated (not approximated) if the demo is ever re-uploaded.
 */
export const videoObjectNode = (): JsonLdNode => ({
  "@type": "VideoObject",
  "@id": `${SITE_URL}/#demo-video`,
  name: "SynCV — Demo",
  description:
    "A walkthrough of tailoring a resume in SynCV: uploading a base resume, pasting a job description, and reviewing the tailored result.",
  uploadDate: "2026-09-13T11:10:05-07:00",
  duration: "PT1M44S",
  thumbnailUrl: ["https://i.ytimg.com/vi/GwSVCSwacgE/maxresdefault.jpg"],
  embedUrl: "https://www.youtube.com/embed/GwSVCSwacgE",
  publisher: { "@id": ORGANIZATION_ID },
});

export type Breadcrumb = { name: string; path: string };

export const breadcrumbNode = (url: string, trail: Breadcrumb[]): JsonLdNode => ({
  "@type": "BreadcrumbList",
  "@id": `${url}#breadcrumb`,
  itemListElement: trail.map((crumb, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: crumb.name,
    item: absoluteUrl(crumb.path),
  })),
});

type WebPageInput = {
  path: string;
  name: string;
  description: string;
  breadcrumbs?: Breadcrumb[];
  /** Present only on pages that genuinely describe the product. */
  about?: "software" | "organization";
};

export const webPageNode = ({
  path,
  name,
  description,
  breadcrumbs,
  about,
}: WebPageInput): JsonLdNode => {
  const url = absoluteUrl(path);
  return {
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name,
    description,
    isPartOf: { "@id": WEBSITE_ID },
    inLanguage: "en",
    ...(about
      ? { about: { "@id": about === "software" ? SOFTWARE_ID : ORGANIZATION_ID } }
      : {}),
    ...(breadcrumbs?.length ? { breadcrumb: { "@id": `${url}#breadcrumb` } } : {}),
  };
};

type ArticleInput = {
  path: string;
  headline: string;
  description: string;
  datePublished: string;
  dateModified: string;
};

export const articleNode = ({
  path,
  headline,
  description,
  datePublished,
  dateModified,
}: ArticleInput): JsonLdNode => {
  const url = absoluteUrl(path);
  return {
    "@type": "Article",
    "@id": `${url}#article`,
    headline,
    description,
    datePublished,
    dateModified,
    mainEntityOfPage: { "@id": `${url}#webpage` },
    isPartOf: { "@id": `${url}#webpage` },
    // Authored and maintained by the company, not a fabricated person.
    author: { "@id": ORGANIZATION_ID },
    publisher: { "@id": ORGANIZATION_ID },
    inLanguage: "en",
  };
};

export type FaqItem = { question: string; answer: string };

/**
 * FAQ markup mirrors questions that are visibly rendered on the same page. It
 * exists so answer engines can resolve the Q&A pairs, not as a rich-result
 * play — Google retired broad FAQ rich results.
 */
export const faqNode = (url: string, items: FaqItem[]): JsonLdNode => ({
  "@type": "FAQPage",
  "@id": `${url}#faq`,
  mainEntity: items.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
});

/** Wraps nodes into the schema.org envelope the page will serialise. */
export const buildGraph = (nodes: JsonLdNode[]) => ({
  "@context": "https://schema.org",
  "@graph": nodes,
});
