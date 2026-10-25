"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  Compass,
  FileText,
  Globe2,
  Loader2,
  MessagesSquare,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The first question after registering: what the user came to do. It decides
 * where onboarding goes next — a base resume is only worth building for the
 * goals that run on a scan — and the answer is kept on the account
 * (user_metadata.onboarding_goals) so later screens can lean on it.
 */

// Stored on the account, so an id must never be renamed — change the copy.
export type OnboardingGoal =
  | "remote_jobs"
  | "tailor_resume"
  | "more_interviews"
  | "interview_prep"
  | "exploring";

type GoalOption = {
  id: OnboardingGoal;
  title: string;
  description: string;
  icon: LucideIcon;
};

export const ONBOARDING_GOALS: GoalOption[] = [
  {
    id: "remote_jobs",
    title: "Find remote jobs",
    description: "Browse remote and hybrid roles, refreshed every night.",
    icon: Globe2,
  },
  {
    id: "tailor_resume",
    title: "Tailor my resume to each job",
    description: "Rework your resume around a specific job description, using your real experience.",
    icon: FileText,
  },
  {
    id: "more_interviews",
    title: "Get more interview calls",
    description: "See how well you match a role and close the keyword gaps that get resumes screened out.",
    icon: Target,
  },
  {
    id: "interview_prep",
    title: "Prepare for interviews",
    description: "Get a prep guide for the role, then practise with a mock interview.",
    icon: MessagesSquare,
  },
  {
    id: "exploring",
    title: "Just exploring",
    description: "Look around first. You can set everything up whenever you're ready.",
    icon: Compass,
  },
];

const GOAL_IDS = new Set<string>(ONBOARDING_GOALS.map((goal) => goal.id));

/** Drops anything that isn't a current goal id — the stored value is user data. */
export const parseStoredGoals = (value: unknown): OnboardingGoal[] =>
  Array.isArray(value)
    ? (value.filter((goal) => typeof goal === "string" && GOAL_IDS.has(goal)) as OnboardingGoal[])
    : [];

// Each of these starts from a scan, and a scan starts from a base resume.
const RESUME_GOALS: OnboardingGoal[] = ["tailor_resume", "more_interviews", "interview_prep"];

export type OnboardingDestination = "base-resume" | "remote-jobs" | "dashboard";

export const destinationForGoals = (goals: OnboardingGoal[]): OnboardingDestination => {
  if (goals.some((goal) => RESUME_GOALS.includes(goal))) return "base-resume";
  if (goals.length === 1 && goals[0] === "remote_jobs") return "remote-jobs";
  return "dashboard";
};

// Said before the user commits, so the button never leads somewhere unexpected.
const NEXT_STEP: Record<OnboardingDestination, string> = {
  "base-resume": "Next: set up the base resume every scan starts from.",
  "remote-jobs": "Next: browse remote jobs.",
  dashboard: "Next: straight to your dashboard.",
};

export const GoalPicker = ({
  initialGoals = [],
  busy = false,
  onContinue,
}: {
  initialGoals?: OnboardingGoal[];
  /** Saving and routing — locks the form so a double tap can't fire twice. */
  busy?: boolean;
  onContinue: (goals: OnboardingGoal[]) => void;
}) => {
  const [selected, setSelected] = useState<OnboardingGoal[]>(initialGoals);

  // "Just exploring" means none of the others, so it and they rule each other out.
  const toggle = (goal: OnboardingGoal) => {
    setSelected((current) => {
      if (current.includes(goal)) return current.filter((id) => id !== goal);
      if (goal === "exploring") return ["exploring"];
      return [...current.filter((id) => id !== "exploring"), goal];
    });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!selected.length || busy) return;
    // Kept in display order, whatever order they were ticked in.
    onContinue(ONBOARDING_GOALS.map((goal) => goal.id).filter((id) => selected.includes(id)));
  };

  return (
    <form onSubmit={handleSubmit}>
      <fieldset disabled={busy}>
        <legend className="sr-only">Choose your goals</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {ONBOARDING_GOALS.map(({ id, title, description, icon: Icon }) => {
            const checked = selected.includes(id);
            return (
              <label
                key={id}
                className={cn(
                  "relative flex cursor-pointer items-start gap-3.5 rounded-2xl border bg-white p-4 text-left shadow-sm transition-[border-color,box-shadow,background-color] sm:p-5",
                  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-slate-900/30 has-[:focus-visible]:ring-offset-2",
                  checked
                    ? "border-slate-900 shadow-md ring-1 ring-slate-900"
                    : "border-slate-200 hover:border-slate-300 hover:shadow",
                  // The way out of the question rather than an answer to it:
                  // full width, and set apart from the goals above.
                  id === "exploring" && "sm:col-span-2",
                  id === "exploring" && !checked && "border-dashed bg-slate-50/60 shadow-none"
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => toggle(id)}
                />
                <span
                  aria-hidden
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                    checked ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-snug text-slate-900">
                    {title}
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-slate-500">
                    {description}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                    checked
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-300 bg-white"
                  )}
                >
                  {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-8 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" className="text-center text-sm text-slate-500 sm:text-left">
          {selected.length ? NEXT_STEP[destinationForGoals(selected)] : "Pick at least one to continue."}
        </p>
        <Button
          type="submit"
          className="h-12 rounded-full px-6 text-[15px] md:h-11"
          disabled={!selected.length || busy}
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          Continue
          {busy ? null : <ArrowRight />}
        </Button>
      </div>
    </form>
  );
};
