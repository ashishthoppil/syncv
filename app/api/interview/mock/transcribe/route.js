import { NextResponse } from "next/server";
import { authorizeInterviewRequest, transcriptionPrompt } from "@/lib/server/interview";
import {
  countModelCalls,
  HOURLY_MODEL_CALL_LIMITS,
  INTERVIEW_TRANSCRIPTION_MODE,
  transcribeAudio,
  TOO_MANY_MODEL_CALLS_MESSAGE,
} from "@/lib/server/openai";

// A clip is one or two sentences of speech; the page cuts them at pauses and
// never lets one run past half a minute. Anything much bigger isn't ours.
const MAX_CLIP_BYTES = 3 * 1024 * 1024;

const EXTENSIONS = [
  ["webm", "webm"],
  ["mp4", "mp4"],
  ["m4a", "m4a"],
  ["mpeg", "mp3"],
  ["ogg", "ogg"],
  ["wav", "wav"],
];

/**
 * Turns one clip of a spoken answer into text. Only for an interview the
 * caller has in progress, and primed with that interview's own vocabulary
 * (the job's keywords), which is what gets the jargon right. The audio is
 * passed straight through to the transcriber and never stored. The page falls
 * back to the browser's recognizer, or to typing, whenever this fails.
 */
export async function POST(req) {
  try {
    if (INTERVIEW_TRANSCRIPTION_MODE !== "openai") {
      return NextResponse.json(
        { success: false, message: "Answers are transcribed in the browser." },
        { status: 404 }
      );
    }

    const auth = await authorizeInterviewRequest(req);
    if (auth.response) return auth.response;
    const { user, supabase } = auth;

    const form = await req.formData();
    const audio = form.get("audio");
    if (!audio || typeof audio === "string" || !audio.size) {
      return NextResponse.json({ success: false, message: "No audio to transcribe." }, { status: 400 });
    }
    if (audio.size > MAX_CLIP_BYTES) {
      return NextResponse.json({ success: false, message: "That clip is too long." }, { status: 413 });
    }

    const { data: row, error } = await supabase
      .from("mock_interviews")
      .select("status, script")
      .eq("id", String(form.get("sessionId") || ""))
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!row || row.status !== "in_progress") {
      return NextResponse.json({ success: false, message: "Interview not found." }, { status: 404 });
    }

    const recentCalls = await countModelCalls(
      supabase,
      user.id,
      ["mock_interview_transcription"],
      60
    );
    if (recentCalls >= HOURLY_MODEL_CALL_LIMITS.mockInterviewTranscription) {
      return NextResponse.json(
        { success: false, message: TOO_MANY_MODEL_CALLS_MESSAGE },
        { status: 429 }
      );
    }

    const type = String(audio.type || "");
    const extension = EXTENSIONS.find(([marker]) => type.includes(marker))?.[1] || "webm";
    const text = await transcribeAudio({
      file: audio,
      filename: `answer.${extension}`,
      prompt: transcriptionPrompt(row.script, form.get("previous")),
      userId: user.id,
      purpose: "mock_interview_transcription",
    });

    return NextResponse.json({ success: true, text });
  } catch (error) {
    console.error("Transcribing a mock interview answer failed:", error);
    return NextResponse.json(
      { success: false, message: "Couldn't transcribe that." },
      { status: 502 }
    );
  }
}
