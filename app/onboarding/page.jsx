"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Check,
  FileUp,
  Loader2,
  PenLine,
  Sparkles,
  UploadCloud,
  UserRoundPen,
} from "lucide-react";
import { toast } from "react-toastify";
import { track } from "@vercel/analytics";
import { Logo } from "@/components/navbar/logo";
import {
  BaseResumeWizard,
  WIZARD_SECTION_COUNTS,
} from "@/components/onboarding/base-resume-wizard";
import {
  GoalPicker,
  destinationForGoals,
  parseStoredGoals,
} from "@/components/onboarding/goal-picker";
import { startProductTour } from "@/components/onboarding/product-tour";
import {
  emptyBaseResumeDraft,
  extractedToDraft,
} from "@/components/dashboard/resume-form";
import { authedFetch } from "@/lib/authed-fetch";
import { countBaseResumes } from "@/lib/base-resume";

export default function OnboardingPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  // "goals" | "choose" | "wizard"
  const [stage, setStage] = useState("goals");
  const [goals, setGoals] = useState([]);
  const [savingGoals, setSavingGoals] = useState(false);
  const [mode, setMode] = useState("upload");
  const [draft, setDraft] = useState(null);
  const [parsing, setParsing] = useState(false);
  // A file is being dragged over the upload area.
  const [dragging, setDragging] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const ensureSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      setUser(session.user);
      // Someone coming back through the welcome email has answered already.
      setGoals(parseStoredGoals(session.user.user_metadata?.onboarding_goals));
      setLoading(false);
    };
    ensureSession();
  }, [router]);

  // Where onboarding goes depends on what the user came for: the base resume
  // only for goals that run on a scan, otherwise straight into the app.
  const handleGoals = async (chosen) => {
    const destination = destinationForGoals(chosen);
    setGoals(chosen);
    setSavingGoals(true);
    track("onboarding_goals_selected", { goals: chosen.join(","), destination });
    // Remembered on the account for later screens. Not worth blocking anyone
    // over: a failed save still lets them carry on.
    try {
      const { error } = await supabase.auth.updateUser({
        data: { onboarding_goals: chosen, onboarding_goals_at: new Date().toISOString() },
      });
      if (error) throw error;
    } catch (error) {
      console.warn("Failed to save onboarding goals.", error);
    }

    if (destination === "base-resume") {
      // The welcome email links back here, so a returning user may already
      // have one; building another would only duplicate it.
      const existing = await countBaseResumes(user.id).catch(() => 0);
      if (existing > 0) {
        router.push("/scan");
        return;
      }
      setSavingGoals(false);
      setStage("choose");
      window.scrollTo({ top: 0 });
      return;
    }
    router.push(destination === "remote-jobs" ? "/scan?section=remote-jobs" : "/scan");
  };

  const startManual = () => {
    const empty = emptyBaseResumeDraft();
    if (user?.email) empty.email = user.email;
    setDraft(empty);
    setMode("manual");
    setStage("wizard");
  };

  const parseResume = async (file) => {
    // The file picker filters by type; a dropped file arrives unchecked.
    if (!/\.(pdf|docx?)$/i.test(file.name)) {
      toast.error("Please use a PDF, DOC, or DOCX file.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    formData.append("extractBaseResume", "true");
    setParsing(true);
    try {
      const response = await authedFetch("/api/scan", { method: "POST", body: formData });
      const data = await response.json();
      if (!data.success || !data.baseResume) {
        toast.error(data.message || "We couldn't read that resume. Try another file.");
        return;
      }
      const extracted = extractedToDraft(data.baseResume);
      if (!extracted.email && user?.email) extracted.email = user.email;
      setDraft(extracted);
      setMode("upload");
      setStage("wizard");
    } catch (error) {
      console.error(error);
      toast.error("We couldn't read that resume. Try another file.");
    } finally {
      setParsing(false);
    }
  };

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) parseResume(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file && !parsing) parseResume(file);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    );
  }

  if (stage === "goals") {
    return (
      <main className="min-h-screen bg-slate-50 px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))] sm:pt-12">
        <div className="mx-auto max-w-3xl">
          <div className="flex justify-center">
            <Logo />
          </div>
          <div className="mb-8 mt-6 text-center sm:mb-10">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              What brings you to SynCV?
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 sm:text-base">
              Choose all that apply, and we&apos;ll start you in the right place.
            </p>
          </div>
          <GoalPicker
            initialGoals={goals}
            busy={savingGoals}
            onContinue={handleGoals}
          />
        </div>
      </main>
    );
  }

  if (stage === "wizard" && draft) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-semibold text-slate-900">
              {mode === "upload" ? "Verify your details" : "Build your base resume"}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {mode === "upload"
                ? "We extracted everything from your resume. Review each section, edit anything that's off, then save."
                : "Fill in each section. This becomes the base resume every scan is tailored from."}
            </p>
          </div>
          <BaseResumeWizard
            user={user}
            initialDraft={draft}
            mode={mode}
            onComplete={() => {
              // Saving the first base resume is the one moment we know someone
              // is brand new — arm the dashboard tour before handing over.
              // They land on Scan: the resume they just built is only worth
              // anything once it has been run against a job description.
              startProductTour(user?.id);
              router.push("/scan");
            }}
          />
        </div>
      </main>
    );
  }

  // Two ways in, laid out the same way: what it is, what you get, and the
  // action at the foot — so the cards stay level whatever their copy runs to.
  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] sm:pt-10">
      <div className="mx-auto max-w-4xl">
        <Button
          variant="ghost"
          className="-ml-2 rounded-md px-2 text-slate-600"
          onClick={() => setStage("goals")}
          disabled={parsing}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="mb-8 mt-4 text-center sm:mb-10">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Set up your base resume
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600 sm:text-base">
            It&apos;s the master copy every scan tailors to a job. You only set it up once.
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          <section className="flex flex-col rounded-3xl border-2 border-slate-900 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <FileUp className="h-5 w-5" />
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                <Sparkles className="h-3.5 w-3.5" /> Recommended
              </span>
            </div>
            <h2 className="mt-5 text-xl font-semibold text-slate-900">Upload your resume</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              We&apos;ll read it and fill in your base resume for you. You just check it over.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-slate-700">
              {[
                "Contact details, experience, skills, education and projects filled in",
                "Review and edit every section before it's saved",
              ].map((point) => (
                <li key={point} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.5} />
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-6">
              <label
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!parsing) setDragging(true);
                }}
                onDragLeave={(event) => {
                  // Leaving for one of its own children isn't leaving.
                  if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false);
                }}
                onDrop={handleDrop}
                className={
                  "flex min-h-[9.5rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-6 text-center transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-slate-900/30 " +
                  (dragging
                    ? "border-slate-900 bg-slate-100"
                    : "border-slate-200 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50") +
                  (parsing ? " pointer-events-none" : "")
                }
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm">
                  {parsing ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <UploadCloud className="h-5 w-5" />
                  )}
                </span>
                <span className="text-sm font-medium text-slate-800" aria-live="polite">
                  {parsing ? (
                    "Reading your resume…"
                  ) : dragging ? (
                    "Drop it here"
                  ) : (
                    // Phones can't drag a file in, so they get the plain verb.
                    <>
                      <span className="sm:hidden">Choose your resume file</span>
                      <span className="hidden sm:inline">
                        Drop your resume here or{" "}
                        <span className="underline underline-offset-2">browse</span>
                      </span>
                    </>
                  )}
                </span>
                <span className="text-xs text-slate-500">PDF, DOC, or DOCX</span>
                <input
                  type="file"
                  className="sr-only"
                  accept=".pdf,.doc,.docx"
                  onChange={handleUpload}
                  disabled={parsing}
                />
              </label>
            </div>
          </section>

          <section className="flex flex-col rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <UserRoundPen className="h-5 w-5" />
              </span>
            </div>
            <h2 className="mt-5 text-xl font-semibold text-slate-900">Build it step by step</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              No resume to hand? We&apos;ll guide you through it, one section at a time.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-slate-700">
              {[
                "Help writing your professional summary",
                "Skip experience, projects and extras if they don't apply yet",
              ].map((point) => (
                <li key={point} className="flex gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.5} />
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-auto pt-6">
              <button
                type="button"
                onClick={startManual}
                disabled={parsing}
                className="flex min-h-[9.5rem] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-slate-50/60 px-6 py-6 text-center transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30 disabled:pointer-events-none disabled:opacity-60"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm">
                  <PenLine className="h-5 w-5" />
                </span>
                <span className="text-sm font-medium text-slate-800">Start from scratch</span>
                <span className="text-xs text-slate-500">
                  {WIZARD_SECTION_COUNTS.required} sections to fill in,{" "}
                  {WIZARD_SECTION_COUNTS.optional} you can skip
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
