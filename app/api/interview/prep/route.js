import { NextResponse } from "next/server";
import {
  authorizeInterviewRequest,
  buildPrepQuestionsPrompt,
  buildPrepStudyPrompt,
  getCandidateContext,
  getInterviewAllowance,
  hasKeywordData,
  interviewSetupMissing,
  interviewUpgradeRequired,
  isMissingSchemaError,
  jobKeywords,
  keywordDataMissing,
  loadOwnedJob,
  normalizePrep,
  parseModelJson,
  PREP_SYSTEM,
  TRIAL_PREP_USED_MESSAGE,
  trialInterviewPrepsUsed,
} from "@/lib/server/interview";
import { FREE_TRIAL_INTERVIEW_PREPS } from "@/lib/interview-config";
import {
  chatCompletion,
  countModelCalls,
  HOURLY_MODEL_CALL_LIMITS,
  LARGE_MODEL,
  TOO_MANY_MODEL_CALLS_MESSAGE,
} from "@/lib/server/openai";

const PREP_PURPOSES = ["interview_prep_questions", "interview_prep_study"];

/**
 * Interview prep for one tracked job. Generated the first time it is asked
 * for and stored on the job; every later request is served from the row
 * without touching the model.
 */
export async function POST(req) {
  try {
    const auth = await authorizeInterviewRequest(req);
    if (auth.response) return auth.response;
    const { user, supabase } = auth;

    const body = await req.json().catch(() => ({}));
    const job = await loadOwnedJob(supabase, user.id, String(body?.jobId || ""));
    if (!job) {
      return NextResponse.json({ success: false, message: "Job not found." }, { status: 404 });
    }
    // `select *` leaves the column out entirely when the migration hasn't run.
    // Generating anyway would bill a fresh set on every open with nowhere to
    // keep it, which is exactly what storing it is meant to prevent.
    if (!("interview_prep" in job)) return interviewSetupMissing();

    if (job.interview_prep) {
      return NextResponse.json({
        success: true,
        prep: job.interview_prep,
        generatedAt: job.interview_prep_generated_at,
      });
    }

    if (!hasKeywordData(job)) return keywordDataMissing();

    const allowance = await getInterviewAllowance(supabase, user.id);
    if (!allowance.allowed) return interviewUpgradeRequired();
    // The free trial writes a guide for one job. Reading a guide that exists
    // (above) stays open to everyone: it costs nothing.
    if (
      allowance.trial &&
      (await trialInterviewPrepsUsed(supabase, user.id)) >= FREE_TRIAL_INTERVIEW_PREPS
    ) {
      return interviewUpgradeRequired(TRIAL_PREP_USED_MESSAGE);
    }

    const recentCalls = await countModelCalls(supabase, user.id, PREP_PURPOSES, 60);
    if (recentCalls >= HOURLY_MODEL_CALL_LIMITS.interviewPrep) {
      return NextResponse.json(
        { success: false, message: TOO_MANY_MODEL_CALLS_MESSAGE },
        { status: 429 }
      );
    }

    const candidate = await getCandidateContext(supabase, user.id);
    const keywords = jobKeywords(job);
    const context = { job, candidate, keywords, experienceYears: candidate.experienceYears };

    // Two calls in parallel rather than one long one: the questions with their
    // model answers are most of the output, so splitting them from the study
    // plan roughly halves the wait.
    const [questionsContent, studyContent] = await Promise.all([
      chatCompletion({
        model: LARGE_MODEL,
        system: PREP_SYSTEM,
        prompt: buildPrepQuestionsPrompt(context),
        maxTokens: 7000,
        temperature: 0.4,
        jsonMode: true,
        userId: user.id,
        purpose: "interview_prep_questions",
      }),
      chatCompletion({
        model: LARGE_MODEL,
        system: PREP_SYSTEM,
        prompt: buildPrepStudyPrompt(context),
        maxTokens: 5000,
        temperature: 0.4,
        jsonMode: true,
        userId: user.id,
        purpose: "interview_prep_study",
      }),
    ]);

    const prep = normalizePrep({
      questionsOut: parseModelJson(questionsContent),
      studyOut: parseModelJson(studyContent),
      keywords,
      experienceYears: candidate.experienceYears,
    });
    if (prep.questions.length < 5 || !prep.studyGuide.length) {
      throw new Error("The prep material came back incomplete. Please try again.");
    }

    // Only fills an empty slot: if the same job was opened twice at once, the
    // first set saved is the one both get, and it never changes after that.
    const generatedAt = new Date().toISOString();
    const { data: saved, error: saveError } = await supabase
      .from("job_tracker")
      .update({ interview_prep: prep, interview_prep_generated_at: generatedAt })
      .eq("id", job.id)
      .eq("user_id", user.id)
      .is("interview_prep", null)
      .select("interview_prep, interview_prep_generated_at")
      .maybeSingle();
    if (saveError) {
      if (isMissingSchemaError(saveError)) return interviewSetupMissing();
      throw saveError;
    }
    if (!saved) {
      const current = await loadOwnedJob(
        supabase,
        user.id,
        job.id,
        "interview_prep, interview_prep_generated_at"
      );
      if (current?.interview_prep) {
        return NextResponse.json({
          success: true,
          prep: current.interview_prep,
          generatedAt: current.interview_prep_generated_at,
        });
      }
    }

    return NextResponse.json({ success: true, prep, generatedAt });
  } catch (error) {
    console.error("Interview prep failed:", error);
    return NextResponse.json(
      { success: false, message: "Couldn't prepare your interview material. Please try again." },
      { status: 500 }
    );
  }
}
