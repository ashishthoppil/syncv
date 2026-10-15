import { fetchJson, hasTimeLeft } from "../http";
import { looksHybrid } from "../normalize";
import type { IngestSource, SourceJob } from "../types";

/**
 * Arbeitnow's free job-board API: 300 jobs a page, newest first, no search.
 * Mostly Germany and the rest of Europe, and mostly on-site — about one in
 * twenty is flagged remote, and hybrid roles are only recognisable from the
 * text. Their terms ask for a link back, which the job page provides.
 */
const API = "https://www.arbeitnow.com/api/job-board-api";
const MAX_PAGES = 15;
/** Re-read a little behind the newest stored job, in case of late arrivals. */
const OVERLAP_MS = 6 * 60 * 60 * 1000;

type ArbeitnowJob = {
  slug?: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
};

const toSourceJob = (raw: ArbeitnowJob): SourceJob | null => {
  const shortFields = [raw.title, raw.location, ...(raw.tags || []), ...(raw.job_types || [])].join(" ");
  const workplaceType = raw.remote
    ? "remote"
    : looksHybrid(shortFields, raw.description || "")
    ? "hybrid"
    : null;
  if (!raw.slug || !workplaceType) return null;
  return {
    externalId: raw.slug,
    sourceUrl: raw.url || `https://www.arbeitnow.com/jobs/${raw.slug}`,
    title: raw.title || "",
    companyName: raw.company_name || "",
    descriptionHtml: raw.description || "",
    location: raw.location || "",
    workplaceType,
    employmentType: (raw.job_types || []).join(", "),
    seniority: (raw.job_types || []).join(", "),
    categories: raw.tags || [],
    postedAt: raw.created_at,
  };
};

export const arbeitnowSource: IngestSource = {
  id: "arbeitnow",
  name: "Arbeitnow",
  fetchJobs: async ({ deadline, windowStart, newestStored }) => {
    const cutoff = Math.max(
      windowStart.getTime(),
      newestStored ? newestStored.getTime() - OVERLAP_MS : 0
    );
    const jobs: SourceJob[] = [];
    let reachedCutoff = false;
    let exhausted = false;
    let pages = 0;
    while (pages < MAX_PAGES && hasTimeLeft(deadline)) {
      let payload: { data?: ArbeitnowJob[]; links?: { next?: string | null } };
      try {
        payload = await fetchJson(`${API}?page=${pages + 1}`, { deadline });
      } catch (error) {
        // Keep the pages already read; only a failure on the first is fatal.
        if (!pages) throw error;
        break;
      }
      pages += 1;
      const data = payload.data || [];
      for (const raw of data) {
        if ((raw.created_at || 0) * 1000 < cutoff) {
          reachedCutoff = true;
          continue;
        }
        const job = toSourceJob(raw);
        if (job) jobs.push(job);
      }
      exhausted = !payload.links?.next || !data.length;
      if (reachedCutoff || exhausted) break;
    }
    const unfinished = !reachedCutoff && !exhausted;
    return {
      jobs,
      partial: unfinished,
      note: unfinished ? `stopped after ${pages} pages` : undefined,
    };
  },
};
