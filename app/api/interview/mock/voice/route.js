import { NextResponse } from "next/server";
import { authorizeInterviewRequest, scriptLine } from "@/lib/server/interview";
import {
  countModelCalls,
  HOURLY_MODEL_CALL_LIMITS,
  INTERVIEW_VOICE_MODE,
  textToSpeech,
  TOO_MANY_MODEL_CALLS_MESSAGE,
} from "@/lib/server/openai";

/**
 * The interviewer's voice for one line of an interview's script, as MP3.
 * Takes a line key, never text: it can only speak what was written into the
 * caller's own interview when it started, so it can't be used as a general
 * text-to-speech endpoint. The page falls back to the device's own voice
 * whenever this fails.
 */
export async function POST(req) {
  try {
    if (INTERVIEW_VOICE_MODE !== "openai") {
      return NextResponse.json(
        { success: false, message: "The interviewer's voice is set to the browser." },
        { status: 404 }
      );
    }

    const auth = await authorizeInterviewRequest(req);
    if (auth.response) return auth.response;
    const { user, supabase } = auth;

    const body = await req.json().catch(() => ({}));
    const { data: row, error } = await supabase
      .from("mock_interviews")
      .select("script")
      .eq("id", String(body?.sessionId || ""))
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    const text = scriptLine(row?.script, String(body?.key || ""));
    if (!text) {
      return NextResponse.json({ success: false, message: "Nothing to say." }, { status: 404 });
    }

    const recentCalls = await countModelCalls(supabase, user.id, ["mock_interview_voice"], 60);
    if (recentCalls >= HOURLY_MODEL_CALL_LIMITS.mockInterviewVoice) {
      return NextResponse.json(
        { success: false, message: TOO_MANY_MODEL_CALLS_MESSAGE },
        { status: 429 }
      );
    }

    const audio = await textToSpeech({ text, userId: user.id, purpose: "mock_interview_voice" });
    return new NextResponse(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Mock interview voice failed:", error);
    return NextResponse.json(
      { success: false, message: "The interviewer's voice isn't available." },
      { status: 502 }
    );
  }
}
