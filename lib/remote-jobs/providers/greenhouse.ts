import { GREENHOUSE_BOARDS } from "@/lib/remote-jobs/companies";
import {
  buildBoardJobId,
  fetchBoardJson,
  getBoardJob,
  parseBoardJobId,
  searchBoards,
} from "@/lib/remote-jobs/providers/boards";
import {
  decodeEntities,
  htmlToPlainText,
  sanitizeJobHtml,
} from "@/lib/remote-jobs/sanitize";
import {
  dedupeLabels,
  type JobProvider,
  type RemoteJob,
  type RemoteJobSearchParams,
} from "@/lib/remote-jobs/types";

/**
 * Greenhouse's public job-board API. These are the employer's own career pages,
 * published for exactly this purpose — no key, no attribution terms.
 *
 * The listing is fetched WITHOUT `content=true`: with descriptions our 16
 * boards weigh 58.5MB, without them 4.35MB, and every board then fits under
 * Next's 2MB cache limit. The full description comes from the per-job endpoint
 * when someone opens a posting.
 *
 * Greenhouse has no remote flag, so remote eligibility is read from the
 * free-text location. A job whose location doesn't say remote is left out
 * rather than guessed at.
 */
const SOURCE_ID = "greenhouse";
const SOURCE_NAME = "Greenhouse";

const REMOTE_HINT = /\b(remote|anywhere|distributed|work from home|wfh)\b/i;

type GreenhouseJob = {
  id: number | string;
  title?: string;
  absolute_url?: string;
  updated_at?: string;
  first_published?: string;
  location?: { name?: string };
  offices?: { name?: string }[];
  departments?: { name?: string }[];
  content?: string;
  company_name?: string;
};

const listUrl = (company: string) =>
  `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(company)}/jobs`;

const jobUrl = (company: string, id: string) =>
  `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(
    company
  )}/jobs/${encodeURIComponent(id)}`;

/**
 * "Remote - US | Remote - Canada" → ["US", "Canada"]; "Remote" → ["Anywhere"].
 * Only the segments that actually mention remote are kept, so a job listed in
 * "San Francisco, CA | Remote - US" doesn't claim SF as remote-eligible.
 */
const parseRemoteLocations = (raw: string): string[] => {
  const segments = raw
    .split(/[|;/]|,\s*(?=remote)/i)
    .map((part) => part.trim())
    .filter(Boolean);

  const remoteSegments = segments.filter((part) => REMOTE_HINT.test(part));
  if (!remoteSegments.length) return [];

  return remoteSegments.map((part) => {
    let stripped = part
      .replace(/\b(remote|distributed|work from home|wfh)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s\-–—,:]+|[\s\-–—,:]+$/g, "")
      .trim();
    // Trimming can leave a dangling "(" — e.g. "Remote - Canada - (ON, AB
    // Only)" loses its closer. Drop the orphaned fragment rather than print it.
    const opens = (stripped.match(/\(/g) || []).length;
    const closes = (stripped.match(/\)/g) || []).length;
    if (opens > closes) {
      stripped = stripped.slice(0, stripped.lastIndexOf("(")).trim();
    }
    stripped = stripped.replace(/^[\s\-–—,:]+|[\s\-–—,:]+$/g, "").trim();
    return stripped || "Anywhere";
  });
};

export const normalizeJob = (
  raw: GreenhouseJob,
  company: string,
  { withContent }: { withContent: boolean }
): RemoteJob | null => {
  const externalId = String(raw.id || "").trim();
  const title = decodeEntities((raw.title || "").trim());
  if (!externalId || !title) return null;

  const locationName = (raw.location?.name || "").trim();
  const remoteCountries = parseRemoteLocations(locationName);
  // No remote signal in the location means we can't claim it's remote.
  if (!remoteCountries.length) return null;

  // Greenhouse double-escapes the description.
  const rawHtml = withContent ? decodeEntities(raw.content || "") : "";
  const url = raw.absolute_url || "";

  return {
    id: `${SOURCE_ID}:${buildBoardJobId(company, externalId)}`,
    externalId,
    source: SOURCE_ID,
    sourceName: SOURCE_NAME,
    sourceUrl: url,
    applicationUrl: url,
    title,
    companyName: decodeEntities((raw.company_name || company).trim()),
    companyLogo: "",
    description: withContent ? htmlToPlainText(rawHtml) : "",
    descriptionHtml: withContent ? sanitizeJobHtml(rawHtml) : "",
    location: locationName,
    remote: true,
    remoteCountries,
    employmentType: "",
    experienceLevel: "",
    salary: "",
    skills: [],
    categories: dedupeLabels(
      (raw.departments || []).map((department) => department.name)
    ),
    postedAt: raw.first_published || raw.updated_at || "",
    detailLoaded: withContent,
  };
};

const loadBoard = async (company: string): Promise<RemoteJob[]> => {
  const payload = await fetchBoardJson<{ jobs?: GreenhouseJob[] }>(
    listUrl(company),
    SOURCE_NAME
  );
  return (payload.jobs || [])
    .map((raw) => normalizeJob(raw, company, { withContent: false }))
    .filter((job): job is RemoteJob => job !== null);
};

const searchJobs = (params: RemoteJobSearchParams) =>
  searchBoards({
    providerId: SOURCE_ID,
    companies: GREENHOUSE_BOARDS,
    loadBoard,
    params,
  });

/** One job, with its description — the only place `content` is pulled. */
const getJob = async (value: string): Promise<RemoteJob | null> => {
  const parsed = parseBoardJobId(value);
  if (!parsed) return null;
  try {
    const raw = await fetchBoardJson<GreenhouseJob>(
      jobUrl(parsed.company, parsed.externalId),
      SOURCE_NAME
    );
    return normalizeJob(raw, parsed.company, { withContent: true });
  } catch (error) {
    console.error(`Remote jobs: ${SOURCE_ID} getJob failed for ${value}`, error);
    // The per-job endpoint can 404 on a pulled posting; fall back to the board.
    return getBoardJob({ providerId: SOURCE_ID, loadBoard, value });
  }
};

export const greenhouseProvider: JobProvider = {
  id: SOURCE_ID,
  name: SOURCE_NAME,
  attributionUrl: "https://www.greenhouse.io",
  searchJobs,
  getJob,
};
