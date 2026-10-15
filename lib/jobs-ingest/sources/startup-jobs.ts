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
 *  - stored data is refreshed or deleted within seven days: the daily cleanup
 *    deletes any startup.jobs row not seen for six days (lib/jobs-ingest/store.ts).
 *
 * The free tier allows 20 requests a minute, so calls are spaced 3.2s apart —
 * about ten pages (500 jobs) per run. The first live run spent all of them on
 * remote jobs and never reached hybrid, so the two are now read in turns, and
 * each run starts from the newest job already stored rather than re-reading a
 * fixed window.
 *
 * https://startup.jobs/api · https://startup.jobs/terms/api
 */
const API = "https://api.startup.jobs/v1/jobs";
/** Never look further back than this, even on the first run. */
const LOOKBACK_DAYS = 3;
/**
 * How far behind the newest stored job to start. New listings reach the API
 * up to 24 hours after their `published_at`, so a smaller overlap would skip
 * jobs that were published before our newest one but released after it.
 */
const OVERLAP_MS = 36 * 60 * 60 * 1000;
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
  fetchJobs: async ({ deadline, newestStored }) => {
    const headers = { Authorization: `Bearer ${process.env.STARTUP_JOBS_API_KEY}` };
    const since = new Date(
      Math.max(
        Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
        newestStored ? newestStored.getTime() - OVERLAP_MS : 0
      )
    ).toISOString();
    const streams = (["remote", "hybrid"] as const).map((workplace) => ({
      workplace,
      cursor: null as number | null,
      done: false,
    }));
    const jobs: SourceJob[] = [];
    let first = true;

    // One page of each in turn, so a busy remote feed can't use up the whole
    // request budget before hybrid gets a look.
    while (streams.some((stream) => !stream.done) && hasTimeLeft(deadline, PAUSE_MS)) {
      for (const stream of streams) {
        if (stream.done || !hasTimeLeft(deadline, PAUSE_MS)) continue;
        if (!first) await sleep(PAUSE_MS);
        first = false;
        const params = new URLSearchParams({
          workplace_type: stream.workplace,
          posted_after: since,
          limit: "50",
        });
        if (stream.cursor) params.set("starting_after", String(stream.cursor));
        const payload = await fetchJson<{ data?: StartupJob[]; has_more?: boolean; next_cursor?: number | null }>(
          `${API}?${params.toString()}`,
          { headers, deadline }
        );
        for (const raw of payload.data || []) {
          const job = toSourceJob(raw);
          if (job) jobs.push(job);
        }
        stream.cursor = payload.next_cursor ?? null;
        stream.done = !payload.has_more || !stream.cursor;
      }
    }

    const unfinished = streams.filter((stream) => !stream.done).map((stream) => stream.workplace);
    return {
      jobs,
      partial: unfinished.length > 0,
      note: unfinished.length
        ? `stopped at the time limit (20 requests/minute) with ${unfinished.join(" and ")} jobs left`
        : undefined,
    };
  },
};
