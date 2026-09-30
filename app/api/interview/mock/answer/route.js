import { NextResponse } from "next/server";
import {
  authorizeInterviewRequest,
  mergeAnswers,
  normalizeAnswer,
} from "@/lib/server/interview";

/**
 * Saves one answer as soon as it is given, so an interview that is cut off
 * (a closed tab, a dropped connection) still has everything said up to then.
 * The finish call sends the full list again, so a save lost here is recovered.
 */
export async function POST(req) {
  try {
    const auth = await authorizeInterviewRequest(req);
    if (auth.response) return auth.response;
    const { user, supabase } = auth;

    const body = await req.json().catch(() => ({}));
    const { data: row, error } = await supabase
      .from("mock_interviews")
      .select("id, status, questions, answers")
      .eq("id", String(body?.sessionId || ""))
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) {
      return NextResponse.json({ success: false, message: "Interview not found." }, { status: 404 });
    }
    if (row.status !== "in_progress") {
      return NextResponse.json(
        { success: false, message: "This interview has already finished." },
        { status: 409 }
      );
    }

    const answers = mergeAnswers(row.answers, [normalizeAnswer(body)], row.questions || []);
    const { error: updateError } = await supabase
      .from("mock_interviews")
      .update({ answers })
      .eq("id", row.id)
      .eq("user_id", user.id);
    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Saving a mock interview answer failed:", error);
    return NextResponse.json(
      { success: false, message: "Couldn't save that answer." },
      { status: 500 }
    );
  }
}
