"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Loader2, FileUp, UserRoundPen, Sparkles, UploadCloud } from "lucide-react";
import { toast } from "react-toastify";
import { BaseResumeWizard } from "@/components/onboarding/base-resume-wizard";
import {
  emptyBaseResumeDraft,
  extractedToDraft,
} from "@/components/dashboard/resume-form";

export default function OnboardingPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  // "choose" | "wizard"
  const [stage, setStage] = useState("choose");
  const [mode, setMode] = useState("upload");
  const [draft, setDraft] = useState(null);
  const [parsing, setParsing] = useState(false);
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
      setLoading(false);
    };
    ensureSession();
  }, [router]);

  const startManual = () => {
    const empty = emptyBaseResumeDraft();
    if (user?.email) empty.email = user.email;
    setDraft(empty);
    setMode("manual");
    setStage("wizard");
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("extractBaseResume", "true");
    setParsing(true);
    try {
      const response = await fetch("/api/scan", { method: "POST", body: formData });
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
      event.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
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
            onComplete={() => router.push("/scan?section=base-resume")}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold text-slate-900">
            Set up your base resume
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            This is the master resume we tailor to every job you scan. Start from an existing
            resume, or build it from scratch.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Recommended: upload */}
          <section className="relative rounded-3xl border-2 border-slate-900 bg-white p-6 shadow-sm">
            <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
              <Sparkles className="h-3.5 w-3.5" /> Recommended
            </span>
            <div className="mb-4 inline-flex rounded-2xl bg-slate-100 p-3 text-slate-700">
              <FileUp className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">Upload your resume</h2>
            <p className="mt-2 text-sm text-slate-600">
              We&apos;ll extract your name, contact info, links, summary, experience, skills,
              education, and projects — then let you verify each one.
            </p>
            <label
              className={
                "mt-6 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-6 py-7 text-center transition hover:border-slate-300 hover:bg-slate-50" +
                (parsing ? " pointer-events-none opacity-60" : "")
              }
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
                {parsing ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <UploadCloud className="h-5 w-5" />
                )}
              </span>
              <span className="text-sm font-medium text-slate-700">
                {parsing ? "Reading your resume…" : "Click to upload your resume"}
              </span>
              <span className="text-xs text-slate-400">PDF, DOC, or DOCX</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx"
                onChange={handleUpload}
                disabled={parsing}
              />
            </label>
          </section>

          {/* Manual */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 inline-flex rounded-2xl bg-slate-100 p-3 text-slate-700">
              <UserRoundPen className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900">Fill it in manually</h2>
            <p className="mt-2 text-sm text-slate-600">
              No resume yet? Enter your details step by step. Work experience and projects are
              optional.
            </p>
            <Button
              variant="outline"
              className="mt-6 w-full rounded-full"
              onClick={startManual}
            >
              Start from scratch
            </Button>
          </section>
        </div>
      </div>
    </main>
  );
}
