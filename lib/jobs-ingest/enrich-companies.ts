import type { SupabaseClient } from "@supabase/supabase-js";
import { chatCompletion, SMALL_MODEL } from "@/lib/server/openai";
import { COMPANY_SIZES, INDUSTRIES, INDUSTRY_VALUES } from "@/lib/remote-jobs/types";
import { hasTimeLeft, pooled } from "./http";

/**
 * Startup status, company size and industry — the three filters no job API
 * reliably provides. They're looked up once per *company* (shared by all its
 * jobs, and kept after the jobs expire), in batches, by the small model.
 *
 * The model is told to answer null whenever it isn't confident, and a null
 * leaves the company out of that filter rather than guessing. Small or
 * obscure employers will mostly come back unknown; that is the honest answer.
 * Cost: ~30 companies per call at a few thousand tokens — fractions of a cent
 * per batch, logged in llm_usage under "job_company_enrichment".
 */

const BATCH_SIZE = 30;
const CONCURRENCY = 6;
const MAX_ATTEMPTS = 3;

const SIZE_VALUES: string[] = COMPANY_SIZES.map((size) => size.value);

const SYSTEM = `You classify employers for a job search filter. For each company, using only what you reliably know about it, return:
- is_startup: true for a young, independent, typically venture-backed or founder-led growth company (roughly under 12 years old and not public); false for public companies, large or long-established firms, government, agencies, consultancies and staffing firms; null if unsure.
- size: employee count band, one of ${SIZE_VALUES.map((value) => `"${value}"`).join(", ")}, or null if unsure.
- industry: one of ${INDUSTRIES.map((industry) => `"${industry.value}" (${industry.label})`).join(", ")}, or null if unsure.
Many names are ambiguous or unknown to you — answer null for those rather than guessing. Reply with JSON only: {"companies":[{"key":"...","is_startup":...,"size":...,"industry":...}]}, one entry per input, in the same order.`;

type PendingCompany = { key: string; name: string; website: string | null; enrichment_attempts: number };

type Classification = {
  key?: string;
  is_startup?: boolean | null;
  size?: string | null;
  industry?: string | null;
};

const classify = async (batch: PendingCompany[]) => {
  const prompt = JSON.stringify(
    batch.map((company) => ({
      key: company.key,
      name: company.name,
      ...(company.website ? { website: company.website } : {}),
    }))
  );
  const reply = await chatCompletion({
    model: SMALL_MODEL,
    system: SYSTEM,
    prompt,
    maxTokens: 60 * batch.length + 200,
    jsonMode: true,
    // A system job, not a user's call — logged with no user.
    userId: null,
    purpose: "job_company_enrichment",
  });
  const parsed = JSON.parse(reply) as { companies?: Classification[] };
  return new Map((parsed.companies || []).map((entry) => [entry.key || "", entry]));
};

/**
 * Classifies pending companies, newest first, until `deadline`. A batch that
 * fails is retried on later runs, up to MAX_ATTEMPTS, then marked failed so a
 * persistently bad name can't hold the queue.
 */
export const enrichPendingCompanies = async (supabase: SupabaseClient, deadline: number) => {
  if (!process.env.OPENAI_API_KEY) return 0;

  const { data, error } = await supabase
    .from("job_companies")
    .select("key, name, website, enrichment_attempts")
    .eq("enrichment_status", "pending")
    // Newest first: those are the companies with jobs still listed. An older
    // backlog only matters if the company posts again.
    .order("created_at", { ascending: false })
    .limit(BATCH_SIZE * CONCURRENCY * 4);
  if (error) throw new Error(`Reading pending companies failed: ${error.message}`);
  const pending = (data || []) as PendingCompany[];

  const batches: PendingCompany[][] = [];
  for (let index = 0; index < pending.length; index += BATCH_SIZE) {
    batches.push(pending.slice(index, index + BATCH_SIZE));
  }

  let enriched = 0;
  await pooled(batches, CONCURRENCY, async (batch) => {
    // Leave time for the write and the report.
    if (!hasTimeLeft(deadline, 8_000)) return;
    let results: Map<string, Classification> | null = null;
    try {
      results = await classify(batch);
    } catch (classifyError) {
      console.error("Job ingest: company classification failed", classifyError);
    }
    const now = new Date().toISOString();
    const updates = batch.map((company) => {
      const result = results?.get(company.key);
      if (!result) {
        const attempts = company.enrichment_attempts + 1;
        return {
          key: company.key,
          name: company.name,
          enrichment_attempts: attempts,
          enrichment_status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        };
      }
      return {
        key: company.key,
        name: company.name,
        is_startup: typeof result.is_startup === "boolean" ? result.is_startup : null,
        size_band: result.size && SIZE_VALUES.includes(result.size) ? result.size : null,
        industry: result.industry && INDUSTRY_VALUES.includes(result.industry) ? result.industry : null,
        enrichment_status: "done",
        enrichment_attempts: company.enrichment_attempts + 1,
        enriched_at: now,
      };
    });
    // Two groups so PostgREST never NULLs a column one row omits.
    const done = updates.filter((row) => row.enrichment_status === "done");
    const retry = updates.filter((row) => row.enrichment_status !== "done");
    for (const group of [done, retry]) {
      if (!group.length) continue;
      const { error: writeError } = await supabase.from("job_companies").upsert(group, { onConflict: "key" });
      if (writeError) console.error("Job ingest: saving company details failed", writeError.message);
    }
    enriched += done.length;
  });
  return enriched;
};
