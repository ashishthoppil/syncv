import { ASHBY_BOARDS } from "../companies";
import { fetchJson } from "../http";
import type { IngestSource, SourceJob } from "../types";
import { readBoards } from "./boards";

/**
 * Ashby's public job-board API. The richest shape of the ATS sources: an
 * explicit workplace type, employment type, secondary locations, structured
 * compensation and full descriptions in the one response — so nothing about
 * the workplace is inferred. Some boards are large (OpenAI's is ~13MB), which
 * is why they're read a few at a time.
 */
type AshbyJob = {
  id?: string;
  title?: string;
  department?: string;
  team?: string;
  employmentType?: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  publishedAt?: string;
  isListed?: boolean;
  isRemote?: boolean;
  workplaceType?: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionHtml?: string;
  compensation?: {
    compensationTierSummary?: string;
    summaryComponents?: {
      compensationType?: string;
      interval?: string;
      currencyCode?: string;
      minValue?: number | null;
      maxValue?: number | null;
    }[];
  };
};

const boardUrl = (board: string) =>
  `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}?includeCompensation=true`;

const workplaceOf = (raw: AshbyJob) => {
  const type = (raw.workplaceType || "").toLowerCase();
  if (type === "hybrid") return "hybrid";
  if (type === "remote" || raw.isRemote === true) return "remote";
  return null;
};

const toSourceJob = (raw: AshbyJob, board: string): SourceJob | null => {
  const workplaceType = workplaceOf(raw);
  if (!raw.id || raw.isListed === false || !workplaceType) return null;
  const salary = raw.compensation?.summaryComponents?.find(
    (component) => (component.compensationType || "").toLowerCase() === "salary"
  );
  return {
    externalId: raw.id,
    board,
    sourceUrl: raw.jobUrl || raw.applyUrl || "",
    applicationUrl: raw.applyUrl || raw.jobUrl || "",
    title: raw.title || "",
    companyName: ASHBY_BOARDS[board] || board,
    descriptionHtml: raw.descriptionHtml || "",
    location: raw.location || "",
    places: (raw.secondaryLocations || []).map((entry) => entry.location || ""),
    workplaceType,
    // "FullTime" → "Full Time", which the normaliser understands.
    employmentType: (raw.employmentType || "").replace(/([a-z])([A-Z])/g, "$1 $2"),
    salary: salary
      ? {
          min: salary.minValue,
          max: salary.maxValue,
          currency: salary.currencyCode,
          period: salary.interval,
        }
      : { text: raw.compensation?.compensationTierSummary },
    categories: [raw.department || "", raw.team || ""],
    postedAt: raw.publishedAt,
  };
};

export const ashbySource: IngestSource = {
  id: "ashby",
  name: "Ashby",
  fetchJobs: async (ctx) =>
    readBoards({
      boards: Object.keys(ASHBY_BOARDS),
      concurrency: 4,
      deadline: ctx.deadline,
      read: async (board) => {
        const payload = await fetchJson<{ jobs?: AshbyJob[] }>(boardUrl(board), {
          deadline: ctx.deadline,
          timeoutMs: 30_000,
        });
        const jobs = (payload.jobs || [])
          .map((raw) => toSourceJob(raw, board))
          .filter((job): job is SourceJob => job !== null);
        return { jobs, complete: true };
      },
    }),
};
