"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Award,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Files,
  Folder,
  Globe,
  GraduationCap,
  Info,
  Languages,
  Layers,
  LayoutGrid,
  Lightbulb,
  Loader2,
  Minus,
  NotepadText,
  Palette,
  Pencil,
  Plus,
  RefreshCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserRound,
  WandSparkles,
  X,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isLanguageKeyword } from "@/lib/languages";
import type { BaseResumeRecord } from "@/lib/base-resume";
import { RESUME_TEMPLATE_CONFIGS } from "@/components/resume-templates/config";
import type { ResumeTemplateId } from "@/components/resume-templates/types";
import type { ResumeEditorSection } from "@/components/dashboard/resume-editor";
import { TemplateThumbnail } from "@/components/dashboard/template-picker";
import { useProductTour } from "@/components/onboarding/product-tour";

/**
 * The scan → optimize flow for phones, one step per screen:
 *
 *   Job Details → Scan → Results → Optimize (pick keywords) → Optimized
 *
 * It is a view only. ScanSection still owns every piece of state and every
 * request — this component reads that state to decide which step is on
 * screen and hands user actions straight back. Desktop keeps its two-column
 * form and modal preview, untouched.
 */

// Below `lg`, the same cut-off the dashboard uses to swap its sidebar for the
// bottom tab bar. `.98` so a fractional viewport width never falls between the
// two layouts.
const MOBILE_LAYOUT_QUERY = "(max-width: 1023.98px)";

const subscribeToLayout = (onChange: () => void) => {
  const query = window.matchMedia(MOBILE_LAYOUT_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/** Whether the scan section should render this flow instead of the desktop one. */
export const useIsMobileScanLayout = () =>
  useSyncExternalStore(
    subscribeToLayout,
    () => window.matchMedia(MOBILE_LAYOUT_QUERY).matches,
    () => false
  );

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

// ---------------------------------------------------------------------------
// Types — structural, so ScanSection's own state objects fit without copying.
// ---------------------------------------------------------------------------

type FormField = "organization" | "designation" | "jd";

type ScoreComponent = {
  key: string;
  label: string;
  weight: number;
  keywordDriven?: boolean;
};

type ScoreBreakdown = Partial<Record<string, number>>;

type ScanResultView = {
  initialScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  keywordUniverse: string[];
  scoreBreakdown?: ScoreBreakdown;
  sectionAnalysis?: { foundSections?: Partial<Record<string, boolean>> };
  suggestions?: string[];
};

type TailoredDocsView = {
  incorporatedKeywords?: string[];
  stillMissingKeywords?: string[];
};

type DocType = "cv" | "cover";

/**
 * Ways out of the optimized step. Each one discards the generated documents,
 * so the host confirms first if anything is still un-downloaded: "back" and
 * "new" stay in the flow, "apply" leaves for the job posting.
 */
export type MobileExitIntent = "back" | "new" | "apply";

type KeywordPickerControl = {
  open: boolean;
  /** Missing keywords the user may add — degree requirements already removed. */
  selectable: string[];
  selected: string[];
  onToggle: (keyword: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  /** Leave the picker without optimizing. */
  onBack: () => void;
  /** Optimize with the current selection (an empty one is a structure-only pass). */
  onContinue: () => void;
};

type PreviewControl = {
  open: boolean;
  docs: TailoredDocsView | null;
  view: "resume" | "cover";
  onViewChange: (view: "resume" | "cover") => void;
  initialScore: number | null;
  finalScore: number | null;
  finalScoreBreakdown?: ScoreBreakdown | null;
  isComputingFinalScore: boolean;
  hasEdits: boolean;
  onReevaluate: () => void;
  /** The rendered resume, with added keywords highlighted (preview only). */
  resumeHtml: string;
  coverLetterHtml: string;
  /**
   * The resume editor — one section of it, or all of it. Built by the host so
   * both layouts share one editor and its drafts.
   */
  renderEditor: (
    section?: ResumeEditorSection,
    onNotice?: (tone: "info" | "error", message: string) => void
  ) => ReactNode;
  /** False for documents with no structured data: one text field, no sections. */
  editorHasSections: boolean;
  /** The colour / font / spacing controls, likewise shared. */
  designer: ReactNode;
  templateId: ResumeTemplateId;
  onTemplateChange: (id: ResumeTemplateId) => void;
  downloadingType: DocType | null;
  downloaded: Record<DocType, boolean>;
  onDownload: (type: DocType) => void;
  onRequestExit: (intent: MobileExitIntent) => void;
};

export type MobileScanFlowProps = {
  form: Record<FormField, string>;
  formErrors: Partial<Record<FormField | "resume", string>>;
  onFieldChange: (field: FormField, value: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  /** Clears the form and every result — a brand-new scan. */
  onReset: () => void;

  baseResumes: BaseResumeRecord[];
  baseResumeLoading: boolean;
  selectedBaseResumeId: string;
  onSelectBaseResume: (record: BaseResumeRecord) => void;
  onManageBaseResumes: () => void;

  result: ScanResultView | null;
  scoreComponents: readonly ScoreComponent[];
  /** Set when the scan started from a Remote Jobs posting. */
  remoteJob: { title: string; companyName: string } | null;

  allowsCoverLetter: boolean;
  /** Paid-plan fair use: while `waiting`, every optimize control is locked. */
  optimizeWait: { waiting: boolean; label: string; note: string };
  /** Starts optimizing — the host may stop to ask about a role mismatch. */
  onOptimize: () => void;
  isGeneratingDocs: boolean;
  /**
   * The last thing that failed. The flow shows no toasts, so this is shown in
   * the pinned action bar, above the button that failed.
   */
  alert: string | null;
  onDismissAlert: () => void;

  keywordPicker: KeywordPickerControl;
  preview: PreviewControl;
};

type FlowStep = "details" | "scan" | "results" | "keywords" | "optimizing" | "optimized";

// ---------------------------------------------------------------------------
// Look
// ---------------------------------------------------------------------------

// The flow's accent is the indigo-violet from its design — stepper, spinners,
// tips, the selected template. Nothing else in the app uses it, so it lives
// here as literal classes rather than in the Tailwind theme.
const CARD =
  "rounded-xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_20px_-12px_rgba(15,23,42,0.12)]";

// The "Resume to tailor" field that leads the Job Details form.
const RESUME_FIELD =
  "flex min-h-[64px] w-full items-center gap-3 rounded-xl border border-[#E4E0FB] bg-[#F6F4FF] px-4 py-3";

const PRIMARY_BUTTON =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[15px] font-medium text-primary-foreground shadow-sm transition active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 motion-reduce:active:scale-100";

const fieldClass = (hasError: boolean) =>
  cn(
    "w-full rounded-lg border bg-white px-4 text-base text-slate-900 shadow-[0_1px_1px_rgba(15,23,42,0.03)] transition placeholder:text-slate-400 focus:outline-none focus:ring-4",
    hasError
      ? "border-red-400 focus:border-red-400 focus:ring-red-100"
      : "border-slate-200 focus:border-[#6A53FD]/60 focus:ring-[#6A53FD]/10"
  );

// The scanner reads this much of a job description (see /api/analyze), so the
// counter shows it as the ceiling. Soft: longer pastes still go through.
const JD_SCAN_WINDOW = 6000;

// ---------------------------------------------------------------------------
// Staged progress
// ---------------------------------------------------------------------------

type Stage = { title: string; detail: string };

const SCAN_STAGES: Stage[] = [
  { title: "Parsing your resume", detail: "Extracting text and structure" },
  { title: "Extracting key requirements", detail: "Identifying skills, tools and experience" },
  { title: "Matching skills and experience", detail: "Comparing with job description" },
  { title: "Generating detailed analysis", detail: "Finding keyword matches and gaps" },
  { title: "Calculating resume score", detail: "Finalizing results" },
];

const OPTIMIZE_STAGES_WITH_LETTER: Stage[] = [
  { title: "Reviewing your selections", detail: "Mapping keywords to your experience" },
  { title: "Tailoring your resume", detail: "Weaving keywords in where they truthfully fit" },
  { title: "Writing your cover letter", detail: "Matching it to this role" },
  { title: "Finalizing your documents", detail: "Checking structure and formatting" },
];

const OPTIMIZE_STAGES: Stage[] = [
  OPTIMIZE_STAGES_WITH_LETTER[0],
  OPTIMIZE_STAGES_WITH_LETTER[1],
  OPTIMIZE_STAGES_WITH_LETTER[3],
];

// How long each stage shows before the next one starts, in ms. There is one
// request behind every list, so these only pace the story; the last stage
// holds until the request actually returns. Module constants because the
// timer effect depends on them.
const SCAN_SCHEDULE = [1600, 2600, 4200, 5200];
const OPTIMIZE_SCHEDULE_WITH_LETTER = [2500, 16000, 12000];
const OPTIMIZE_SCHEDULE = [2500, 22000];

// Once the result is in, the remaining stages tick off at this pace, and the
// finished list holds for a beat before the next step replaces it.
const FINISH_STEP_MS = 170;
const FINISH_HOLD_MS = 420;

type StagedRun = {
  /** The outcome value when the run began; a different one means success. */
  baseline: unknown;
  stepStartedAt: number[];
  stepEndedAt: number[];
  /** The stage in progress — equal to the stage count once all are ticked. */
  index: number;
  finishing: boolean;
};

/**
 * Paces a staged progress list over one request. A run starts when `active`
 * turns on, and succeeds the moment `outcome` changes identity (a new scan
 * result, new documents) — which can happen before `active` turns off, as the
 * host still has follow-up work in flight. Success ticks the rest of the list
 * off; `active` ending without a new outcome is a failure and drops the run.
 */
const useStagedRun = (
  active: boolean,
  outcome: unknown,
  stageCount: number,
  schedule: number[]
) => {
  const [run, setRun] = useState<StagedRun | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const outcomeRef = useRef(outcome);

  // Declared before the start effect so it sees this render's outcome.
  useEffect(() => {
    outcomeRef.current = outcome;
  });

  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();
    setNow(startedAt);
    setRun({
      baseline: outcomeRef.current,
      stepStartedAt: [startedAt],
      stepEndedAt: [],
      index: 0,
      finishing: false,
    });
  }, [active]);

  // Success wins over failure when both land in the same render.
  useEffect(() => {
    if (!run || run.finishing) return;
    if (outcome != null && outcome !== run.baseline) {
      setRun({ ...run, finishing: true });
    } else if (!active) {
      setRun(null);
    }
  }, [active, outcome, run]);

  useEffect(() => {
    if (!run) return;
    const advance = () => {
      const at = Date.now();
      setRun((current) =>
        current === run
          ? {
              ...current,
              stepEndedAt: [...current.stepEndedAt, at],
              stepStartedAt: [...current.stepStartedAt, at],
              index: current.index + 1,
            }
          : current
      );
    };

    if (run.finishing) {
      const done = run.index >= stageCount;
      const id = window.setTimeout(
        () =>
          done ? setRun((current) => (current === run ? null : current)) : advance(),
        done ? FINISH_HOLD_MS : FINISH_STEP_MS
      );
      return () => window.clearTimeout(id);
    }

    // The last stage waits for the request, however long it takes.
    if (run.index >= stageCount - 1) return;
    const due = run.stepStartedAt[run.index] + (schedule[run.index] ?? 4000);
    const id = window.setTimeout(advance, Math.max(0, due - Date.now()));
    return () => window.clearTimeout(id);
  }, [run, stageCount, schedule]);

  // Drives the live seconds counter on the stage in progress.
  useEffect(() => {
    if (!run || run.finishing) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [run]);

  return {
    running: run !== null,
    index: run?.index ?? 0,
    /** ms the stage took, or has taken so far; null before it starts. */
    elapsed: (stage: number): number | null => {
      if (!run) return null;
      const startedAt = run.stepStartedAt[stage];
      if (startedAt === undefined) return null;
      const endedAt = run.stepEndedAt[stage];
      return (endedAt ?? Math.max(now, startedAt)) - startedAt;
    },
  };
};

// ---------------------------------------------------------------------------
// Score tone — mirrors ScanSection's score bands (55 / 70 / 80).
// ---------------------------------------------------------------------------

type ScoreTone = {
  label: string;
  text: string;
  pill: string;
  alert: string;
  icon: LucideIcon;
  encouragement: string;
  summary: (missingCount: number) => string;
};

const scoreToneFor = (score: number): ScoreTone => {
  if (score < 55) {
    return {
      label: "Needs work",
      text: "text-red-600",
      pill: "bg-red-50 text-red-700",
      alert: "bg-red-50 text-red-700",
      icon: CircleAlert,
      encouragement: "Don't worry, we have got you covered.",
      summary: (missing) =>
        missing
          ? "Your resume partially matches the role but there are key skills and terms missing."
          : "Your resume has the keywords, but experience, titles and structure are holding the score back.",
    };
  }
  if (score < 70) {
    return {
      label: "Almost there",
      text: "text-orange-500",
      pill: "bg-orange-50 text-orange-700",
      alert: "bg-orange-50 text-orange-700",
      icon: CircleAlert,
      encouragement: "You're close. A few focused tweaks can lift this quickly.",
      summary: (missing) =>
        missing
          ? "Your resume matches much of the role, but a few key skills and terms are still missing."
          : "Your resume has the keywords; experience, titles and structure make up the rest of the score.",
    };
  }
  if (score < 80) {
    return {
      label: "Good",
      text: "text-amber-500",
      pill: "bg-amber-50 text-amber-700",
      alert: "bg-amber-50 text-amber-800",
      icon: CheckCircle2,
      encouragement: "Nice progress. A tighter keyword match can make it stronger.",
      summary: (missing) =>
        missing
          ? "Your resume matches most of the role. A few of its keywords are still missing."
          : "Your resume covers the role's keywords and matches it well.",
    };
  }
  return {
    label: "Strong",
    text: "text-emerald-600",
    pill: "bg-emerald-50 text-emerald-700",
    alert: "bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
    encouragement: "Your resume rocks already. You can still tailor it to this exact role.",
    summary: (missing) =>
      missing
        ? "Your resume already matches the role closely, with only a few keywords missing."
        : "Your resume already matches the role closely.",
  };
};

const formatSeconds = (ms: number, settled: boolean) =>
  `${settled ? Math.max(1, Math.round(ms / 1000)) : Math.floor(ms / 1000)}s`;

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

const StepHeading = ({
  title,
  subtitle,
  centered = false,
  aside,
  titleClassName = "text-2xl",
}: {
  title: string;
  subtitle?: string;
  centered?: boolean;
  aside?: ReactNode;
  titleClassName?: string;
}) => (
  <div className={cn("px-1", centered && "text-center")}>
    <div className="flex items-center gap-3">
      <h1
        className={cn(
          "min-w-0 flex-1 font-bold leading-[1.15] tracking-tight text-slate-900",
          titleClassName
        )}
      >
        {title}
      </h1>
      {aside}
    </div>
    {/* Full width, under the aside too — beside it, the line would wrap early. */}
    {subtitle ? (
      <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{subtitle}</p>
    ) : null}
  </div>
);

/**
 * The flow's replacement for toasts: a message pinned where the user is
 * looking — above the action that failed, or beside the sheet's Done button.
 */
const InlineNotice = ({
  tone,
  message,
  onDismiss,
}: {
  tone: "info" | "error";
  message: string;
  onDismiss: () => void;
}) => {
  const error = tone === "error";
  const Icon = error ? CircleAlert : Info;
  return (
    <div
      role={error ? "alert" : "status"}
      className={cn(
        "mb-2.5 flex items-start gap-2 rounded-lg border py-2 pl-3 pr-1.5",
        error ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
      )}
    >
      <Icon className={cn("mt-px h-4 w-4 shrink-0", error ? "text-red-600" : "text-amber-600")} />
      <p
        className={cn(
          "min-w-0 flex-1 text-[13px] leading-snug",
          error ? "text-red-700" : "text-amber-900"
        )}
      >
        {message}
      </p>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className={cn(
          "-my-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition",
          error ? "text-red-400 active:bg-red-100" : "text-amber-500 active:bg-amber-100"
        )}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

const IconBadge = ({ icon: Icon, className }: { icon: LucideIcon; className: string }) => (
  <span
    className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", className)}
  >
    <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
  </span>
);

const Collapsible = ({
  icon,
  iconClassName,
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  icon: LucideIcon;
  iconClassName: string;
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) => (
  <section className={CARD}>
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="flex w-full items-center gap-3 rounded-xl p-3.5 text-left transition active:bg-slate-50"
    >
      <IconBadge icon={icon} className={iconClassName} />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold leading-snug text-slate-900">
          {title}
        </span>
        <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">{subtitle}</span>
      </span>
      <ChevronDown
        className={cn(
          "h-[18px] w-[18px] shrink-0 self-start text-slate-400 transition-transform",
          open && "rotate-180"
        )}
      />
    </button>
    {open ? <div className="px-3.5 pb-3.5">{children}</div> : null}
  </section>
);

const TAB_BAR_SELECTOR = 'nav[aria-label="Dashboard sections"]';

/** Height of the dashboard's bottom tab bar (safe-area padding included). */
const useTabBarHeight = () => {
  const [height, setHeight] = useState(0);
  useIsomorphicLayoutEffect(() => {
    const nav = document.querySelector<HTMLElement>(TAB_BAR_SELECTOR);
    if (!nav || typeof ResizeObserver === "undefined") return;
    const update = () => setHeight(nav.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(nav);
    return () => observer.disconnect();
  }, []);
  return height;
};

/**
 * The step's main action, pinned just above the tab bar so it is never
 * scrolled away from — a long keyword list would otherwise push it a screen
 * down. The page can't use `sticky` here (the dashboard's <main> is an
 * overflow container that never scrolls itself), so this is fixed, and it
 * leaves a spacer of its own height in the flow so the last card clears it.
 */
const ActionBar = ({ children }: { children: ReactNode }) => {
  const tabBarHeight = useTabBarHeight();
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(76);

  useIsomorphicLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    const update = () => setBarHeight(bar.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div aria-hidden style={{ height: barHeight }} />
      <div
        ref={barRef}
        className={cn(
          "fixed inset-x-0 z-30 border-t border-slate-200/80 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85",
          // Without a tab bar underneath, the bar meets the home indicator.
          !tabBarHeight && "pb-safe"
        )}
        style={{ bottom: tabBarHeight }}
      >
        <div className="mx-auto w-full max-w-xl px-4 py-3">{children}</div>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// Stepper
// ---------------------------------------------------------------------------

const STEP_INDEX: Record<FlowStep, number> = {
  details: 0,
  scan: 1,
  results: 2,
  keywords: 3,
  optimizing: 3,
  optimized: 3,
};

const Stepper = ({
  step,
  hasResult,
  canJump,
  onJump,
}: {
  step: FlowStep;
  hasResult: boolean;
  canJump: (index: number) => boolean;
  onJump: (index: number) => void;
}) => {
  const activeIndex = STEP_INDEX[step];
  // The last step is named for what is happening in it.
  const lastLabel =
    step === "optimized"
      ? "Optimized"
      : step === "keywords" || step === "optimizing"
        ? "Optimize"
        : "Optimized CV";
  const labels = ["Job Details", "Scan", "Results", lastLabel];
  // Back on the details with a scan in hand, the scan and its results stay
  // ticked — they still exist, and Results is one tap away.
  const isDone = (index: number) =>
    index < activeIndex || (step === "details" && hasResult && index > 0 && index < 3);

  const connectorClass = (index: number) => {
    if (isDone(index + 1) || index + 1 === activeIndex) return "bg-[#6A53FD]";
    // Filling in the details: the first leg is under way.
    if (step === "details" && !hasResult && index === 0) {
      return "bg-[linear-gradient(90deg,#6A53FD_50%,#CBC3FD_50%)]";
    }
    return "bg-[#E3E7EF]";
  };

  return (
    <nav aria-label="Scan progress">
      <ol className="grid grid-cols-4">
        {labels.map((label, index) => {
          const done = isDone(index);
          const active = index === activeIndex;
          const content = (
            <>
              <span
                className={cn(
                  "relative z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full transition-colors",
                  done || active ? "bg-[#6A53FD]" : "bg-[#DFE4EE]"
                )}
              >
                {done ? <Check className="h-3 w-3 text-white" strokeWidth={3.25} /> : null}
              </span>
              <span
                className={cn(
                  "mt-2.5 whitespace-nowrap text-[11px] leading-none xs:text-xs",
                  active ? "font-medium text-slate-900" : "text-slate-500"
                )}
              >
                {label}
              </span>
            </>
          );
          return (
            <li
              key={index}
              aria-current={active ? "step" : undefined}
              className="relative flex justify-center"
            >
              {index < labels.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-1/2 top-[7.5px] h-[3px] w-full rounded-full transition-colors",
                    connectorClass(index)
                  )}
                />
              ) : null}
              {canJump(index) ? (
                <button
                  type="button"
                  onClick={() => onJump(index)}
                  aria-label={`Go to ${label}`}
                  className="-mt-1 flex flex-col items-center rounded-lg px-1.5 pb-1.5 pt-1 transition active:bg-slate-200/60"
                >
                  {content}
                </button>
              ) : (
                <div className="-mt-1 flex flex-col items-center px-1.5 pb-1.5 pt-1">{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

// ---------------------------------------------------------------------------
// Progress (Scan / Optimizing)
// ---------------------------------------------------------------------------

const ActiveSpinner = () => (
  <svg
    viewBox="0 0 28 28"
    className="h-[26px] w-[26px] shrink-0 animate-spin [animation-duration:1.1s] motion-reduce:animate-none"
    aria-hidden
  >
    <circle
      cx="14"
      cy="14"
      r="11"
      fill="none"
      stroke="#DDD7FE"
      strokeWidth="3"
      strokeDasharray="1.5 4"
      strokeLinecap="round"
    />
    <circle
      cx="14"
      cy="14"
      r="11"
      fill="none"
      stroke="#6A53FD"
      strokeWidth="3"
      strokeLinecap="round"
      strokeDasharray="44 69.1"
    />
  </svg>
);

const ProgressList = ({
  stages,
  index,
  elapsed,
}: {
  stages: Stage[];
  index: number;
  elapsed: (stage: number) => number | null;
}) => (
  <div className={cn(CARD, "px-3.5 py-1.5")}>
    {/* One line for screen readers instead of a list that re-reads itself. */}
    <p role="status" className="sr-only">
      {index < stages.length
        ? `Step ${index + 1} of ${stages.length}: ${stages[index].title}`
        : "Done"}
    </p>
    <ol aria-hidden>
      {stages.map((stage, position) => {
        const status =
          position < index ? "done" : position === index ? "active" : "pending";
        const ms = elapsed(position);
        return (
          <li key={stage.title} className="flex items-center gap-3.5 py-2">
            {status === "done" ? (
              <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="h-3.5 w-3.5" strokeWidth={3.25} />
              </span>
            ) : status === "active" ? (
              <ActiveSpinner />
            ) : (
              <span className="h-[26px] w-[26px] shrink-0 rounded-full border-[2.5px] border-slate-300" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug text-slate-900">{stage.title}</p>
              <p className="mt-0.5 text-xs leading-snug text-slate-500">{stage.detail}</p>
            </div>
            {status === "done" && ms !== null ? (
              <span className="flex shrink-0 items-center gap-1 text-[13px] font-medium tabular-nums text-emerald-600">
                <Check className="h-3.5 w-3.5" strokeWidth={2.75} />
                {formatSeconds(ms, true)}
              </span>
            ) : status === "active" && ms !== null ? (
              <span className="shrink-0 text-[13px] tabular-nums text-slate-400">
                {formatSeconds(ms, false)}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  </div>
);

const usePrefersReducedMotion = () =>
  useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true
  );

const DocumentShape = () => (
  <>
    <path
      d="M31 13h38l19 19v67a6 6 0 0 1-6 6H31a6 6 0 0 1-6-6V19a6 6 0 0 1 6-6z"
      fill="#fff"
      stroke="#D9D5FC"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <path
      d="M69 13v13a6 6 0 0 0 6 6h13"
      fill="#F3F1FF"
      stroke="#D9D5FC"
      strokeWidth="2.5"
      strokeLinejoin="round"
    />
    <rect x="35" y="33" width="24" height="5" rx="2.5" fill="#CFCAFB" />
    <rect x="35" y="46" width="41" height="5" rx="2.5" fill="#CFCAFB" />
    <rect x="35" y="59" width="24" height="5" rx="2.5" fill="#CFCAFB" />
    <rect x="35" y="72" width="30" height="5" rx="2.5" fill="#CFCAFB" />
    <rect x="35" y="85" width="24" height="5" rx="2.5" fill="#CFCAFB" />
  </>
);

const Illustration = ({ kind }: { kind: "scan" | "optimize" }) => {
  const reducedMotion = usePrefersReducedMotion();
  return (
    <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-full bg-[#F2F1FF]">
      <svg viewBox="0 0 120 120" className="ml-2 h-[118px] w-[118px]" aria-hidden>
        <DocumentShape />
        {kind === "scan" ? (
          <g>
            <circle cx="80" cy="80" r="15" fill="#fff" fillOpacity="0.9" stroke="#3D2BB5" strokeWidth="5.5" />
            <path d="M91 91l11 11" stroke="#3D2BB5" strokeWidth="7" strokeLinecap="round" />
            {reducedMotion ? null : (
              <animateTransform
                attributeName="transform"
                type="translate"
                values="0 0; -7 -9; -2 -18; 3 -8; 0 0"
                dur="3.6s"
                repeatCount="indefinite"
              />
            )}
          </g>
        ) : (
          <g>
            <g transform="rotate(40 84 78)">
              <rect x="79" y="52" width="11" height="36" rx="3" fill="#3D2BB5" />
              <rect x="79" y="52" width="11" height="8" rx="3" fill="#6A53FD" />
              <path d="M79 88h11l-5.5 11z" fill="#3D2BB5" />
            </g>
            {[
              { x: 22, y: 30, s: 1 },
              { x: 98, y: 22, s: 0.8 },
              { x: 100, y: 102, s: 0.7 },
            ].map((spark, i) => (
              <path
                key={i}
                transform={`translate(${spark.x} ${spark.y}) scale(${spark.s})`}
                d="M0-7 1.8-1.8 7 0 1.8 1.8 0 7-1.8 1.8-7 0-1.8-1.8z"
                fill="#6A53FD"
              >
                {reducedMotion ? null : (
                  <animate
                    attributeName="opacity"
                    values="1;0.25;1"
                    dur="1.8s"
                    begin={`${i * 0.6}s`}
                    repeatCount="indefinite"
                  />
                )}
              </path>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scores
// ---------------------------------------------------------------------------

const ScoreRing = ({ score, className }: { score: number; className: string }) => {
  // Starts empty and sweeps to the score once it is on screen.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setShown(score));
    return () => window.cancelAnimationFrame(id);
  }, [score]);
  const circumference = 2 * Math.PI * 52;
  const percent = Math.max(0, Math.min(100, shown));
  return (
    <div className={cn("relative h-[112px] w-[112px]", className)}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r="52" fill="none" stroke="#E6E9F1" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          className="transition-[stroke-dashoffset] duration-700 ease-out motion-reduce:transition-none"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[40px] font-bold leading-none tracking-tight tabular-nums">
          {score}
        </span>
        <span className="mt-1.5 text-xs font-medium text-slate-500">out of 100</span>
      </div>
    </div>
  );
};

const BreakdownRows = ({
  components,
  breakdown,
}: {
  components: readonly ScoreComponent[];
  breakdown: ScoreBreakdown;
}) => (
  <div className="space-y-3">
    {components.map((component) => {
      const value = Math.round(Number(breakdown[component.key] ?? 0));
      const contribution = Math.round((value * component.weight) / 100);
      return (
        <div key={component.key}>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-1.5 text-slate-600">
              {component.label}
              <span
                className={cn(
                  "rounded px-1 py-0.5 text-[10px] font-semibold",
                  component.keywordDriven
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-slate-100 text-slate-500"
                )}
              >
                {component.weight}%
              </span>
            </span>
            <span className="font-medium tabular-nums text-slate-700">+{contribution}</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn(
                "h-full rounded-full",
                component.keywordDriven ? "bg-emerald-500" : "bg-slate-400"
              )}
              style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
            />
          </div>
        </div>
      );
    })}
    <p className="border-t border-slate-100 pt-3 text-xs leading-relaxed text-slate-500">
      Only the <span className="font-semibold text-emerald-600">keyword-driven</span> rows
      move when you add keywords. The rest reflect your real experience, titles and
      quantified results.
    </p>
  </div>
);

const ScoreBadge = ({
  initialScore,
  finalScore,
  computing,
  expanded,
  onToggle,
}: {
  initialScore: number | null;
  finalScore: number | null;
  computing: boolean;
  expanded: boolean;
  onToggle: () => void;
}) => {
  if (computing) {
    return (
      <span className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-slate-100 px-3 py-2.5 text-xs font-medium text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Scoring…
      </span>
    );
  }
  if (finalScore === null) return null;
  const delta = initialScore === null ? null : finalScore - initialScore;
  const up = (delta ?? 0) >= 0;
  const Trend = up ? TrendingUp : TrendingDown;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={`Score ${initialScore ?? ""} to ${finalScore}. Show breakdown`}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-2xl border px-2 py-1.5 text-left transition active:scale-[0.98] motion-reduce:active:scale-100",
        up ? "border-emerald-100 bg-emerald-50" : "border-rose-100 bg-rose-50"
      )}
    >
      <Trend className={cn("h-4 w-4", up ? "text-emerald-600" : "text-rose-600")} />
      <span className="flex flex-col">
        <span
          className={cn(
            "text-[11px] font-medium leading-none",
            up ? "text-emerald-700" : "text-rose-700"
          )}
        >
          Score
        </span>
        <span className="mt-1 flex items-center gap-1">
          <span
            className={cn(
              "whitespace-nowrap text-[15px] font-bold leading-none tabular-nums",
              up ? "text-emerald-800" : "text-rose-800"
            )}
          >
            {initialScore ?? "—"} → {finalScore}
          </span>
          {delta !== null ? (
            <span
              className={cn(
                "rounded-md px-1 py-[3px] text-[10px] font-bold leading-none tabular-nums text-white",
                up ? "bg-emerald-500" : "bg-rose-500"
              )}
            >
              {delta >= 0 ? `+${delta}` : delta}
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
};

// ---------------------------------------------------------------------------
// Keywords
// ---------------------------------------------------------------------------

const KeywordListCard = ({
  tone,
  title,
  keywords,
  emptyText,
}: {
  tone: "matched" | "missing";
  title: string;
  keywords: string[];
  emptyText: string;
}) => {
  const matched = tone === "matched";
  return (
    <section className={cn(CARD, "p-3.5")}>
      <div className="flex items-center gap-3">
        <IconBadge
          icon={matched ? CheckCircle2 : XCircle}
          className={matched ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}
        />
        <h2 className="min-w-0 flex-1 text-[15px] font-semibold text-slate-900">{title}</h2>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[13px] font-semibold tabular-nums",
            matched ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"
          )}
        >
          {keywords.length}
        </span>
      </div>
      {keywords.length ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {keywords.map((keyword) => (
            <li
              key={keyword}
              className={cn(
                "break-anywhere rounded-full border px-2.5 py-[3px] text-xs font-medium",
                matched
                  ? "border-emerald-200 bg-emerald-50/70 text-emerald-700"
                  : "border-rose-200 bg-rose-50/70 text-rose-600"
              )}
            >
              {keyword}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">{emptyText}</p>
      )}
    </section>
  );
};

const SelectableChip = ({
  keyword,
  selected,
  onToggle,
}: {
  keyword: string;
  selected: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={selected}
    className={cn(
      "inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 text-left text-xs font-medium transition active:scale-[0.97] motion-reduce:active:scale-100",
      selected
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-slate-200 bg-white text-slate-600"
    )}
  >
    <span
      className={cn(
        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full transition",
        selected ? "bg-emerald-500 text-white" : "border-2 border-slate-300 bg-white text-transparent"
      )}
    >
      <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
    </span>
    <span className="break-anywhere">{keyword}</span>
  </button>
);

// ---------------------------------------------------------------------------
// Optimized step pieces
// ---------------------------------------------------------------------------

// The default template first, so the one already applied is the first card.
const TEMPLATE_ORDER = [
  ...RESUME_TEMPLATE_CONFIGS.filter((template) => template.group === "modern"),
  ...RESUME_TEMPLATE_CONFIGS.filter((template) => template.group !== "modern"),
];

// One line under each card in the template sheet. The configs' own
// descriptions are written for the desktop designer and run to a paragraph.
const TEMPLATE_TAGLINES: Partial<Record<ResumeTemplateId, string>> = {
  "classic-blue": "Clean and professional. Great for most roles.",
  "bold-modern": "Bold and high-contrast. Your name stands out.",
  "analyst-photo": "Structured, with room for a photo.",
  "minimal-slate": "Simple and text-only. Safest for strict ATS.",
  "executive-serif": "Refined serif. Suited to senior roles.",
  "us-standard": "Letter size, no photo. The US convention.",
  "uk-cv": "A4 with references. The UK convention.",
  australian: "Work rights up front. The Australian convention.",
  europass: "The standard European CV format.",
  "middle-east": "Photo and personal details. The Gulf convention.",
};

// The PDF prints on A4 (Letter for the US template) with 18mm × 12mm margins
// (app/api/generate-pdf), which leaves a 703 × 987px content box at 96dpi, or
// 725 × 920px on Letter. The preview lays the resume out at exactly that width,
// so its line breaks are the download's, then scales the page to fit the
// screen — a document, not a web page reflowed to phone width.
const PAGE_BOX = {
  a4: { width: 703, height: 987 },
  letter: { width: 725, height: 920 },
} as const;

const ZOOM_STEPS = [1, 1.25, 1.5, 1.75, 2, 2.5];

const DocumentPreview = ({
  html,
  page,
  zoom,
  inset = 0,
  tourId,
}: {
  html: string;
  page: keyof typeof PAGE_BOX;
  /** 1 fits the page to the screen width. */
  zoom: number;
  /** White space around content that brings none of its own (the letter). */
  inset?: number;
  tourId?: string;
}) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(0);

  useIsomorphicLayoutEffect(() => {
    const frame = frameRef.current;
    const sheet = sheetRef.current;
    if (!frame || !sheet || typeof ResizeObserver === "undefined") return;
    // offsetHeight is the laid-out height, before the scale transform.
    const update = () => {
      setFrameWidth(frame.clientWidth);
      setSheetHeight(sheet.offsetHeight);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    observer.observe(sheet);
    return () => observer.disconnect();
  }, []);

  const box = PAGE_BOX[page];
  const width = box.width + inset * 2;
  const scale = frameWidth ? (frameWidth / width) * zoom : 0;

  return (
    <section
      data-tour={tourId}
      className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),0_12px_28px_-16px_rgba(15,23,42,0.25)]"
    >
      {/* Zoomed past the width of the screen, the page pans sideways. */}
      <div ref={frameRef} className="touch-scroll overflow-x-auto overflow-y-hidden">
        <div className="relative" style={{ width: width * scale, height: sheetHeight * scale }}>
          <div
            ref={sheetRef}
            className="absolute left-0 top-0 origin-top-left bg-white"
            style={{
              width,
              // Never shorter than a page, so a one-page resume reads as one.
              minHeight: box.height + inset * 2,
              padding: inset,
              transform: `scale(${scale})`,
              visibility: scale ? "visible" : "hidden",
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </section>
  );
};

/** Pull the sheet down by its header to dismiss it, as on a native sheet. */
const useSheetDrag = (onDismiss: () => void) => {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<number | null>(null);
  const offsetRef = useRef(0);

  const end = () => {
    if (startRef.current === null) return;
    startRef.current = null;
    setDragging(false);
    if (offsetRef.current > 110) onDismiss();
    offsetRef.current = 0;
    setOffset(0);
  };

  return {
    handlers: {
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        // The header's own buttons (back, close) keep working as buttons.
        if ((event.target as HTMLElement).closest("button")) return;
        startRef.current = event.clientY;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
      },
      onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
        if (startRef.current === null) return;
        offsetRef.current = Math.max(0, event.clientY - startRef.current);
        setOffset(offsetRef.current);
      },
      onPointerUp: end,
      onPointerCancel: end,
    },
    style: {
      transform: offset ? `translateY(${offset}px)` : undefined,
      transition: dragging ? "none" : "transform 200ms ease-out",
    },
  };
};

const BottomSheet = ({
  open,
  onOpenChange,
  title,
  description,
  onBack,
  footer,
  bodyClassName,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Shown as a back arrow when the sheet has drilled into a sub-view. */
  onBack?: () => void;
  footer?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
}) => {
  const drag = useSheetDrag(() => onOpenChange(false));
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-slate-900/45 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          // Focusing the first control would flash a focus ring on open (and
          // on a text field, pop the keyboard). The sheet itself takes focus.
          onOpenAutoFocus={(event) => event.preventDefault()}
          style={drag.style}
          className="fixed inset-x-0 bottom-0 z-[70] mx-auto flex max-h-[88dvh] w-full max-w-xl flex-col rounded-t-[28px] bg-white shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom data-[state=closed]:duration-200 data-[state=open]:duration-300"
        >
          <div {...drag.handlers} className="shrink-0 touch-none select-none px-5 pb-4 pt-2.5">
            <div aria-hidden className="mx-auto h-1.5 w-10 rounded-full bg-slate-200" />
            <div className="mt-3 flex items-start gap-1">
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  aria-label="Back"
                  className="-ml-2.5 mt-px flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-700 transition active:bg-slate-100"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              ) : null}
              <div className="min-w-0 flex-1">
                <Dialog.Title className="text-[22px] font-bold leading-tight tracking-tight text-slate-900">
                  {title}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm leading-snug text-slate-500">
                  {description}
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="Close"
                className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition active:bg-slate-100"
              >
                <X className="h-6 w-6" strokeWidth={1.75} />
              </Dialog.Close>
            </div>
          </div>
          <div
            className={cn(
              "touch-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]",
              footer && "pb-5",
              bodyClassName
            )}
          >
            {children}
          </div>
          {footer ? (
            <div className="shrink-0 border-t border-slate-100 bg-white px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

// The rows of the "Edit your resume" sheet, each opening that one section.
const EDITOR_SECTIONS: {
  key: ResumeEditorSection;
  title: string;
  detail: string;
  icon: LucideIcon;
}[] = [
  { key: "contact", title: "Contact information", detail: "Name, email, phone, location, links", icon: UserRound },
  { key: "summary", title: "Professional summary", detail: "Edit or generate your summary", icon: NotepadText },
  { key: "experience", title: "Work experience", detail: "Add or edit your work experience", icon: BriefcaseBusiness },
  { key: "education", title: "Education", detail: "Add or edit your education details", icon: GraduationCap },
  { key: "skills", title: "Skills", detail: "Manage your skills and keywords", icon: Sparkles },
  { key: "projects", title: "Projects", detail: "Add or edit your projects", icon: Folder },
  { key: "certifications", title: "Certifications", detail: "Add or edit your certifications", icon: Award },
  { key: "languages", title: "Languages", detail: "Add languages you speak or write", icon: Globe },
  { key: "additional", title: "More sections", detail: "Awards, publications, volunteering and more", icon: Layers },
];

const ToolbarButton = ({
  icon: Icon,
  label,
  shortLabel,
  onClick,
  tourId,
  expanded,
}: {
  icon: LucideIcon;
  label: string;
  /** For the narrowest phones, where three controls share one row. */
  shortLabel?: string;
  onClick: () => void;
  tourId: string;
  expanded: boolean;
}) => (
  <button
    type="button"
    data-tour={tourId}
    aria-haspopup="dialog"
    aria-expanded={expanded}
    onClick={onClick}
    className="flex h-10 min-w-0 items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-2.5 text-[13px] font-medium text-slate-900 shadow-sm transition active:bg-slate-50"
  >
    <Icon className="h-4 w-4 shrink-0 text-slate-700" strokeWidth={2} />
    {shortLabel ? (
      <>
        <span className="truncate min-[370px]:hidden">{shortLabel}</span>
        <span className="hidden truncate min-[370px]:inline">{label}</span>
      </>
    ) : (
      <span className="truncate">{label}</span>
    )}
    <ChevronDown className="hidden h-3.5 w-3.5 shrink-0 text-slate-400 min-[420px]:block" />
  </button>
);

const ZoomControl = ({
  zoom,
  onZoomChange,
}: {
  zoom: number;
  onZoomChange: (zoom: number) => void;
}) => {
  const index = ZOOM_STEPS.indexOf(zoom);
  const stepButton =
    "flex h-8 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition active:bg-slate-100 disabled:opacity-40";
  return (
    <div className="ml-auto flex h-10 shrink-0 items-center gap-0.5 rounded-xl border border-slate-200/80 bg-white p-1 shadow-sm">
      <button
        type="button"
        aria-label="Zoom out"
        disabled={index <= 0}
        onClick={() => onZoomChange(ZOOM_STEPS[Math.max(0, index - 1)])}
        className={stepButton}
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-[38px] text-center text-xs tabular-nums text-slate-600">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        aria-label="Zoom in"
        disabled={index >= ZOOM_STEPS.length - 1}
        onClick={() => onZoomChange(ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, index + 1)])}
        className={stepButton}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
};

const TemplateGrid = ({
  selected,
  onSelect,
}: {
  selected: ResumeTemplateId;
  onSelect: (id: ResumeTemplateId) => void;
}) => (
  <div className="grid grid-cols-2 gap-x-3 gap-y-5">
    {TEMPLATE_ORDER.map((template) => {
      const active = template.id === selected;
      return (
        <button
          key={template.id}
          type="button"
          onClick={() => onSelect(template.id)}
          aria-pressed={active}
          className="min-w-0 text-center"
        >
          <span
            className={cn(
              "relative block overflow-hidden rounded-xl border-2 bg-white transition",
              active
                ? "border-[#6A53FD] shadow-[0_0_0_4px_rgba(106,83,253,0.12)]"
                : "border-slate-200"
            )}
          >
            {/* A squarer crop than the thumbnail's own: the top of the page is
                what tells templates apart. */}
            <span className="block aspect-[5/6] overflow-hidden">
              <TemplateThumbnail templateId={template.id} />
            </span>
            {active ? (
              <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#6A53FD] text-white shadow-md">
                <Check className="h-4 w-4" strokeWidth={3} />
              </span>
            ) : null}
          </span>
          <span className="mt-2.5 block text-[15px] font-semibold leading-snug text-slate-900">
            {template.label}
          </span>
          <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">
            {TEMPLATE_TAGLINES[template.id] || template.description}
          </span>
        </button>
      );
    })}
  </div>
);

const DownloadButton = ({
  view,
  allowsCoverLetter,
  downloadingType,
  downloaded,
  disabled,
  onDownload,
}: {
  view: "resume" | "cover";
  allowsCoverLetter: boolean;
  downloadingType: DocType | null;
  downloaded: Record<DocType, boolean>;
  disabled: boolean;
  onDownload: (type: DocType) => void;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const primary: DocType = allowsCoverLetter && view === "cover" ? "cover" : "cv";
  const busy = downloadingType !== null;

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const menuItems: { type: DocType; label: string; icon: LucideIcon }[] = [
    { type: "cv", label: "Tailored CV", icon: FileText },
    { type: "cover", label: "Cover letter", icon: NotepadText },
  ];

  return (
    <div
      ref={rootRef}
      data-tour="preview-download"
      className={cn(
        "relative flex h-12 min-w-0 rounded-xl bg-primary text-primary-foreground shadow-sm",
        disabled && "opacity-60"
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDownload(primary)}
        className={cn(
          "flex min-w-0 flex-1 items-center justify-center gap-2 px-3 text-[15px] font-medium",
          allowsCoverLetter ? "rounded-l-xl" : "rounded-xl"
        )}
      >
        {busy ? (
          <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
        ) : (
          <Download className="h-5 w-5 shrink-0" />
        )}
        <span className="truncate">
          {busy ? "Preparing…" : primary === "cover" ? "Download letter" : "Download CV"}
        </span>
      </button>
      {allowsCoverLetter ? (
        <button
          type="button"
          disabled={disabled}
          aria-label="Choose a document to download"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex w-10 shrink-0 items-center justify-center rounded-r-xl border-l border-white/[0.08]"
        >
          <ChevronDown
            className={cn("h-5 w-5 transition-transform", menuOpen && "rotate-180")}
          />
        </button>
      ) : null}
      {menuOpen ? (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-10 mb-2 w-[min(17rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-1.5 text-slate-900 shadow-xl"
        >
          {menuItems.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                onDownload(type);
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-[15px] transition active:bg-slate-100"
            >
              <Icon className="h-5 w-5 text-slate-500" />
              <span className="flex-1">{label}</span>
              {downloaded[type] ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.75} /> Saved
                </span>
              ) : (
                <span className="text-xs font-medium text-slate-400">PDF</span>
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

// "12 Sep 2025". Fixed month names, so it reads the same in every locale
// (and en-GB's "Sept" never creeps in).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const formatUpdatedOn = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
};

const BaseResumeOption = ({
  record,
  selected,
  onSelect,
}: {
  record: BaseResumeRecord;
  selected: boolean;
  onSelect: () => void;
}) => {
  const updated = formatUpdatedOn(record.updatedAt);
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
          selected
            ? "border-[#8B7FF9] bg-[#F7F5FF]"
            : "border-slate-200/80 bg-white active:bg-slate-50"
        )}
      >
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            !selected && "bg-slate-100/80"
          )}
        >
          <FileText className="h-5 w-5 text-slate-800" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium leading-snug text-slate-900">
            {record.name}
          </span>
          {updated ? (
            <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">
              Last updated on {updated}
            </span>
          ) : null}
        </span>
        {selected ? (
          <span
            aria-hidden
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5B45E6] text-white"
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        ) : (
          <span aria-hidden className="h-6 w-6 shrink-0 rounded-full border-2 border-slate-300" />
        )}
      </button>
    </li>
  );
};

const SECONDARY_BUTTON =
  "flex h-12 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 text-[15px] font-medium text-slate-900 shadow-sm transition active:bg-slate-50";

// ---------------------------------------------------------------------------
// The flow
// ---------------------------------------------------------------------------

export const MobileScanFlow = ({
  form,
  formErrors,
  onFieldChange,
  onAnalyze,
  isAnalyzing,
  onReset,
  baseResumes,
  baseResumeLoading,
  selectedBaseResumeId,
  onSelectBaseResume,
  onManageBaseResumes,
  result,
  scoreComponents,
  remoteJob,
  allowsCoverLetter,
  optimizeWait,
  onOptimize,
  isGeneratingDocs,
  alert,
  onDismissAlert,
  keywordPicker,
  preview,
}: MobileScanFlowProps) => {
  const { activeStepId: tourStepId } = useProductTour();

  // Revisiting the job details with a scan already in hand. Everything else
  // about which step is on screen is read off the host's state.
  const [editingDetails, setEditingDetails] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [editorSheetOpen, setEditorSheetOpen] = useState(false);
  // The section the editor sheet has drilled into; null shows the list.
  const [editorSection, setEditorSection] = useState<ResumeEditorSection | null>(null);
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);
  const [baseSheetOpen, setBaseSheetOpen] = useState(false);
  // A message from the editor's Rephrase / Generate buttons.
  const [editorNotice, setEditorNotice] = useState<{
    tone: "info" | "error";
    message: string;
  } | null>(null);
  const [designerOpen, setDesignerOpen] = useState(false);
  const [finalBreakdownOpen, setFinalBreakdownOpen] = useState(false);
  // 1 fits the page to the screen; shared by the resume and the letter.
  const [docZoom, setDocZoom] = useState(1);

  const scanRun = useStagedRun(isAnalyzing, result, SCAN_STAGES.length, SCAN_SCHEDULE);
  const optimizeStages = allowsCoverLetter ? OPTIMIZE_STAGES_WITH_LETTER : OPTIMIZE_STAGES;
  const optimizeRun = useStagedRun(
    isGeneratingDocs,
    preview.docs,
    optimizeStages.length,
    allowsCoverLetter ? OPTIMIZE_SCHEDULE_WITH_LETTER : OPTIMIZE_SCHEDULE
  );

  const previewReady = preview.open && preview.docs !== null;
  // The host keeps working after the documents arrive (it re-scores them), so
  // once they are here the optimized step takes over and shows "Scoring…".
  const step: FlowStep =
    optimizeRun.running || (isGeneratingDocs && !previewReady)
      ? "optimizing"
      : previewReady
        ? "optimized"
        : scanRun.running || isAnalyzing
          ? "scan"
          : keywordPicker.open && result
            ? "keywords"
            : result && !editingDetails
              ? "results"
              : "details";

  // A fresh scan result supersedes whatever was being revisited.
  useEffect(() => {
    setEditingDetails(false);
    setAnalysisOpen(false);
    setSuggestionsOpen(false);
  }, [result]);

  useEffect(() => {
    setEditorSheetOpen(false);
    setTemplateSheetOpen(false);
    setDesignerOpen(false);
    setDocZoom(1);
    setFinalBreakdownOpen(false);
  }, [preview.docs]);

  // Every step starts at its top, like a new screen.
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    window.scrollTo({ top: 0, behavior: "instant" });
    // A sheet belongs to the step it was opened on.
    setEditorSheetOpen(false);
    setTemplateSheetOpen(false);
    setBaseSheetOpen(false);
  }, [step]);

  // Tapping Next with gaps in the form: the button sits at the bottom of the
  // card, so bring the first field that needs attention into view. Only when
  // errors are added — not as they clear while the user fills them in.
  const errorCount = (["organization", "designation", "jd"] as const).filter(
    (field) => formErrors[field]
  ).length;
  const previousErrorCount = useRef(errorCount);
  useEffect(() => {
    const grew = errorCount > previousErrorCount.current;
    previousErrorCount.current = errorCount;
    if (!grew) return;
    const first = (["organization", "designation", "jd"] as const).find(
      (field) => formErrors[field]
    );
    document
      .getElementById(`mobile-scan-${first}`)
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [errorCount, formErrors]);

  // The first-run tour spotlights the Edit and Template buttons. A sheet is a
  // modal: open under the tour's overlay, it would leave the tour card
  // unclickable. So no sheet stays open, or opens, while a tour step is up.
  const tourShowing = tourStepId !== null;
  useEffect(() => {
    if (!tourShowing) return;
    setEditorSheetOpen(false);
    setTemplateSheetOpen(false);
    setBaseSheetOpen(false);
  }, [tourShowing]);
  const openEditorSheet = () => {
    if (tourShowing) return;
    setEditorSection(null);
    setEditorSheetOpen(true);
  };
  const openTemplateSheet = () => {
    if (tourShowing) return;
    setTemplateSheetOpen(true);
  };
  const openBaseSheet = () => {
    if (tourShowing) return;
    setBaseSheetOpen(true);
  };
  const manageBaseResumes = () => {
    setBaseSheetOpen(false);
    onManageBaseResumes();
  };
  // Picking in a sheet closes it a beat later, once the check has registered,
  // so the choice is on screen straight away.
  const sheetCloseTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (sheetCloseTimer.current) window.clearTimeout(sheetCloseTimer.current);
  }, []);
  const closeSoon = (close: () => void) => {
    if (sheetCloseTimer.current) window.clearTimeout(sheetCloseTimer.current);
    sheetCloseTimer.current = window.setTimeout(close, 220);
  };
  const chooseTemplate = (id: ResumeTemplateId) => {
    if (id !== preview.templateId) preview.onTemplateChange(id);
    closeSoon(() => setTemplateSheetOpen(false));
  };
  const chooseBaseResume = (record: BaseResumeRecord) => {
    if (record.id !== selectedBaseResumeId) onSelectBaseResume(record);
    closeSoon(() => setBaseSheetOpen(false));
  };

  // Leaving the optimized step goes through the host's download check; where
  // to land is applied once the preview has actually closed (the user may
  // back out of the check instead).
  const exitTargetRef = useRef<"details" | "results" | "new" | null>(null);
  const onResetRef = useRef(onReset);
  useEffect(() => {
    onResetRef.current = onReset;
  });
  useEffect(() => {
    if (preview.open) return;
    const target = exitTargetRef.current;
    exitTargetRef.current = null;
    if (target === "details") setEditingDetails(true);
    else if (target === "new") onResetRef.current();
  }, [preview.open]);

  const alertBanner = alert ? (
    <InlineNotice tone="error" message={alert} onDismiss={onDismissAlert} />
  ) : null;

  // Editor messages go stale once acted on ("write a few lines first"), so
  // they clear after a few seconds, and with the section they belonged to.
  useEffect(() => {
    if (!editorNotice) return;
    const id = window.setTimeout(() => setEditorNotice(null), 6000);
    return () => window.clearTimeout(id);
  }, [editorNotice]);
  useEffect(() => {
    setEditorNotice(null);
  }, [editorSection, editorSheetOpen]);
  const showEditorNotice = (tone: "info" | "error", message: string) =>
    setEditorNotice({ tone, message });

  const leavePreview = (target: "details" | "results" | "new") => {
    onDismissAlert();
    exitTargetRef.current = target;
    preview.onRequestExit(target === "new" ? "new" : "back");
  };

  const canJump = (index: number) => {
    switch (step) {
      case "details":
        return index === 2 && Boolean(result);
      case "results":
        return index === 0;
      case "keywords":
      case "optimized":
        return index === 0 || index === 2;
      default:
        return false;
    }
  };

  const jumpTo = (index: number) => {
    if (!canJump(index)) return;
    // An error belongs to the screen it was shown on.
    onDismissAlert();
    if (step === "optimized") {
      leavePreview(index === 0 ? "details" : "results");
      return;
    }
    if (step === "keywords") keywordPicker.onBack();
    setEditingDetails(index === 0);
  };

  const skills = keywordPicker.selectable.filter((keyword) => !isLanguageKeyword(keyword));
  const languages = keywordPicker.selectable.filter((keyword) => isLanguageKeyword(keyword));
  const selectedSet = new Set(keywordPicker.selected);

  // ---- Steps ---------------------------------------------------------------

  const renderDetails = () => {
    const currentBaseResume = baseResumes.find((record) => record.id === selectedBaseResumeId);
    const jdLength = form.jd.length;
    const overWindow = jdLength > JD_SCAN_WINDOW;
    const fieldError = (field: FormField, label: string) =>
      formErrors[field] ? `${label} is required.` : null;
    const errors = {
      organization: fieldError("organization", "Company"),
      designation: fieldError("designation", "Role"),
      jd: fieldError("jd", "Job description"),
    };

    return (
      <div className="space-y-6">
        <div className="space-y-4">
          {result ? (
            <button
              type="button"
              onClick={() => jumpTo(2)}
              className="-ml-1 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-medium text-slate-600 transition active:bg-slate-200/60"
            >
              <ArrowLeft className="h-4 w-4" /> Back to results
            </button>
          ) : null}
          <StepHeading
            title="Optimize your resume"
            subtitle="Provide the target role, paste the job description, and let SynCV evaluate your resume."
          />
        </div>

        <div data-tour="scan-form" className={cn(CARD, "space-y-4 p-4")}>
          {/* The resume this job is scanned against — the scan's first input,
              so it leads the form. Tapping it opens the picker sheet. */}
          {baseResumeLoading ? (
            <div className={cn(RESUME_FIELD, "text-slate-500")}>
              <Loader2 className="h-[22px] w-[22px] shrink-0 animate-spin" />
              <span className="text-sm">Loading your base resume…</span>
            </div>
          ) : baseResumes.length === 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div className="min-w-0 text-sm text-amber-900">
                <p className="font-semibold">No base resume yet</p>
                <p className="mt-0.5 leading-relaxed">
                  Set up your base resume first — every scan is tailored from it.
                </p>
                <button
                  type="button"
                  onClick={onManageBaseResumes}
                  className="mt-3 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
                >
                  Set up base resume
                </button>
              </div>
            </div>
          ) : currentBaseResume ? (
            <button
              type="button"
              onClick={openBaseSheet}
              aria-haspopup="dialog"
              aria-expanded={baseSheetOpen}
              className={cn(RESUME_FIELD, "text-left transition active:bg-[#EFEBFF]")}
            >
              <FileText className="h-[22px] w-[22px] shrink-0 text-slate-800" strokeWidth={1.8} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] leading-snug text-slate-500">
                  Resume to tailor
                </span>
                <span className="mt-0.5 block truncate text-base font-semibold leading-snug text-slate-900">
                  {currentBaseResume.name}
                </span>
              </span>
              <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" />
            </button>
          ) : null}

          {(
            [
              {
                field: "organization",
                label: "Company",
                placeholder: "Acme Corp",
                autoComplete: "organization",
              },
              {
                field: "designation",
                label: "Role / designation",
                placeholder: "Senior Frontend Engineer",
                autoComplete: "organization-title",
              },
            ] as const
          ).map(({ field, label, placeholder, autoComplete }) => (
            <div key={field} className="space-y-2">
              <label
                htmlFor={`mobile-scan-${field}`}
                className="block text-sm font-medium text-slate-800"
              >
                {label} <span className="text-red-500">*</span>
              </label>
              <input
                id={`mobile-scan-${field}`}
                value={form[field]}
                onChange={(event) => onFieldChange(field, event.target.value)}
                placeholder={placeholder}
                autoComplete={autoComplete}
                aria-invalid={Boolean(errors[field])}
                className={cn(fieldClass(Boolean(errors[field])), "h-11")}
              />
              {errors[field] ? <p className="text-sm text-red-600">{errors[field]}</p> : null}
            </div>
          ))}

          <div className="space-y-2">
            <label
              htmlFor="mobile-scan-jd"
              className="block text-sm font-medium text-slate-800"
            >
              Job description <span className="text-red-500">*</span>
            </label>
            <textarea
              id="mobile-scan-jd"
              value={form.jd}
              onChange={(event) => onFieldChange("jd", event.target.value)}
              placeholder="Paste the key responsibilities, required skills, etc."
              aria-invalid={Boolean(errors.jd)}
              aria-describedby="mobile-scan-jd-count"
              rows={8}
              className={cn(
                fieldClass(Boolean(errors.jd)),
                "min-h-[200px] resize-y py-2.5 leading-relaxed"
              )}
            />
            {errors.jd ? <p className="text-sm text-red-600">{errors.jd}</p> : null}
            <p
              id="mobile-scan-jd-count"
              className={cn("text-[13px] tabular-nums", overWindow ? "text-amber-600" : "text-slate-400")}
            >
              {jdLength} / {JD_SCAN_WINDOW} characters
              {overWindow ? " · only the first 6000 are scanned" : ""}
            </p>
          </div>
        </div>

        {/* Pinned like every other step's action — a long job description
            would otherwise push it a screen or more below the fold. */}
        <ActionBar>
          {alertBanner}
          <button
            type="button"
            onClick={onAnalyze}
            disabled={baseResumeLoading || isAnalyzing}
            className={PRIMARY_BUTTON}
          >
            Next <ArrowRight className="h-5 w-5" />
          </button>
        </ActionBar>

        <BottomSheet
          open={baseSheetOpen}
          onOpenChange={setBaseSheetOpen}
          title="Select a base resume"
          description="Choose the resume you want to use for this scan."
        >
          <ul className="space-y-2.5">
            {baseResumes.map((record) => (
              <BaseResumeOption
                key={record.id}
                record={record}
                selected={record.id === selectedBaseResumeId}
                onSelect={() => chooseBaseResume(record)}
              />
            ))}
          </ul>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={manageBaseResumes}
              className={cn(SECONDARY_BUTTON, "w-full")}
            >
              <Files className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />
              Manage Resumes
            </button>
          </div>
        </BottomSheet>
      </div>
    );
  };

  const renderProgress = (kind: "scan" | "optimize") => {
    const isScan = kind === "scan";
    const run = isScan ? scanRun : optimizeRun;
    return (
      <div className="space-y-6">
        <StepHeading
          centered
          title={isScan ? "Analyzing your resume..." : "Optimizing your resume..."}
          subtitle={
            isScan
              ? "We’re comparing your resume with the job description and extracting key insights."
              : allowsCoverLetter
                ? "We’re tailoring your resume and drafting your cover letter. This can take a minute or two."
                : "We’re tailoring your resume to this job. This can take a minute or two."
          }
        />
        <Illustration kind={kind} />
        <ProgressList
          stages={isScan ? SCAN_STAGES : optimizeStages}
          index={run.index}
          elapsed={run.elapsed}
        />
      </div>
    );
  };

  const renderResults = () => {
    if (!result) return null;
    const tone = scoreToneFor(result.initialScore);
    const ToneIcon = tone.icon;
    const breakdown = result.scoreBreakdown;
    const sections = Object.entries(result.sectionAnalysis?.foundSections || {});
    const suggestions = result.suggestions || [];

    return (
      <div data-tour="scan-summary" className="space-y-4">
        <section className={cn(CARD, "flex gap-3.5 p-3.5")}>
          <div className="flex shrink-0 flex-col items-center">
            <ScoreRing score={result.initialScore} className={tone.text} />
            <span
              className={cn(
                "mt-2.5 whitespace-nowrap rounded-full px-3.5 py-1 text-[13px] font-semibold",
                tone.pill
              )}
            >
              {tone.label}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold leading-snug text-slate-900">
              Your resume score
            </h2>
            <p className="mt-1 text-xs leading-snug text-slate-500">
              Based on{" "}
              <span className="font-semibold text-slate-800">
                {result.keywordUniverse.length}
              </span>{" "}
              extracted keywords from the job description.{" "}
              {tone.summary(result.missingKeywords.length)}
            </p>
            <div aria-hidden className="my-2.5 h-px bg-slate-100" />
            <div className={cn("flex gap-2 rounded-lg p-2.5", tone.alert)}>
              <ToneIcon className="h-4 w-4 shrink-0" />
              <p className="text-xs font-semibold leading-snug">{tone.encouragement}</p>
            </div>
          </div>
        </section>

        {breakdown || sections.length ? (
          <Collapsible
            icon={Layers}
            iconClassName="bg-slate-100 text-slate-600"
            title="Job match analysis"
            subtitle="See how well your resume matches the job description."
            open={analysisOpen}
            onToggle={() => setAnalysisOpen((open) => !open)}
          >
            <div className="space-y-5 border-t border-slate-100 pt-3.5">
              {breakdown ? (
                <BreakdownRows components={scoreComponents} breakdown={breakdown} />
              ) : null}
              {sections.length ? (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Detected sections
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sections.map(([name, present]) => (
                      <span
                        key={name}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
                          present
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-50 text-slate-400"
                        )}
                      >
                        {present ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Minus className="h-3 w-3" />
                        )}
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Collapsible>
        ) : null}

        <KeywordListCard
          tone="matched"
          title="Matched keywords"
          keywords={result.matchedKeywords}
          emptyText="None of the extracted keywords are present yet."
        />
        <KeywordListCard
          tone="missing"
          title="Missing keywords"
          keywords={result.missingKeywords}
          emptyText="Great! Your resume covers every keyword we found."
        />

        {suggestions.length ? (
          <Collapsible
            icon={Lightbulb}
            iconClassName="bg-amber-50 text-amber-500"
            title="Suggestions"
            subtitle="Get specific recommendations to improve your resume."
            open={suggestionsOpen}
            onToggle={() => setSuggestionsOpen((open) => !open)}
          >
            <ul className="space-y-2.5 border-t border-slate-100 pt-3.5">
              {suggestions.map((item) => (
                <li key={item} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-600">
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Collapsible>
        ) : null}

        <ActionBar>
          {alertBanner}
          {optimizeWait.waiting ? (
            <p className="mb-2 text-center text-xs leading-snug text-slate-500">
              {optimizeWait.note}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onOptimize}
            disabled={optimizeWait.waiting}
            className={cn(PRIMARY_BUTTON, optimizeWait.waiting && "tabular-nums")}
          >
            {optimizeWait.waiting ? (
              <>
                <Clock3 className="h-5 w-5" /> {optimizeWait.label}
              </>
            ) : (
              <>
                <WandSparkles className="h-5 w-5 shrink-0" />
                <span className="truncate">
                  {allowsCoverLetter
                    ? "Create optimized CV and Cover Letter"
                    : "Create optimized CV"}
                </span>
                <ArrowRight className="h-5 w-5 shrink-0" />
              </>
            )}
          </button>
        </ActionBar>
      </div>
    );
  };

  const renderKeywords = () => {
    const toolbar = (
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[13px] font-semibold tabular-nums text-emerald-700">
          <Check className="h-4 w-4" strokeWidth={2.75} />
          {keywordPicker.selected.length} of {keywordPicker.selectable.length} selected
        </span>
        <div className="-mr-1 flex items-center text-[13px] font-medium text-slate-500">
          <button
            type="button"
            onClick={keywordPicker.onSelectAll}
            className="rounded-md px-1 py-1 transition active:bg-slate-100"
          >
            Select all
          </button>
          <span aria-hidden className="mx-1 text-slate-300">
            |
          </span>
          <button
            type="button"
            onClick={keywordPicker.onClear}
            className="rounded-md px-1 py-1 transition active:bg-slate-100"
          >
            Clear
          </button>
        </div>
      </div>
    );

    return (
      <div className="space-y-4">
        <StepHeading
          // No-break space: "back up?" wraps as a pair, never leaving "up?" alone.
          title={"Which keywords can you back up?"}
          subtitle="Select only the keywords you genuinely have — we’ll weave those into your resume where they fit. The rest stay out."
        />

        {/* Every chip arrives selected, so this is what stands between the
            user and a resume claiming a skill they don't have. */}
        <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5">
          <AlertTriangle className="h-[22px] w-[22px] shrink-0 text-orange-500" strokeWidth={1.9} />
          <p className="text-[13px] leading-relaxed text-orange-800">
            <strong className="font-semibold">We never invent experience.</strong> Select only
            the keywords you genuinely have — we&apos;ll weave those into your resume where they
            fit. The rest stay out.
          </p>
        </div>

        {skills.length ? (
          <section className={cn(CARD, "p-3.5")}>
            {toolbar}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {skills.map((keyword) => (
                <SelectableChip
                  key={keyword}
                  keyword={keyword}
                  selected={selectedSet.has(keyword)}
                  onToggle={() => keywordPicker.onToggle(keyword)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {languages.length ? (
          <section className={cn(CARD, "p-3.5")}>
            {skills.length ? null : <div className="mb-3">{toolbar}</div>}
            <div className="flex gap-3">
              <Languages className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Languages this role mentions
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                  Select a language only if you actually speak or write it — it&apos;s added to a
                  Languages section, never to Skills.
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {languages.map((keyword) => (
                <SelectableChip
                  key={keyword}
                  keyword={keyword}
                  selected={selectedSet.has(keyword)}
                  onToggle={() => keywordPicker.onToggle(keyword)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {!keywordPicker.selectable.length ? (
          <section className={cn(CARD, "p-3.5 text-[13px] leading-relaxed text-slate-600")}>
            None of the missing keywords can be added to your resume for this job. Continue
            for a structure-only pass.
          </section>
        ) : null}

        <p className="flex gap-2.5 px-1 text-[13px] leading-relaxed text-slate-500">
          <Info className="mt-px h-[18px] w-[18px] shrink-0 text-slate-400" />
          Only selected keywords are added, and only where they truthfully fit your experience.
          You can optimize with none selected for a structure-only pass.
        </p>

        <ActionBar>
          {alertBanner}
          {optimizeWait.waiting ? (
            <p className="mb-2 text-center text-xs leading-snug text-slate-500">
              {optimizeWait.note}
            </p>
          ) : null}
          <button
            type="button"
            onClick={keywordPicker.onContinue}
            disabled={optimizeWait.waiting}
            className={cn(PRIMARY_BUTTON, optimizeWait.waiting && "tabular-nums")}
          >
            {optimizeWait.waiting ? (
              <>
                <Clock3 className="h-5 w-5" /> {optimizeWait.label}
              </>
            ) : (
              <>
                Next <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </ActionBar>
      </div>
    );
  };

  const renderOptimized = () => {
    const docs = preview.docs;
    if (!docs) return null;
    const onResume = !allowsCoverLetter || preview.view === "resume";
    const added = docs.incorporatedKeywords || [];
    const notIncluded = docs.stillMissingKeywords || [];
    const resumePage =
      RESUME_TEMPLATE_CONFIGS.find((template) => template.id === preview.templateId)?.layout
        .page === "letter"
        ? "letter"
        : "a4";
    const openSection = EDITOR_SECTIONS.find((section) => section.key === editorSection);

    return (
      <div className="space-y-4">
        <StepHeading
          title={allowsCoverLetter ? "Tailored CV & Cover Letter" : "Tailored CV"}
          // One line beside the score badge wherever it fits (≈12.25px of
          // width per px of type, next to a ~130px badge); balanced onto two
          // lines on the narrowest phones.
          titleClassName="text-[length:clamp(15px,calc(8.1vw_-_15.5px),19px)] [text-wrap:balance]"
          subtitle="Edit your documents and download."
          aside={
            <ScoreBadge
              initialScore={preview.initialScore}
              finalScore={preview.finalScore}
              computing={preview.isComputingFinalScore}
              expanded={finalBreakdownOpen}
              onToggle={() => setFinalBreakdownOpen((open) => !open)}
            />
          }
        />

        {finalBreakdownOpen && preview.finalScoreBreakdown && preview.finalScore !== null ? (
          <section className={cn(CARD, "p-3.5")}>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Score breakdown
              </p>
              <span className="text-sm font-bold text-slate-900">{preview.finalScore}/100</span>
            </div>
            <BreakdownRows components={scoreComponents} breakdown={preview.finalScoreBreakdown} />
          </section>
        ) : null}

        {allowsCoverLetter ? (
          <div role="tablist" className={cn(CARD, "grid grid-cols-2 overflow-hidden")}>
            {(
              [
                { view: "resume", label: "Resume", icon: FileText },
                { view: "cover", label: "Cover Letter", icon: NotepadText },
              ] as const
            ).map(({ view, label, icon: Icon }) => {
              const active = preview.view === view;
              return (
                <button
                  key={view}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-tour={view === "cover" ? "preview-cover-tab" : undefined}
                  onClick={() => preview.onViewChange(view)}
                  className={cn(
                    "relative flex h-12 items-center justify-center gap-2 text-sm font-medium transition",
                    active ? "text-slate-900" : "text-slate-400"
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                  {label}
                  {active ? (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-slate-900" />
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="flex items-center gap-1.5">
          {onResume ? (
            <>
              <ToolbarButton
                tourId="preview-editor"
                icon={Pencil}
                label="Edit resume"
                shortLabel="Edit"
                onClick={openEditorSheet}
                expanded={editorSheetOpen}
              />
              <ToolbarButton
                tourId="preview-design"
                icon={LayoutGrid}
                label="Template"
                onClick={openTemplateSheet}
                expanded={templateSheetOpen}
              />
            </>
          ) : null}
          <ZoomControl zoom={docZoom} onZoomChange={setDocZoom} />
        </div>

        {onResume && preview.hasEdits ? (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
            <p className="min-w-0 flex-1 text-[13px] leading-snug text-amber-900">
              You&apos;ve edited your resume. Re-score it to update the match.
            </p>
            <button
              type="button"
              onClick={preview.onReevaluate}
              disabled={preview.isComputingFinalScore}
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 disabled:opacity-60"
            >
              {preview.isComputingFinalScore ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="h-4 w-4" />
              )}
              Re-evaluate
            </button>
          </div>
        ) : null}

        {onResume ? (
          <>
            <DocumentPreview
              tourId="preview-document"
              html={preview.resumeHtml}
              page={resumePage}
              zoom={docZoom}
            />
            {added.length || notIncluded.length ? (
              <div className="space-y-1 px-1 text-xs leading-relaxed">
                {added.length ? (
                  <p className="text-emerald-700">
                    <span className="font-semibold">Added:</span> {added.join(", ")}
                    <span className="text-slate-400"> · highlighted above, never in the download</span>
                  </p>
                ) : null}
                {notIncluded.length ? (
                  <p className="text-slate-500">
                    <span className="font-semibold text-slate-600">Not included:</span>{" "}
                    {notIncluded.join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          // The letter brings no margins of its own; in the PDF the page's
          // do that job, so the preview adds matching white space.
          <DocumentPreview html={preview.coverLetterHtml} page="a4" zoom={docZoom} inset={40} />
        )}

        <ActionBar>
          {alertBanner}
          <div className="grid grid-cols-[1.6fr_1fr] gap-3">
            <DownloadButton
              view={preview.view}
              allowsCoverLetter={allowsCoverLetter}
              downloadingType={preview.downloadingType}
              downloaded={preview.downloaded}
              disabled={preview.downloadingType !== null || preview.isComputingFinalScore}
              onDownload={preview.onDownload}
            />
            {remoteJob ? (
              <button
                type="button"
                onClick={() => preview.onRequestExit("apply")}
                className={SECONDARY_BUTTON}
              >
                <ExternalLink className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} />
                <span className="truncate">View job</span>
                <ArrowRight className="hidden h-[18px] w-[18px] shrink-0 min-[385px]:block" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => leavePreview("new")}
                className={SECONDARY_BUTTON}
              >
                <RefreshCcw className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">New scan</span>
              </button>
            )}
          </div>
        </ActionBar>

        <BottomSheet
          open={editorSheetOpen}
          onOpenChange={setEditorSheetOpen}
          title={openSection ? openSection.title : "Edit your resume"}
          description={
            openSection
              ? "Changes show in the preview as you type."
              : "Update your information, experience, skills and more."
          }
          onBack={openSection ? () => setEditorSection(null) : undefined}
          bodyClassName={
            openSection || !preview.editorHasSections ? "bg-slate-50 px-3 pt-3" : undefined
          }
          footer={
            openSection || !preview.editorHasSections ? (
              <>
                {editorNotice ? (
                  <InlineNotice
                    tone={editorNotice.tone}
                    message={editorNotice.message}
                    onDismiss={() => setEditorNotice(null)}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => setEditorSheetOpen(false)}
                  className={PRIMARY_BUTTON}
                >
                  Done
                </button>
              </>
            ) : null
          }
        >
          {!preview.editorHasSections ? (
            preview.renderEditor(undefined, showEditorNotice)
          ) : openSection ? (
            preview.renderEditor(openSection.key, showEditorNotice)
          ) : (
            <ul className="space-y-2">
              {EDITOR_SECTIONS.map(({ key, title, detail, icon: Icon }) => (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setEditorSection(key)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 text-left transition active:bg-slate-50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100/80 text-slate-700">
                      <Icon className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold leading-snug text-slate-900">
                        {title}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-slate-500">
                        {detail}
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </BottomSheet>

        <BottomSheet
          open={templateSheetOpen}
          onOpenChange={setTemplateSheetOpen}
          title="Choose a template"
          description="Select a template for your optimized resume."
        >
          <TemplateGrid selected={preview.templateId} onSelect={chooseTemplate} />
          <div className="mt-6 border-t border-slate-100 pt-3">
            <button
              type="button"
              aria-expanded={designerOpen}
              onClick={() => setDesignerOpen((open) => !open)}
              className="flex w-full items-center gap-2 rounded-lg px-1 py-2.5 text-sm font-medium text-slate-700 transition active:bg-slate-100"
            >
              <Palette className="h-[18px] w-[18px] text-slate-400" />
              <span className="flex-1 text-left">Customize colors, font and spacing</span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-slate-400 transition-transform",
                  designerOpen && "rotate-180"
                )}
              />
            </button>
            {designerOpen ? <div className="mt-2">{preview.designer}</div> : null}
          </div>
        </BottomSheet>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-xl">
      <Stepper
        step={step}
        hasResult={Boolean(result)}
        canJump={canJump}
        onJump={jumpTo}
      />
      <div className="mt-7">
        {step === "details"
          ? renderDetails()
          : step === "scan"
            ? renderProgress("scan")
            : step === "results"
              ? renderResults()
              : step === "keywords"
                ? renderKeywords()
                : step === "optimizing"
                  ? renderProgress("optimize")
                  : renderOptimized()}
      </div>
    </div>
  );
};
