import { WORKABLE_BOARDS } from "../companies";
import { fetchJson, HttpError, sleep } from "../http";
import { looksHybrid } from "../normalize";
import type { IngestSource, SourceJob } from "../types";
import { readBoards } from "./boards";

/**
 * Workable's public career-page APIs. Two calls per company:
 *  - the widget endpoint, which returns every job with its description in one
 *    response but only a remote yes/no (`telecommuting`);
 *  - the v3 jobs endpoint, which says remote / hybrid / on-site.
 *
 * Workable rate-limits hard (it refused 280 of 335 rapid requests while this
 * was being built), so companies are read one at a time with a pause between
 * calls. If the v3 call is refused, hybrid roles can only be spotted from the
 * text — the board is then marked as read in part, so none of its stored jobs
 * are deleted on the strength of an incomplete read.
 */
const PAUSE_MS = 1200;

type WidgetJob = {
  title?: string;
  shortcode?: string;
  employment_type?: string;
  telecommuting?: boolean | string;
  department?: string;
  url?: string;
  application_url?: string;
  published_on?: string;
  created_at?: string;
  country?: string;
  city?: string;
  state?: string;
  experience?: string;
  function?: string;
  industry?: string;
  locations?: { country?: string; countryCode?: string; city?: string; region?: string }[];
  description?: string;
};

type V3Job = { shortcode?: string; workplace?: string };

const widgetUrl = (board: string) =>
  `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(board)}?details=true`;
const v3Url = (board: string) =>
  `https://apply.workable.com/api/v3/accounts/${encodeURIComponent(board)}/jobs`;

/**
 * shortcode → "remote" | "hybrid" | "on_site", or null when Workable refused
 * the request or the pages didn't add up to the stated total.
 */
const readWorkplaces = async (board: string, deadline: number) => {
  const workplaces = new Map<string, string>();
  let token: string | undefined;
  let total = 0;
  try {
    for (let page = 0; page < 6; page += 1) {
      const payload = await fetchJson<{ results?: V3Job[]; total?: number; nextPage?: string }>(v3Url(board), {
        method: "POST",
        body: { query: "", location: [], department: [], worktype: [], remote: [], ...(token ? { token } : {}) },
        deadline,
        // A refusal here costs only hybrid detection, so don't wait it out.
        retries: 0,
      });
      total = payload.total || 0;
      for (const job of payload.results || []) workplaces.set(job.shortcode || "", job.workplace || "");
      token = payload.nextPage || undefined;
      if (!token) break;
      await sleep(PAUSE_MS);
    }
  } catch (error) {
    if (error instanceof HttpError && error.status === 429) return null;
    throw error;
  }
  return workplaces.size >= total ? workplaces : null;
};

export const workableSource: IngestSource = {
  id: "workable",
  name: "Workable",
  fetchJobs: async (ctx) =>
    readBoards({
      boards: WORKABLE_BOARDS,
      concurrency: 1,
      deadline: ctx.deadline,
      read: async (board) => {
        const widget = await fetchJson<{ name?: string; jobs?: WidgetJob[] }>(widgetUrl(board), {
          deadline: ctx.deadline,
          retries: 1,
        });
        await sleep(PAUSE_MS);
        const workplaces = await readWorkplaces(board, ctx.deadline);
        await sleep(PAUSE_MS);

        const jobs: SourceJob[] = [];
        for (const raw of widget.jobs || []) {
          if (!raw.shortcode) continue;
          const telecommute = String(raw.telecommuting).toLowerCase() === "true";
          const stated = workplaces?.get(raw.shortcode);
          const workplaceType =
            stated === "remote" || stated === "hybrid"
              ? stated
              : stated
              ? null
              : telecommute
              ? "remote"
              : looksHybrid(raw.title || "", raw.description || "")
              ? "hybrid"
              : null;
          if (!workplaceType) continue;
          jobs.push({
            externalId: raw.shortcode,
            board,
            sourceUrl: raw.url || `https://apply.workable.com/j/${raw.shortcode}`,
            applicationUrl: raw.application_url || raw.url,
            title: raw.title || "",
            companyName: widget.name || board,
            descriptionHtml: raw.description || "",
            location: [raw.city, raw.state, raw.country].filter(Boolean).join(", "),
            places: (raw.locations || []).map((place) =>
              [place.city, place.region, place.countryCode].filter(Boolean).join(", ")
            ),
            workplaceType,
            employmentType: raw.employment_type,
            seniority: raw.experience,
            categories: [raw.department || "", raw.function || ""],
            industry: raw.industry,
            postedAt: raw.published_on || raw.created_at,
          });
        }
        return { jobs, complete: workplaces !== null };
      },
    }),
};
