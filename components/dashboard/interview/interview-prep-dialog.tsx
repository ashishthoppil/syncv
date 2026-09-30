"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { authedFetch } from "@/lib/authed-fetch";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Check,
  ChevronDown,
  CircleAlert,
  Download,
  GraduationCap,
  Lightbulb,
  ListChecks,
  Loader2,
  MessageCircleQuestion,
  RotateCcw,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import type { InterviewJob, InterviewPrep, PrepQuestion } from "./types";

// Prep is generated once per job and stored on it, so within a session it is
// kept here too: reopening the dialog is instant, and a second open while the
// first is still generating waits on that request instead of starting another
// (which would pay for the same material twice).
const prepCache = new Map<string, { prep: InterviewPrep; generatedAt: string }>();
const prepInflight = new Map<string, Promise<{ prep: InterviewPrep; generatedAt: string }>>();

const requestPrep = (jobId: string) => {
  const inflight = prepInflight.get(jobId);
  if (inflight) return inflight;
  const request = authedFetch("/api/interview/prep", {
    method: "POST",
    body: JSON.stringify({ jobId }),
  })
    .then(async (response) => {
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw Object.assign(
          new Error(result?.message || "Couldn't prepare your interview material."),
          { upgrade: result?.code === "upgrade" }
        );
      }
      const entry = { prep: result.prep as InterviewPrep, generatedAt: String(result.generatedAt || "") };
      prepCache.set(jobId, entry);
      return entry;
    })
    .finally(() => prepInflight.delete(jobId));
  prepInflight.set(jobId, request);
  return request;
};

// Checked-off study topics and checklist items: a per-device convenience, so
// localStorage, and every access guarded (private mode, blocked storage).
const readChecks = (key: string) => {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "[]");
    return new Set<string>(Array.isArray(value) ? value.map(String) : []);
  } catch {
    return new Set<string>();
  }
};
const writeChecks = (key: string, value: Set<string>) => {
  try {
    window.localStorage.setItem(key, JSON.stringify([...value]));
  } catch {
    // Not persisted; the ticks still work for this visit.
  }
};

const useChecklist = (key: string) => {
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  useEffect(() => setChecked(readChecks(key)), [key]);
  const toggle = (id: string) =>
    setChecked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeChecks(key, next);
      return next;
    });
  return { checked, toggle };
};

type TabId = "overview" | "questions" | "study" | "gaps" | "final";

const CATEGORY_STYLES: Record<string, string> = {
  "Core skills": "bg-violet-50 text-violet-700 ring-violet-200",
  Scenario: "bg-sky-50 text-sky-700 ring-sky-200",
  Behavioral: "bg-amber-50 text-amber-700 ring-amber-200",
  "Motivation & fit": "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

const GENERATION_STEPS = [
  "Reading the job's keywords",
  "Predicting the questions you'll face",
  "Writing sample answers",
  "Building your study guide",
  "Planning how to close your gaps",
];

/** Model answers mark the candidate's own details as [placeholders]. */
const withPlaceholders = (text: string) =>
  text.split(/(\[[^\]\n]{1,48}\])/g).map((part, index) =>
    /^\[[^\]]+\]$/.test(part) ? (
      <mark
        key={index}
        className="rounded-md bg-brand/10 px-1 py-px font-medium text-brand ring-1 ring-inset ring-brand/15"
      >
        {part.slice(1, -1)}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    )
  );

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** A printable version of the prep, for the PDF route. */
const prepToHtml = (prep: InterviewPrep, job: InterviewJob) => {
  const list = (items: string[]) =>
    items.length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "";
  const h2 = (text: string) =>
    `<h2 style="font-size:15px;margin:22px 0 8px;padding-bottom:4px;border-bottom:1px solid #e2e8f0;color:#6D28D9">${escapeHtml(text)}</h2>`;
  return `<div style="font-size:11.5px;line-height:1.55;color:#0f172a">
    <p style="margin:0;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#6D28D9;font-weight:600">Interview prep</p>
    <h1 style="margin:2px 0 0;font-size:20px">${escapeHtml(job.designation)}</h1>
    <p style="margin:2px 0 0;color:#64748b">${escapeHtml(job.organization)}</p>
    ${h2("What to expect")}<p>${escapeHtml(prep.overview.summary)}</p>${list(prep.overview.focusAreas)}
    ${
      prep.pitch.outline.length
        ? `${h2("Tell me about yourself")}<ol>${prep.pitch.outline.map((beat) => `<li>${escapeHtml(beat)}</li>`).join("")}</ol><p><em>${escapeHtml(prep.pitch.tip)}</em></p>`
        : ""
    }
    ${h2("Likely questions and sample answers")}
    ${prep.questions
      .map(
        (question, index) => `<div style="margin:0 0 12px;page-break-inside:avoid">
          <p style="margin:0;font-weight:600">${index + 1}. ${escapeHtml(question.question)} <span style="font-weight:400;color:#64748b">(${escapeHtml(question.category)})</span></p>
          <p style="margin:2px 0;color:#475569"><em>Why they ask: ${escapeHtml(question.whyTheyAsk)}</em></p>
          <p style="margin:4px 0 0">${escapeHtml(question.answer)}</p>
        </div>`
      )
      .join("")}
    ${h2("Study guide")}
    ${prep.studyGuide
      .map(
        (topic) => `<div style="margin:0 0 10px;page-break-inside:avoid">
          <p style="margin:0;font-weight:600">${escapeHtml(topic.topic)}${topic.priority === "high" ? ' <span style="color:#be123c;font-weight:500">· High priority</span>' : ""}</p>
          <p style="margin:2px 0;color:#475569">${escapeHtml(topic.why)}</p>${list(topic.concepts)}
          ${topic.practice ? `<p style="margin:2px 0"><strong>Practice:</strong> ${escapeHtml(topic.practice)}</p>` : ""}
        </div>`
      )
      .join("")}
    ${
      prep.gaps.length
        ? `${h2("Close the gaps")}${prep.gaps
            .map(
              (gap) =>
                `<p style="margin:0 0 8px"><strong>${escapeHtml(gap.keyword)}</strong>: ${escapeHtml(gap.howToAddress)} <em>Quick prep: ${escapeHtml(gap.quickPrep)}</em></p>`
            )
            .join("")}`
        : ""
    }
    ${
      prep.strengths.length
        ? `${h2("Lean on your strengths")}${prep.strengths
            .map((item) => `<p style="margin:0 0 8px"><strong>${escapeHtml(item.keyword)}</strong>: ${escapeHtml(item.howToShowcase)}</p>`)
            .join("")}`
        : ""
    }
    ${h2("Questions to ask them")}${list(prep.questionsToAsk)}
    ${h2("Checklist")}${list(prep.checklist)}
  </div>`;
};

const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "job";

type InterviewPrepDialogProps = {
  job: InterviewJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Told once prep exists for the job, so the tracker row can show it. */
  onPrepReady?: (jobId: string) => void;
};

export const InterviewPrepDialog = ({ job, open, onOpenChange, onPrepReady }: InterviewPrepDialogProps) => {
  const [entry, setEntry] = useState<{ prep: InterviewPrep; generatedAt: string } | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  // The refusal was the plan's limit (the free trial's one guide), so the way
  // forward is the plans, not trying again.
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("overview");
  const [downloading, setDownloading] = useState(false);
  const jobId = job?.id || "";
  // The job on screen. A load that finishes after the dialog has moved on to
  // another job still fills the cache, but mustn't replace what is shown.
  const shownJobRef = useRef(jobId);
  shownJobRef.current = jobId;

  const load = useCallback(() => {
    if (!jobId) return;
    const cached = prepCache.get(jobId);
    if (cached) {
      setEntry(cached);
      setStatus("ready");
      return;
    }
    setEntry(null);
    setStatus("loading");
    setError("");
    setNeedsUpgrade(false);
    requestPrep(jobId)
      .then((result) => {
        onPrepReady?.(jobId);
        if (shownJobRef.current !== jobId) return;
        setEntry(result);
        setStatus("ready");
      })
      .catch((reason: unknown) => {
        if (shownJobRef.current !== jobId) return;
        setError(reason instanceof Error ? reason.message : "Couldn't prepare your interview material.");
        setNeedsUpgrade(Boolean((reason as { upgrade?: boolean } | null)?.upgrade));
        setStatus("error");
      });
  }, [jobId, onPrepReady]);

  useEffect(() => {
    if (!open || !jobId) return;
    setTab("overview");
    load();
  }, [open, jobId, load]);

  const prep = entry?.prep || null;

  // On phones the tab strip scrolls sideways; keep the active tab in view,
  // including when the overview's tiles switch tabs.
  const activeTabRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeTabRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [tab, prep]);

  const downloadPdf = async () => {
    if (!prep || !job) return;
    setDownloading(true);
    try {
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        body: JSON.stringify({ html: prepToHtml(prep, job), type: "interview-prep" }),
      });
      if (!response.ok) throw new Error("PDF generation failed.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${slug(job.organization)}-${slug(job.designation)}-interview-prep.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (reason) {
      console.error(reason);
      toast.error("Couldn't download the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const tabs: { id: TabId; label: string; count?: number }[] = prep
    ? [
        { id: "overview", label: "Overview" },
        { id: "questions", label: "Questions & answers", count: prep.questions.length },
        { id: "study", label: "Study guide", count: prep.studyGuide.length },
        { id: "gaps", label: "Gaps & strengths", count: prep.gaps.length + prep.strengths.length },
        { id: "final", label: "Final prep" },
      ]
    : [];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-slate-950/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <div className="pointer-events-none fixed inset-0 z-[80] flex items-stretch justify-center sm:items-center sm:p-6">
          <Dialog.Content
            onOpenAutoFocus={(event) => event.preventDefault()}
            className="pointer-events-auto flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 sm:h-[min(92dvh,920px)] sm:max-w-4xl sm:rounded-2xl sm:data-[state=open]:zoom-in-95"
          >
            <header className="shrink-0 border-b border-slate-200 bg-gradient-to-br from-violet-50 via-white to-white pt-safe">
              <div className="flex items-start gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
                <span className="mt-0.5 hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-sm shadow-brand/30 sm:flex">
                  <BookOpen className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">
                    Interview prep
                  </p>
                  <Dialog.Title className="break-anywhere text-lg font-bold leading-tight text-slate-900 sm:text-xl">
                    {job?.designation || "Interview prep"}
                  </Dialog.Title>
                  <Dialog.Description className="break-anywhere mt-0.5 text-sm text-slate-500">
                    {job?.organization}
                    {prep?.basis.keywordCount ? (
                      <span className="hidden sm:inline">
                        {` · built from ${prep.basis.keywordCount} job keywords`}
                      </span>
                    ) : null}
                  </Dialog.Description>
                </div>
                {prep ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadPdf}
                    disabled={downloading}
                    aria-label="Download as PDF"
                    className="h-10 w-10 shrink-0 rounded-full bg-white px-0 sm:h-8 sm:w-auto sm:px-3"
                  >
                    {downloading ? <Loader2 className="animate-spin" /> : <Download />}
                    <span className="hidden sm:inline">PDF</span>
                  </Button>
                ) : null}
                <Dialog.Close
                  aria-label="Close"
                  className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 transition hover:bg-slate-100 active:bg-slate-200 sm:h-8 sm:w-8"
                >
                  <X className="h-5 w-5" />
                </Dialog.Close>
              </div>
              {prep ? (
                <nav
                  aria-label="Prep sections"
                  className="no-scrollbar mt-3 flex gap-1 overflow-x-auto px-3 sm:px-5"
                >
                  {tabs.map((item) => (
                    <button
                      key={item.id}
                      ref={tab === item.id ? activeTabRef : undefined}
                      type="button"
                      onClick={() => setTab(item.id)}
                      aria-current={tab === item.id ? "page" : undefined}
                      className={cn(
                        "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 pb-3 pt-2 text-sm font-medium transition",
                        tab === item.id ? "text-slate-900" : "text-slate-500 hover:text-slate-800"
                      )}
                    >
                      {item.label}
                      {item.count ? (
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-px text-[11px] font-semibold tabular-nums",
                            tab === item.id ? "bg-brand text-white" : "bg-slate-100 text-slate-500"
                          )}
                        >
                          {item.count}
                        </span>
                      ) : null}
                      {tab === item.id ? (
                        <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand" />
                      ) : null}
                    </button>
                  ))}
                </nav>
              ) : (
                <div className="h-4" />
              )}
            </header>

            <div className="touch-scroll min-h-0 flex-1 overflow-y-auto bg-slate-50/70">
              <div className="mx-auto w-full max-w-3xl px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6">
                {status === "loading" ? (
                  <PrepLoading job={job} generating={!job?.has_interview_prep} />
                ) : status === "error" ? (
                  <div className="flex flex-col items-center gap-3 py-16 text-center">
                    {/* Reaching the plan's limit isn't a fault, so it doesn't
                        get the error's red. */}
                    <span
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-full",
                        needsUpgrade ? "bg-violet-50 text-brand" : "bg-rose-50 text-rose-600"
                      )}
                    >
                      {needsUpgrade ? <Sparkles className="h-6 w-6" /> : <CircleAlert className="h-6 w-6" />}
                    </span>
                    <p className="max-w-sm text-sm text-slate-600">{error}</p>
                    {needsUpgrade ? (
                      <Button
                        className="rounded-full"
                        onClick={() => {
                          onOpenChange(false);
                          router.push("/scan?section=settings&scrollTo=dashboard-pricing");
                        }}
                      >
                        View plans
                      </Button>
                    ) : (
                      <Button onClick={load} className="rounded-full">
                        <RotateCcw />
                        Try again
                      </Button>
                    )}
                  </div>
                ) : prep && job ? (
                  <>
                    {tab === "overview" ? <OverviewTab prep={prep} onNavigate={setTab} /> : null}
                    {tab === "questions" ? <QuestionsTab questions={prep.questions} /> : null}
                    {tab === "study" ? <StudyTab prep={prep} jobId={job.id} /> : null}
                    {tab === "gaps" ? <GapsTab prep={prep} /> : null}
                    {tab === "final" ? <FinalTab prep={prep} jobId={job.id} /> : null}
                  </>
                ) : null}
              </div>
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

const PrepLoading = ({ job, generating }: { job: InterviewJob | null; generating: boolean }) => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!generating) return;
    const timer = window.setInterval(
      () => setStep((current) => Math.min(current + 1, GENERATION_STEPS.length - 1)),
      5500
    );
    return () => window.clearInterval(timer);
  }, [generating]);

  if (!generating) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const keywordCount =
    job?.keyword_universe?.length ||
    (job?.matched_keywords?.length || 0) + (job?.missing_keywords?.length || 0);
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-8 text-center sm:py-12">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-brand/15 [animation-duration:2s]" />
        <span className="absolute inset-2 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-brand/30" />
        <Sparkles className="relative h-8 w-8 text-white" />
      </div>
      <h3 className="mt-6 text-lg font-semibold text-slate-900">Preparing your interview material</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
        {`Working from ${keywordCount} keywords in the job description and your experience level.`}
      </p>
      <ol className="mt-7 w-full space-y-2.5 text-left">
        {GENERATION_STEPS.map((label, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <li
              key={label}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition",
                active
                  ? "border-brand/25 bg-white text-slate-900 shadow-sm"
                  : done
                    ? "border-transparent text-slate-500"
                    : "border-transparent text-slate-400"
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  done ? "bg-emerald-500 text-white" : active ? "bg-brand/10 text-brand" : "bg-slate-100"
                )}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                ) : active ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
              </span>
              {label}
            </li>
          );
        })}
      </ol>
      <p className="mt-6 text-xs text-slate-400">
        Takes about half a minute. It&apos;s saved to this job, so next time it opens instantly.
      </p>
    </div>
  );
};

const Card = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => (
  <section className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5", className)}>
    {children}
  </section>
);

const CardTitle = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
  <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600 [&_svg]:h-4 [&_svg]:w-4">
      {icon}
    </span>
    {children}
  </h3>
);

const OverviewTab = ({ prep, onNavigate }: { prep: InterviewPrep; onNavigate: (tab: TabId) => void }) => {
  const stats: { label: string; value: number; tab: TabId }[] = [
    { label: "Questions", value: prep.questions.length, tab: "questions" },
    { label: "Study topics", value: prep.studyGuide.length, tab: "study" },
    { label: "Gaps to close", value: prep.gaps.length, tab: "gaps" },
  ];
  const years = prep.basis.experienceYears;
  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-2xl bg-slate-900 p-5 text-white shadow-sm sm:p-6">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-brand/40 blur-3xl"
        />
        <p className="relative text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-light">
          What to expect
        </p>
        <p className="relative mt-2 text-[15px] leading-relaxed text-slate-100">{prep.overview.summary}</p>
        {prep.overview.focusAreas.length ? (
          <div className="relative mt-4 flex flex-wrap gap-2">
            {prep.overview.focusAreas.map((area) => (
              <span
                key={area}
                className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white ring-1 ring-inset ring-white/15"
              >
                {area}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {stats.map((stat) => (
          <button
            key={stat.label}
            type="button"
            onClick={() => onNavigate(stat.tab)}
            className="group rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-brand/30 hover:shadow active:scale-[0.98] sm:p-4"
          >
            <span className="block text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">{stat.value}</span>
            <span className="mt-0.5 block text-xs leading-tight text-slate-500 group-hover:text-brand">
              {stat.label}
            </span>
          </button>
        ))}
      </div>

      {prep.pitch.outline.length ? (
        <Card>
          <CardTitle icon={<MessageCircleQuestion />}>&ldquo;Tell me about yourself&rdquo;</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Almost every interview opens with it. A shape for your answer:
          </p>
          <ol className="mt-4 space-y-3">
            {prep.pitch.outline.map((beat, index) => (
              <li key={beat} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                  {index + 1}
                </span>
                <span className="pt-0.5 text-sm leading-relaxed text-slate-700">{beat}</span>
              </li>
            ))}
          </ol>
          {prep.pitch.tip ? (
            <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
              {prep.pitch.tip}
            </p>
          ) : null}
        </Card>
      ) : null}

      <p className="px-1 text-xs leading-relaxed text-slate-400">
        {`Built from ${prep.basis.keywordCount} job description keywords (${prep.basis.matchedCount} on your resume, ${prep.basis.missingCount} missing)`}
        {years !== null && years !== undefined
          ? `, pitched for ${years} year${years === 1 ? "" : "s"} of experience.`
          : "."}
      </p>
    </div>
  );
};

const QuestionsTab = ({ questions }: { questions: PrepQuestion[] }) => {
  const [filter, setFilter] = useState("All");
  const [open, setOpen] = useState<Set<string>>(() => new Set(questions[0] ? [questions[0].id] : []));
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const question of questions) counts.set(question.category, (counts.get(question.category) || 0) + 1);
    return [{ name: "All", count: questions.length }, ...[...counts].map(([name, count]) => ({ name, count }))];
  }, [questions]);
  const visible = filter === "All" ? questions : questions.filter((question) => question.category === filter);
  const allOpen = visible.length > 0 && visible.every((question) => open.has(question.id));

  const toggle = (id: string) =>
    setOpen((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0">
        {categories.map((category) => (
          <button
            key={category.name}
            type="button"
            onClick={() => setFilter(category.name)}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition sm:h-8",
              filter === category.name
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            )}
          >
            {category.name}
            <span className={cn("tabular-nums", filter === category.name ? "text-white/70" : "text-slate-400")}>
              {category.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 px-1">
        <p className="text-xs text-slate-500">
          Try answering out loud before you open the sample.{" "}
          <span className="hidden sm:inline">Highlighted parts are yours to fill in.</span>
        </p>
        <button
          type="button"
          onClick={() =>
            setOpen((previous) => {
              const next = new Set(previous);
              for (const question of visible) {
                if (allOpen) next.delete(question.id);
                else next.add(question.id);
              }
              return next;
            })
          }
          className="shrink-0 text-xs font-semibold text-brand hover:underline"
        >
          {allOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <ol className="space-y-3">
        {visible.map((question) => {
          const number = questions.indexOf(question) + 1;
          const expanded = open.has(question.id);
          return (
            <li key={question.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => toggle(question.id)}
                aria-expanded={expanded}
                className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-slate-50/80 sm:p-5"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold tabular-nums text-slate-600">
                  {number}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                      CATEGORY_STYLES[question.category] || "bg-slate-50 text-slate-600 ring-slate-200"
                    )}
                  >
                    {question.category}
                  </span>
                  <span className="break-anywhere mt-1.5 block text-[15px] font-semibold leading-snug text-slate-900">
                    {question.question}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200",
                    expanded && "rotate-180"
                  )}
                />
              </button>
              {expanded ? (
                <div className="space-y-4 border-t border-slate-100 px-4 pb-5 pt-4 sm:px-5 sm:pl-[3.75rem]">
                  {question.whyTheyAsk ? (
                    <p className="flex gap-2 text-sm text-slate-600">
                      <Target className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <span>
                        <span className="font-semibold text-slate-800">What they&apos;re testing: </span>
                        {question.whyTheyAsk}
                      </span>
                    </p>
                  ) : null}
                  {question.keyPoints.length ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Hit these points</p>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {question.keyPoints.map((point) => (
                          <li
                            key={point}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800"
                          >
                            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div className="rounded-xl border-l-4 border-brand/60 bg-violet-50/60 px-4 py-3.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand">Sample answer</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-800">
                      {withPlaceholders(question.answer)}
                    </p>
                  </div>
                  {question.keywords.length ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-slate-400">Covers</span>
                      {question.keywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
};

const StudyTab = ({ prep, jobId }: { prep: InterviewPrep; jobId: string }) => {
  const { checked, toggle } = useChecklist(`syncv:prep:${jobId}:studied`);
  const done = prep.studyGuide.filter((topic) => checked.has(topic.id)).length;
  const total = prep.studyGuide.length;
  return (
    <div className="space-y-4">
      <Card className="flex items-center gap-4">
        <div className="relative h-12 w-12 shrink-0">
          <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="4" className="stroke-slate-100" />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              className="stroke-brand transition-[stroke-dasharray] duration-500"
              strokeDasharray={`${total ? (done / total) * 97.4 : 0} 97.4`}
            />
          </svg>
          <GraduationCap className="absolute inset-0 m-auto h-5 w-5 text-brand" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {done} of {total} topics reviewed
          </p>
          <p className="text-xs text-slate-500">Most important first. Tick each one off as you revise it.</p>
        </div>
      </Card>

      {prep.studyGuide.map((topic) => {
        const isDone = checked.has(topic.id);
        return (
          <section
            key={topic.id}
            className={cn(
              "rounded-2xl border bg-white p-4 shadow-sm transition sm:p-5",
              isDone ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200"
            )}
          >
            <div className="flex items-start gap-3">
              <button
                type="button"
                role="checkbox"
                aria-checked={isDone}
                aria-label={`Mark ${topic.topic} as reviewed`}
                onClick={() => toggle(topic.id)}
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition active:scale-95",
                  isDone
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-slate-300 bg-white text-transparent hover:border-emerald-400"
                )}
              >
                <Check className="h-4 w-4" strokeWidth={3} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    className={cn(
                      "break-anywhere text-[15px] font-semibold text-slate-900",
                      isDone && "text-slate-500 line-through decoration-slate-300"
                    )}
                  >
                    {topic.topic}
                  </h3>
                  {topic.priority === "high" ? (
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                      High priority
                    </span>
                  ) : null}
                </div>
                {topic.why ? <p className="mt-1 text-sm leading-relaxed text-slate-600">{topic.why}</p> : null}
                {topic.concepts.length ? (
                  <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {topic.concepts.map((concept) => (
                      <li key={concept} className="flex gap-2 text-sm text-slate-700">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand/60" />
                        <span className="break-anywhere">{concept}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {topic.practice ? (
                  <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                    <span className="font-semibold text-slate-900">Practice: </span>
                    {topic.practice}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
};

const GapsTab = ({ prep }: { prep: InterviewPrep }) => {
  if (!prep.gaps.length && !prep.strengths.length) {
    return (
      <Card className="py-10 text-center">
        <p className="text-sm font-medium text-slate-700">No gaps or strengths to show</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
          The questions and study guide still cover this job&apos;s keywords.
        </p>
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      {prep.gaps.length ? (
        <div className="space-y-3">
          <div className="px-1">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <CircleAlert className="h-4 w-4 text-amber-500" />
              Close the gaps
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Keywords from the job that your resume doesn&apos;t show. Expect to be asked about them.
            </p>
          </div>
          {prep.gaps.map((gap) => (
            <Card key={gap.keyword} className="space-y-3">
              <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                {gap.keyword}
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">If they ask</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">{gap.howToAddress}</p>
              </div>
              {gap.quickPrep ? (
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Quick prep</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">{gap.quickPrep}</p>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}

      {prep.strengths.length ? (
        <div className="space-y-3">
          <div className="px-1">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Lean on your strengths
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Keywords you already match. Have a story ready for each.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {prep.strengths.map((item) => (
              <Card key={item.keyword}>
                <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200">
                  {item.keyword}
                </span>
                <p className="mt-2.5 text-sm leading-relaxed text-slate-700">{item.howToShowcase}</p>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const FinalTab = ({ prep, jobId }: { prep: InterviewPrep; jobId: string }) => {
  const { checked, toggle } = useChecklist(`syncv:prep:${jobId}:checklist`);
  return (
    <div className="space-y-4">
      {prep.questionsToAsk.length ? (
        <Card>
          <CardTitle icon={<MessageCircleQuestion />}>Questions to ask them</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Have two or three ready for the &ldquo;Any questions for us?&rdquo; moment.
          </p>
          <ol className="mt-4 space-y-2.5">
            {prep.questionsToAsk.map((question, index) => (
              <li key={question} className="flex gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                <span className="text-sm font-bold tabular-nums text-brand">{index + 1}</span>
                <span className="text-sm leading-relaxed text-slate-700">{question}</span>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {prep.checklist.length ? (
        <Card>
          <CardTitle icon={<ListChecks />}>Before the interview</CardTitle>
          <ul className="mt-3 divide-y divide-slate-100">
            {prep.checklist.map((item, index) => {
              const id = `c${index}`;
              const isDone = checked.has(id);
              return (
                <li key={item}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isDone}
                    onClick={() => toggle(id)}
                    className="flex w-full items-start gap-3 py-3 text-left"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition",
                        isDone ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent"
                      )}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <span
                      className={cn(
                        "text-sm leading-relaxed",
                        isDone ? "text-slate-400 line-through" : "text-slate-700"
                      )}
                    >
                      {item}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  );
};
