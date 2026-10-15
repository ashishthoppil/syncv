import { RECRUITEE_BOARDS } from "../companies";
import { fetchJson } from "../http";
import type { IngestSource, SourceJob } from "../types";
import { readBoards } from "./boards";

/**
 * Recruitee's public careers API — one board per company, every offer with its
 * description, salary and explicit remote / hybrid / on-site flags.
 */
type Offer = {
  id?: number;
  slug?: string;
  title?: string;
  company_name?: string;
  description?: string;
  requirements?: string;
  location?: string;
  city?: string;
  country?: string;
  country_code?: string;
  locations?: { city?: string; country?: string; country_code?: string }[];
  remote?: boolean;
  hybrid?: boolean;
  on_site?: boolean;
  employment_type_code?: string;
  experience_code?: string;
  category_code?: string;
  department?: string;
  salary?: { min?: string | number | null; max?: string | number | null; currency?: string; period?: string };
  published_at?: string;
  careers_url?: string;
  careers_apply_url?: string;
};

const boardUrl = (board: string) => `https://${encodeURIComponent(board)}.recruitee.com/api/offers/`;

const toSourceJob = (raw: Offer, board: string): SourceJob | null => {
  const workplaceType = raw.remote ? "remote" : raw.hybrid ? "hybrid" : null;
  if (!raw.id || !workplaceType) return null;
  const html = [raw.description, raw.requirements ? `<h3>Requirements</h3>${raw.requirements}` : ""]
    .filter(Boolean)
    .join("\n");
  return {
    externalId: String(raw.id),
    board,
    sourceUrl: raw.careers_url || `https://${board}.recruitee.com/o/${raw.slug}`,
    applicationUrl: raw.careers_apply_url || raw.careers_url,
    title: raw.title || "",
    companyName: raw.company_name || board,
    descriptionHtml: html,
    location: raw.location || [raw.city, raw.country].filter(Boolean).join(", "),
    places: [
      raw.country_code || "",
      ...(raw.locations || []).map((place) => place.country_code || place.country || ""),
    ],
    workplaceType,
    employmentType: raw.employment_type_code,
    seniority: raw.experience_code,
    salary: raw.salary
      ? {
          min: Number(raw.salary.min) || null,
          max: Number(raw.salary.max) || null,
          currency: raw.salary.currency,
          period: raw.salary.period,
        }
      : null,
    categories: [raw.department || "", (raw.category_code || "").replace(/_/g, " ")],
    // "2026-09-01 12:00:00 UTC"
    postedAt: (raw.published_at || "").replace(" UTC", "Z").replace(" ", "T"),
  };
};

export const recruiteeSource: IngestSource = {
  id: "recruitee",
  name: "Recruitee",
  fetchJobs: async (ctx) =>
    readBoards({
      boards: RECRUITEE_BOARDS,
      concurrency: 4,
      deadline: ctx.deadline,
      read: async (board) => {
        const payload = await fetchJson<{ offers?: Offer[] }>(boardUrl(board), { deadline: ctx.deadline });
        const jobs = (payload.offers || [])
          .map((raw) => toSourceJob(raw, board))
          .filter((job): job is SourceJob => job !== null);
        return { jobs, complete: true };
      },
    }),
};
