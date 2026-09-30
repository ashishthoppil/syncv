import { NextResponse } from "next/server";
import {
  answersToScore,
  authorizeInterviewRequest,
  buildEvaluation,
  buildEvaluationPrompt,
  getCandidateContext,
  jobKeywords,
  loadOwnedJob,
  mergeAnswers,
  MOCK_SYSTEM,
  normalizeAnswer,
  parseModelJson,
  sessionForClient,
} from "@/lib/server/interview";
import {
  chatCompletion,
  countModelCalls,
  HOURLY_MODEL_CALL_LIMITS,
  LARGE_MODEL,
  TOO_MANY_MODEL_CALLS_MESSAGE,
} from "@/lib/server/openai";

/**
 * Ends a mock interview and scores it. Safe to call twice: an interview that
 * is already scored returns its stored report without another model call.
 */
export async function POST(req) {
  try {
    const auth = await authorizeInterviewRequest(req);
    if (auth.response) return auth.response;
    const { user, supabase } = auth;

    const body = await req.json().catch(() => ({}));
    const { data: row, error } = await supabase
      .from("mock_interviews")
      .select("*")
      .eq("id", String(body?.sessionId || ""))
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) {
      return NextResponse.json({ success: false, message: "Interview not found." }, { status: 404 });
    }
    if (row.status === "completed") {
      return NextResponse.json({ success: true, session: sessionForClient(row) });
    }

    const questions = Array.isArray(row.questions) ? row.questions : [];
    const incoming = (Array.isArray(body?.answers) ? body.answers : []).map(normalizeAnswer);
    const answers = mergeAnswers(row.answers, incoming, questions);
    if (!answers.length) {
      return NextResponse.json(
        { success: false, message: "Answer at least one question to get feedback." },
        { status: 400 }
      );
    }

    const scorable = answersToScore(answers);
    let raw = null;
    if (scorable.length) {
      const recentCalls = await countModelCalls(
        supabase,
        user.id,
        ["mock_interview_evaluation"],
        60
      );
      if (recentCalls >= HOURLY_MODEL_CALL_LIMITS.mockInterviewEvaluation) {
        return NextResponse.json(
          { success: false, message: TOO_MANY_MODEL_CALLS_MESSAGE },
          { status: 429 }
        );
      }

      const [job, candidate] = await Promise.all([
        loadOwnedJob(
          supabase,
          user.id,
          row.job_id,
          "organization, designation, keyword_universe, matched_keywords, missing_keywords"
        ),
        getCandidateContext(supabase, user.id),
      ]);
      raw = parseModelJson(
        await chatCompletion({
          model: LARGE_MODEL,
          system: MOCK_SYSTEM,
          prompt: buildEvaluationPrompt({
            questions,
            answers: scorable,
            job: job || {},
            candidate,
            keywords: jobKeywords(job),
            experienceYears: row.experience_years ?? null,
          }),
          maxTokens: 6000,
          temperature: 0.2,
          jsonMode: true,
          userId: user.id,
          purpose: "mock_interview_evaluation",
        })
      );
    }

    const evaluation = buildEvaluation({ questions, answers, raw });
    if (!raw) {
      evaluation.summary =
        "You skipped every question you reached, so there was nothing to score this time. Try again and give each question an answer, even a short one: how you think it through counts.";
    }

    const { data: updated, error: updateError } = await supabase
      .from("mock_interviews")
      .update({
        status: "completed",
        answers,
        evaluation,
        overall_score: evaluation.overallScore,
        completed_at: new Date().toISOString(),
      })
      .eq("id", row.id)
      .eq("user_id", user.id)
      .select("*")
      .single();
    if (updateError) throw updateError;

    return NextResponse.json({ success: true, session: sessionForClient(updated) });
  } catch (error) {
    console.error("Scoring a mock interview failed:", error);
    return NextResponse.json(
      { success: false, message: "Couldn't score your interview. Please try again." },
      { status: 500 }
    );
  }
}
