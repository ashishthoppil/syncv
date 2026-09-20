import { LEVER_BOARDS } from "@/lib/remote-jobs/companies";
import {
  buildBoardJobId,
  fetchBoardJson,
  getBoardJob,
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
 * Lever's public postings feed. Boards are modest in size and already carry
 * both HTML and plain-text descriptions, so unlike Greenhouse there's no
 * separate detail fetch — the plain text is taken as-is rather than derived.
 *
 * `workplaceType: "remote"` is authoritative, so remote eligibility never has
 * to be inferred here.
 */
const SOURCE_ID = "lever";
const SOURCE_NAME = "Lever";

type LeverJob = {
  id?: string;
  text?: string;
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  workplaceType?: string;
  country?: string;
  categories?: {
    location?: string;
    allLocations?: string[];
    team?: string;
    department?: string;
    commitment?: string;
  };
  opening?: string;
  openingPlain?: string;
  description?: string;
  descriptionPlain?: string;
  /**
   * Where Lever keeps the bulk of a JD — "What You'll Do", "Who You Are" and
   * so on, each a heading plus an HTML list. On many postings these dwarf
   * `description` (and on some, `description` is empty and this is the whole
   * job). Skipping them would hand the scanner a gutted JD.
   */
  lists?: { text?: string; content?: string }[];
  additional?: string;
  additionalPlain?: string;
};

const boardUrl = (company: string) =>
  `https://api.lever.co/v0/postings/${encodeURIComponent(company)}?mode=json`;

export const normalizeJob = (
  raw: LeverJob,
  company: string
): RemoteJob | null => {
  const externalId = String(raw.id || "").trim();
  const title = decodeEntities((raw.text || "").trim());
  if (!externalId || !title) return null;
  if ((raw.workplaceType || "").toLowerCase() !== "remote") return null;

  const locations =
    raw.categories?.allLocations?.filter(Boolean) ||
    (raw.categories?.location ? [raw.categories.location] : []);

  // Reassemble the JD in the order Lever's own hosted page renders it:
  // opening, body, the titled lists, then the closing block.
  const listHtml = (raw.lists || [])
    .map((entry) =>
      [
        entry.text ? `<h3>${entry.text}</h3>` : "",
        entry.content ? `<ul>${entry.content}</ul>` : "",
      ].join("")
    )
    .filter(Boolean);
  const listPlain = (raw.lists || [])
    .map((entry) =>
      [entry.text, htmlToPlainText(`<ul>${entry.content || ""}</ul>`)]
        .filter(Boolean)
        .join("\n")
    )
    .filter(Boolean);

  const html = [raw.opening, raw.description, ...listHtml, raw.additional]
    .filter(Boolean)
    .join("\n");
  const plain = [
    raw.openingPlain,
    raw.descriptionPlain,
    ...listPlain,
    raw.additionalPlain,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
  const url = raw.hostedUrl || "";

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
    description: plain,
    descriptionHtml: sanitizeJobHtml(html),
    location: raw.categories?.location || "",
    remote: true,
    remoteCountries: locations.length ? locations : ["Anywhere"],
    employmentType: raw.categories?.commitment || "",
    experienceLevel: "",
    salary: "",
    skills: [],
    categories: dedupeLabels([
      raw.categories?.team,
      raw.categories?.department,
    ]),
    postedAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : "",
    detailLoaded: true,
  };
};

const loadBoard = async (company: string): Promise<RemoteJob[]> => {
  const payload = await fetchBoardJson<LeverJob[]>(boardUrl(company), SOURCE_NAME);
  return (Array.isArray(payload) ? payload : [])
    .map((raw) => normalizeJob(raw, company))
    .filter((job): job is RemoteJob => job !== null);
};

const searchJobs = (params: RemoteJobSearchParams) =>
  searchBoards({
    providerId: SOURCE_ID,
    companies: LEVER_BOARDS,
    loadBoard,
    params,
  });

const getJob = (value: string) =>
  getBoardJob({ providerId: SOURCE_ID, loadBoard, value });

export const leverProvider: JobProvider = {
  id: SOURCE_ID,
  name: SOURCE_NAME,
  attributionUrl: "https://www.lever.co",
  searchJobs,
  getJob,
};
