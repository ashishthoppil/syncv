"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  CircleAlert,
  Clock,
  Lightbulb,
  MessagesSquare,
  SkipForward,
  Target,
  TrendingUp,
} from "lucide-react";
import type { MockSession } from "./types";

export const scoreTone = (score: number | null) => {
  if (score === null) {
    return { stroke: "stroke-slate-300", text: "text-slate-400", chip: "bg-slate-100 text-slate-500", bar: "bg-slate-300" };
  }
  if (score >= 80) {
    return { stroke: "stroke-emerald-500", text: "text-emerald-600", chip: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500" };
  }
  if (score >= 65) {
    return { stroke: "stroke-violet-500", text: "text-violet-600", chip: "bg-violet-50 text-violet-700", bar: "bg-violet-500" };
  }
  if (score >= 45) {
    return { stroke: "stroke-amber-500", text: "text-amber-600", chip: "bg-amber-50 text-amber-700", bar: "bg-amber-500" };
  }
  return { stroke: "stroke-rose-500", text: "text-rose-600", chip: "bg-rose-50 text-rose-700", bar: "bg-rose-500" };
};

const formatDuration = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes}m ${String(rest).padStart(2, "0")}s` : `${rest}s`;
};

/** The headline score, drawn in from zero when the report opens. */
const ScoreRing = ({ score }: { score: number }) => {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setShown(score));
    return () => window.cancelAnimationFrame(frame);
  }, [score]);
  const tone = scoreTone(score);
  const circumference = 2 * Math.PI * 52;
  return (
    <div className="relative h-36 w-36 shrink-0 sm:h-40 sm:w-40">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" className="stroke-slate-100" />
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className={cn(tone.stroke, "transition-[stroke-dashoffset] duration-1000 ease-out")}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - shown / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-4xl font-bold tabular-nums sm:text-5xl", tone.text)}>{score}</span>
        <span className="text-xs font-medium text-slate-400">out of 100</span>
      </div>
    </div>
  );
};

const Meter = ({ label, value }: { label: string; value: number | null }) => (
  <div>
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold tabular-nums text-slate-900">{value === null ? "—" : `${value}/10`}</span>
    </div>
    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
      <div
        className={cn("h-full rounded-full transition-[width] duration-700", scoreTone(value === null ? null : value * 10).bar)}
        style={{ width: `${(value ?? 0) * 10}%` }}
      />
    </div>
  </div>
);

export const MockInterviewReport = ({ session }: { session: MockSession }) => {
  const evaluation = session.evaluation;
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  if (!evaluation) return null;

  const answerById = new Map(session.answers.map((answer) => [answer.questionId, answer]));
  const feedbackById = new Map(evaluation.questions.map((item) => [item.id, item]));
  const pace = evaluation.stats.wordsPerMinute;
  const partial = evaluation.scoredCount < evaluation.totalQuestions;

  const toggle = (id: string) =>
    setOpen((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      <section className="flex flex-col items-center gap-5 rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:flex-row sm:items-center sm:gap-7 sm:p-7 sm:text-left">
        <ScoreRing score={evaluation.overallScore} />
        <div className="min-w-0">
          <span
            className={cn(
              "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
              scoreTone(evaluation.overallScore).chip
            )}
          >
            {evaluation.readiness}
          </span>
          <p className="mt-3 text-[15px] leading-relaxed text-slate-700">{evaluation.summary}</p>
          <p className="mt-3 text-xs text-slate-400">
            {partial
              ? `Scored on the ${evaluation.scoredCount} of ${evaluation.totalQuestions} questions you reached`
              : `Scored on all ${evaluation.totalQuestions} questions`}
            {` · pitched at ${session.level.toLowerCase()}`}
            {session.experienceYears !== null
              ? ` (${session.experienceYears} year${session.experienceYears === 1 ? "" : "s"})`
              : ""}
          </p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">By section</h3>
          <div className="mt-4 space-y-3.5">
            {evaluation.sectionScores.map((section) => (
              <div key={section.section}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{section.section}</span>
                  <span className="font-semibold tabular-nums text-slate-900">
                    {section.score === null ? "Not reached" : section.score}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn("h-full rounded-full transition-[width] duration-700", scoreTone(section.score).bar)}
                    style={{ width: `${section.score ?? 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">How you came across</h3>
          <div className="mt-4 space-y-3.5">
            <Meter label="Clarity" value={evaluation.communication.clarity} />
            <Meter label="Structure" value={evaluation.communication.structure} />
            <Meter label="Relevance" value={evaluation.communication.relevance} />
            <Meter label="Depth" value={evaluation.communication.depth} />
          </div>
        </section>
      </div>

      <section className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { icon: Clock, label: "Avg. answer", value: formatDuration(evaluation.stats.averageSeconds) },
          {
            icon: MessagesSquare,
            label: "Pace",
            value: pace ? `${pace} wpm` : "—",
            hint: pace ? (pace < 110 ? "A little slow" : pace > 175 ? "A little fast" : "Comfortable") : "",
          },
          { icon: SkipForward, label: "Skipped", value: String(evaluation.stats.skipped) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <stat.icon className="h-4 w-4 text-slate-400" />
            <p className="mt-2 text-lg font-bold tabular-nums text-slate-900 sm:text-xl">{stat.value}</p>
            <p className="text-xs text-slate-500">
              {stat.label}
              {stat.hint ? <span className="hidden sm:inline"> · {stat.hint}</span> : null}
            </p>
          </div>
        ))}
      </section>

      {evaluation.strengths.length || evaluation.improvements.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {evaluation.strengths.length ? (
            <section className="rounded-3xl border border-emerald-200 bg-emerald-50/50 p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <TrendingUp className="h-4 w-4" />
                Strengths
              </h3>
              <ul className="mt-3 space-y-3">
                {evaluation.strengths.map((item) => (
                  <li key={item.title} className="flex gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2.5} />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{item.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {evaluation.improvements.length ? (
            <section className="rounded-3xl border border-amber-200 bg-amber-50/50 p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <Target className="h-4 w-4" />
                Areas to improve
              </h3>
              <ul className="mt-3 space-y-3">
                {evaluation.improvements.map((item) => (
                  <li key={item.title} className="flex gap-2.5">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{item.detail}</p>
                      {item.action ? (
                        <p className="mt-1.5 flex gap-1.5 text-sm text-amber-900">
                          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          {item.action}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      <section>
        <h3 className="px-1 text-sm font-semibold text-slate-900">Question by question</h3>
        <ol className="mt-3 space-y-2.5">
          {session.questions.map((question, index) => {
            const feedback = feedbackById.get(question.id);
            const answer = answerById.get(question.id);
            const expanded = open.has(question.id);
            const status = feedback?.status || "not_reached";
            const score = feedback?.score ?? null;
            return (
              <li key={question.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggle(question.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-slate-50/80"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold tabular-nums text-slate-600">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {question.section}
                    </span>
                    <span className="break-anywhere mt-0.5 block text-sm font-medium leading-snug text-slate-900">
                      {question.question}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-lg px-2 py-1 text-xs font-bold tabular-nums",
                      status === "answered"
                        ? scoreTone(score === null ? null : score * 10).chip
                        : "bg-slate-100 text-slate-500"
                    )}
                  >
                    {status === "answered" ? `${score}/10` : status === "skipped" ? "Skipped" : "—"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform",
                      expanded && "rotate-180"
                    )}
                  />
                </button>
                {expanded ? (
                  <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3.5 sm:pl-14">
                    {status === "not_reached" ? (
                      <p className="text-sm text-slate-500">The interview ended before this question.</p>
                    ) : (
                      <>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your answer</p>
                          <p className="break-anywhere mt-1 text-sm italic leading-relaxed text-slate-600">
                            {answer?.answer ? `“${answer.answer}”` : "No answer given."}
                          </p>
                        </div>
                        {feedback?.feedback ? (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Feedback</p>
                            <p className="mt-1 text-sm leading-relaxed text-slate-700">{feedback.feedback}</p>
                          </div>
                        ) : null}
                        {feedback?.betterAnswer ? (
                          <div className="rounded-xl border-l-4 border-brand/60 bg-violet-50/60 px-3.5 py-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-brand">A stronger answer</p>
                            <p className="mt-1 text-sm leading-relaxed text-slate-800">{feedback.betterAnswer}</p>
                          </div>
                        ) : null}
                      </>
                    )}
                    {question.idealPoints?.length ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          What a strong answer covers
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {question.idealPoints.map((point) => (
                            <li key={point} className="flex gap-2 text-sm text-slate-700">
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
};
