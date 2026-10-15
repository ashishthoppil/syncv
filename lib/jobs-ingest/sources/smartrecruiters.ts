import { SMARTRECRUITERS_BOARDS } from "../companies";
import { fetchJson } from "../http";
import { buildJobId, toIsoDate } from "../normalize";
import type { IngestSource, SourceJob } from "../types";
import { hydrateNew, readBoards } from "./boards";

/**
 * SmartRecruiters' public Posting API. The boards are big (Bosch lists 5,000+
 * postings, nearly all on-site) and the API has no workplace filter, so each
 * company is searched for "remote" and "hybrid" and the results are kept only
 * where the posting's own `location.remote` / `location.hybrid` flag agrees.
 * Descriptions need one request per posting, so they're fetched only for
 * postings we don't have yet.
 */
const SOURCE_ID = "smartrecruiters";
const PAGE_SIZE = 100;
const MAX_PAGES_PER_QUERY = 3;

type Posting = {
  id: string;
  name?: string;
  releasedDate?: string;
  company?: { identifier?: string; name?: string };
  location?: {
    city?: string;
    region?: string;
    country?: string;
    fullLocation?: string;
    remote?: boolean;
    hybrid?: boolean;
  };
  industry?: { label?: string };
  department?: { label?: string };
  function?: { label?: string };
  typeOfEmployment?: { label?: string };
  experienceLevel?: { id?: string; label?: string };
  postingUrl?: string;
  applyUrl?: string;
  jobAd?: { sections?: Record<string, { title?: string; text?: string }> };
};

const postingsUrl = (board: string, query: string, offset: number) =>
  `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(
    board
  )}/postings?q=${query}&limit=${PAGE_SIZE}&offset=${offset}`;

const postingUrl = (board: string, id: string) =>
  `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(board)}/postings/${encodeURIComponent(id)}`;

const SECTION_ORDER = ["companyDescription", "jobDescription", "qualifications", "additionalInformation"];

const toSourceJob = (raw: Posting, board: string, withContent: boolean): SourceJob | null => {
  const location = raw.location || {};
  const workplaceType = location.remote ? "remote" : location.hybrid ? "hybrid" : null;
  if (!workplaceType) return null;
  const sections = raw.jobAd?.sections || {};
  const html = SECTION_ORDER.map((key) => sections[key])
    .filter((section) => section?.text)
    .map((section) => `${section?.title ? `<h3>${section.title}</h3>` : ""}${section?.text}`)
    .join("\n");
  const publicUrl = raw.postingUrl || `https://jobs.smartrecruiters.com/${board}/${raw.id}`;
  return {
    externalId: raw.id,
    board,
    sourceUrl: publicUrl,
    applicationUrl: raw.applyUrl || publicUrl,
    title: raw.name || "",
    companyName: raw.company?.name || board,
    descriptionHtml: withContent ? html : undefined,
    location: location.fullLocation || [location.city, location.region].filter(Boolean).join(", "),
    places: [(location.country || "").toUpperCase()],
    workplaceType,
    employmentType: raw.typeOfEmployment?.label,
    seniority: raw.experienceLevel?.id || raw.experienceLevel?.label,
    categories: [raw.function?.label || "", raw.department?.label || ""],
    industry: raw.industry?.label,
    postedAt: raw.releasedDate,
  };
};

export const smartRecruitersSource: IngestSource = {
  id: SOURCE_ID,
  name: "SmartRecruiters",
  fetchJobs: async (ctx) => {
    const existingIds = await ctx.existingIds();
    return readBoards({
      boards: SMARTRECRUITERS_BOARDS,
      concurrency: 4,
      deadline: ctx.deadline,
      read: async (board) => {
        const found = new Map<string, Posting>();
        let complete = true;
        for (const query of ["remote", "hybrid"]) {
          for (let page = 0; page < MAX_PAGES_PER_QUERY; page += 1) {
            const payload = await fetchJson<{ totalFound?: number; content?: Posting[] }>(
              postingsUrl(board, query, page * PAGE_SIZE),
              { deadline: ctx.deadline }
            );
            for (const posting of payload.content || []) {
              if (posting.location?.remote || posting.location?.hybrid) found.set(posting.id, posting);
            }
            const seen = (page + 1) * PAGE_SIZE;
            if (seen >= (payload.totalFound || 0)) break;
            if (page === MAX_PAGES_PER_QUERY - 1) complete = false;
          }
        }
        const candidates = [...found.values()].filter((posting) => {
          const posted = toIsoDate(posting.releasedDate);
          return Boolean(posted) && new Date(posted as string) >= ctx.windowStart;
        });
        const { jobs, deferred } = await hydrateNew({
          candidates,
          existingIds,
          idOf: (posting) => buildJobId(SOURCE_ID, { board, externalId: posting.id }),
          deadline: ctx.deadline,
          concurrency: 4,
          toHeader: (posting) => toSourceJob(posting, board, false),
          fetchFull: async (posting) => {
            const detail = await fetchJson<Posting>(postingUrl(board, posting.id), {
              deadline: ctx.deadline,
            });
            return toSourceJob({ ...posting, ...detail }, board, true);
          },
        });
        return { jobs, complete, deferred };
      },
    });
  },
};
