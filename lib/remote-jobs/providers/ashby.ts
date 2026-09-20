import { ASHBY_BOARDS } from "@/lib/remote-jobs/companies";
import {
  buildBoardJobId,
  fetchBoardJson,
  getBoardJob,
  searchBoards,
} from "@/lib/remote-jobs/providers/boards";
import { decodeEntities, sanitizeJobHtml } from "@/lib/remote-jobs/sanitize";
import {
  dedupeLabels,
  type JobProvider,
  type RemoteJob,
  type RemoteJobSearchParams,
} from "@/lib/remote-jobs/types";

/**
 * Ashby's public job-board API. The richest shape of the three: an explicit
 * `isRemote` boolean, `employmentType`, secondary locations, and both HTML and
 * plain-text descriptions — so nothing about remote eligibility is inferred.
 *
 * Ashby has no lightweight listing mode and no public per-job endpoint (it
 * answers 401), so a board is always all-or-nothing. Most are under 2.4MB;
 * OpenAI's is 12.9MB on its own, which is why boards.ts caps fetch concurrency
 * and keeps descriptions out of search responses.
 */
const SOURCE_ID = "ashby";
const SOURCE_NAME = "Ashby";

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
  descriptionPlain?: string;
  compensation?: {
    compensationTierSummary?: string;
  };
};

const boardUrl = (company: string) =>
  `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(
    company
  )}?includeCompensation=true`;

/** "FullTime" → "Full-Time", so it reads like the other sources. */
const formatEmploymentType = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeJob = (
  raw: AshbyJob,
  company: string
): RemoteJob | null => {
  const externalId = String(raw.id || "").trim();
  const title = decodeEntities((raw.title || "").trim());
  if (!externalId || !title) return null;
  if (raw.isListed === false) return null;

  const isRemote =
    raw.isRemote === true ||
    (raw.workplaceType || "").toLowerCase() === "remote";
  if (!isRemote) return null;

  const locations = [
    raw.location,
    ...(raw.secondaryLocations || []).map((entry) => entry.location),
  ]
    .map((value) => (value || "").trim())
    .filter(Boolean);

  const url = raw.jobUrl || raw.applyUrl || "";

  return {
    id: `${SOURCE_ID}:${buildBoardJobId(company, externalId)}`,
    externalId,
    source: SOURCE_ID,
    sourceName: SOURCE_NAME,
    sourceUrl: url,
    applicationUrl: raw.applyUrl || url,
    title,
    companyName: company,
    companyLogo: "",
    description: (raw.descriptionPlain || "").trim(),
    descriptionHtml: sanitizeJobHtml(raw.descriptionHtml || ""),
    location: raw.location || "",
    remote: true,
    // Ashby marks the job remote but still names the anchor location(s); an
    // empty list genuinely means "anywhere".
    remoteCountries: locations.length ? locations : ["Anywhere"],
    employmentType: formatEmploymentType(raw.employmentType || ""),
    experienceLevel: "",
    salary: (raw.compensation?.compensationTierSummary || "").trim(),
    skills: [],
    categories: dedupeLabels([raw.department, raw.team]),
    postedAt: raw.publishedAt ? new Date(raw.publishedAt).toISOString() : "",
    detailLoaded: true,
  };
};

const loadBoard = async (company: string): Promise<RemoteJob[]> => {
  const payload = await fetchBoardJson<{ jobs?: AshbyJob[] }>(
    boardUrl(company),
    SOURCE_NAME
  );
  return (payload.jobs || [])
    .map((raw) => normalizeJob(raw, company))
    .filter((job): job is RemoteJob => job !== null);
};

const searchJobs = (params: RemoteJobSearchParams) =>
  searchBoards({
    providerId: SOURCE_ID,
    companies: ASHBY_BOARDS,
    loadBoard,
    params,
  });

const getJob = (value: string) =>
  getBoardJob({ providerId: SOURCE_ID, loadBoard, value });

export const ashbyProvider: JobProvider = {
  id: SOURCE_ID,
  name: SOURCE_NAME,
  attributionUrl: "https://www.ashbyhq.com",
  searchJobs,
  getJob,
};
