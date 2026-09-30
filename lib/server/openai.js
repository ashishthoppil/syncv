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
  // Prep is generated once per job, so this only bites someone opening prep
  // for many different jobs in a row. Each generation is two calls.
  interviewPrep: 30,
  // A mock interview is one call for its questions and one to score it. The
  // voice is about fifteen lines per interview, less whatever the page already
  // has cached for a replayed question.
  mockInterviewQuestions: 8,
  mockInterviewEvaluation: 12,
  mockInterviewVoice: 200,
  // Answers are transcribed a sentence or two at a time, roughly a hundred
  // short clips across a full interview.
  mockInterviewTranscription: 600,
};

// The mock interviewer's voice. gpt-4o-mini-tts reads plain text naturally and
// takes a direction for delivery; the voice and model can be changed from the
// environment. MOCK_INTERVIEW_VOICE=browser skips this entirely and has the
// page speak with the device's own voices instead, at no cost.
export const TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
export const TTS_VOICE = process.env.OPENAI_TTS_VOICE || "coral";
export const INTERVIEW_VOICE_MODE =
  String(process.env.MOCK_INTERVIEW_VOICE || "openai").toLowerCase() === "browser"
    ? "browser"
    : "openai";
// How the candidate's spoken answers become text. The browser's own speech
// recognition is free but can't be given a vocabulary, and mishears the very
// words an interview turns on ("frontend-heavy full stack" came out as "front
// and heavy full strike"). gpt-4o-mini-transcribe takes the job's keywords as
// context and gets them right, at about $0.003 per minute of speech.
// MOCK_INTERVIEW_TRANSCRIPTION=browser goes back to the free recognizer.
export const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
export const INTERVIEW_TRANSCRIPTION_MODE =
  String(process.env.MOCK_INTERVIEW_TRANSCRIPTION || "openai").toLowerCase() === "browser"
    ? "browser"
    : "openai";

const TTS_DIRECTION =
  "You are a warm, professional job interviewer on a video call. Speak clearly and at a calm, measured pace, slightly slower than casual conversation, with natural pauses between sentences. Enunciate every word. Sound encouraging but neutral: never sarcastic, never overly excited.";

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
 * Speaks `text` and returns it as MP3 bytes, logged to `llm_usage` like any
 * other call. Asked for as server-sent events because that is the only form
 * of the speech endpoint that reports usage (text tokens in, audio tokens
 * out); a plain audio body is still accepted, for models that can't stream
 * events (tts-1), and is logged without token counts.
 */
export async function textToSpeech({ text, userId, purpose }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const canStreamEvents = !/^tts-1/.test(TTS_MODEL);
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: text,
      response_format: "mp3",
      ...(canStreamEvents ? { instructions: TTS_DIRECTION, stream_format: "sse" } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI speech request failed: ${response.status} ${errorText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream")) {
    const audio = Buffer.from(await response.arrayBuffer());
    recordUsage({ userId, purpose, model: TTS_MODEL, usage: null });
    return audio;
  }

  const chunks = [];
  let usage = null;
  const events = (await response.text()).split("\n");
  for (const line of events) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") continue;
    let event;
    try {
      event = JSON.parse(data);
    } catch {
      continue;
    }
    if (event?.type === "speech.audio.delta" && event.audio) {
      chunks.push(Buffer.from(event.audio, "base64"));
    } else if (event?.type === "speech.audio.done") {
      usage = event.usage || null;
    }
  }

  const audio = Buffer.concat(chunks);
  if (!audio.length) {
    throw new Error("OpenAI speech request returned no audio.");
  }
  recordUsage({
    userId,
    purpose,
    model: TTS_MODEL,
    usage: usage
      ? { prompt_tokens: usage.input_tokens, completion_tokens: usage.output_tokens }
      : null,
  });
  return audio;
}

/**
 * Transcribes a short audio clip of English speech, logged to `llm_usage`
 * like any other call. `prompt` is context for the model (the role, the terms
 * likely to come up), which is what keeps names and jargon spelled right.
 * `file` is a Blob or File; `filename` must carry the right extension, since
 * the API picks the decoder from it.
 */
export async function transcribeAudio({ file, filename, prompt, userId, purpose }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const form = new FormData();
  form.append("file", file, filename);
  form.append("model", TRANSCRIBE_MODEL);
  form.append("language", "en");
  form.append("response_format", "json");
  if (prompt) form.append("prompt", prompt);

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI transcription request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  // Token usage for the gpt-4o transcription models; whisper-1 reports only a
  // duration, which is logged as no tokens.
  recordUsage({
    userId,
    purpose,
    model: TRANSCRIBE_MODEL,
    usage: {
      prompt_tokens: payload?.usage?.input_tokens,
      completion_tokens: payload?.usage?.output_tokens,
    },
  });

  return String(payload?.text || "").trim();
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
