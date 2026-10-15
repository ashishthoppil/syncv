import { fetchJson, hasTimeLeft, sleep } from "../http";
import type { IngestSource, SourceJob } from "../types";

/**
 * startup.jobs' API (free key: STARTUP_JOBS_API_KEY). Every company on it is a
 * startup, which is the one source where `isStartup` comes for free.
 *
 * Their terms, all of which the app honours:
 *  - each job title links to the job's startup.jobs page, dofollow;
 *  - "Startup Jobs" is credited, linking to startup.jobs;
 *  - a page showing one listing carries a canonical link to the original;
 *  - the attribution paragraph at the end of each description is kept;
 *  - stored data is refreshed or deleted within seven days. Each run re-reads
 *    the last LOOKBACK_DAYS, and the daily cleanup deletes any startup.jobs
 *    row not seen for six days (lib/jobs-ingest/store.ts).
 *
 * The free tier allows 20 requests a minute, so calls are spaced 3.2s apart.
 *
 * https://startup.jobs/api · https://startup.jobs/terms/api
 */
const API = "https://api.startup.jobs/v1/jobs";
const LOOKBACK_DAYS = 3;
const PAUSE_MS = 3_200;

type StartupJob = {
  id: number;
  title?: string;
  url?: string;
  published_at?: string;
  employment_type?: string;
  workplace_type?: string;
  location?: { city?: string | null; state?: string | null; country?: string | null };
  roles?: { title?: string }[];
  salary?: string | null;
  company?: { name?: string; website_url?: string | null; logo_url?: string | null };
  description_html?: string;
};

const toSourceJob = (raw: StartupJob): SourceJob | null => {
  const workplace = (raw.workplace_type || "").toLowerCase();
  const workplaceType = workplace === "remote" ? "remote" : workplace === "hybrid" ? "hybrid" : null;
  if (!raw.id || !raw.url || !workplaceType) return null;
  const location = raw.location || {};
  return {
    externalId: String(raw.id),
    sourceUrl: raw.url,
    // Applications go through the startup.jobs page; their terms require it.
    applicationUrl: raw.url,
    title: raw.title || "",
    companyName: raw.company?.name || "",
    companyLogo: raw.company?.logo_url || "",
    companyWebsite: raw.company?.website_url || undefined,
    descriptionHtml: raw.description_html || "",
    location: [location.city, location.state, location.country].filter(Boolean).join(", "),
    places: [location.country || ""],
    workplaceType,
    employmentType: raw.employment_type,
    salary: raw.salary ? { text: raw.salary } : null,
    categories: (raw.roles || []).map((role) => role.title || ""),
    isStartup: true,
    postedAt: raw.published_at,
  };
};

export const startupJobsSource: IngestSource = {
  id: "startupjobs",
  name: "Startup Jobs",
  isConfigured: () => Boolean(process.env.STARTUP_JOBS_API_KEY),
  fetchJobs: async ({ deadline }) => {
    const headers = { Authorization: `Bearer ${process.env.STARTUP_JOBS_API_KEY}` };
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const jobs: SourceJob[] = [];
    let unfinished = false;
    let first = true;

    for (const workplace of ["remote", "hybrid"]) {
      let cursor: number | null = null;
      for (;;) {
        if (!hasTimeLeft(deadline, PAUSE_MS)) {
          unfinished = true;
          break;
        }
        if (!first) await sleep(PAUSE_MS);
        first = false;
        const params = new URLSearchParams({ workplace_type: workplace, posted_after: since, limit: "50" });
        if (cursor) params.set("starting_after", String(cursor));
        const payload = await fetchJson<{ data?: StartupJob[]; has_more?: boolean; next_cursor?: number | null }>(
          `${API}?${params.toString()}`,
          { headers, deadline }
        );
        for (const raw of payload.data || []) {
          const job = toSourceJob(raw);
          if (job) jobs.push(job);
        }
        cursor = payload.next_cursor ?? null;
        if (!payload.has_more || !cursor) break;
      }
    }
    return {
      jobs,
      partial: unfinished,
      note: unfinished ? "stopped at the time limit (20 requests/minute)" : undefined,
    };
  },
};
