"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "react-toastify";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import {
  getResumeTemplateConfig,
  RESUME_FONT_OPTIONS,
  RESUME_TEMPLATE_CONFIGS,
  resolveResumeTemplateTheme,
} from "@/components/resume-templates/config";
import {
  extractCandidateName,
  renderCoverLetterHtml,
  renderResumeHtml,
  toSlugPart,
} from "@/components/resume-templates/render";
import {
  ResumeTemplateId,
  ResumeTemplateThemeOverrides,
} from "@/components/resume-templates/types";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Download,
  FileText,
  Loader2,
  RefreshCcw,
  UploadCloud,
  WandSparkles,
  X,
} from "lucide-react";

type ScanSummary = {
  initialScore: number;
  finalAtsScore?: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  keywordUniverse: string[];
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

type FormField = keyof typeof initialFormState;
type FormErrors = Partial<Record<FormField, string>>;

type ScanSectionProps = {
  guestTrial?: boolean;
  hideTopHeading?: boolean;
  className?: string;
  subscriptionLocked?: boolean;
  planKey?: string | null;
  allowsCoverLetter?: boolean;
};

type GuestTrialStage = "none" | "analyzed" | "optimized";

const GUEST_STAGE_KEY = "syncv_guest_trial_stage";

export const ScanSection = ({
  guestTrial = false,
  hideTopHeading = false,
  className,
  subscriptionLocked = false,
  planKey = null,
  allowsCoverLetter = true,
}: ScanSectionProps = {}) => {
  const router = useRouter();
  const [form, setForm] = useState(initialFormState);
  const [result, setResult] = useState<ScanSummary | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingDocs, setIsGeneratingDocs] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [tailoredDocs, setTailoredDocs] = useState<TailoredDocs | null>(null);
  const [downloadingType, setDownloadingType] = useState<"cv" | "cover" | null>(
    null
  );
  const [scanJobId, setScanJobId] = useState<string | null>(null);
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
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [isComputingFinalScore, setIsComputingFinalScore] = useState(false);
  const [editableResumeText, setEditableResumeText] = useState("");
  const [hasResumePreviewEdits, setHasResumePreviewEdits] = useState(false);
  const [analyzingLabelIndex, setAnalyzingLabelIndex] = useState(0);
  const [generatingLabelIndex, setGeneratingLabelIndex] = useState(0);
  const [showCareerWarning, setShowCareerWarning] = useState(false);
  const [showCareerKeywordPicker, setShowCareerKeywordPicker] = useState(false);
  const [careerSelectedKeywords, setCareerSelectedKeywords] = useState<string[]>([]);
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
  const editableResumePreviewRef = useRef<HTMLDivElement | null>(null);
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
        "developer",
        "frontend engineer",
        "backend engineer",
        "full stack",
        "web engineer",
      ],
    },
    {
      id: "project-management",
      label: "Project Management",
      keywords: [
        "project manager",
        "project coordinator",
        "program manager",
        "delivery manager",
        "scrum master",
      ],
    },
    {
      id: "product-management",
      label: "Product",
      keywords: ["product manager", "product owner", "product coordinator"],
    },
    {
      id: "education",
      label: "Education",
      keywords: ["teacher", "professor", "tutor", "lecturer", "educator"],
    },
    {
      id: "operations",
      label: "Operations",
      keywords: ["operations", "coordinator", "administrator", "office assistant"],
    },
  ];
  const isSpeedPlan = planKey === "speed";
  const shouldAllowCoverLetter = !isSpeedPlan && allowsCoverLetter;
  const selectedTemplateConfig = getResumeTemplateConfig(selectedTemplate);
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

  const getSessionUserId = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.user?.id || "";
  };

  const redirectGuestToSignUp = () => {
    toast.info("Your free trial is complete. Please register to continue.");
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
    if (!validateForm()) {
      toast.error("Please complete all required fields.");
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
        toast.error("Please log in to save scan results.");
        setIsAnalyzing(false);
        return;
      }
      if (guestTrial && guestTrialStage !== "none") {
        setIsAnalyzing(false);
        redirectGuestToSignUp();
        return;
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: JSON.stringify({
          resume: form.resume,
          jd: form.jd,
          organization: form.organization,
          designation: form.designation,
          userId: sessionUserId,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setResult(data.message);

        if (guestTrial) {
          setGuestTrialStage("analyzed");
          setGuestSummaryOpen(true);
          persistGuestState("analyzed");
          toast.success("Scan completed!");
          return;
        }

        if (!isSpeedPlan) {
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
              toast.success("Scan completed and saved to job tracker!");
            } else {
              setScanJobId(null);
              toast.success("Scan completed! (Could not save to tracker)");
            }
          } catch (saveError) {
            console.error("Error saving to job tracker:", saveError);
            setScanJobId(null);
            toast.success("Scan completed! (Could not save to tracker)");
          }
        } else {
          setScanJobId(null);
          toast.success("Scan completed!");
        }
      } else {
        toast.error(data.message || "Unable to analyze the resume right now.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Unexpected error while analyzing.");
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
    setResult(null);
    setTailoredDocs(null);
    setPreviewOpen(false);
    setGuestSummaryOpen(false);
    setScanJobId(null);
    setSelectedTemplate("classic-blue");
    setFinalScore(null);
    setEditableResumeText("");
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

  const loadProfileContact = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("email, phone, linkedin, portfolio, github, behance, other_link")
        .eq("id", userId)
        .maybeSingle();

      if (error) return null;

      const nextProfile = {
        email: data?.email || session?.user?.email || "",
        phone: data?.phone || "",
        linkedin: data?.linkedin || "",
        portfolio: data?.portfolio || "",
        github: data?.github || "",
        behance: data?.behance || "",
        otherLink: data?.other_link || "",
      };

      setProfileContact(nextProfile);
      return nextProfile;
    } catch (error) {
      console.error("Failed to load profile contact:", error);
      return null;
    }
  }, []);

  const detectRoleFamily = (text: string) => {
    const normalized = text.toLowerCase();
    let best: { id: string; label: string; score: number } | null = null;
    for (const family of roleFamilies) {
      let score = 0;
      for (const keyword of family.keywords) {
        if (normalized.includes(keyword)) score += 1;
      }
      if (!best || score > best.score) {
        best = { id: family.id, label: family.label, score };
      }
    }
    if (!best || best.score === 0) return null;
    return best;
  };

  const assessRoleFit = (resumeText: string, targetDesignation: string) => {
    const resumeFamily = detectRoleFamily(resumeText);
    const targetFamily = detectRoleFamily(targetDesignation);

    if (!resumeFamily || !targetFamily) {
      return { shouldWarn: false };
    }
    if (resumeFamily.id === targetFamily.id) {
      return { shouldWarn: false };
    }

    return {
      shouldWarn: true,
      resumeFamilyId: resumeFamily.id,
      targetFamilyId: targetFamily.id,
      resumeFamilyLabel: resumeFamily.label,
      targetFamilyLabel: targetFamily.label,
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
    const scorePayload =
      typeof optimizedScore === "number" ? { initialScore: optimizedScore } : {};
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
        toast.warn(
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
          toast.warn(
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
    setDownloadingType(type);
    try {
      const candidateName = extractCandidateName(form.resume);
      const candidateSlug = toSlugPart(candidateName);
      const orgSlug = toSlugPart(form.organization || "organization");
      const editedResumeHtml = editableResumePreviewRef.current?.innerHTML || "";
      const html =
        type === "cv"
          ? editedResumeHtml
            ? `<div>${editedResumeHtml}</div>`
            : renderResumeHtml({
                resumeText: editableResumeText || tailoredDocs.optimizedResumeText,
                templateId: selectedTemplate,
                candidateName,
                designation: form.designation,
                photoUrl: profilePhotoUrl,
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
    } catch (error) {
      console.error(error);
      toast.error("Unable to download PDF right now.");
    } finally {
      setDownloadingType(null);
    }
  };

  const createTailoredDocuments = async (
    careerChangeApproved = false,
    selectedCareerKeywords?: string[]
  ) => {
    if (!result) {
      toast.error("Run a scan first.");
      return;
    }

    if (!careerChangeApproved) {
      const fit = assessRoleFit(form.resume, form.designation);
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

    if (
      careerChangeApproved &&
      selectedCareerKeywords === undefined &&
      result.missingKeywords.length
    ) {
      setCareerSelectedKeywords([]);
      setShowCareerKeywordPicker(true);
      return;
    }

    const keywordsForTailoring = careerChangeApproved
      ? selectedCareerKeywords || []
      : result.missingKeywords;

    if (guestTrial && guestTrialStage === "optimized") {
      redirectGuestToSignUp();
      return;
    }

    if (guestTrial) {
      setGuestSummaryOpen(false);
    }

    setOptimizationStepIndex(0);
    setIsGeneratingDocs(true);
    setFinalScore(null);
    try {
      const latestProfile = guestTrial
        ? profileContact
        : (await loadProfileContact()) || profileContact;
      const response = await fetch("/api/tailor-documents", {
        method: "POST",
        body: JSON.stringify({
          userId: await getSessionUserId(),
          resume: form.resume,
          jd: form.jd,
          organization: form.organization,
          designation: form.designation,
          missingKeywords: keywordsForTailoring,
          selectedMissingKeywords: careerChangeApproved ? keywordsForTailoring : [],
          matchedKeywords: result.matchedKeywords,
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
        }),
      });
      const data = await response.json();

      if (!data.success) {
        toast.error(data.message || "Unable to generate tailored documents.");
        return;
      }

      setTailoredDocs(data.message);
      setEditableResumeText(data.message.optimizedResumeText || "");
      setHasResumePreviewEdits(false);
      setPreviewView("resume");
      setPreviewOpen(true);
      if (guestTrial) {
        setGuestTrialStage("optimized");
      }
      setIsComputingFinalScore(true);
      let optimizedScore: number | null = null;

      try {
        const finalScoreResponse = await fetch("/api/analyze", {
          method: "POST",
          body: JSON.stringify({
            resume: data.message.optimizedResumeText,
            jd: form.jd,
            organization: form.organization,
            designation: form.designation,
            userId: await getSessionUserId(),
            skipUsageTracking: true,
          }),
        });
        const finalScoreData = await finalScoreResponse.json();
        if (finalScoreData.success) {
          optimizedScore = finalScoreData.message.initialScore;
          setFinalScore(optimizedScore);
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
      }

      toast.success(
        shouldAllowCoverLetter
          ? "Tailored CV and cover letter are ready."
          : "Tailored CV is ready."
      );
    } catch (error) {
      console.error(error);
      toast.error("Unexpected error while generating tailored documents.");
    } finally {
      setIsGeneratingDocs(false);
    }
  };

  useEffect(() => {
    if (guestTrial) return;
    loadProfileContact();
  }, [loadProfileContact, guestTrial]);

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
    if (!editableResumeText.trim() || !form.jd.trim()) {
      toast.error("Edited resume or JD is missing.");
      return;
    }
    setIsComputingFinalScore(true);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: JSON.stringify({
          resume: editableResumeText,
          jd: form.jd,
          organization: form.organization,
          designation: form.designation,
          userId: await getSessionUserId(),
        }),
      });
      const data = await response.json();
      if (data.success) {
        setFinalScore(data.message.initialScore);
        setHasResumePreviewEdits(false);
        toast.success("Score updated for your edits.");
      } else {
        toast.error(data.message || "Unable to re-evaluate resume.");
      }
    } catch (error) {
      console.error("Unable to recompute score for edited resume:", error);
      toast.error("Unable to re-evaluate resume right now.");
    } finally {
      setIsComputingFinalScore(false);
    }
  };

  const applyPreviewCommand = (command: "bold" | "italic") => {
    if (!editableResumePreviewRef.current) return;
    editableResumePreviewRef.current.focus();
    document.execCommand(command);
    const liveText = editableResumePreviewRef.current.innerText || "";
    setEditableResumeText(liveText);
    setHasResumePreviewEdits(true);
  };

  useEffect(() => {
    if (!previewOpen || !tailoredDocs?.optimizedResumeText) return;
    if (!editableResumeText.trim()) {
      setEditableResumeText(tailoredDocs.optimizedResumeText);
    }
  }, [previewOpen, tailoredDocs, editableResumeText]);

  useEffect(() => {
    if (!previewOpen || previewView !== "resume" || !tailoredDocs) return;
    if (!editableResumePreviewRef.current) return;

    const candidateName = extractCandidateName(form.resume);
    const resumeTextForRender =
      editableResumeText.trim() || tailoredDocs.optimizedResumeText;

    editableResumePreviewRef.current.innerHTML = renderResumeHtml({
      resumeText: resumeTextForRender,
      templateId: selectedTemplate,
      candidateName,
      designation: form.designation,
      photoUrl: profilePhotoUrl,
      overrides: templateOverrides[selectedTemplate],
      useContactIcons: !guestTrial,
    });
  }, [
    previewOpen,
    previewView,
    tailoredDocs,
    selectedTemplate,
    templateOverrides,
    form.resume,
    form.designation,
    profilePhotoUrl,
  ]);

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

  const isFormComplete = (Object.values(form) as string[]).every((value) =>
    value.trim()
  );
  const initialScanScore = result?.initialScore ?? null;
  const scoreDelta =
    finalScore !== null && initialScanScore !== null
      ? finalScore - initialScanScore
      : null;

  if (subscriptionLocked && !guestTrial) {
    return (
      <section className="space-y-8">
        {!hideTopHeading ? (
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Scan</h1>
            <p className="text-sm text-slate-500">
              Analyze your resume against a target role and improve ATS performance.
            </p>
          </div>
        ) : null}
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-amber-900">Subscription Required</h2>
          <p className="mt-2 text-sm text-amber-800">
            Please subscribe to a plan to optimize your resume.
          </p>
        </div>
      </section>
    );
  }

  const summaryPanel = (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Scan summary</h2>
      <p className="text-sm text-slate-500">
        We compare your resume against every keyword found in the JD.
      </p>

      <div className="mt-6 rounded-3xl border border-slate-100 p-6 text-center">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Resume score
        </p>
        <p className="mt-3 text-5xl font-semibold text-slate-900">
          {result ? `${result.initialScore}/100` : "—"}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {result
            ? `Based on ${result.keywordUniverse.length} extracted keywords.`
            : "Fill the form and run a scan to see your score."}
        </p>
      </div>

      {result && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <Button
            className="w-full rounded-full"
            onClick={() => createTailoredDocuments()}
            disabled={isGeneratingDocs || isAnalyzing || isUploading}
          >
            {isGeneratingDocs ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <WandSparkles className="mr-2 h-4 w-4" />
            )}
            {isGeneratingDocs
              ? generatingLabels[generatingLabelIndex]
              : "Create tailored CV & Cover letter"}
          </Button>
          <p className="mt-2 text-center text-xs text-slate-500">
            Generate optimized documents from this score.
          </p>
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-emerald-500" />
              <p className="text-sm font-semibold text-slate-900">
                Matched keywords ({result.matchedKeywords.length})
              </p>
            </div>
            {result.matchedKeywords.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {result.matchedKeywords.map((keyword) => (
                  <li
                    key={keyword}
                    className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"
                  >
                    {keyword}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                None of the extracted keywords are present yet.
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-red-500" />
              <p className="text-sm font-semibold text-slate-900">
                Missing keywords ({result.missingKeywords.length})
              </p>
            </div>
            {result.missingKeywords.length ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {result.missingKeywords.map((keyword) => (
                  <li
                    key={keyword}
                    className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700"
                  >
                    {keyword}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Great! Your resume covers every keyword we found.
              </p>
            )}
          </div>
        </div>
      )}

      {result?.suggestions?.length ? (
        <div className="mt-4 rounded-xl border border-slate-100 p-4">
          <p className="text-sm font-semibold text-slate-900">Suggestions</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {result.suggestions.map((item) => (
              <li key={item}>• {item}</li>
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
        <div className="mt-4 rounded-xl border border-slate-100 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">Detected sections</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(result.sectionAnalysis.foundSections).map(([name, present]) => (
              <span
                key={name}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  present
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                )}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {result?.formattingWarnings?.length ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Formatting warnings</p>
          <ul className="mt-2 space-y-1 text-xs text-amber-800">
            {result.formattingWarnings.map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );

  return (
    <section className={cn("space-y-8", className)}>
      {!hideTopHeading && (
        <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">
            Optimize your resume
          </h1>
          <p className="text-sm text-slate-500">
            Provide the target role, paste the JD, and let SynCV evaluate your resume.
          </p>
        </div>

        <Button variant="outline" className="rounded-full" onClick={resetForm}>
          <RefreshCcw className="mr-2 h-4 w-4" /> New Scan
        </Button>
      </div>
      )}

      <div
        className={cn(
          "grid gap-6",
          guestTrial ? "grid-cols-1" : "xl:grid-cols-[1.5fr,1fr]"
        )}
      >
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          {guestTrial && (
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Try an instant scan</h2>
              <p className="mt-1 text-sm text-slate-500">
                Fill the form below to run one quick resume analysis and optimization preview.
              </p>
            </div>
          )}

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
                placeholder="Senior Frontend Engineer"
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

          <div className={cn("grid gap-4", guestTrial ? "md:grid-cols-2" : "grid-cols-1")}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600">
                Job description <span className="text-red-500">*</span>
              </label>
              <textarea
                className={cn(
                  guestTrial ? "min-h-[180px]" : "min-h-[140px]",
                  "w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20",
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
                  "min-h-[180px] w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20",
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
            className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-500"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              handleDrop(event.dataTransfer.files);
            }}
          >
            <UploadCloud className="h-8 w-8 text-slate-400" />
            <p className="text-sm">
              Drag and drop a PDF/DOC/DOCX or{" "}
              <button
                type="button"
                className="font-semibold text-slate-900 underline"
                onClick={() => fileInputRef.current?.click()}
              >
                browse files
              </button>
            </p>
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

          <div className="flex flex-wrap gap-3">
            <Button
              className="rounded-full"
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
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="mr-2 h-4 w-4" />
              )}
              {isAnalyzing
                ? analyzingLabels[analyzingLabelIndex]
                : guestTrial && guestTrialStage !== "none"
                ? "Trial used - Register to continue"
                : "Analyze my resume"}
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={resetForm}
              disabled={isAnalyzing}
            >
              Clear inputs
            </Button>
          </div>
        </div>

        {!guestTrial ? summaryPanel : null}
      </div>

      {guestTrial && guestSummaryOpen && result && !previewOpen && (
        <div className="fixed inset-0 z-[66] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl">
            <button
              type="button"
              aria-label="Close summary"
              className="absolute right-5 top-5 rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              onClick={() => setGuestSummaryOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
            {summaryPanel}
          </div>
        </div>
      )}

      {showCareerWarning && fitInsight && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
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

            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCareerWarning(false);
                  toast.info("No changes were made. Try scanning against a closer role.");
                }}
              >
                No
              </Button>
              <Button
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
      )}

      {showCareerKeywordPicker && result && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Select keywords to include
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Choose only keywords you are comfortable adding for this career-change resume.
                </p>
              </div>
              <button
                type="button"
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                onClick={() => setShowCareerKeywordPicker(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>{careerSelectedKeywords.length} selected</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="font-medium text-slate-700 underline"
                  onClick={() => setCareerSelectedKeywords(result.missingKeywords)}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="font-medium text-slate-700 underline"
                  onClick={() => setCareerSelectedKeywords([])}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="mt-3 max-h-64 overflow-y-auto rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap gap-2">
                {result.missingKeywords.map((keyword) => {
                  const selected = careerSelectedKeywords.includes(keyword);
                  return (
                    <button
                      key={keyword}
                      type="button"
                      onClick={() => toggleCareerKeyword(keyword)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition",
                        selected
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                      )}
                    >
                      {keyword}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              You can continue with zero keywords selected if you only want structural optimization.
            </p>

            <div className="mt-5 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCareerKeywordPicker(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setShowCareerKeywordPicker(false);
                  createTailoredDocuments(true, careerSelectedKeywords);
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}

      {isAnalyzing && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {shouldAllowCoverLetter
                    ? "Tailored CV & Cover Letter Preview"
                    : "Tailored CV Preview"}
                </h3>
                <p className="text-xs text-slate-500">
                  Review the optimized drafts and download each document separately.
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-700">
                  Score change:{" "}
                  {isComputingFinalScore ? (
                    <span className="text-slate-500">Calculating...</span>
                  ) : finalScore !== null ? (
                    <span className="font-bold text-emerald-600">
                      {initialScanScore ?? "—"}/100 → {finalScore}/100
                      {scoreDelta !== null ? (
                        <span
                          className={cn(
                            "ml-2 rounded-full px-2 py-0.5 text-xs font-semibold",
                            scoreDelta >= 0
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          )}
                        >
                          {scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-slate-500">Unavailable</span>
                  )}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close preview"
                className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                onClick={() => setPreviewOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[calc(90vh-84px)] overflow-y-auto p-5">
              <div className="mb-4 flex items-center gap-2">
                <button
                  type="button"
                  className={cn(
                    "rounded-full px-4 py-2 text-sm transition",
                    previewView === "resume"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  )}
                  onClick={() => setPreviewView("resume")}
                >
                  Resume
                </button>
                {shouldAllowCoverLetter ? (
                  <button
                    type="button"
                    className={cn(
                      "rounded-full px-4 py-2 text-sm transition",
                      previewView === "cover"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    )}
                    onClick={() => setPreviewView("cover")}
                  >
                    Cover Letter
                  </button>
                ) : null}
              </div>

              {previewView === "resume" || !shouldAllowCoverLetter ? (
                <div className="grid gap-4 lg:grid-cols-[360px,1fr]">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <h4 className="text-sm font-semibold text-slate-900">Resume setup</h4>
                        <Button
                          variant="outline"
                          className="rounded-full"
                          disabled={
                            guestTrial ||
                            downloadingType === "cv" ||
                            downloadingType === "cover" ||
                            isComputingFinalScore
                          }
                          onClick={() => {
                            if (guestTrial) return;
                            downloadPdf("cv");
                          }}
                        >
                          {guestTrial ? <Download className="h-4 w-4" /> : downloadingType === "cv" ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="mr-2 h-4 w-4" />
                          )}
                          {guestTrial ? "Login to download" : "Download CV"}
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {RESUME_TEMPLATE_CONFIGS.map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => setSelectedTemplate(template.id)}
                            className={cn(
                              "rounded-full border px-3 py-1 text-xs font-medium transition",
                              selectedTemplate === template.id
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"
                            )}
                          >
                            {template.label}
                          </button>
                        ))}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Template Designer
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 rounded-full px-3 text-xs"
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
                          {/* <label className="flex items-center gap-2 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300"
                              checked={selectedTemplateTheme.showPhoto}
                              onChange={(event) =>
                                updateTemplateOverrides({
                                  showPhoto: event.target.checked,
                                })
                              }
                            />
                            Show profile photo
                          </label> */}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-slate-900">Resume preview</h4>
                    </div>
                    <div className="max-h-[60vh] overflow-auto rounded-lg bg-slate-50 p-4 pt-0">
                      <div className="sticky top-0 z-20 -mx-4 mb-2 border-b border-slate-200 bg-slate-50 px-4 pb-2 pt-1">
                        <p className="mb-2 text-xs text-slate-500">
                          Click and edit directly in the preview, then re-evaluate score when ready.
                        </p>
                        <div className="flex flex-wrap items-center">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 rounded-r border-r-0 px-3 text-xs font-semibold"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              applyPreviewCommand("bold");
                            }}
                          >
                            Bold
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-8 rounded-l px-3 text-xs italic"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              applyPreviewCommand("italic");
                            }}
                          >
                            Italic
                          </Button>
                        </div>
                      </div>
                      <div
                        ref={editableResumePreviewRef}
                        contentEditable
                        suppressContentEditableWarning
                        className="min-h-[420px] rounded-md border border-slate-200 bg-white p-2 focus:outline-none focus:ring-2 focus:ring-slate-900/20"
                        onInput={() => {
                          const liveText = editableResumePreviewRef.current?.innerText || "";
                          setEditableResumeText(liveText);
                          setHasResumePreviewEdits(true);
                        }}
                      />
                      {hasResumePreviewEdits && (
                        <div className="pointer-events-none sticky bottom-3 mt-3 flex justify-end">
                          <Button
                            type="button"
                            className="pointer-events-auto rounded-full shadow-md"
                            onClick={reevaluateEditedResumeScore}
                            disabled={isComputingFinalScore}
                          >
                            {isComputingFinalScore ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Re-evaluate after changes
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold text-slate-900">
                      Tailored Cover Letter
                    </h4>
                    <Button
                      variant="outline"
                      className="rounded-full"
                      disabled={
                        guestTrial ||
                        downloadingType === "cv" ||
                        downloadingType === "cover" ||
                        isComputingFinalScore
                      }
                      onClick={() => {
                        if (guestTrial) return;
                        downloadPdf("cover");
                      }}
                    >
                      {guestTrial ? <Download className="h-4 w-4" /> : downloadingType === "cover" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      {guestTrial ? "Login to download" : "Download Cover Letter"}
                    </Button>
                  </div>
                  <div className="max-h-[60vh] overflow-auto rounded-lg bg-slate-50 p-4">
                    <div
                      dangerouslySetInnerHTML={{
                        __html: renderCoverLetterHtml(tailoredDocs.coverLetter),
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            {tailoredDocs.incorporatedKeywords?.length ? (
              <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-600">
                Incorporated keywords: {tailoredDocs.incorporatedKeywords.join(", ")}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
};
