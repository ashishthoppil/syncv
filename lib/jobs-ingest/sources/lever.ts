import { LEVER_BOARDS } from "../companies";
import { fetchJson } from "../http";
import type { IngestSource, SourceJob } from "../types";
import { readBoards } from "./boards";

/**
 * Lever's public postings API. `workplaceType` is authoritative, boards carry
 * full descriptions, and Lever is slow (single boards take 2–3.5s), so the
 * boards are read in parallel and nothing is fetched per job.
 */
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
  description?: string;
  /**
   * Where Lever keeps the bulk of a JD — "What You'll Do", "Who You Are" and
   * so on, each a heading plus an HTML list. On some postings `description` is
   * empty and this is the whole job; skipping it would gut the JD.
   */
  lists?: { text?: string; content?: string }[];
  additional?: string;
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
};

const boardUrl = (board: string) =>
  `https://api.lever.co/v0/postings/${encodeURIComponent(board)}?mode=json`;

const workplaceOf = (raw: LeverJob) => {
  const type = (raw.workplaceType || "").toLowerCase();
  return type === "remote" ? "remote" : type === "hybrid" ? "hybrid" : null;
};

const toSourceJob = (raw: LeverJob, board: string): SourceJob | null => {
  const workplaceType = workplaceOf(raw);
  if (!raw.id || !workplaceType) return null;
  // Reassembled in the order Lever's own hosted page renders it.
  const listHtml = (raw.lists || []).map(
    (entry) => `${entry.text ? `<h3>${entry.text}</h3>` : ""}${entry.content ? `<ul>${entry.content}</ul>` : ""}`
  );
  const html = [raw.opening, raw.description, ...listHtml, raw.additional].filter(Boolean).join("\n");
  const locations = raw.categories?.allLocations?.length
    ? raw.categories.allLocations
    : [raw.categories?.location || ""];
  return {
    externalId: raw.id,
    board,
    sourceUrl: raw.hostedUrl || "",
    applicationUrl: raw.applyUrl || raw.hostedUrl || "",
    title: raw.text || "",
    companyName: LEVER_BOARDS[board] || board,
    descriptionHtml: html,
    location: raw.categories?.location || "",
    places: [...locations, raw.country || ""],
    workplaceType,
    employmentType: raw.categories?.commitment,
    salary: raw.salaryRange
      ? {
          min: raw.salaryRange.min,
          max: raw.salaryRange.max,
          currency: raw.salaryRange.currency,
          period: raw.salaryRange.interval,
        }
      : null,
    categories: [raw.categories?.team || "", raw.categories?.department || ""],
    postedAt: raw.createdAt,
  };
};

export const leverSource: IngestSource = {
  id: "lever",
  name: "Lever",
  fetchJobs: async (ctx) =>
    readBoards({
      boards: Object.keys(LEVER_BOARDS),
      concurrency: 8,
      deadline: ctx.deadline,
      read: async (board) => {
        const payload = await fetchJson<LeverJob[]>(boardUrl(board), {
          deadline: ctx.deadline,
          timeoutMs: 25_000,
        });
        const jobs = (Array.isArray(payload) ? payload : [])
          .map((raw) => toSourceJob(raw, board))
          .filter((job): job is SourceJob => job !== null);
        return { jobs, complete: true };
      },
    }),
};
