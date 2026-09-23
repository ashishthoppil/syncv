import { after } from "next/server";
import { getSupabaseAdminClient } from "./subscriptions";

// Two tiers. Pulling structure out of text — job-description keywords, contact
// fields, the dashboard editor's one-line helpers — runs on the small model.
// Anything the candidate keeps as their own writing (the tailored resume, the
// cover letter, the verbatim base-resume extraction) runs on the large one.
// Both currently default to gpt-6-luna; they stay separate so the writing can
// move to a stronger model on its own. Either can be swapped, or rolled back
// (OPENAI_LARGE_MODEL=gpt-4o, OPENAI_SMALL_MODEL=gpt-4o-mini), from the
// environment without a code change.
export const SMALL_MODEL = process.env.OPENAI_SMALL_MODEL || "gpt-6-luna";
export const LARGE_MODEL = process.env.OPENAI_LARGE_MODEL || "gpt-6-luna";

// GPT-5 onward can reason before answering. Nothing here needs it — the hidden
// reasoning is billed as output and slows every call — so it is switched off,
// which is also the only setting under which these models accept
// `temperature`. Set OPENAI_REASONING_EFFORT for a model that has no "none"
// (the original gpt-5 models, GPT-6 Astra).
const REASONING_EFFORT = process.env.OPENAI_REASONING_EFFORT || "none";
const isReasoningModel = (model = "") => /^gpt-(?:[5-9]|\d{2,})/.test(model);

/**
 * Per-user ceilings on the model calls no plan meters: optimizing, reading an
 * uploaded resume, and the editor helpers. Set well above anything a person
 * does by hand — they exist to stop a script looping on a route, not to ration
 * real use. Counted from `llm_usage`, one row per model call.
 */
export const HOURLY_MODEL_CALL_LIMITS = {
  tailor: 20,
  resumeExtraction: 20,
  cvAssist: 120,
};

/**
 * Records one call's token usage. Runs after the response has been sent, so
 * logging never adds to what the user waits for, and a failed insert is only
 * reported: losing a usage row must never fail the request that produced it.
 */
const recordUsage = ({ userId, purpose, model, usage }) => {
  const row = {
    user_id: userId || null,
    purpose,
    model,
    prompt_tokens: Number(usage?.prompt_tokens) || 0,
    cached_tokens: Number(usage?.prompt_tokens_details?.cached_tokens) || 0,
    completion_tokens: Number(usage?.completion_tokens) || 0,
  };

  after(async () => {
    try {
      const { error } = await getSupabaseAdminClient().from("llm_usage").insert(row);
      if (error) console.error("Failed to record LLM usage:", error.message);
    } catch (error) {
      console.error("Failed to record LLM usage:", error);
    }
  });
};

/**
 * One OpenAI chat completion, logged to `llm_usage` against `userId` and
 * `purpose`. Returns the message content, or "" when the model sent none —
 * callers keep their own empty/parse checks, since what counts as a usable
 * answer differs per route.
 */
export async function chatCompletion({
  model,
  system,
  prompt,
  maxTokens,
  temperature = 0,
  jsonMode = false,
  userId,
  purpose,
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      ...(isReasoningModel(model) ? { reasoning_effort: REASONING_EFFORT } : {}),
      ...(!isReasoningModel(model) || REASONING_EFFORT === "none" ? { temperature } : {}),
      // Every current model takes max_completion_tokens; the newer ones reject
      // the older max_tokens outright.
      ...(maxTokens ? { max_completion_tokens: maxTokens } : {}),
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  recordUsage({ userId, purpose, model: payload?.model || model, usage: payload?.usage });

  return String(payload?.choices?.[0]?.message?.content || "");
}

/**
 * How many model calls with one of `purposes` this user has made, within the
 * last `windowMinutes` or ever when it is omitted. Fails open (0) when the log
 * can't be read — say, before the migration adding `llm_usage` has been run —
 * because a missing log must not lock everyone out.
 */
export const countModelCalls = async (supabase, userId, purposes, windowMinutes) => {
  let query = supabase
    .from("llm_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("purpose", purposes);
  if (windowMinutes) {
    query = query.gte("created_at", new Date(Date.now() - windowMinutes * 60_000).toISOString());
  }

  const { count, error } = await query;
  if (error) {
    console.error("Could not read llm_usage; model call limits are not enforced:", error.message);
    return 0;
  }
  return Number(count || 0);
};

export const TOO_MANY_MODEL_CALLS_MESSAGE =
  "You've made a lot of requests in the last hour. Please wait a little and try again.";
