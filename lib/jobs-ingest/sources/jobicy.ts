import { fetchJson } from "../http";
import type { IngestSource, SourceJob } from "../types";

/**
 * Jobicy's public remote-jobs API (no key). Every job is remote. Their terms
 * ask that we credit Jobicy, keep the canonical job URL, and poll at most
 * hourly — once a day is well inside that.
 *
 * https://jobicy.com/jobs-rss-feed
 */
const API = "https://jobicy.com/api/v2/remote-jobs?count=200";

type JobicyJob = {
  id: number | string;
  url?: string;
  jobTitle?: string;
  companyName?: string;
  companyLogo?: string;
  jobIndustry?: string[] | string;
  jobType?: string[] | string;
  jobGeo?: string;
  jobLevel?: string;
  jobDescription?: string;
  pubDate?: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: string | null;
};

const toArray = (value: string[] | string | undefined): string[] =>
  Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];

/** "2026-10-14 08:12:45" is UTC on Jobicy's side, but carries no zone. */
const parseDate = (value?: string) =>
  value && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(" ", "T")}Z` : value;

const toSourceJob = (job: JobicyJob): SourceJob => ({
  externalId: String(job.id),
  sourceUrl: job.url || "",
  title: job.jobTitle || "",
  companyName: job.companyName || "",
  companyLogo: job.companyLogo || "",
  descriptionHtml: job.jobDescription || "",
  // jobGeo arrives as "LATAM,  Canada,  USA", or "Anywhere".
  location: (job.jobGeo || "").replace(/\s{2,}/g, " "),
  workplaceType: "remote",
  employmentType: toArray(job.jobType).join(", "),
  seniority: job.jobLevel,
  salary: {
    min: job.salaryMin,
    max: job.salaryMax,
    currency: job.salaryCurrency,
    period: job.salaryPeriod,
  },
  categories: toArray(job.jobIndustry),
  postedAt: parseDate(job.pubDate),
});

export const jobicySource: IngestSource = {
  id: "jobicy",
  name: "Jobicy",
  fetchJobs: async ({ deadline }) => {
    const payload = await fetchJson<{ success?: boolean; error?: string; jobs?: JobicyJob[] }>(API, {
      deadline,
    });
    if (payload?.success === false) throw new Error(payload.error || "Jobicy rejected the request.");
    return { jobs: (payload.jobs || []).map(toSourceJob) };
  },
};
