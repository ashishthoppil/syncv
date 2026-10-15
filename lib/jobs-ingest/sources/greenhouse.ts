import { decodeEntities } from "@/lib/remote-jobs/sanitize";
import { GREENHOUSE_BOARDS } from "../companies";
import { fetchJson } from "../http";
import { buildJobId, HYBRID_HINT, REMOTE_HINT, toIsoDate } from "../normalize";
import type { IngestSource, SourceJob } from "../types";
import { hydrateNew, readBoards } from "./boards";

/**
 * Greenhouse's public job-board API — the employers' own career pages, no key.
 *
 * The list is read WITHOUT descriptions (with them, 16 boards weigh ~58MB),
 * then each posting we don't have yet is fetched on its own. Greenhouse has no
 * remote flag, so the workplace is read from the location text, e.g.
 * "Remote - US" or "Hybrid - Bengaluru". Anything else is on-site and skipped.
 */
const SOURCE_ID = "greenhouse";

type GreenhouseJob = {
  id: number | string;
  title?: string;
  absolute_url?: string;
  updated_at?: string;
  first_published?: string;
  company_name?: string;
  location?: { name?: string };
  departments?: { name?: string }[];
  offices?: { name?: string; location?: string }[];
  content?: string;
  pay_input_ranges?: {
    min_cents?: number;
    max_cents?: number;
    currency_type?: string;
  }[];
};

const listUrl = (board: string) =>
  `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs`;

const jobUrl = (board: string, id: string) =>
  `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${encodeURIComponent(
    id
  )}?pay_transparency=true`;

const workplaceOf = (location: string) =>
  HYBRID_HINT.test(location) ? "hybrid" : REMOTE_HINT.test(location) ? "remote" : null;

const toSourceJob = (raw: GreenhouseJob, board: string, withContent: boolean): SourceJob | null => {
  const location = (raw.location?.name || "").trim();
  const workplaceType = workplaceOf(location);
  if (!workplaceType) return null;
  const pay = raw.pay_input_ranges?.[0];
  return {
    externalId: String(raw.id),
    board,
    sourceUrl: raw.absolute_url || "",
    title: raw.title || "",
    companyName: raw.company_name || board,
    // Greenhouse double-escapes the description.
    descriptionHtml: withContent ? decodeEntities(raw.content || "") : undefined,
    location,
    places: (raw.offices || []).map((office) => office.location || office.name || ""),
    workplaceType,
    salary: pay
      ? {
          min: pay.min_cents ? pay.min_cents / 100 : null,
          max: pay.max_cents ? pay.max_cents / 100 : null,
          currency: pay.currency_type,
          period: "year",
        }
      : null,
    categories: (raw.departments || []).map((department) => department.name || ""),
    postedAt: raw.first_published || raw.updated_at,
  };
};

export const greenhouseSource: IngestSource = {
  id: SOURCE_ID,
  name: "Greenhouse",
  fetchJobs: async (ctx) => {
    const existingIds = await ctx.existingIds();
    return readBoards({
      boards: GREENHOUSE_BOARDS,
      concurrency: 4,
      deadline: ctx.deadline,
      read: async (board) => {
        const payload = await fetchJson<{ jobs?: GreenhouseJob[] }>(listUrl(board), {
          deadline: ctx.deadline,
        });
        const candidates = (payload.jobs || []).filter((raw) => {
          if (!workplaceOf(raw.location?.name || "")) return false;
          const posted = toIsoDate(raw.first_published || raw.updated_at);
          return Boolean(posted) && new Date(posted as string) >= ctx.windowStart;
        });
        const { jobs, deferred } = await hydrateNew({
          candidates,
          existingIds,
          idOf: (raw) => buildJobId(SOURCE_ID, { board, externalId: String(raw.id) }),
          deadline: ctx.deadline,
          concurrency: 4,
          toHeader: (raw) => toSourceJob(raw, board, false),
          fetchFull: async (raw) => {
            const detail = await fetchJson<GreenhouseJob>(jobUrl(board, String(raw.id)), {
              deadline: ctx.deadline,
            });
            return toSourceJob({ ...raw, ...detail }, board, true);
          },
        });
        return { jobs, complete: true, deferred };
      },
    });
  },
};
