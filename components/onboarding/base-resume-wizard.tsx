"use client";

import { useMemo, useState, type ReactNode } from "react";
import { toast } from "react-toastify";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AdditionalSectionsCard,
  CertificationsCard,
  EducationCard,
  ExperienceCard,
  LanguagesCard,
  PersonalDetailsCard,
  ProjectsCard,
  SkillsCard,
  SummaryCard,
  stepHasContent,
  type BaseResumeDraft,
} from "@/components/dashboard/resume-form";
import { saveBaseResume } from "@/lib/base-resume";

type WizardUser = { id?: string; email?: string } | null;

type Step = {
  key: string;
  title: string;
  description: string;
  render: (draft: BaseResumeDraft, update: (patch: Partial<BaseResumeDraft>) => void) => ReactNode;
  // A required step blocks Next until satisfied. A skippable step shows Skip.
  isComplete?: (draft: BaseResumeDraft) => boolean;
  skippable?: boolean;
};

const STEPS: Step[] = [
  {
    key: "personal",
    title: "Personal & contact",
    description: "Your name, title, contact details, and profile links.",
    render: (draft, update) => <PersonalDetailsCard draft={draft} update={update} />,
    isComplete: stepHasContent.personal,
  },
  {
    key: "summary",
    title: "Professional summary",
    description: "A short summary of who you are — or generate one.",
    render: (draft, update) => <SummaryCard draft={draft} update={update} />,
    isComplete: stepHasContent.summary,
  },
  {
    key: "skills",
    title: "Skills",
    description: "Add your skills — each is sorted into a category.",
    render: (draft, update) => (
      <SkillsCard
        value={draft.skillCategories}
        onChange={(next) => update({ skillCategories: next })}
      />
    ),
    isComplete: stepHasContent.skills,
  },
  {
    key: "experience",
    title: "Work experience",
    description: "Your roles and what you did. You can skip this if it doesn't apply.",
    render: (draft, update) => (
      <ExperienceCard
        value={draft.experiences}
        onChange={(next) => update({ experiences: next })}
      />
    ),
    skippable: true,
  },
  {
    key: "projects",
    title: "Projects",
    description: "Notable projects. Optional — skip if you have none.",
    render: (draft, update) => (
      <ProjectsCard value={draft.projects} onChange={(next) => update({ projects: next })} />
    ),
    skippable: true,
  },
  {
    key: "education",
    title: "Education",
    description: "Your degrees and qualifications.",
    render: (draft, update) => (
      <EducationCard
        value={draft.educations}
        onChange={(next) => update({ educations: next })}
      />
    ),
    isComplete: stepHasContent.education,
  },
  {
    key: "certifications",
    title: "Certifications",
    description: "Optional — add any certifications or licenses.",
    render: (draft, update) => (
      <CertificationsCard
        value={draft.certifications}
        onChange={(next) => update({ certifications: next })}
      />
    ),
    skippable: true,
  },
  {
    key: "languages",
    title: "Languages",
    description: "Optional — languages you speak or write.",
    render: (draft, update) => (
      <LanguagesCard value={draft.languages} onChange={(next) => update({ languages: next })} />
    ),
    skippable: true,
  },
  {
    key: "additional",
    title: "Additional sections",
    description: "Rename and edit any extra sections found in your resume.",
    render: (draft, update) => (
      <AdditionalSectionsCard
        value={draft.additionalSections}
        onChange={(next) => update({ additionalSections: next })}
      />
    ),
    skippable: true,
  },
];

type BaseResumeWizardProps = {
  user: WizardUser;
  initialDraft: BaseResumeDraft;
  mode: "upload" | "manual";
  onComplete: () => void;
};

export const BaseResumeWizard = ({
  user,
  initialDraft,
  mode,
  onComplete,
}: BaseResumeWizardProps) => {
  const [draft, setDraft] = useState<BaseResumeDraft>(initialDraft);
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const update = (patch: Partial<BaseResumeDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  // Only show the "Additional sections" step in the manual path if the user
  // actually added one — the upload path always shows it so extracted sections
  // can be reviewed and renamed.
  const steps = useMemo(
    () =>
      STEPS.filter(
        (step) =>
          step.key !== "additional" ||
          mode === "upload" ||
          draft.additionalSections.length > 0
      ),
    [mode, draft.additionalSections.length]
  );

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
  const canAdvance = step.isComplete ? step.isComplete(draft) : true;

  const goNext = () => {
    if (!canAdvance) {
      toast.info("Please complete this section before continuing.");
      return;
    }
    if (!isLast) setStepIndex((i) => i + 1);
  };
  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));
  const skip = () => {
    if (!isLast) setStepIndex((i) => i + 1);
  };

  const finish = async () => {
    // Enforce every mandatory step, not just the current one.
    const incomplete = steps.find((s) => s.isComplete && !s.isComplete(draft));
    if (incomplete) {
      const idx = steps.findIndex((s) => s.key === incomplete.key);
      setStepIndex(idx);
      toast.info(`Please complete "${incomplete.title}" before finishing.`);
      return;
    }
    setSaving(true);
    try {
      await saveBaseResume(user, draft, "bold-modern");
      toast.success("Base resume saved.");
      onComplete();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save your base resume.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      {/* Progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
          <span>
            Step {stepIndex + 1} of {steps.length}
          </span>
          <span>{Math.round(((stepIndex + 1) / steps.length) * 100)}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-slate-900 transition-all"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{step.title}</h2>
        <p className="text-sm text-slate-500">{step.description}</p>
      </div>

      <div className="mb-6">{step.render(draft, update)}</div>

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          className="rounded-md"
          onClick={goBack}
          disabled={stepIndex === 0 || saving}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <div className="flex items-center gap-2">
          {step.skippable && !isLast ? (
            <Button variant="outline" className="rounded-md" onClick={skip} disabled={saving}>
              Skip
            </Button>
          ) : null}
          {isLast ? (
            <Button
              className="rounded-md"
              onClick={finish}
              disabled={saving || !canAdvance}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Finish & save
            </Button>
          ) : (
            <Button
              className={cn("rounded-md", !canAdvance && "opacity-60")}
              onClick={goNext}
              disabled={saving}
            >
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
