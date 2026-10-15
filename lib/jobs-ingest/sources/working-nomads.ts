import { fetchJson } from "../http";
import type { IngestSource, SourceJob } from "../types";

/**
 * Working Nomads' public feed — a small list (around 50 jobs), every one
 * remote, returned whole in one response. Because it is the complete list,
 * a stored job that no longer appears in it has been taken down.
 */
const API = "https://www.workingnomads.com/api/exposed_jobs/";

type NomadJob = {
  url?: string;
  title?: string;
  description?: string;
  company_name?: string;
  category_name?: string;
  tags?: string;
  location?: string;
  pub_date?: string;
};

const toSourceJob = (raw: NomadJob): SourceJob | null => {
  // https://www.workingnomads.com/job/go/1939844/ → 1939844
  const externalId = raw.url?.match(/\/(\d+)\/?$/)?.[1];
  if (!externalId) return null;
  return {
    externalId,
    sourceUrl: raw.url || "",
    title: raw.title || "",
    companyName: raw.company_name || "",
    descriptionHtml: raw.description || "",
    location: raw.location || "",
    workplaceType: "remote",
    categories: [raw.category_name || "", ...(raw.tags || "").split(",").map((tag) => tag.trim())],
    postedAt: raw.pub_date,
  };
};

export const workingNomadsSource: IngestSource = {
  id: "workingnomads",
  name: "Working Nomads",
  fetchJobs: async ({ deadline }) => {
    const payload = await fetchJson<NomadJob[]>(API, { deadline, timeoutMs: 30_000 });
    const jobs = (Array.isArray(payload) ? payload : [])
      .map(toSourceJob)
      .filter((job): job is SourceJob => job !== null);
    return { jobs, complete: true };
  },
};
