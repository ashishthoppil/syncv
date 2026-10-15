import { fetchJson, hasTimeLeft } from "../http";
import type { IngestSource, SourceJob } from "../types";

/**
 * Himalayas' public remote-jobs feed: newest first, 20 jobs a request, paged by
 * an opaque cursor — so it can only be read one page after another. At roughly
 * 3,000 new jobs a day that is the slowest source by far; it reads until it
 * reaches jobs it already has or runs out of time, and on a busy day it keeps
 * the newest ~2,000 and skips the rest.
 *
 * Their terms: link back to the job on Himalayas, name Himalayas as the
 * source, and don't submit their jobs to other job boards (Google Jobs,
 * LinkedIn and so on).
 *
 * https://himalayas.app/api
 */
const API = "https://himalayas.app/jobs/api?limit=20";
const OVERLAP_MS = 2 * 60 * 60 * 1000;

type HimalayasJob = {
  title?: string;
  companyName?: string;
  companySlug?: string;
  companyLogo?: string;
  employmentType?: string;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: string;
  currency?: string;
  seniority?: string[];
  locationRestrictions?: string[];
  categories?: string[];
  parentCategories?: string[];
  description?: string;
  pubDate?: number;
  expiryDate?: number;
  applicationLink?: string;
  guid?: string;
};

const toSourceJob = (raw: HimalayasJob): SourceJob | null => {
  // https://himalayas.app/companies/<company>/jobs/<job> → <company>/<job>
  const match = raw.guid?.match(/\/companies\/([^/]+)\/jobs\/([^/?#]+)/);
  if (!match) return null;
  const restrictions = (raw.locationRestrictions || []).filter(Boolean);
  const categories = raw.parentCategories?.length
    ? raw.parentCategories
    : (raw.categories || []).slice(0, 3).map((category) => category.replace(/-/g, " "));
  return {
    externalId: `${match[1]}/${match[2]}`,
    sourceUrl: raw.guid || "",
    applicationUrl: raw.applicationLink || raw.guid,
    title: raw.title || "",
    companyName: raw.companyName || "",
    companyLogo: raw.companyLogo || "",
    descriptionHtml: raw.description || "",
    location: restrictions.join(", "),
    // No restriction on Himalayas means the role is open worldwide.
    places: restrictions.length ? restrictions : ["Anywhere"],
    workplaceType: "remote",
    employmentType: raw.employmentType,
    seniority: raw.seniority?.[0],
    salary: { min: raw.minSalary, max: raw.maxSalary, currency: raw.currency, period: raw.salaryPeriod },
    categories,
    postedAt: raw.pubDate,
    expiresAt: raw.expiryDate,
  };
};

export const himalayasSource: IngestSource = {
  id: "himalayas",
  name: "Himalayas",
  fetchJobs: async ({ deadline, windowStart, newestStored }) => {
    const cutoff = Math.max(
      windowStart.getTime(),
      newestStored ? newestStored.getTime() - OVERLAP_MS : 0
    );
    const jobs: SourceJob[] = [];
    let cursor: string | undefined;
    let reachedCutoff = false;
    let stoppedBy = "";
    let pages = 0;
    // Each page takes ~0.3s; leave a moment for the database write.
    while (hasTimeLeft(deadline, 1_000)) {
      let payload: { jobs?: HimalayasJob[]; nextCursor?: string };
      try {
        payload = await fetchJson(cursor ? `${API}&cursor=${encodeURIComponent(cursor)}` : API, {
          deadline,
          timeoutMs: 15_000,
        });
      } catch (error) {
        // Keep the pages already read; only a failure on the first is fatal.
        if (!pages) throw error;
        stoppedBy = error instanceof Error ? error.message : String(error);
        break;
      }
      pages += 1;
      for (const raw of payload.jobs || []) {
        if ((raw.pubDate || 0) * 1000 < cutoff) {
          reachedCutoff = true;
          continue;
        }
        const job = toSourceJob(raw);
        if (job) jobs.push(job);
      }
      cursor = payload.nextCursor;
      if (reachedCutoff || !cursor) break;
    }
    const unfinished = !reachedCutoff && Boolean(cursor);
    return {
      jobs,
      partial: unfinished,
      note: unfinished
        ? `read ${pages} pages, then ${stoppedBy ? `stopped: ${stoppedBy}` : "hit the time limit"}`
        : undefined,
    };
  },
};
