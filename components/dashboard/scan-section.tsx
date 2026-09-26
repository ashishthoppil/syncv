"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isLanguageKeyword } from "@/lib/languages";
import {
  SCAN_SOURCE_MANUAL,
  type ScanSource,
} from "@/lib/scan-sources";
import { draftToResumeData } from "@/components/dashboard/resume-form";
import { ResumeTemplatePicker } from "@/components/dashboard/template-picker";
import {
  listBaseResumes,
  contactFromDraft,
  type BaseResumeRecord,
} from "@/lib/base-resume";
import { useResumePhotoUrl } from "@/lib/resume-photo";
import { toast } from "react-toastify";
import { supabase } from "@/lib/supabaseClient";
import { authedFetch } from "@/lib/authed-fetch";
import { useRouter } from "next/navigation";
import {
  getResumeTemplateConfig,
  RESUME_FONT_OPTIONS,
  resolveResumeTemplateTheme,
} from "@/components/resume-templates/config";
import {
  extractCandidateName,
  highlightKeywordsInHtml,
  renderCoverLetterHtml,
  renderResumeFromData,
  renderResumeHtml,
  resumeDataToText,
  toSlugPart,
  type ResumeData,
} from "@/components/resume-templates/render";
import {
  ResumeEditor,
  type ResumeEditorSection,
  type ResumeEditorSession,
} from "@/components/dashboard/resume-editor";
import { SubscriptionGate } from "@/components/dashboard/subscription-gate";
import {
  type OptimizationUsage,
  useOptimizationWait,
} from "@/components/dashboard/optimization-meter";
import { useProductTour } from "@/components/onboarding/product-tour";
import {
  MobileScanFlow,
  useIsMobileScanLayout,
  type MobileExitIntent,
} from "@/components/dashboard/scan-flow-mobile";
import {
  ResumeTemplateId,
  ResumeTemplateThemeOverrides,
} from "@/components/resume-templates/types";
import {
  AlertCircleIcon,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Download,
  Eye,
  FileText,
  Info,
  Languages,
  Layers,
  Lightbulb,
  Loader2,
  Minus,
  Palette,
  Pencil,
  Plus,
  RefreshCcw,
  ScanLine,
  ShieldCheck,
  Star,
  TrendingUp,
  UploadCloud,
  WandSparkles,
  Clock3,
  X,
  XCircleIcon,
} from "lucide-react";

type WeightedKeyword = {
  keyword: string;
  weight: number;
  importance: "required" | "preferred";
  variants: string[];
};

type ScanSummary = {
  initialScore: number;
  finalAtsScore?: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  keywordUniverse: string[];
  weightedKeywords?: WeightedKeyword[];
  scoreBreakdown?: {
    keywordMatch: number;
    skillsCoverage: number;
    titleMatch: number;
    experienceRelevance: number;
    achievements: number;
    sectionCompleteness: number;
  };
  titleAnalysis?: {
    score: number;
    targetRole: string;
    matchedTitle: string;
    detectedTitles: string[];
  };
  experienceAnalysis?: {
    score: number;
    totalYears: number;
    requiredYears: number | null;
  };
  achievementAnalysis?: {
    score: number;
    measurableBullets: number;
    totalBulletLikeLines: number;
  };
  sectionAnalysis?: {
    score: number;
    foundSections: {
      summary: boolean;
      skills: boolean;
      experience: boolean;
      education: boolean;
      projects: boolean;
    };
  };
  formattingWarnings?: string[];
  suggestions?: string[];
};

type TailoredDocs = {
  optimizedResume?: ResumeData;
  optimizedResumeText: string;
  coverLetter: string;
  incorporatedKeywords?: string[];
  stillMissingKeywords?: string[];
};

type ProfileContactPayload = {
  email: string;
  phone: string;
  linkedin: string;
  portfolio: string;
  github: string;
  behance: string;
  otherLink: string;
};

const initialFormState = {
  organization: "",
  designation: "",
  jd: "",
  resume: "",
};

// The ATS score is a weighted composite. Only the first two components respond
// to adding keywords; the rest are structural (they depend on the resume's
// actual experience, titles, and quantified results), which is why a keyword
// pass alone can't push the score to 100.
const SCORE_COMPONENTS: {
  key: keyof NonNullable<ScanSummary["scoreBreakdown"]>;
  label: string;
  weight: number;
  keywordDriven?: boolean;
}[] = [
  { key: "keywordMatch", label: "Keyword match", weight: 40, keywordDriven: true },
  { key: "skillsCoverage", label: "Skills coverage", weight: 15, keywordDriven: true },
  { key: "experienceRelevance", label: "Experience relevance", weight: 15 },
  { key: "titleMatch", label: "Title match", weight: 10 },
  { key: "achievements", label: "Quantified achievements", weight: 10 },
  { key: "sectionCompleteness", label: "Section completeness", weight: 10 },
];

// Educational-degree keywords must never appear in the keyword picker — we never
// add keywords to the education section, so they aren't selectable/integratable.
const DEGREE_KEYWORD_RE =
  /\b(bachelor'?s?|master'?s?|doctorate|doctoral|ph\.?\s?d|mca|m\.?\s?c\.?a|mba|m\.?\s?b\.?a|bca|b\.?\s?c\.?a|bba|b\.?\s?b\.?a|b\.?\s?tech|m\.?\s?tech|b\.e\.?|m\.e\.?|b\.?\s?sc|m\.?\s?sc|b\.a\.?|m\.a\.?|b\.?\s?com|m\.?\s?com|b\.?\s?ed|m\.?\s?ed|diploma|associate'?s?\s+degree|under\s?graduate|post\s?graduate|graduation|degrees?)\b/i;
const isDegreeKeyword = (keyword: string) => DEGREE_KEYWORD_RE.test(keyword);

type FormField = keyof typeof initialFormState;
type FormErrors = Partial<Record<FormField, string>>;

type ScanSectionProps = {
  guestTrial?: boolean;
  hideTopHeading?: boolean;
  className?: string;
  subscriptionLocked?: boolean;
  allowsCoverLetter?: boolean;
  allowsJobTracker?: boolean;
  /** Called after a scan consumes quota, so the host can refresh the balance. */
  onUsageChange?: () => void;
  /**
   * Paid plan only: the optimization fair-use state. During a break, or once
   * the day's cap is used, every way into optimizing is disabled until it ends.
   */
  optimizationUsage?: OptimizationUsage | null;
  /**
   * Seeds the form when the user arrives from Remote Jobs, so they don't have
   * to copy a job description across. Absent everywhere else, which leaves the
   * form exactly as it was.
   */
  prefill?: {
    organization?: string;
    designation?: string;
    jd?: string;
    /** Recorded on the scan so we can tell where the analysis originated. */
    source?: ScanSource;
    /**
     * The posting this scan is for, when it came from Remote Jobs. Kept so the
     * user can get back to it to apply — optimizing a resume and then losing
     * the job it was for is a dead end.
     */
    remoteJob?: RemoteJobOrigin;
  } | null;
  /** Lets the host drop the prefill once it has been applied. */
  onPrefillConsumed?: () => void;
  /**
   * Lets the host check with this section before switching away. On phones
   * the optimized documents sit inline with the tab bar still in reach, so a
   * section switch would silently throw them away. The guard returns true when
   * it has taken over — it shows its own confirm and calls `proceed` itself.
   */
  registerLeaveGuard?: (guard: ((proceed: () => void) => boolean) | null) => void;
};

/** Just enough of a Remote Jobs posting to navigate back to it. */
type RemoteJobOrigin = {
  id: string;
  title: string;
  companyName: string;
  applicationUrl: string;
};

type TailoredDocType = "cv" | "cover";

const DOC_LABELS: Record<TailoredDocType, string> = {
  cv: "tailored CV",
  cover: "cover letter",
};

/**
 * What the user is trying to do when we interrupt to ask about downloads.
 * "close" dismisses the preview; "apply" leaves for the job posting. Both
 * discard the generated documents, which is why either is worth a confirm.
 * The phone flow adds "back" (to an earlier step), "new" (a fresh scan) and
 * "leave" (another dashboard section), which discard them the same way.
 */
type PendingExit = "close" | MobileExitIntent | "leave";

const EXIT_COPY: Record<PendingExit, { title: string; detail: string }> = {
  close: {
    title: "Close without downloading?",
    detail: "This preview can't be reopened, and the documents are not saved anywhere else.",
  },
  apply: {
    title: "Ready to apply?",
    detail:
      "You'll need them to apply, and this preview can't be reopened once you leave it.",
  },
  back: {
    title: "Go back without downloading?",
    detail:
      "Your tailored documents can't be reopened once you go back, and they are not saved anywhere else.",
  },
  new: {
    title: "Start a new scan?",
    detail:
      "Your tailored documents can't be reopened once you start over, and they are not saved anywhere else.",
  },
  leave: {
    title: "Leave without downloading?",
    detail:
      "Your tailored documents can't be reopened once you leave, and they are not saved anywhere else.",
  },
};

type GuestTrialStage = "none" | "analyzed" | "optimized";

const GUEST_STAGE_KEY = "syncv_guest_trial_stage";

// Every dialog in this section shares one mobile treatment: it rises from the
// bottom edge as a sheet, full-bleed and rounded only at the top, and reverts to
// a centred card from `sm` up. `dvh` rather than `vh` so the sheet resizes with
// the iOS URL bar instead of hiding its footer underneath it.
//
// `!mt-0` because these backdrops render as direct children of the section's
// `space-y-8`, which hands every later sibling a 2rem top margin — and a margin
// on a `fixed inset-0` box shifts it down, leaving a strip of page undimmed at
// the top of the viewport.
const DIALOG_BACKDROP =
  "fixed inset-0 !mt-0 flex items-end justify-center bg-slate-900/60 sm:items-center sm:p-4";
const DIALOG_PANEL =
  "w-full max-h-[92dvh] touch-scroll overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl";

/**
 * Dialog padding, including the bottom.
 *
 * This deliberately does NOT live on DIALOG_PANEL. A `pb-*` there loses to the
 * `p-*` each dialog sets (tailwind-merge resolves the conflict in favour of the
 * later class), so the panel previously carried an `sm:pb-0` to get out of the
 * way — but `sm:pb-0` is its own breakpoint group, which `p-6` cannot override.
 * The result was zero bottom padding on every one of these dialogs at `sm` and
 * up, with the last row of buttons sitting flush against the panel edge.
 *
 * Owning the whole box here means one class wins outright, and the bottom
 * inset clears a phone's home indicator without shrinking the desktop gap.
 */
const DIALOG_BODY =
  "p-6 pb-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))]";
const DIALOG_BODY_TIGHT =
  "p-4 pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.75rem))]";

export const ScanSection = ({
  guestTrial = false,
  hideTopHeading = false,
  className,
  subscriptionLocked = false,
  allowsCoverLetter = true,
  allowsJobTracker = true,
  onUsageChange,
  optimizationUsage = null,
  prefill = null,
  onPrefillConsumed,
  registerLeaveGuard,
}: ScanSectionProps = {}) => {
  const router = useRouter();
  // Phones get the step-by-step flow in scan-flow-mobile.tsx; everything
  // below keeps driving it, only the rendering at the end differs.
  const isMobileLayout = useIsMobileScanLayout();
  const [form, setForm] = useState(initialFormState);
  const [result, setResult] = useState<ScanSummary | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingDocs, setIsGeneratingDocs] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [tailoredDocs, setTailoredDocs] = useState<TailoredDocs | null>(null);
  // The optimize CTA pulses until the user acknowledges it. Hovering or
  // focusing counts as "found it" — past that point the animation would just
  // be nagging someone who is already looking at the button.
  const [ctaNudgeAcknowledged, setCtaNudgeAcknowledged] = useState(false);
  const [downloadingType, setDownloadingType] = useState<"cv" | "cover" | null>(
    null
  );
  const [scanJobId, setScanJobId] = useState<string | null>(null);
  // Where the job description came from. Stays with the form until it is reset,
  // so the origin is still known by the time the scan is actually run.
  const [scanSource, setScanSource] = useState<ScanSource>(SCAN_SOURCE_MANUAL);
  // The Remote Jobs posting this scan is for, if any — the route back.
  const [remoteJob, setRemoteJob] = useState<RemoteJobOrigin | null>(null);
  // Which generated documents the user has actually pulled down. The preview
  // cannot be reopened once closed, so this is what the exit prompt checks.
  const [downloadedDocs, setDownloadedDocs] = useState<
    Record<TailoredDocType, boolean>
  >({ cv: false, cover: false });
  const [pendingExit, setPendingExit] = useState<PendingExit | null>(null);
  const [selectedTemplate, setSelectedTemplate] =
    useState<ResumeTemplateId>("classic-blue");
  const [templateOverrides, setTemplateOverrides] = useState<
    Record<string, ResumeTemplateThemeOverrides>
  >({});
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string>("");
  const [profileContact, setProfileContact] = useState<ProfileContactPayload>({
    email: "",
    phone: "",
    linkedin: "",
    portfolio: "",
    github: "",
    behance: "",
    otherLink: "",
  });
  // The resume is no longer uploaded per-scan — it comes from the saved base
  // resume. `baseResumeLoading` guards the empty-state message until we know.
  const [hasBaseResume, setHasBaseResume] = useState(false);
  const [baseResumeLoading, setBaseResumeLoading] = useState(!guestTrial);
  const [baseResumeList, setBaseResumeList] = useState<BaseResumeRecord[]>([]);
  const [selectedBaseResumeId, setSelectedBaseResumeId] = useState<string>("");
  // Ref mirror so the loader keeps the user's picked resume across refreshes.
  const selectedBaseResumeIdRef = useRef<string>("");
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [finalScoreBreakdown, setFinalScoreBreakdown] =
    useState<ScanSummary["scoreBreakdown"] | null>(null);
  const [scoreBreakdownOpen, setScoreBreakdownOpen] = useState(false);
  const [isComputingFinalScore, setIsComputingFinalScore] = useState(false);
  const [editableResumeText, setEditableResumeText] = useState("");
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  // The Design tab and Cover letter view unmount the resume editor; this is
  // how it comes back with its drafts and used Rephrase / Generate buttons.
  const resumeEditorSession = useRef<ResumeEditorSession | null>(null);
  const [hasResumePreviewEdits, setHasResumePreviewEdits] = useState(false);
  // Name/designation shown on the optimized resume — seeded when the preview
  // opens, editable from the preview's contact section.
  const [previewCandidateName, setPreviewCandidateName] = useState("");
  const [previewDesignation, setPreviewDesignation] = useState("");
  const [editorTab, setEditorTab] = useState<"content" | "design">("content");
  const [previewZoom, setPreviewZoom] = useState(1);
  // Phones can't show the editor and the rendered resume side by side, so below
  // `lg` the preview modal shows one at a time and this picks which. Ignored at
  // `lg` and up, where both panes render as before.
  const [mobilePreviewPane, setMobilePreviewPane] = useState<"edit" | "preview">(
    "edit"
  );
  const [analyzingLabelIndex, setAnalyzingLabelIndex] = useState(0);
  const [generatingLabelIndex, setGeneratingLabelIndex] = useState(0);
  const [showCareerWarning, setShowCareerWarning] = useState(false);
  const [showCareerKeywordPicker, setShowCareerKeywordPicker] = useState(false);
  const [careerSelectedKeywords, setCareerSelectedKeywords] = useState<string[]>([]);
  // Whether the keyword picker was opened from the career-change path (vs a
  // normal optimization). Carried so "Continue" resumes the right flow.
  const [keywordPickerCareerChange, setKeywordPickerCareerChange] = useState(false);
  const [analysisStepIndex, setAnalysisStepIndex] = useState(0);
  const [optimizationStepIndex, setOptimizationStepIndex] = useState(0);
  const [previewView, setPreviewView] = useState<"resume" | "cover">("resume");
  const [guestTrialStage, setGuestTrialStage] = useState<GuestTrialStage>("none");
  const [guestSummaryOpen, setGuestSummaryOpen] = useState(false);
  const [fitInsight, setFitInsight] = useState<{
    resumeFamilyLabel: string;
    targetFamilyLabel: string;
    resumeFamilyId: string;
    targetFamilyId: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const summaryPanelRef = useRef<HTMLDivElement | null>(null);
  // The section switch waiting on the "leave without downloading?" confirm.
  const leaveProceedRef = useRef<(() => void) | null>(null);
  // The phone flow shows no toasts. Success is the next screen appearing, so
  // those are dropped; failures land here and show in the flow's pinned
  // action bar, right above the button that failed. Desktop still toasts.
  const [mobileAlert, setMobileAlert] = useState<string | null>(null);
  const mobileFlow = isMobileLayout && !guestTrial;
  // Read at call time: most messages are sent after an await.
  const mobileFlowRef = useRef(mobileFlow);
  useEffect(() => {
    mobileFlowRef.current = mobileFlow;
  }, [mobileFlow]);
  const notify = {
    success: (message: string) => {
      if (!mobileFlowRef.current) toast.success(message);
    },
    info: (message: string) => {
      if (!mobileFlowRef.current) toast.info(message);
    },
    warn: (message: string) => {
      if (!mobileFlowRef.current) toast.warn(message);
    },
    error: (message: string) => {
      if (mobileFlowRef.current) setMobileAlert(message);
      else toast.error(message);
    },
  };
  // The first-run tour walks through this section. It needs to know when a scan
  // and an optimization finish, and the preview steps need the pane they point
  // at to actually be the one on screen. Outside the dashboard (the guest scan
  // on marketing pages) there is no provider and both of these are inert.
  const { activeStepId: tourStepId, signal: tourSignal } = useProductTour();
  const analyzingLabels = [
    "Analyzing your resume...",
    "Inspecting your resume...",
    "Matching with job keywords...",
    "Scoring your resume...",
  ];
  const generatingLabels = [
    "Creating tailored CV & cover letter...",
    "Optimizing your CV with missing keywords...",
    "Drafting your cover letter...",
    "Finalizing polished drafts...",
  ];
  const analysisSteps = [
    "Parsing resume",
    "Extracting skills",
    "Detecting experience",
    "Comparing with job description",
    "Evaluating resume",
  ];
  const optimizationSteps = [
    "Extracting missing keywords",
    "Optimizing your resume",
    "Generating cover letter",
    "Finalizing tailored documents",
    "Computing optimized score",
  ];
  const roleFamilies = [
    {
      id: "software-engineering",
      label: "Software Engineering",
      keywords: [
        "software engineer",
        "software developer",
        "software development engineer",
        "frontend engineer",
        "frontend developer",
        "front-end engineer",
        "front-end developer",
        "backend engineer",
        "backend developer",
        "back-end engineer",
        "back-end developer",
        "full stack engineer",
        "full stack developer",
        "full-stack engineer",
        "full-stack developer",
        "fullstack engineer",
        "fullstack developer",
        "web engineer",
        "web developer",
        "mobile developer",
        "android developer",
        "ios developer",
        "devops engineer",
        "site reliability engineer",
        "platform engineer",
        "cloud engineer",
        "qa engineer",
        "test engineer",
        "automation engineer",
        "sde",
      ],
    },
    {
      id: "project-management",
      label: "Project Management",
      keywords: [
        "project manager",
        "project coordinator",
        "project lead",
        "program manager",
        "delivery manager",
        "scrum master",
        "agile coach",
        "release manager",
        "technical program manager",
        "engineering program manager",
        "pmo",
      ],
    },
    {
      id: "product-management",
      label: "Product",
      keywords: [
        "product manager",
        "product owner",
        "product coordinator",
        "product analyst",
        "associate product manager",
        "senior product manager",
        "group product manager",
      ],
    },
    {
      id: "education",
      label: "Education",
      keywords: [
        "teacher",
        "professor",
        "tutor",
        "lecturer",
        "educator",
        "instructor",
        "teaching assistant",
        "academic coordinator",
        "head of department",
        "principal",
      ],
    },
    {
      id: "operations",
      label: "Operations",
      keywords: [
        "operations manager",
        "operations analyst",
        "operations specialist",
        "operations associate",
        "operations coordinator",
        "ops manager",
        "business operations",
        "office manager",
        "office administrator",
        "administrative assistant",
        "office assistant",
      ],
    },
    {
      id: "data",
      label: "Data",
      keywords: [
        "data scientist",
        "data analyst",
        "data engineer",
        "data architect",
        "machine learning engineer",
        "ml engineer",
        "ai engineer",
        "research scientist",
        "analytics engineer",
        "business intelligence analyst",
        "bi analyst",
      ],
    },
    {
      id: "design",
      label: "Design",
      keywords: [
        "ui designer",
        "ux designer",
        "ui/ux designer",
        "product designer",
        "graphic designer",
        "visual designer",
        "interaction designer",
      ],
    },
    {
      id: "marketing",
      label: "Marketing",
      keywords: [
        "marketing manager",
        "marketing analyst",
        "marketing specialist",
        "digital marketing",
        "seo specialist",
        "content marketing",
        "growth marketing",
      ],
    },
    {
      id: "sales",
      label: "Sales",
      keywords: [
        "sales manager",
        "sales executive",
        "account executive",
        "account manager",
        "business development",
        "sales representative",
        "sales associate",
      ],
    },
  ];
  const shouldAllowCoverLetter = allowsCoverLetter;
  // Ticks with the header's timer, from the same state, so they unlock together.
  const optimizeWait = useOptimizationWait(optimizationUsage);
  const optimizeWaitLabel =
    optimizeWait.blockedBy === "daily"
      ? `Daily limit reached · resets in ${optimizeWait.countdown}`
      : `Optimize again in ${optimizeWait.countdown}`;
  const selectedTemplateConfig = getResumeTemplateConfig(selectedTemplate);
  // Regional personal details (date of birth, visa status…) live on the base
  // resume and never pass through tailoring — attach them for rendering so the
  // templates that expect them (Europass, Middle East…) can show them.
  const selectedBaseDraft = baseResumeList.find(
    (record) => record.id === selectedBaseResumeId
  )?.draft;
  const basePersonalDetails = selectedBaseDraft?.personal;
  // The photo also comes from the base resume. Resumes saved before photos
  // lived there (no photo field at all) fall back to the old profile photo.
  const basePhotoUrl = useResumePhotoUrl(selectedBaseDraft?.photo);
  const resumePhotoUrl =
    selectedBaseDraft && selectedBaseDraft.photo !== undefined
      ? basePhotoUrl
      : profilePhotoUrl;
  const renderableResumeData =
    resumeData && basePersonalDetails && !resumeData.personal
      ? { ...resumeData, personal: basePersonalDetails }
      : resumeData;
  const selectedTemplateTheme = resolveResumeTemplateTheme(
    selectedTemplate,
    templateOverrides[selectedTemplate]
  );

  const updateTemplateOverrides = (patch: ResumeTemplateThemeOverrides) => {
    setTemplateOverrides((prev) => ({
      ...prev,
      [selectedTemplate]: {
        ...(prev[selectedTemplate] || {}),
        ...patch,
      },
    }));
  };

  const redirectGuestToSignUp = () => {
    toast.info("Your trial has ended. Register to proceed.");
    router.push("/sign-up");
  };

  const persistGuestState = useCallback(
    (stage: GuestTrialStage) => {
      if (!guestTrial || typeof window === "undefined") return;
      localStorage.setItem(GUEST_STAGE_KEY, stage);
    },
    [guestTrial]
  );

  const resetTemplateOverrides = () => {
    setTemplateOverrides((prev) => {
      const updated = { ...prev };
      delete updated[selectedTemplate];
      return updated;
    });
  };

  const updateForm = (key: FormField, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => {
      if (!prev[key]) return prev;
      const updated = { ...prev };
      delete updated[key];
      return updated;
    });
  };

  const validateForm = () => {
    const errors: FormErrors = {};
    (Object.keys(form) as FormField[]).forEach((field) => {
      if (!form[field].trim()) {
        const label =
          field === "jd"
            ? "Job description"
            : field === "resume"
            ? "Resume content"
            : field === "organization"
            ? "Organization"
            : "Designation";
        errors[field] = `${label} is required.`;
      }
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleDrop = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }
    const file = files[0];
    const formData = new FormData();
    formData.append("file", file);

    setIsUploading(true);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
        updateForm("resume", data.message);
        toast.success("Resume extracted successfully.");
      } else {
        toast.error(data.message || "Unable to parse the resume.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong while scanning the resume.");
    } finally {
      setIsUploading(false);
    }
  };

  const analyzeResume = async () => {
    setMobileAlert(null);
    if (!validateForm()) {
      // The phone form marks each missing field and scrolls to the first.
      if (!mobileFlowRef.current) toast.error("Please complete all required fields.");
      return;
    }

    setAnalysisStepIndex(0);
    setIsAnalyzing(true);
    try {
      // Get current user session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const sessionUserId = session?.user?.id;
      if (guestTrial && session) {
        router.push("/scan");
        setIsAnalyzing(false);
        return;
      }
      if (!sessionUserId && !guestTrial) {
        notify.error("Please log in to save scan results.");
        setIsAnalyzing(false);
        return;
      }
      if (guestTrial && guestTrialStage !== "none") {
        setIsAnalyzing(false);
        redirectGuestToSignUp();
        return;
      }

      const response = await authedFetch("/api/analyze", {
        method: "POST",
        body: JSON.stringify({
          resume: form.resume,
          jd: form.jd,
          organization: form.organization,
          designation: form.designation,
          // Only this call records scan usage; the post-optimize re-scores pass
          // skipUsageTracking, so they have no origin to record.
          source: scanSource,
          experienceYears:
            baseResumeList.find((r) => r.id === selectedBaseResumeId)?.draft
              .experienceYears || "",
          candidateTitle:
            baseResumeList.find((r) => r.id === selectedBaseResumeId)?.draft
              .designation || "",
        }),
      });
      const data = await response.json();
      if (data.success) {
        setResult(data.message);
        tourSignal("scan:analyzed");
        if (!guestTrial) onUsageChange?.();

        if (guestTrial) {
          setGuestTrialStage("analyzed");
          setGuestSummaryOpen(true);
          persistGuestState("analyzed");
          toast.success("Scan completed!");
          return;
        }

        // Gate on the server-derived entitlement, not on `planKey`, which falls
        // back to the latest *inactive* subscription — a lapsed subscriber is a
        // free user and must still get their scans saved.
        if (allowsJobTracker) {
          // Save to job tracker
          try {
            const saveResponse = await fetch("/api/job-tracker", {
              method: "POST",
              body: JSON.stringify({
                userId: sessionUserId,
                organization: form.organization,
                designation: form.designation,
                initialScore: data.message.initialScore,
                matchedKeywords: data.message.matchedKeywords,
                missingKeywords: data.message.missingKeywords,
                keywordUniverse: data.message.keywordUniverse,
              }),
            });
            const saveData = await saveResponse.json();
            if (saveData.success) {
              setScanJobId(saveData.data?.id || null);
              notify.success("Scan completed and saved to job tracker!");
            } else {
              setScanJobId(null);
              notify.success("Scan completed! (Could not save to tracker)");
            }
          } catch (saveError) {
            console.error("Error saving to job tracker:", saveError);
            setScanJobId(null);
            notify.success("Scan completed! (Could not save to tracker)");
          }
        } else {
          setScanJobId(null);
          notify.success("Scan completed!");
        }
      } else {
        notify.error(data.message || "Unable to analyze the resume right now.");
      }
    } catch (error) {
      console.error(error);
      notify.error("Unexpected error while analyzing.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetForm = () => {
    if (guestTrial && guestTrialStage !== "none") {
      redirectGuestToSignUp();
      return;
    }
    setForm(initialFormState);
    setFormErrors({});
    setMobileAlert(null);
    setScanSource(SCAN_SOURCE_MANUAL);
    setRemoteJob(null);
    setDownloadedDocs({ cv: false, cover: false });
    setPendingExit(null);
    setResult(null);
    setTailoredDocs(null);
    setPreviewOpen(false);
    setGuestSummaryOpen(false);
    setScanJobId(null);
    setSelectedTemplate("classic-blue");
    setFinalScore(null);
    setEditableResumeText("");
    setResumeData(null);
    setHasResumePreviewEdits(false);
    setShowCareerWarning(false);
    setShowCareerKeywordPicker(false);
    setCareerSelectedKeywords([]);
    setFitInsight(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const toggleCareerKeyword = (keyword: string) => {
    setCareerSelectedKeywords((prev) =>
      prev.includes(keyword)
        ? prev.filter((item) => item !== keyword)
        : [...prev, keyword]
    );
  };

  const resolvePhotoUrl = useCallback(async (pathOrUrl: string) => {
    if (!pathOrUrl) return "";
    if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
      return pathOrUrl;
    }
    const { data, error } = await supabase.storage
      .from("profile-photos")
      .createSignedUrl(pathOrUrl, 60 * 60);
    if (error || !data?.signedUrl) return "";
    return data.signedUrl;
  }, []);

  const loadProfilePhoto = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("photo_url")
        .eq("id", userId)
        .single();
      if (error || !data?.photo_url) return;

      const url = await resolvePhotoUrl(data.photo_url);
      if (url) setProfilePhotoUrl(url);
    } catch (error) {
      console.error("Failed to load profile photo:", error);
    }
  }, [resolvePhotoUrl]);

  // Apply a chosen base resume to the scan: its text feeds analyze/tailor, and
  // its contact fills the optimized resume header.
  const applyBaseResume = (record: BaseResumeRecord) => {
    selectedBaseResumeIdRef.current = record.id;
    setSelectedBaseResumeId(record.id);
    setForm((prev) => ({ ...prev, resume: record.resumeText }));
    setProfileContact(contactFromDraft(record.draft));
  };

  // Loads the user's base resumes and applies the selected one (kept across
  // refreshes; falls back to the default, then the first). Returns the applied
  // resume's contact for the tailor request.
  const loadProfileContact = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return null;

      const list = await listBaseResumes(userId);
      setBaseResumeList(list);
      setHasBaseResume(list.length > 0);
      if (!list.length) return null;

      const current = list.find((r) => r.id === selectedBaseResumeIdRef.current);
      const chosen = current || list.find((r) => r.isDefault) || list[0];
      selectedBaseResumeIdRef.current = chosen.id;
      setSelectedBaseResumeId(chosen.id);
      setForm((prev) => ({ ...prev, resume: chosen.resumeText }));

      const nextProfile = contactFromDraft(chosen.draft);
      setProfileContact(nextProfile);
      return nextProfile;
    } catch (error) {
      console.error("Failed to load base resumes:", error);
      return null;
    } finally {
      setBaseResumeLoading(false);
    }
  }, []);

  const PRESENT_INDICATORS =
    /\b(present|current|currently|ongoing|now|to\s+date|till\s+date)\b/i;
  const EXPERIENCE_HEADER_RE =
    /^\s*(experience|work\s+experience|professional\s+experience|employment\s+history|work\s+history|professional\s+background|career\s+history|relevant\s+experience)\s*:?\s*$/i;
  const OTHER_SECTION_HEADER_RE =
    /^\s*(summary|professional\s+summary|profile|education|academic\s+background|skills|technical\s+skills|professional\s+skills|core\s+skills|key\s+skills|core\s+competencies|competencies|projects?|certifications?|languages?|awards?|publications?|interests|hobbies|volunteer)\s*:?\s*$/i;
  const ROLE_TITLE_HINT_RE =
    /\b(engineer|developer|programmer|manager|designer|analyst|architect|consultant|specialist|lead|officer|coordinator|administrator|scientist|researcher|director|head|associate|intern|tutor|teacher|professor|lecturer|instructor|educator|owner|executive|representative|trainer|recruiter|tester)\b/i;

  const stripBoldMarkers = (s: string) => s.replace(/\*\*/g, "").trim();

  const extractTitleCandidate = (rawLine: string): string => {
    let cleaned = stripBoldMarkers(rawLine);
    cleaned = cleaned.replace(/^[-*•◦▪]\s*/, "").trim();
    if (!cleaned) return "";
    if (EXPERIENCE_HEADER_RE.test(cleaned) || OTHER_SECTION_HEADER_RE.test(cleaned)) {
      return "";
    }
    // If the line has separators, look at the part that contains a role hint.
    const parts = cleaned.split(/\s*\|\s*|\s+at\s+|\s+@\s+|\s+-\s+/i);
    for (const part of parts) {
      const trimmed = part.trim();
      if (
        trimmed &&
        trimmed.length < 80 &&
        ROLE_TITLE_HINT_RE.test(trimmed) &&
        !/\d{4}/.test(trimmed) // Avoid lines that are mostly dates
      ) {
        return trimmed;
      }
    }
    if (
      cleaned.length < 100 &&
      ROLE_TITLE_HINT_RE.test(cleaned) &&
      !/^\d/.test(cleaned)
    ) {
      return cleaned;
    }
    return "";
  };

  const extractLatestDesignation = (resumeText: string): string => {
    const lines = resumeText.split("\n").map((line) => line.trim());

    // Strategy 1: Find a line containing Present/Current/etc. The current title is
    // most often on the same line; otherwise check the previous 2 or next line.
    for (let i = 0; i < lines.length; i += 1) {
      if (!PRESENT_INDICATORS.test(lines[i])) continue;
      const sameLine = extractTitleCandidate(lines[i]);
      if (sameLine) return sameLine;
      for (let j = Math.max(0, i - 2); j < i; j += 1) {
        const candidate = extractTitleCandidate(lines[j]);
        if (candidate) return candidate;
      }
      if (i + 1 < lines.length) {
        const next = extractTitleCandidate(lines[i + 1]);
        if (next) return next;
      }
    }

    // Strategy 2: First title-like line after the EXPERIENCE section header.
    const expIdx = lines.findIndex((l) => EXPERIENCE_HEADER_RE.test(l));
    if (expIdx >= 0) {
      for (let i = expIdx + 1; i < Math.min(lines.length, expIdx + 20); i += 1) {
        if (OTHER_SECTION_HEADER_RE.test(lines[i])) break;
        const candidate = extractTitleCandidate(lines[i]);
        if (candidate) return candidate;
      }
    }

    // Strategy 3: First title-like line anywhere in the resume.
    for (const line of lines) {
      const candidate = extractTitleCandidate(line);
      if (candidate) return candidate;
    }

    return "";
  };

  const detectRoleFamily = (text: string) => {
    if (!text) return null;
    const normalized =
      " " +
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s+#./-]/g, " ")
        .replace(/\s+/g, " ")
        .trim() +
      " ";
    let best:
      | { id: string; label: string; score: number; matched: string }
      | null = null;
    for (const family of roleFamilies) {
      for (const keyword of family.keywords) {
        const padded = ` ${keyword.toLowerCase()} `;
        if (!normalized.includes(padded)) continue;
        // Specificity = number of words in the matched phrase. The more specific
        // the phrase that matches, the more confident we are about the family.
        const specificity = keyword.split(/\s+/).length;
        if (!best || specificity > best.score) {
          best = {
            id: family.id,
            label: family.label,
            score: specificity,
            matched: keyword,
          };
        }
      }
    }
    if (!best) return null;
    return { id: best.id, label: best.label, score: best.score };
  };

  const detectFamiliesFromJd = (jdText: string) => {
    if (!jdText) return [] as Array<{ id: string; label: string; score: number }>;
    const normalized =
      " " +
      jdText
        .toLowerCase()
        .replace(/[^a-z0-9\s+#./-]/g, " ")
        .replace(/\s+/g, " ")
        .trim() +
      " ";
    // Score by counting weighted occurrences of family keywords across the JD.
    // Weight = phrase specificity (word count) so "project manager" outweighs
    // a stray "manager" mention.
    const scores: Record<string, { label: string; score: number }> = {};
    for (const family of roleFamilies) {
      for (const keyword of family.keywords) {
        const padded = ` ${keyword.toLowerCase()} `;
        let occurrences = 0;
        let idx = normalized.indexOf(padded);
        while (idx !== -1) {
          occurrences += 1;
          idx = normalized.indexOf(padded, idx + padded.length);
        }
        if (!occurrences) continue;
        const specificity = keyword.split(/\s+/).length;
        const weighted = occurrences * specificity;
        const existing = scores[family.id];
        if (!existing) {
          scores[family.id] = { label: family.label, score: weighted };
        } else {
          existing.score += weighted;
        }
      }
    }
    return Object.entries(scores)
      .map(([id, info]) => ({ id, label: info.label, score: info.score }))
      .sort((a, b) => b.score - a.score);
  };

  const assessRoleFit = (
    resumeText: string,
    targetDesignation: string,
    jdText: string = ""
  ) => {
    const latestDesignation = extractLatestDesignation(resumeText);
    const resumeFamily = detectRoleFamily(latestDesignation);
    if (!resumeFamily) {
      return { shouldWarn: false };
    }

    const targetFromDesignation = detectRoleFamily(targetDesignation);
    const targetFromJd = detectFamiliesFromJd(jdText);

    // Build the set of plausible target families. If the user mistyped the
    // designation (e.g. "Product" instead of "Project"), the JD body usually
    // still mentions the real role - so any family with a strong JD signal
    // should be treated as a legitimate target.
    const candidateTargets = new Set<string>();
    if (targetFromDesignation) candidateTargets.add(targetFromDesignation.id);

    const topJdScore = targetFromJd[0]?.score ?? 0;
    for (const fam of targetFromJd) {
      // Include the top JD family, plus any family at >= 50% of its score.
      if (fam.score >= Math.max(2, topJdScore * 0.5)) {
        candidateTargets.add(fam.id);
      }
    }

    if (candidateTargets.size === 0) {
      return { shouldWarn: false };
    }

    if (candidateTargets.has(resumeFamily.id)) {
      return { shouldWarn: false };
    }

    // Pick the warning's "target" label: prefer designation, else strongest JD signal.
    const primaryTarget =
      targetFromDesignation ||
      (targetFromJd[0]
        ? { id: targetFromJd[0].id, label: targetFromJd[0].label }
        : null);

    if (!primaryTarget) {
      return { shouldWarn: false };
    }

    return {
      shouldWarn: true,
      resumeFamilyId: resumeFamily.id,
      targetFamilyId: primaryTarget.id,
      resumeFamilyLabel: resumeFamily.label,
      targetFamilyLabel: primaryTarget.label,
    };
  };

  const persistGeneratedDocs = async ({
    optimizedDocs,
    optimizedScore,
  }: {
    optimizedDocs: TailoredDocs;
    optimizedScore: number | null;
  }) => {
    if (!scanJobId) return;
    // Written to its own column: the scan's original score is what the tracker
    // compares against, so it has to survive the optimization.
    const scorePayload =
      typeof optimizedScore === "number" ? { optimizedScore } : {};
    try {
      const response = await fetch("/api/job-tracker", {
        method: "PATCH",
        body: JSON.stringify({
          id: scanJobId,
          ...scorePayload,
          resumeTemplateId: selectedTemplate,
          coverLetterTemplateId: "default-letter",
          generatedResumeText: optimizedDocs.optimizedResumeText,
          generatedCoverLetterText: optimizedDocs.coverLetter,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "Failed to persist generated docs.");
      }
      if (result.partial) {
        notify.warn(
          result.partialMessage ||
            "Score updated, but generated document storage is partially unavailable. Run latest DB migration."
        );
      }
    } catch (error) {
      console.error("Failed to persist generated docs:", error);
      try {
        const fallbackResponse = await fetch("/api/job-tracker", {
          method: "PATCH",
          body: JSON.stringify({ id: scanJobId, ...scorePayload }),
        });
        const fallbackResult = await fallbackResponse.json();
        if (fallbackResult.success) {
          notify.warn(
            "Optimized score updated. Generated documents could not be saved for tracker downloads."
          );
        }
      } catch (fallbackError) {
        console.error("Fallback score update failed:", fallbackError);
      }
    }
  };

  const downloadPdf = async (type: "cv" | "cover") => {
    if (!tailoredDocs) return;
    if (type === "cover" && !shouldAllowCoverLetter) return;
    setMobileAlert(null);
    setDownloadingType(type);
    try {
      const candidateName =
        previewCandidateName.trim() || extractCandidateName(form.resume);
      const candidateSlug = toSlugPart(candidateName);
      const orgSlug = toSlugPart(form.organization || "organization");
      // Prefer the structured object (the source of truth). Fall back to the
      // derived text only when no object is present (old/guest cached docs).
      const html =
        type === "cv"
          ? renderableResumeData
            ? renderResumeFromData({
                data: renderableResumeData,
                templateId: selectedTemplate,
                candidateName,
                designation: previewDesignation,
                photoUrl: resumePhotoUrl,
                overrides: templateOverrides[selectedTemplate],
                useContactIcons: !guestTrial,
              })
            : renderResumeHtml({
                resumeText: editableResumeText || tailoredDocs.optimizedResumeText,
                templateId: selectedTemplate,
                candidateName,
                designation: previewDesignation,
                photoUrl: resumePhotoUrl,
                overrides: templateOverrides[selectedTemplate],
                useContactIcons: !guestTrial,
              })
          : renderCoverLetterHtml(tailoredDocs.coverLetter);

      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        body: JSON.stringify({
          html,
          type: type === "cv" ? "tailored-cv" : "tailored-cover-letter",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate PDF.");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download =
        type === "cv"
          ? `${candidateSlug}-${orgSlug}-resume.pdf`
          : `${candidateSlug}-${orgSlug}-cover-letter.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      // The browser owns the save dialog from here, so this records that the
      // download was started — the closest signal we can observe.
      setDownloadedDocs((prev) => ({ ...prev, [type]: true }));

      // Persist the EXACT optimized resume the user just downloaded, so the Job
      // Tracker can reproduce an identical file. This is the only place the
      // resume payload is stored — the Job Tracker resume download is available
      // only after this runs (fire-and-forget).
      if (type === "cv" && scanJobId && !guestTrial) {
        fetch("/api/job-tracker", {
          method: "PATCH",
          body: JSON.stringify({
            id: scanJobId,
            resumeTemplateId: selectedTemplate,
            generatedResumePayload: {
              resumeData: renderableResumeData || null,
              resumeText: editableResumeText || tailoredDocs.optimizedResumeText,
              template: selectedTemplate,
              overrides: templateOverrides[selectedTemplate] || null,
              candidateName,
              designation: previewDesignation,
              // The storage path, not the signed URL — that expires.
              photoPath: selectedBaseDraft?.photo || "",
            },
          }),
        })
          .then((res) => res.json())
          .then((res) => {
            if (res?.partial) {
              notify.warn(
                res.partialMessage ||
                  "Downloaded — but couldn't save it to Job Tracker. Run the latest database migration."
              );
            }
          })
          .catch((persistError) =>
            console.error("Failed to persist downloaded resume:", persistError)
          );
      }
    } catch (error) {
      console.error(error);
      notify.error("Unable to download PDF right now.");
    } finally {
      setDownloadingType(null);
    }
  };

  /**
   * Documents this plan produces, and which of them are still un-downloaded.
   * A plan without a cover letter, or a guest, who cannot download at all —
   * prompting either of them to "download first" would be a dead end.
   */
  const requiredDownloads: TailoredDocType[] = guestTrial
    ? []
    : shouldAllowCoverLetter
      ? ["cv", "cover"]
      : ["cv"];
  const pendingDownloads = requiredDownloads.filter((doc) => !downloadedDocs[doc]);

  const goToRemoteJob = () => {
    if (!remoteJob) return;
    setPendingExit(null);
    setPreviewOpen(false);
    tourSignal("scan:preview-closed");
    router.push(`/scan?section=remote-jobs&job=${encodeURIComponent(remoteJob.id)}`);
  };

  const closePreview = () => {
    setPendingExit(null);
    setPreviewOpen(false);
    // Everything the tour has left to show lives in this modal.
    tourSignal("scan:preview-closed");
  };

  /**
   * Both exits from the preview throw the generated documents away — it has no
   * reopen path — so each one checks the download ledger first. Nothing is
   * outstanding, nothing is asked: the confirm is a safety net, not a toll.
   */
  const requestExit = (intent: PendingExit) => {
    if (pendingDownloads.length === 0) {
      if (intent === "apply") goToRemoteJob();
      else closePreview();
      return;
    }
    setPendingExit(intent);
  };

  // A section switch is one more exit. In practice it only happens on phones:
  // the desktop preview is a modal over the sidebar, while the phone flow keeps
  // the tab bar in reach. With nothing outstanding the preview just closes (so
  // the tour hears about it) and the switch goes ahead unasked.
  const hasPendingDownloads = pendingDownloads.length > 0;
  useEffect(() => {
    if (!registerLeaveGuard) return;
    registerLeaveGuard((proceed) => {
      if (!previewOpen) return false;
      if (!hasPendingDownloads) {
        setPendingExit(null);
        setPreviewOpen(false);
        tourSignal("scan:preview-closed");
        return false;
      }
      leaveProceedRef.current = proceed;
      setPendingExit("leave");
      return true;
    });
    return () => registerLeaveGuard(null);
  }, [registerLeaveGuard, previewOpen, hasPendingDownloads, tourSignal]);

  const createTailoredDocuments = async (
    careerChangeApproved = false,
    selectedCareerKeywords?: string[]
  ) => {
    if (!result) {
      notify.error("Run a scan first.");
      return;
    }
    if (optimizeWait.waiting) {
      notify.info(optimizeWaitLabel);
      return;
    }
    setMobileAlert(null);

    // Role-mismatch warning and the keyword picker both open below the tour
    // overlay, so get it off the screen for the rest of this flow.
    tourSignal("scan:optimizing");

    if (guestTrial && guestTrialStage === "optimized") {
      redirectGuestToSignUp();
      return;
    }

    if (guestTrial) {
      setGuestSummaryOpen(false);
    }

    if (!careerChangeApproved) {
      const fit = assessRoleFit(form.resume, form.designation, form.jd);
      if (fit.shouldWarn) {
        setFitInsight({
          resumeFamilyId: fit.resumeFamilyId as string,
          targetFamilyId: fit.targetFamilyId as string,
          resumeFamilyLabel: fit.resumeFamilyLabel as string,
          targetFamilyLabel: fit.targetFamilyLabel as string,
        });
        setShowCareerWarning(true);
        return;
      }
    }

    // Pre-optimization keyword selection: the user picks which missing keywords
    // they can genuinely back up. Only those are woven in — nothing is invented.
    // Everything selectable starts checked (same set as "Select all"), so the
    // user deselects what they can't back up rather than rebuilding the list.
    if (selectedCareerKeywords === undefined && result.missingKeywords.length) {
      setCareerSelectedKeywords(
        result.missingKeywords.filter((k) => !isDegreeKeyword(k))
      );
      setKeywordPickerCareerChange(careerChangeApproved);
      setShowCareerKeywordPicker(true);
      return;
    }

    const keywordsForTailoring = selectedCareerKeywords || [];
    const keywordSelectionApplied = selectedCareerKeywords !== undefined;

    setOptimizationStepIndex(0);
    setIsGeneratingDocs(true);
    setFinalScore(null);
    setFinalScoreBreakdown(null);
    setScoreBreakdownOpen(false);
    try {
      // profileContact already reflects the selected base resume (or the guest's
      // profile), applied when the resume was chosen.
      const latestProfile = profileContact;
      // Authoritative structured experience from the selected base resume, so
      // the optimizer preserves exact company/location/designation fields.
      const selectedDraft = baseResumeList.find(
        (r) => r.id === selectedBaseResumeId
      )?.draft;
      const selectedResumeData = selectedDraft ? draftToResumeData(selectedDraft) : null;
      const structuredExperience = selectedResumeData?.experience || [];
      const structuredProjects = selectedResumeData?.projects || [];
      const structuredEducation = selectedResumeData?.education || [];
      const response = await authedFetch("/api/tailor-documents", {
        method: "POST",
        body: JSON.stringify({
          resume: form.resume,
          jd: form.jd,
          organization: form.organization,
          designation: form.designation,
          missingKeywords: result.missingKeywords,
          selectedMissingKeywords: keywordsForTailoring,
          keywordSelectionApplied,
          matchedKeywords: result.matchedKeywords,
          weightedKeywords: result.weightedKeywords || [],
          hasSummary: result.sectionAnalysis?.foundSections?.summary ?? false,
          analysisSuggestions: result.suggestions || [],
          formattingWarnings: result.formattingWarnings || [],
          scoreBreakdown: result.scoreBreakdown || null,
          titleAnalysis: result.titleAnalysis || null,
          experienceAnalysis: result.experienceAnalysis || null,
          careerChangeApproved,
          resumeRoleFamily: fitInsight?.resumeFamilyId || "",
          targetRoleFamily: fitInsight?.targetFamilyId || "",
          profileContact: latestProfile,
          includeCoverLetter: shouldAllowCoverLetter,
          // The base resume's structured experience — authoritative field
          // mapping (designation/company/location/duration) so the optimizer
          // never has to re-parse it from ambiguous text.
          structuredExperience,
          // Structured projects (with links) — links are re-attached from here
          // since the model output has no link field.
          structuredProjects,
          // Structured education — every saved entry is checked for in the
          // output and put back if the model dropped it.
          structuredEducation,
        }),
      });
      const data = await response.json();

      if (!data.success) {
        notify.error(data.message || "Unable to generate tailored documents.");
        // A fair-use refusal starts the header's break timer; refresh it.
        if (!guestTrial) onUsageChange?.();
        return;
      }

      setTailoredDocs(data.message);
      // New documents: whatever was downloaded before no longer counts.
      setDownloadedDocs({ cv: false, cover: false });
      setResumeData(data.message.optimizedResume || null);
      setEditableResumeText(data.message.optimizedResumeText || "");
      setHasResumePreviewEdits(false);
      setPreviewCandidateName(extractCandidateName(form.resume));
      setPreviewDesignation(form.designation);
      setPreviewView("resume");
      // On a phone the preview opens on the rendered document, not the editor —
      // the first thing anyone wants after optimizing is to see the result.
      setMobilePreviewPane("preview");
      setPreviewOpen(true);
      tourSignal("scan:optimized");
      if (guestTrial) {
        setGuestTrialStage("optimized");
      }
      setIsComputingFinalScore(true);
      let optimizedScore: number | null = null;

      try {
        const finalScoreResponse = await authedFetch("/api/analyze", {
          method: "POST",
          body: JSON.stringify({
            resume: data.message.optimizedResumeText,
            jd: form.jd,
            organization: form.organization,
            designation: form.designation,
            skipUsageTracking: true,
            experienceYears:
              baseResumeList.find((r) => r.id === selectedBaseResumeId)?.draft
                .experienceYears || "",
            candidateTitle:
              baseResumeList.find((r) => r.id === selectedBaseResumeId)?.draft
                .designation || "",
          }),
        });
        const finalScoreData = await finalScoreResponse.json();
        if (finalScoreData.success) {
          optimizedScore = finalScoreData.message.initialScore;
          setFinalScore(optimizedScore);
          setFinalScoreBreakdown(finalScoreData.message.scoreBreakdown || null);
        }
      } catch (scoreError) {
        console.error("Unable to compute final score:", scoreError);
      } finally {
        setIsComputingFinalScore(false);
      }
      await persistGeneratedDocs({
        optimizedDocs: data.message,
        optimizedScore,
      });
      if (guestTrial) {
        persistGuestState("optimized");
      } else {
        // The header counts today's optimizations. Refreshed only now, after
        // the re-score, because the usage row is written once the optimize
        // response has gone out.
        onUsageChange?.();
      }

      notify.success(
        shouldAllowCoverLetter
          ? "Tailored CV and cover letter are ready."
          : "Tailored CV is ready."
      );
    } catch (error) {
      console.error(error);
      notify.error("Unexpected error while generating tailored documents.");
    } finally {
      setIsGeneratingDocs(false);
      // If generation failed there is no preview to point at, so bring the
      // paused tour step back. On the success path a preview step has already
      // taken over and this does nothing.
      tourSignal("scan:idle");
    }
  };

  useEffect(() => {
    if (guestTrial) return;
    loadProfileContact();
  }, [loadProfileContact, guestTrial]);

  // Arriving from Remote Jobs: fill the organization, role and JD the user
  // would otherwise have had to copy across, then release the prefill so a
  // later visit to this section starts clean. `resume` is left alone — the base
  // resume loader owns it, and both use functional updates so neither wins.
  useEffect(() => {
    if (!prefill) return;
    setForm((prev) => ({
      ...prev,
      organization: prefill.organization ?? prev.organization,
      designation: prefill.designation ?? prev.designation,
      jd: prefill.jd ?? prev.jd,
    }));
    setFormErrors({});
    if (prefill.source) setScanSource(prefill.source);
    if (prefill.remoteJob) setRemoteJob(prefill.remoteJob);
    onPrefillConsumed?.();
  }, [prefill, onPrefillConsumed]);

  useEffect(() => {
    if (!guestTrial || typeof window === "undefined") return;
    const stage = (localStorage.getItem(GUEST_STAGE_KEY) || "none") as GuestTrialStage;
    setGuestTrialStage(stage);
    // Cleanup old persisted trial payloads from previous versions.
    localStorage.removeItem("syncv_guest_trial_form");
    localStorage.removeItem("syncv_guest_trial_result");
    localStorage.removeItem("syncv_guest_trial_docs");
  }, [guestTrial]);

  useEffect(() => {
    if (!guestTrial) return;
    if (guestTrialStage === "none") return;
    if (result || tailoredDocs) return;
    setForm(initialFormState);
    setFormErrors({});
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [guestTrial, guestTrialStage, result, tailoredDocs]);

  useEffect(() => {
    if (!isAnalyzing) {
      setAnalyzingLabelIndex(0);
      return;
    }
    const intervalId = window.setInterval(() => {
      setAnalyzingLabelIndex((prev) => (prev + 1) % analyzingLabels.length);
    }, 2400);
    return () => window.clearInterval(intervalId);
  }, [isAnalyzing, analyzingLabels.length]);

  useEffect(() => {
    if (!isAnalyzing) {
      setAnalysisStepIndex(0);
      return;
    }
    const intervalId = window.setInterval(() => {
      setAnalysisStepIndex((prev) => {
        if (prev >= analysisSteps.length - 1) return prev;
        return prev + 1;
      });
    }, 2000);
    return () => window.clearInterval(intervalId);
  }, [isAnalyzing, analysisSteps.length]);

  useEffect(() => {
    if (!isGeneratingDocs) {
      setGeneratingLabelIndex(0);
      return;
    }
    const intervalId = window.setInterval(() => {
      setGeneratingLabelIndex((prev) => (prev + 1) % generatingLabels.length);
    }, 2400);
    return () => window.clearInterval(intervalId);
  }, [isGeneratingDocs, generatingLabels.length]);

  // Every fresh scan earns a fresh nudge, so re-scanning after a tweak draws
  // the eye back to the CTA.
  useEffect(() => {
    setCtaNudgeAcknowledged(false);
  }, [result]);

  // When a scan lands on a narrow screen the summary is stacked a full screen
  // below the form, so the analysis modal closes and nothing appears to have
  // happened — the score and the "Create tailored CV" CTA are off-frame. Bring
  // them into view once the modal is gone.
  //
  // The cutoff is the same `xl` breakpoint the two-column grid uses: at `xl` and
  // up the summary already sits beside the form and is never scrolled past, so
  // desktop is deliberately left alone. Guests are skipped too — their summary
  // opens in a centred modal, which needs no scrolling.
  useEffect(() => {
    if (guestTrial || !result || isAnalyzing) return;
    if (!window.matchMedia("(max-width: 1279px)").matches) return;

    // One frame of slack so the analysis modal has actually unmounted and the
    // summary has its final height before we measure a scroll target.
    const frameId = window.requestAnimationFrame(() => {
      summaryPanelRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [result, isAnalyzing, guestTrial]);

  useEffect(() => {
    if (!isGeneratingDocs) {
      setOptimizationStepIndex(0);
      return;
    }
    const intervalId = window.setInterval(() => {
      setOptimizationStepIndex((prev) => {
        if (prev >= optimizationSteps.length - 1) return prev;
        return prev + 1;
      });
    }, 4500);
    return () => window.clearInterval(intervalId);
  }, [isGeneratingDocs, optimizationSteps.length]);

  const reevaluateEditedResumeScore = async () => {
    const resumeForScore = resumeData
      ? resumeDataToText(resumeData)
      : editableResumeText;
    setMobileAlert(null);
    if (!resumeForScore.trim() || !form.jd.trim()) {
      notify.error("Edited resume or JD is missing.");
      return;
    }
    setIsComputingFinalScore(true);
    try {
      const response = await authedFetch("/api/analyze", {
        method: "POST",
        body: JSON.stringify({
          resume: resumeForScore,
          jd: form.jd,
          organization: form.organization,
          designation: form.designation,
          skipUsageTracking: true,
          experienceYears:
            baseResumeList.find((r) => r.id === selectedBaseResumeId)?.draft
              .experienceYears || "",
          candidateTitle:
            baseResumeList.find((r) => r.id === selectedBaseResumeId)?.draft
              .designation || "",
        }),
      });
      const data = await response.json();
      if (data.success) {
        setFinalScore(data.message.initialScore);
        setFinalScoreBreakdown(data.message.scoreBreakdown || null);
        setHasResumePreviewEdits(false);
        // The tracker shows this same number, so keep it in step with the
        // rescored edit (fire-and-forget — the score on screen is the point).
        if (scanJobId && !guestTrial) {
          fetch("/api/job-tracker", {
            method: "PATCH",
            body: JSON.stringify({
              id: scanJobId,
              optimizedScore: data.message.initialScore,
            }),
          }).catch((persistError) =>
            console.error("Failed to persist re-evaluated score:", persistError)
          );
        }
        notify.success("Score updated for your edits.");
      } else {
        notify.error(data.message || "Unable to re-evaluate resume.");
      }
    } catch (error) {
      console.error("Unable to recompute score for edited resume:", error);
      notify.error("Unable to re-evaluate resume right now.");
    } finally {
      setIsComputingFinalScore(false);
    }
  };

  useEffect(() => {
    if (!previewOpen || !tailoredDocs?.optimizedResumeText) return;
    if (!editableResumeText.trim()) {
      setEditableResumeText(tailoredDocs.optimizedResumeText);
    }
  }, [previewOpen, tailoredDocs, editableResumeText]);

  useEffect(() => {
    if (!previewOpen) return;

    const burst = async () => {
      try {
        const confettiModule = await import("canvas-confetti");
        const confetti = confettiModule.default;
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.7 },
        });
        confetti({
          particleCount: 90,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.75 },
        });
        confetti({
          particleCount: 90,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.75 },
        });
      } catch (error) {
        console.error("Unable to trigger confetti:", error);
      }
    };

    burst();
    if (!profilePhotoUrl) {
      loadProfilePhoto();
    }
  }, [previewOpen, profilePhotoUrl, loadProfilePhoto]);

  // Put the preview in the state each tour step is describing. The design panel
  // and the rendered document both live behind a tab, so without this the tour
  // would spotlight a target that is one click away from being on screen — and
  // on a phone, where only one pane shows at a time, not on screen at all.
  useEffect(() => {
    if (!tourStepId) return;
    if (tourStepId === "preview-document") {
      setPreviewView("resume");
      setMobilePreviewPane("preview");
    } else if (tourStepId === "preview-editor") {
      setPreviewView("resume");
      setMobilePreviewPane("edit");
      setEditorTab("content");
    } else if (tourStepId === "preview-design") {
      setPreviewView("resume");
      setMobilePreviewPane("edit");
      setEditorTab("design");
    }
  }, [tourStepId]);

  const isFormComplete = (Object.values(form) as string[]).every((value) =>
    value.trim()
  );
  const initialScanScore = result?.initialScore ?? null;
  const scoreBand =
    initialScanScore === null
      ? {
          textClass: "text-slate-900",
          pillClass: "bg-slate-100 text-slate-500",
          label: "",
          encouragement: "",
        }
      : initialScanScore < 55
      ? {
          textClass: "text-red-600",
          pillClass: "bg-red-50 text-red-700",
          label: "Needs work",
          encouragement: "Do not worry, we have got you covered.",
        }
      : initialScanScore < 70
      ? {
          textClass: "text-orange-500",
          pillClass: "bg-orange-50 text-orange-700",
          label: "Almost there",
          encouragement: "You are close. A few focused tweaks can lift this quickly.",
        }
      : initialScanScore < 80
      ? {
          textClass: "text-yellow-500",
          pillClass: "bg-yellow-50 text-yellow-700",
          label: "Good",
          encouragement: "Nice progress. Tighten the keyword match and your resume can get stronger.",
        }
      : {
          textClass: "text-emerald-600",
          pillClass: "bg-emerald-50 text-emerald-700",
          label: "Strong",
          encouragement: "Your resume rocks already. You can still tweak it for the exact role.",
        };
  const scoreDelta =
    finalScore !== null && initialScanScore !== null
      ? finalScore - initialScanScore
      : null;
  const scoreRingCircumference = 2 * Math.PI * 52;
  const scorePercent = Math.max(0, Math.min(100, initialScanScore ?? 0));

  // Nudge only while the CTA is actually actionable: after a scan, before any
  // documents exist, and never while a generation or scan is already running
  // (the button is disabled and showing its own spinner in those states).
  const showCtaNudge =
    Boolean(result) &&
    !ctaNudgeAcknowledged &&
    !tailoredDocs &&
    !isGeneratingDocs &&
    !isAnalyzing &&
    !isUploading;

  // Only take over the screen with the subscribe prompt when the user has no
  // in-progress work. If a scan result or the optimized preview is open (e.g.
  // the trial just got consumed by this very scan), keep it visible so the flow
  // isn't interrupted — the lock applies to starting the NEXT scan.
  if (subscriptionLocked && !guestTrial && !result && !previewOpen) {
    return (
      <section className="space-y-8">
        {!hideTopHeading ? (
          <div className="flex flex-col gap-2">
            <h1 className="flex gap-1 items-center text-2xl font-semibold text-slate-900 sm:text-3xl"><ScanLine /> Scan</h1>
            <p className="text-sm text-slate-500 font-medium">
              Analyze your resume against a target role and improve ATS performance.
            </p>
          </div>
        ) : null}
        <SubscriptionGate
          event="scan_locked_upgrade_clicked"
          title="You're out of scans"
          body="Scanning is paused until you pick a plan. Everything you've already built — your base resumes, scores and generated documents — stays exactly where it is."
          highlights={[
            "Scan any job description against your base resume",
            "Tailored CV and cover letter for every application",
            "Remote Jobs and Job Tracker included",
          ]}
        />
      </section>
    );
  }

  const summaryPanel = (
    // The fixed-height inner scroller only makes sense in the two-column `xl`
    // layout. On phones it created a scroll area inside the page scroll — you
    // had to find the right 34rem box to flick. Below `xl` it just grows.
    //
    // scroll-mt clears the sticky dashboard app bar (plus the status-bar inset
    // when installed) so the auto-scroll above doesn't park the "Scan summary"
    // heading underneath it. It stacks with the 3rem scroll-padding-top that
    // globals.css sets on <html>.
    <div
      ref={summaryPanelRef}
      data-tour="scan-summary"
      className="scroll-mt-[calc(1.5rem+env(safe-area-inset-top))] rounded-lg shadow-xl bg-white p-4 xl:h-[34rem] xl:overflow-y-scroll"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-slate-900">Scan summary</h2>
        <p className="text-sm text-slate-500 font-medium">
          We compare your resume against every keyword found in the JD.
        </p>
      </div>

      {/* Repeated here, not just in the preview: once that modal is closed it
          cannot be reopened, and without this the user is stranded on a scan
          with no route back to the job it was for. */}
      {remoteJob ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Scanning against
            </p>
            <p className="truncate text-sm font-semibold text-slate-900">
              {remoteJob.title}
            </p>
            {remoteJob.companyName ? (
              <p className="truncate text-sm text-slate-500">
                {remoteJob.companyName}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 rounded-md"
            onClick={() => requestExit("apply")}
          >
            <ArrowRight className="mr-2 h-4 w-4" />
            Go to the job to apply
          </Button>
        </div>
      ) : null}
      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Resume score
        </p>
        <div className={`relative mx-auto my-5 h-40 w-40 ${scoreBand.textClass}`}>
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="9"
            />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="currentColor"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={scoreRingCircumference}
              strokeDashoffset={
                scoreRingCircumference * (1 - (result ? scorePercent : 0) / 100)
              }
              style={{ transition: "stroke-dashoffset 0.7s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-bold leading-none">
              {result ? result.initialScore : "—"}
            </span>
            <span className="mt-1 text-[11px] font-medium text-slate-400">out of 100</span>
          </div>
        </div>
        {result && scoreBand.label ? (
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${scoreBand.pillClass}`}
          >
            {scoreBand.label}
          </span>
        ) : null}
        <div className="mt-3 text-xs text-slate-500">
          {result ? (
            <div className="space-y-1">
              <p>Based on {result.keywordUniverse.length} extracted keywords.</p>
              <p className={`text-sm font-semibold ${scoreBand.textClass}`}>
                {scoreBand.encouragement}
              </p>
            </div>
          ) : (
            "Fill the form and run a scan to see your score."
          )}
        </div>
      </div>

      {result && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="relative">
            {/* Two rings half a cycle apart, so a second ping is already on its
                way out as the next one leaves the button — a radar sweep
                rather than a single repeating blip. */}
            {showCtaNudge && !optimizeWait.waiting ? (
              <>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-md animate-cta-ping motion-reduce:hidden"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 rounded-md animate-cta-ping [animation-delay:-0.9s] motion-reduce:hidden"
                />
              </>
            ) : null}
            <Button
              className={cn("relative w-full rounded-md", optimizeWait.waiting && "tabular-nums")}
              onClick={() => createTailoredDocuments()}
              onMouseEnter={() => setCtaNudgeAcknowledged(true)}
              onFocus={() => setCtaNudgeAcknowledged(true)}
              disabled={isGeneratingDocs || isAnalyzing || isUploading || optimizeWait.waiting}
            >
              {isGeneratingDocs ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : optimizeWait.waiting ? (
                <Clock3 className="mr-2 h-4 w-4" />
              ) : (
                <WandSparkles className="mr-2 h-4 w-4" />
              )}
              {isGeneratingDocs
                ? generatingLabels[generatingLabelIndex]
                : optimizeWait.waiting
                  ? optimizeWaitLabel
                  : "Create tailored CV & Cover letter"}
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-slate-500">
            {optimizeWait.blockedBy === "daily"
              ? `You've used today's ${optimizationUsage?.dailyLimit} optimizations. They reset at midnight UTC.`
              : optimizeWait.waiting
                ? `A short break after ${optimizationUsage?.hourlyLimit} optimizations in an hour. This unlocks when it ends.`
                : "Generate optimized documents from this score."}
          </p>
        </div>
      )}

      {result && (
        <div className="mt-4 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <p className="text-sm font-semibold text-slate-900">Matched keywords</p>
              <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                {result.matchedKeywords.length}
              </span>
            </div>
            {result.matchedKeywords.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {result.matchedKeywords.map((keyword) => (
                  <li
                    key={keyword}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                  >
                    {keyword}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                None of the extracted keywords are present yet.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-rose-600">
                <XCircleIcon className="h-4 w-4" />
              </span>
              <p className="text-sm font-semibold text-slate-900">Missing keywords</p>
              <span className="ml-auto rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                {result.missingKeywords.length}
              </span>
            </div>
            {result.missingKeywords.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {result.missingKeywords.map((keyword) => (
                  <li
                    key={keyword}
                    className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700"
                  >
                    {keyword}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">
                Great! Your resume covers every keyword we found.
              </p>
            )}
          </div>
        </div>
      )}

      {result?.suggestions?.length ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-600">
              <Lightbulb className="h-4 w-4" />
            </span>
            <p className="text-sm font-semibold text-slate-900">Suggestions</p>
          </div>
          <ul className="space-y-2">
            {result.suggestions.map((item) => (
              <li key={item} className="flex gap-2 text-xs text-slate-600">
                <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* {result?.experienceAnalysis && (
        <div className="mt-4 rounded-xl border border-slate-100 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Experience analysis</p>
          <p className="mt-2">
            Estimated experience:{" "}
            <span className="font-medium text-slate-900">
              {result.experienceAnalysis.totalYears} years
            </span>
          </p>
          <p className="mt-1">
            JD requirement:{" "}
            <span className="font-medium text-slate-900">
              {result.experienceAnalysis.requiredYears !== null
                ? `${result.experienceAnalysis.requiredYears}+ years`
                : "Not explicitly specified"}
            </span>
          </p>
        </div>
      )} */}

      {/* {result?.achievementAnalysis && (
        <div className="mt-4 rounded-xl border border-slate-100 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Achievement analysis</p>
          <p className="mt-2">
            Measurable bullet points:{" "}
            <span className="font-medium text-slate-900">
              {result.achievementAnalysis.measurableBullets}
            </span>
          </p>
        </div>
      )} */}

      {result?.sectionAnalysis?.foundSections && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-600">
              <Layers className="h-4 w-4" />
            </span>
            <p className="text-sm font-semibold text-slate-900">Detected sections</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(result.sectionAnalysis.foundSections).map(([name, present]) => (
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
      )}

    </div>
  );


  // ---- Shared by the desktop preview and the phone flow ----------------------

  // Highlight added keywords in the PREVIEW only — downloadPdf() renders its
  // own HTML, so the PDF is never highlighted.
  const renderPreviewResumeHtml = () => {
    if (!tailoredDocs) return "";
    return highlightKeywordsInHtml(
      renderableResumeData
        ? renderResumeFromData({
            data: renderableResumeData,
            templateId: selectedTemplate,
            candidateName: previewCandidateName,
            designation: previewDesignation,
            photoUrl: resumePhotoUrl,
            overrides: templateOverrides[selectedTemplate],
            useContactIcons: !guestTrial,
          })
        : renderResumeHtml({
            resumeText: editableResumeText || tailoredDocs.optimizedResumeText,
            templateId: selectedTemplate,
            candidateName: previewCandidateName,
            designation: previewDesignation,
            photoUrl: resumePhotoUrl,
            overrides: templateOverrides[selectedTemplate],
            useContactIcons: !guestTrial,
          }),
      tailoredDocs.incorporatedKeywords || []
    );
  };

  // The phone flow edits one section at a time; the desktop preview shows
  // them all. Both share the one editor session, so drafts carry across.
  const renderResumeContentEditor = (
    sections?: ResumeEditorSection[],
    onNotice?: (tone: "info" | "error", message: string) => void
  ) =>
    resumeData ? (
      <ResumeEditor
        sections={sections}
        onNotice={onNotice}
        showPreview={false}
        session={resumeEditorSession}
        data={resumeData}
        onChange={(next) => {
          setResumeData(next);
          setEditableResumeText(resumeDataToText(next));
          setHasResumePreviewEdits(true);
        }}
        templateId={selectedTemplate}
        candidateName={previewCandidateName}
        designation={previewDesignation}
        onCandidateNameChange={(value) => {
          setPreviewCandidateName(value);
          setHasResumePreviewEdits(true);
        }}
        onDesignationChange={(value) => {
          setPreviewDesignation(value);
          setHasResumePreviewEdits(true);
        }}
        photoUrl={resumePhotoUrl}
        overrides={templateOverrides[selectedTemplate]}
        useContactIcons={!guestTrial}
      />
    ) : (
      <textarea
        className="min-h-[440px] w-full rounded-md border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
        value={editableResumeText}
        onChange={(event) => {
          setEditableResumeText(event.target.value);
          setHasResumePreviewEdits(true);
        }}
      />
    );
  const resumeContentEditor = renderResumeContentEditor();

  const templateDesigner = (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Template Designer
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 rounded-md px-3 text-xs"
          onClick={resetTemplateOverrides}
        >
          Reset
        </Button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {selectedTemplateConfig.description}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-slate-600">
          Accent
          <input
            type="color"
            className="mt-1 h-9 w-full cursor-pointer rounded-md border border-slate-300 bg-white p-1"
            value={selectedTemplateTheme.accent}
            onChange={(event) =>
              updateTemplateOverrides({ accent: event.target.value })
            }
          />
        </label>
        <label className="text-xs text-slate-600">
          Heading Color
          <input
            type="color"
            className="mt-1 h-9 w-full cursor-pointer rounded-md border border-slate-300 bg-white p-1"
            value={selectedTemplateTheme.headingColor}
            onChange={(event) =>
              updateTemplateOverrides({
                headingColor: event.target.value,
              })
            }
          />
        </label>
        <label className="text-xs text-slate-600">
          Body Color
          <input
            type="color"
            className="mt-1 h-9 w-full cursor-pointer rounded-md border border-slate-300 bg-white p-1"
            value={selectedTemplateTheme.bodyColor}
            onChange={(event) =>
              updateTemplateOverrides({ bodyColor: event.target.value })
            }
          />
        </label>
        <label className="text-xs text-slate-600">
          Font
          <select
            className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs"
            value={selectedTemplateTheme.fontFamily}
            onChange={(event) =>
              updateTemplateOverrides({ fontFamily: event.target.value })
            }
          >
            {RESUME_FONT_OPTIONS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-600">
          Base Font Size ({selectedTemplateTheme.baseFontSize}px)
          <input
            type="range"
            min={11}
            max={15}
            step={1}
            className="mt-2 w-full"
            value={selectedTemplateTheme.baseFontSize}
            onChange={(event) =>
              updateTemplateOverrides({
                baseFontSize: Number(event.target.value),
              })
            }
          />
        </label>
        <label className="text-xs text-slate-600">
          Line Height ({selectedTemplateTheme.lineHeight.toFixed(2)})
          <input
            type="range"
            min={1.35}
            max={1.95}
            step={0.05}
            className="mt-2 w-full"
            value={selectedTemplateTheme.lineHeight}
            onChange={(event) =>
              updateTemplateOverrides({
                lineHeight: Number(event.target.value),
              })
            }
          />
        </label>
        <label className="text-xs text-slate-600">
          Section Spacing ({selectedTemplateTheme.sectionSpacing}px)
          <input
            type="range"
            min={10}
            max={24}
            step={1}
            className="mt-2 w-full"
            value={selectedTemplateTheme.sectionSpacing}
            onChange={(event) =>
              updateTemplateOverrides({
                sectionSpacing: Number(event.target.value),
              })
            }
          />
        </label>
        {selectedTemplateConfig.layout.photo !== "none" ? (
          <label className="flex items-start gap-2 text-xs text-slate-600 sm:col-span-2">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
              checked={selectedTemplateTheme.showPhoto}
              onChange={(event) =>
                updateTemplateOverrides({
                  showPhoto: event.target.checked,
                })
              }
            />
            <span>
              Show photo
              {!resumePhotoUrl ? (
                <span className="block text-[11px] text-slate-400">
                  Add one under Personal details in your base resume.
                </span>
              ) : null}
            </span>
          </label>
        ) : null}
      </div>
    </div>
  );

  const careerWarningDialog =
    showCareerWarning && fitInsight ? (
      <div className={cn(DIALOG_BACKDROP, "z-[80]")}>
        <div className={cn(DIALOG_PANEL, "max-w-lg", DIALOG_BODY)}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Potential Role Mismatch
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                Your resume appears aligned to{" "}
                <span className="font-semibold">{fitInsight.resumeFamilyLabel}</span>, but
                this scan targets{" "}
                <span className="font-semibold">{fitInsight.targetFamilyLabel}</span>.
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Are you looking for a career change?
              </p>
            </div>
          </div>

          {/* Thumb-reachable on a phone: two equal full-width buttons, with
              the affirmative first in the visual order it reads best. */}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setShowCareerWarning(false);
                tourSignal("scan:idle");
                notify.info("No changes were made. Try scanning against a closer role.");
              }}
            >
              No
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={optimizeWait.waiting}
              onClick={() => {
                setShowCareerWarning(false);
                createTailoredDocuments(true);
              }}
            >
              Yes
            </Button>
          </div>
        </div>
      </div>
    ) : null;

  // Leaving the preview — by closing it, heading to the job, or (on a phone)
  // stepping back or switching section — throws the generated documents away,
  // and there is no way back into it. This is the last chance to save them, so
  // it sits above the preview itself.
  const exitConfirmDialog = pendingExit ? (
    <div className={cn(DIALOG_BACKDROP, "z-[90]")}>
      <div className={cn(DIALOG_PANEL, "max-w-lg", DIALOG_BODY)}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-slate-900">
              {EXIT_COPY[pendingExit].title}
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              {pendingDownloads.length === requiredDownloads.length
                ? `You haven't downloaded your ${requiredDownloads
                    .map((doc) => DOC_LABELS[doc])
                    .join(" or ")} yet.`
                : `You still haven't downloaded your ${pendingDownloads
                    .map((doc) => DOC_LABELS[doc])
                    .join(" or ")}.`}
            </p>
            <p className="mt-2 text-sm text-slate-600">{EXIT_COPY[pendingExit].detail}</p>
          </div>
        </div>

        {/* Same geometry as the other confirms in this section: two equal
            full-width buttons on a phone, the affirmative reading last. */}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            className="w-full sm:w-auto"
            onClick={() => {
              leaveProceedRef.current = null;
              setPendingExit(null);
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            No, let me download first
          </Button>
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => {
              if (pendingExit === "apply") {
                goToRemoteJob();
                return;
              }
              const proceed = pendingExit === "leave" ? leaveProceedRef.current : null;
              leaveProceedRef.current = null;
              closePreview();
              proceed?.();
            }}
          >
            Go ahead
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  if (isMobileLayout && !guestTrial) {
    const selectableKeywords = result
      ? result.missingKeywords.filter((keyword) => !isDegreeKeyword(keyword))
      : [];
    return (
      <section className={className}>
        <MobileScanFlow
          form={form}
          formErrors={formErrors}
          onFieldChange={updateForm}
          onAnalyze={analyzeResume}
          isAnalyzing={isAnalyzing}
          onReset={resetForm}
          baseResumes={baseResumeList}
          baseResumeLoading={baseResumeLoading}
          selectedBaseResumeId={selectedBaseResumeId}
          onSelectBaseResume={applyBaseResume}
          onManageBaseResumes={() => router.push("/scan?section=base-resume")}
          result={result}
          scoreComponents={SCORE_COMPONENTS}
          remoteJob={remoteJob}
          allowsCoverLetter={shouldAllowCoverLetter}
          optimizeWait={{
            waiting: optimizeWait.waiting,
            label: optimizeWaitLabel,
            note:
              optimizeWait.blockedBy === "daily"
                ? `You've used today's ${optimizationUsage?.dailyLimit} optimizations. They reset at midnight UTC.`
                : `A short break after ${optimizationUsage?.hourlyLimit} optimizations in an hour. This unlocks when it ends.`,
          }}
          onOptimize={() => createTailoredDocuments()}
          isGeneratingDocs={isGeneratingDocs}
          alert={mobileAlert}
          onDismissAlert={() => setMobileAlert(null)}
          keywordPicker={{
            open: showCareerKeywordPicker,
            selectable: selectableKeywords,
            selected: careerSelectedKeywords,
            onToggle: toggleCareerKeyword,
            onSelectAll: () => setCareerSelectedKeywords(selectableKeywords),
            onClear: () => setCareerSelectedKeywords([]),
            onBack: () => {
              setShowCareerKeywordPicker(false);
              tourSignal("scan:idle");
            },
            onContinue: () => {
              setShowCareerKeywordPicker(false);
              createTailoredDocuments(keywordPickerCareerChange, careerSelectedKeywords);
            },
          }}
          preview={{
            open: previewOpen,
            docs: tailoredDocs,
            view: previewView,
            onViewChange: setPreviewView,
            initialScore: initialScanScore,
            finalScore,
            finalScoreBreakdown,
            isComputingFinalScore,
            hasEdits: hasResumePreviewEdits,
            onReevaluate: reevaluateEditedResumeScore,
            resumeHtml: previewOpen ? renderPreviewResumeHtml() : "",
            coverLetterHtml:
              previewOpen && tailoredDocs ? renderCoverLetterHtml(tailoredDocs.coverLetter) : "",
            renderEditor: (section, onNotice) =>
              renderResumeContentEditor(section ? [section] : undefined, onNotice),
            editorHasSections: resumeData !== null,
            designer: templateDesigner,
            templateId: selectedTemplate,
            onTemplateChange: setSelectedTemplate,
            downloadingType,
            downloaded: downloadedDocs,
            onDownload: downloadPdf,
            onRequestExit: requestExit,
          }}
        />
        {careerWarningDialog}
        {exitConfirmDialog}
      </section>
    );
  }

  return (
    <section className={cn("space-y-8", className)}>
      {!hideTopHeading && (
        <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="flex gap-1 items-center text-2xl font-semibold text-slate-900 sm:text-3xl">
            <TrendingUp /> Optimize your resume
          </h1>
          <p className="text-sm text-slate-500 font-medium">
            Provide the target role, paste the JD, and let SynCV evaluate your resume.
          </p>
        </div>

        <Button className="rounded-md" onClick={resetForm}>
          <RefreshCcw className="h-4 w-4" /> New Scan
        </Button>
      </div>
      )}

      <div
        className={cn(
          "grid gap-6",
          guestTrial ? "grid-cols-1" : "xl:grid-cols-[1.5fr,1fr]"
        )}
      >
        <div
          data-tour="scan-form"
          className="rounded-lg shadow-xl bg-white p-4 shadow-sm space-y-6 sm:p-6"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">
                Organization <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="Acme Corp"
                value={form.organization}
                onChange={(event) =>
                  updateForm("organization", event.target.value)
                }
                className={cn(
                  formErrors.organization &&
                    "border-red-500 focus-visible:ring-red-500"
                )}
              />
              {formErrors.organization && (
                <p className="text-xs text-red-600">{formErrors.organization}</p>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">
                Role / designation <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="AI Engineer"
                value={form.designation}
                onChange={(event) =>
                  updateForm("designation", event.target.value)
                }
                className={cn(
                  formErrors.designation &&
                    "border-red-500 focus-visible:ring-red-500"
                )}
              />
              {formErrors.designation && (
                <p className="text-xs text-red-600">{formErrors.designation}</p>
              )}
            </div>
          </div>

          {guestTrial ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600">
                    Job description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className={cn(
                      "min-h-[140px] w-full rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20",
                      formErrors.jd &&
                        "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2"
                    )}
                    placeholder="Paste the key responsibilities, required skills, etc."
                    value={form.jd}
                    onChange={(event) => updateForm("jd", event.target.value)}
                  />
                  {formErrors.jd && (
                    <p className="text-xs text-red-600">{formErrors.jd}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600">
                    Resume content <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    className={cn(
                      "min-h-[140px] w-full rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20",
                      formErrors.resume &&
                        "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2"
                    )}
                    placeholder="Paste your resume or upload a PDF/DOC/DOCX file."
                    value={form.resume}
                    onChange={(event) => updateForm("resume", event.target.value)}
                  />
                  {formErrors.resume && (
                    <p className="text-xs text-red-600">{formErrors.resume}</p>
                  )}
                </div>
              </div>

              <div
                className="flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-500"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(event.dataTransfer.files);
                }}
              >
                <UploadCloud className="h-8 w-8 text-slate-400" />
                {/* There is no drag-and-drop on a touch device, so phones get a
                    plain "tap to upload" instruction and a real button; the
                    drag wording returns on pointer layouts. */}
                <p className="hidden text-sm sm:block">
                  Drag and drop a PDF/DOC/DOCX or{" "}
                  <button
                    type="button"
                    className="font-semibold text-slate-900 underline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    browse files
                  </button>
                </p>
                <p className="text-sm sm:hidden">Upload your resume as PDF, DOC or DOCX</p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-md sm:hidden"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className="mr-2 h-4 w-4" />
                  Choose file
                </Button>
                <p className="text-xs text-slate-400">
                  {isUploading
                    ? "Parsing resume..."
                    : "Only the first file will be processed."}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(event) => handleDrop(event.target.files)}
                />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">
                  Job description <span className="text-red-500">*</span>
                </label>
                <textarea
                  className={cn(
                    "min-h-[160px] w-full rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20",
                    formErrors.jd &&
                      "border-red-500 focus-visible:ring-red-500 focus-visible:ring-2"
                  )}
                  placeholder="Paste the key responsibilities, required skills, etc."
                  value={form.jd}
                  onChange={(event) => updateForm("jd", event.target.value)}
                />
                {formErrors.jd && (
                  <p className="text-xs text-red-600">{formErrors.jd}</p>
                )}
              </div>

              {baseResumeLoading ? (
                <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading your base resume…
                </div>
              ) : hasBaseResume ? (
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900/5 text-slate-600">
                        <FileText className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">
                          {baseResumeList.length > 1
                            ? "Choose a base resume to tailor"
                            : "Scanning against your base resume"}
                        </p>
                        <p className="text-xs text-slate-500">
                          The JD is compared to the selected resume.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                      onClick={() => router.push("/scan?section=base-resume")}
                    >
                      Manage
                    </button>
                  </div>

                  {baseResumeList.length > 1 ? (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {baseResumeList.map((record) => {
                        const active = record.id === selectedBaseResumeId;
                        return (
                          <button
                            key={record.id}
                            type="button"
                            onClick={() => applyBaseResume(record)}
                            aria-pressed={active}
                            className={cn(
                              "flex items-start justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition",
                              active
                                ? "border-slate-900 bg-slate-50 ring-2 ring-slate-900/10"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                            )}
                          >
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate text-sm font-medium text-slate-900">
                                  {record.name}
                                </span>
                                {record.isDefault ? (
                                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    <Star className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500" />
                                    Default
                                  </span>
                                ) : null}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-slate-400">
                                {record.draft.designation || "No title"}
                              </span>
                            </span>
                            <span
                              className={cn(
                                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition",
                                active
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-300 bg-white text-transparent"
                              )}
                            >
                              <Check className="h-3 w-3" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      Using{" "}
                      <span className="font-semibold text-slate-800">
                        {baseResumeList[0]?.name || "your base resume"}
                      </span>
                      .
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-4">
                  <AlertCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <div className="flex-1 text-sm text-amber-800">
                    <p className="font-medium">No base resume yet</p>
                    <p className="mt-0.5">
                      Set up your base resume first — every scan is tailored from it.
                    </p>
                    <Button
                      size="sm"
                      className="mt-3 rounded-md"
                      onClick={() => router.push("/scan?section=base-resume")}
                    >
                      Set up base resume
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              className="rounded-md w-full md:w-auto"
              onClick={
                guestTrial && guestTrialStage !== "none"
                  ? redirectGuestToSignUp
                  : analyzeResume
              }
              disabled={
                isAnalyzing || isUploading || (!isFormComplete && guestTrialStage === "none")
              }
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {isAnalyzing
                ? analyzingLabels[analyzingLabelIndex]
                : guestTrial && guestTrialStage !== "none"
                ? "Trial used - Register to continue"
                : "Analyze resume"}
            </Button>
            <Button
              variant="outline"
              className="rounded-md w-full md:w-auto"
              onClick={resetForm}
              disabled={isAnalyzing}
            >
              Clear inputs
            </Button>
          </div>
          {guestTrial && (
            <div className="">
              <p className="mt-4 text-xs text-slate-500 text-center md:text-right font-medium">
                You can run one guest scan and one guest optimization. To continue after that,
                registration is required.
              </p>
            </div>
          )}
        </div>

        {!guestTrial ? summaryPanel : null}
      </div>

      {guestTrial && guestSummaryOpen && result && !previewOpen && (
        <div className={cn(DIALOG_BACKDROP, "z-[66]")}>
          <div className={cn(DIALOG_PANEL, "relative max-w-3xl", DIALOG_BODY_TIGHT)}>
            <button
              type="button"
              aria-label="Close summary"
              className="absolute right-3 top-3 rounded-full p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:right-5 sm:top-5 sm:rounded-md sm:p-2"
              onClick={() => setGuestSummaryOpen(false)}
            >
              <X className="h-5 w-5 sm:h-4 sm:w-4" />
            </button>
            {summaryPanel}
          </div>
        </div>
      )}

      {careerWarningDialog}

      {showCareerKeywordPicker && result && (
        <div className={cn(DIALOG_BACKDROP, "z-[80]")}>
          {/* This one keeps its own flex/overflow structure (the chip list is the
              only scrolling part, between a pinned header and footer), so it
              takes the sheet geometry from DIALOG_BACKDROP rather than the
              scroll-everything DIALOG_PANEL. */}
          <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[88vh] sm:rounded-2xl">
            {/* Header */}
            <div className="border-b border-slate-100 px-4 pb-4 pt-5 sm:px-6">
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="flex items-center gap-3">
                  <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 sm:flex">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <h3 className="text-base font-semibold text-slate-900 sm:text-lg">
                    Which of these can you back up?
                  </h3>
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  className="-mr-1.5 -mt-1.5 shrink-0 rounded-full p-2.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 sm:m-0 sm:rounded-md sm:p-1"
                  onClick={() => {
                    setShowCareerKeywordPicker(false);
                    tourSignal("scan:idle");
                  }}
                >
                  <X className="h-5 w-5 sm:h-4 sm:w-4" />
                </button>
              </div>
              {/* The one line in this dialog that must not be skimmed: every
                  chip arrives selected, so this is what stands between the user
                  and a resume claiming a skill they don't have. Styled as a
                  caution rather than supporting copy for exactly that reason. */}
              <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 sm:ml-12">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-sm leading-relaxed text-amber-900">
                  <strong className="font-semibold">We never invent experience.</strong>{" "}
                  Select only the keywords you genuinely have — we&apos;ll weave those
                  into your resume where they fit. The rest stay out.
                </p>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4 sm:px-6">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                <Check className="h-3.5 w-3.5" />
                {careerSelectedKeywords.length} of{" "}
                {result.missingKeywords.filter((k) => !isDegreeKeyword(k)).length} selected
              </span>
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  className="font-medium text-slate-600 hover:text-slate-900"
                  onClick={() =>
                    setCareerSelectedKeywords(
                      result.missingKeywords.filter((k) => !isDegreeKeyword(k))
                    )
                  }
                >
                  Select all
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  className="font-medium text-slate-600 hover:text-slate-900"
                  onClick={() => setCareerSelectedKeywords([])}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Keyword chips, grouped so language requirements are called out */}
            <div className="touch-scroll mt-3 flex-1 space-y-4 overflow-y-auto px-4 pb-2 sm:px-6">
              {[
                {
                  key: "skills",
                  title: null,
                  hint: null,
                  keywords: result.missingKeywords.filter(
                    (k) => !isLanguageKeyword(k) && !isDegreeKeyword(k)
                  ),
                },
                {
                  key: "languages",
                  title: "Languages this role mentions",
                  hint: "Select a language only if you actually speak or write it — it's added to a Languages section, never to Skills.",
                  keywords: result.missingKeywords.filter(
                    (k) => isLanguageKeyword(k) && !isDegreeKeyword(k)
                  ),
                },
              ]
                .filter((group) => group.keywords.length)
                .map((group) => (
                  <div key={group.key}>
                    {group.title ? (
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <Languages className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {group.title}
                        </span>
                      </div>
                    ) : null}
                    {group.hint ? (
                      <p className="mb-2 text-xs text-slate-500">{group.hint}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {group.keywords.map((keyword) => {
                        const selected = careerSelectedKeywords.includes(keyword);
                        return (
                          <button
                            key={keyword}
                            type="button"
                            onClick={() => toggleCareerKeyword(keyword)}
                            aria-pressed={selected}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                              selected
                                ? "border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm"
                                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-4 w-4 items-center justify-center rounded-full border transition",
                                selected
                                  ? "border-emerald-500 bg-emerald-500 text-white"
                                  : "border-slate-300 bg-white text-transparent"
                              )}
                            >
                              <Check className="h-3 w-3" />
                            </span>
                            {keyword}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>

            {/* Footer */}
            <div className="mt-2 border-t border-slate-100 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
              <p className="mb-3 flex items-start gap-1.5 text-xs text-slate-500">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Only selected keywords are added, and only where they truthfully fit your
                experience. You can optimize with none selected for a structure-only pass.
              </p>
              {/* column-reverse: the primary action sits at the bottom of the
                  sheet, closest to the thumb, without changing tab order. */}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <Button
                  variant="outline"
                  className="w-full rounded-md sm:w-auto"
                  disabled={optimizeWait.waiting}
                  onClick={() => {
                    setShowCareerKeywordPicker(false);
                    createTailoredDocuments(keywordPickerCareerChange, []);
                  }}
                >
                  Optimize without keywords
                </Button>
                <Button
                  className={cn("w-full rounded-md sm:w-auto", optimizeWait.waiting && "tabular-nums")}
                  disabled={optimizeWait.waiting}
                  onClick={() => {
                    setShowCareerKeywordPicker(false);
                    createTailoredDocuments(
                      keywordPickerCareerChange,
                      careerSelectedKeywords
                    );
                  }}
                >
                  {optimizeWait.waiting ? (
                    <Clock3 className="mr-2 h-4 w-4" />
                  ) : (
                    <WandSparkles className="mr-2 h-4 w-4" />
                  )}
                  {optimizeWait.waiting
                    ? optimizeWaitLabel
                    : careerSelectedKeywords.length
                      ? `Add ${careerSelectedKeywords.length} & optimize`
                      : "Optimize"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAnalyzing && (
        <div className={cn(DIALOG_BACKDROP, "z-[70]")}>
          <div className={cn(DIALOG_PANEL, "max-w-md", DIALOG_BODY)}>
            <h3 className="text-lg font-semibold text-slate-900">
              Analyzing your resume...
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Live analysis progress
            </p>
            <ul className="mt-5 space-y-3">
              {analysisSteps.map((step, index) => {
                const isCompleted = index < analysisStepIndex;
                const isActive = index === analysisStepIndex;
                return (
                  <li key={step} className="flex items-center gap-3 text-sm">
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-slate-300" />
                    )}
                    <span
                      className={cn(
                        isCompleted
                          ? "text-slate-700"
                          : isActive
                          ? "font-medium text-slate-900"
                          : "text-slate-400"
                      )}
                    >
                      {step}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {isGeneratingDocs && (
        <div className={cn(DIALOG_BACKDROP, "z-[70]")}>
          <div className={cn(DIALOG_PANEL, "max-w-md", DIALOG_BODY)}>
            <h3 className="text-lg font-semibold text-slate-900">
              Optimizing your resume...
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              This might take a minute or two..
            </p>
            <ul className="mt-5 space-y-3">
              {optimizationSteps.map((step, index) => {
                const isCompleted = index < optimizationStepIndex;
                const isActive = index === optimizationStepIndex;
                return (
                  <li key={step} className="flex items-center gap-3 text-sm">
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-slate-300" />
                    )}
                    <span
                      className={cn(
                        isCompleted
                          ? "text-slate-700"
                          : isActive
                          ? "font-medium text-slate-900"
                          : "text-slate-400"
                      )}
                    >
                      {step}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {previewOpen && tailoredDocs && (
        // The preview is the app's main workspace, so on a phone it takes the
        // whole screen — edge to edge, no backdrop gutter, no rounded corners —
        // the way a pushed screen would in a native app. From `sm` up it fills
        // the viewport inside one even gutter, so the editor and preview get
        // all the room there is. `!mt-0`: see DIALOG_BACKDROP.
        <div className="fixed inset-0 z-50 !mt-0 flex items-center justify-center bg-slate-900/60 sm:p-8">
          <div className="flex h-full w-full flex-col overflow-hidden bg-white pt-safe shadow-2xl sm:rounded-2xl sm:pt-0">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="text-base font-semibold text-slate-900 sm:text-lg">
                    {shouldAllowCoverLetter
                      ? "Tailored CV & Cover Letter"
                      : "Tailored CV preview"}
                  </h3>
                  {isComputingFinalScore ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Scoring…
                    </span>
                  ) : finalScore !== null ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setScoreBreakdownOpen((open) => !open)}
                        title="See score breakdown"
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-white shadow-sm ring-1 transition hover:brightness-110",
                          (scoreDelta ?? 0) >= 0
                            ? "bg-emerald-600 ring-emerald-700/20"
                            : "bg-rose-600 ring-rose-700/20"
                        )}
                      >
                        <TrendingUp
                          className={cn("h-4 w-4", (scoreDelta ?? 0) >= 0 ? "" : "rotate-180")}
                        />
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/80">
                          Score
                        </span>
                        <span className="flex items-baseline gap-1">
                          <span className="text-sm font-medium text-white/70 line-through">
                            {initialScanScore ?? "—"}
                          </span>
                          <span className="text-white/70">→</span>
                          <span className="text-lg font-bold leading-none">{finalScore}</span>
                        </span>
                        {scoreDelta !== null ? (
                          <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold tabular-nums">
                            {scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta}
                          </span>
                        ) : null}
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 text-white/70 transition",
                            scoreBreakdownOpen ? "rotate-180" : ""
                          )}
                        />
                      </button>

                      {scoreBreakdownOpen && finalScoreBreakdown ? (
                        <div className="absolute left-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xl">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              Score breakdown
                            </p>
                            <span className="text-sm font-bold text-slate-900">
                              {finalScore}/100
                            </span>
                          </div>
                          <div className="space-y-2.5">
                            {SCORE_COMPONENTS.map((component) => {
                              const value = Math.round(
                                Number(finalScoreBreakdown?.[component.key] ?? 0)
                              );
                              const contribution = Math.round((value * component.weight) / 100);
                              return (
                                <div key={component.key}>
                                  <div className="flex items-center justify-between gap-2 text-xs">
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
                                    <span className="tabular-nums font-medium text-slate-700">
                                      +{contribution}
                                    </span>
                                  </div>
                                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                    <div
                                      className={cn(
                                        "h-full rounded-full",
                                        component.keywordDriven ? "bg-emerald-500" : "bg-slate-400"
                                      )}
                                      style={{ width: `${Math.min(100, value)}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] leading-snug text-slate-500">
                            Only the two{" "}
                            <span className="font-semibold text-emerald-600">keyword-driven</span>{" "}
                            rows (55%) move when you add keywords. The rest reflect your real
                            experience, titles, and quantified results — the honest ceiling on a
                            keyword-only pass.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <p className="mt-1 hidden text-xs text-slate-500 sm:block">
                  Edit any field — the preview updates live.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {shouldAllowCoverLetter ? (
                  <div
                    data-tour="preview-cover-tab"
                    className="hidden gap-1 rounded-lg bg-slate-100 p-1 sm:flex"
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewView("resume")}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm transition",
                        previewView === "resume"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Resume
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewView("cover")}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm transition",
                        previewView === "cover"
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Cover letter
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  aria-label="Close preview"
                  className="-mr-1.5 rounded-full p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:mr-0 sm:rounded-md sm:p-2"
                  onClick={() => requestExit("close")}
                >
                  <X className="h-5 w-5 sm:h-4 sm:w-4" />
                </button>
              </div>
            </div>

            {/* Phone-only switcher. Two rows of segments rather than one: the
                document choice (Resume / Cover letter) and, for the resume,
                which half of the split view is on screen. Both segmented
                controls are hidden from `sm` up, where the header tabs and the
                side-by-side layout do the same jobs. */}
            <div className="flex shrink-0 flex-col gap-2 border-b border-slate-200 px-4 py-2.5 sm:hidden">
              {shouldAllowCoverLetter ? (
                <div data-tour="preview-cover-tab" className="flex gap-1 rounded-lg bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setPreviewView("resume")}
                    className={cn(
                      "flex-1 rounded-md px-3 py-2 text-sm transition",
                      previewView === "resume"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600"
                    )}
                  >
                    Resume
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewView("cover")}
                    className={cn(
                      "flex-1 rounded-md px-3 py-2 text-sm transition",
                      previewView === "cover"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600"
                    )}
                  >
                    Cover letter
                  </button>
                </div>
              ) : null}
              {previewView === "resume" || !shouldAllowCoverLetter ? (
                <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setMobilePreviewPane("edit")}
                    className={cn(
                      "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm transition",
                      mobilePreviewPane === "edit"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600"
                    )}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobilePreviewPane("preview")}
                    className={cn(
                      "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm transition",
                      mobilePreviewPane === "preview"
                        ? "bg-white text-slate-900 shadow-sm"
                        : "text-slate-600"
                    )}
                  >
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </button>
                </div>
              ) : null}
            </div>

            {previewView === "resume" || !shouldAllowCoverLetter ? (
              <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
                <div
                  className={cn(
                    "flex min-h-0 flex-col border-b border-slate-200 lg:border-b-0 lg:border-r",
                    // Below `lg` only one pane is on screen at a time; `lg:flex`
                    // restores the split view untouched.
                    mobilePreviewPane === "preview" && "hidden lg:flex"
                  )}
                >
                  <div className="flex shrink-0 gap-1 px-4 pt-3">
                    <button
                      type="button"
                      onClick={() => setEditorTab("content")}
                      className={cn(
                        "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition",
                        editorTab === "content"
                          ? "border-slate-900 font-medium text-slate-900"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      )}
                    >
                      <FileText className="h-4 w-4" /> Content
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditorTab("design")}
                      className={cn(
                        "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition",
                        editorTab === "design"
                          ? "border-slate-900 font-medium text-slate-900"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      )}
                    >
                      <Palette className="h-4 w-4" /> Design
                    </button>
                  </div>
                  <div
                    data-tour="preview-editor"
                    className="min-h-0 flex-1 overflow-auto border-t border-slate-200 bg-slate-50 p-4"
                  >
                    {editorTab === "content" ? (
                      resumeContentEditor
                    ) : (
                      <div data-tour="preview-design" className="space-y-4">
                        <div>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Template
                          </p>
                          <ResumeTemplatePicker
                            selected={selectedTemplate}
                            onSelect={setSelectedTemplate}
                          />
                        </div>
                      {templateDesigner}
                      </div>
                    )}
                  </div>
                </div>
                <div
                  data-tour="preview-document"
                  className={cn(
                    "flex min-h-0 flex-col bg-slate-100",
                    mobilePreviewPane === "edit" && "hidden lg:flex"
                  )}
                >
                  <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Preview
                      </span>
                      {tailoredDocs.incorporatedKeywords?.length ? (
                        <span className="hidden items-center gap-1.5 text-[11px] text-slate-500 sm:inline-flex">
                          <span
                            aria-hidden
                            className="inline-block h-2.5 w-4 rounded-sm"
                            style={{ backgroundColor: "rgba(16,185,129,0.18)" }}
                          />
                          Added keywords — not shown in the download
                        </span>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 text-slate-500">
                      <button
                        type="button"
                        aria-label="Zoom out"
                        className="rounded-md border border-slate-300 bg-white p-2 hover:bg-slate-50 sm:p-1"
                        onClick={() =>
                          setPreviewZoom((z) => Math.max(0.6, Math.round((z - 0.1) * 10) / 10))
                        }
                      >
                        <Minus className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                      </button>
                      <span className="w-9 text-center text-xs tabular-nums">
                        {Math.round(previewZoom * 100)}%
                      </span>
                      <button
                        type="button"
                        aria-label="Zoom in"
                        className="rounded-md border border-slate-300 bg-white p-2 hover:bg-slate-50 sm:p-1"
                        onClick={() =>
                          setPreviewZoom((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10))
                        }
                      >
                        <Plus className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="touch-scroll min-h-0 flex-1 overflow-auto px-3 pb-6 sm:px-5">
                    <div
                      className="mx-auto w-full max-w-[820px] overflow-hidden rounded-md bg-white shadow-md ring-1 ring-slate-200"
                      style={{ zoom: previewZoom }}
                    >
                      <div
                        dangerouslySetInnerHTML={{
                          __html: renderPreviewResumeHtml(),
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="touch-scroll min-h-0 flex-1 overflow-auto bg-slate-100 p-3 sm:p-6">
                <div
                  className="mx-auto max-w-3xl rounded-md bg-white p-5 shadow-md ring-1 ring-slate-200 sm:p-8"
                  dangerouslySetInnerHTML={{
                    __html: renderCoverLetterHtml(tailoredDocs.coverLetter),
                  }}
                />
              </div>
            )}
            {/* Download is the point of this screen, so on a phone the footer
                becomes a pinned action bar: buttons full width, the keyword
                notes above them, and padding for the home indicator. */}
            <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 pb-[max(1rem,calc(env(safe-area-inset-bottom)+0.5rem))] sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-4">
              <div className="min-w-0 flex-1 space-y-0.5">
                {tailoredDocs.incorporatedKeywords?.length ? (
                  <p
                    className="truncate text-xs text-emerald-700"
                    title={tailoredDocs.incorporatedKeywords.join(", ")}
                  >
                    <span className="font-semibold">Added:</span>{" "}
                    {tailoredDocs.incorporatedKeywords.join(", ")}
                  </p>
                ) : null}
                {tailoredDocs.stillMissingKeywords?.length ? (
                  <p
                    className="truncate text-xs text-slate-500"
                    title={tailoredDocs.stillMissingKeywords.join(", ")}
                  >
                    <span className="font-semibold text-slate-600">Not included:</span>{" "}
                    {tailoredDocs.stillMissingKeywords.join(", ")}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {previewView === "resume" && hasResumePreviewEdits ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-md sm:flex-none"
                    onClick={reevaluateEditedResumeScore}
                    disabled={isComputingFinalScore}
                  >
                    {isComputingFinalScore ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="mr-2 h-4 w-4" />
                    )}
                    Re-evaluate
                  </Button>
                ) : null}
                <Button
                  data-tour="preview-download"
                  className="flex-1 rounded-md sm:flex-none"
                  disabled={
                    guestTrial ||
                    downloadingType === "cv" ||
                    downloadingType === "cover" ||
                    isComputingFinalScore
                  }
                  onClick={() => {
                    if (guestTrial) return;
                    downloadPdf(previewView === "cover" ? "cover" : "cv");
                  }}
                >
                  {guestTrial ? (
                    <Download className="mr-2 h-4 w-4" />
                  ) : downloadingType === "cv" || downloadingType === "cover" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  {guestTrial
                    ? "Login to download"
                    : previewView === "cover"
                      ? "Download cover letter"
                      : "Download CV"}
                </Button>
                {remoteJob ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 rounded-md sm:flex-none"
                    onClick={() => requestExit("apply")}
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    {/* The full label does not survive a 360px row beside
                        Download, so phones get the verb on its own. */}
                    <span className="sm:hidden">Apply</span>
                    <span className="hidden sm:inline">Go to the job to apply</span>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {exitConfirmDialog}
    </section>
  );
};
