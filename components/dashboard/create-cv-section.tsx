"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "react-toastify";
import {
  Award,
  Briefcase,
  Download,
  Dribbble,
  FileText,
  FolderGit2,
  Github,
  Globe,
  GraduationCap,
  Languages as LanguagesIcon,
  Link as LinkIcon,
  Linkedin,
  Loader2,
  Minus,
  Palette,
  Plus,
  Sparkles,
  Trash2,
  User,
  Wand2,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import {
  RESUME_FONT_OPTIONS,
  RESUME_TEMPLATE_CONFIGS,
  resolveResumeTemplateTheme,
} from "@/components/resume-templates/config";
import {
  ResumeTemplateId,
  ResumeTemplateThemeOverrides,
} from "@/components/resume-templates/types";
import {
  renderResumeFromData,
  toSlugPart,
  type ResumeData,
} from "@/components/resume-templates/render";

type ExperienceDraft = {
  designation: string;
  company: string;
  location: string;
  duration: string;
  text: string;
};
type EducationDraft = {
  qualification: string;
  institution: string;
  location: string;
  duration: string;
  details: string;
};
type CertificationDraft = { title: string; link: string };
type ProjectDraft = { name: string; link: string; text: string };
type SkillCategory = { category: string; items: string[] };
type LinkKey = "linkedin" | "portfolio" | "dribbble" | "behance" | "github" | "other";

const LINK_FIELDS: {
  key: LinkKey;
  label: string;
  placeholder: string;
  Icon: typeof Linkedin;
}[] = [
  { key: "linkedin", label: "LinkedIn", placeholder: "linkedin.com/in/you", Icon: Linkedin },
  { key: "portfolio", label: "Portfolio", placeholder: "yoursite.com", Icon: Globe },
  { key: "dribbble", label: "Dribbble", placeholder: "dribbble.com/you", Icon: Dribbble },
  { key: "behance", label: "Behance", placeholder: "behance.net/you", Icon: Palette },
  { key: "github", label: "Git", placeholder: "github.com/you", Icon: Github },
  { key: "other", label: "Other website", placeholder: "https://…", Icon: LinkIcon },
];

const labelClass = "block text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const inputClass =
  "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

const emptyExperience = (): ExperienceDraft => ({
  designation: "",
  company: "",
  location: "",
  duration: "",
  text: "",
});
const emptyEducation = (): EducationDraft => ({
  qualification: "",
  institution: "",
  location: "",
  duration: "",
  details: "",
});
const emptyProject = (): ProjectDraft => ({ name: "", link: "", text: "" });

// Defined at module scope (not inside the component) so it keeps a stable
// identity across renders — otherwise every keystroke would remount the inputs
// and steal focus.
const SectionCard = ({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof User;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900/5 text-slate-700">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {action}
    </div>
    {children}
  </div>
);

const addEntryButton = (label: string, onClick: () => void) => (
  <Button
    type="button"
    variant="outline"
    className="h-7 rounded-md px-2 text-xs"
    onClick={onClick}
  >
    <Plus className="mr-1 h-3.5 w-3.5" /> {label}
  </Button>
);

const splitLines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);

export const CreateCvSection = () => {
  const [candidateName, setCandidateName] = useState("");
  const [designation, setDesignation] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [links, setLinks] = useState<Record<LinkKey, string>>({
    linkedin: "",
    portfolio: "",
    dribbble: "",
    behance: "",
    github: "",
    other: "",
  });

  const [skillCategories, setSkillCategories] = useState<SkillCategory[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const [categorizing, setCategorizing] = useState(false);

  const [summary, setSummary] = useState("");
  const [generatingSummary, setGeneratingSummary] = useState(false);

  const [experiences, setExperiences] = useState<ExperienceDraft[]>([emptyExperience()]);
  const [rephrasingIndex, setRephrasingIndex] = useState<number | null>(null);

  const [projects, setProjects] = useState<ProjectDraft[]>([emptyProject()]);
  const [rephrasingProjectIndex, setRephrasingProjectIndex] = useState<number | null>(null);

  const [educations, setEducations] = useState<EducationDraft[]>([emptyEducation()]);
  const [certifications, setCertifications] = useState<CertificationDraft[]>([
    { title: "", link: "" },
  ]);
  const [languages, setLanguages] = useState<string[]>([""]);

  const [selectedTemplate, setSelectedTemplate] =
    useState<ResumeTemplateId>("classic-blue");
  const [templateOverrides, setTemplateOverrides] = useState<
    Record<string, ResumeTemplateThemeOverrides>
  >({});
  const [editorTab, setEditorTab] = useState<"content" | "design">("content");
  const [previewZoom, setPreviewZoom] = useState(1);
  const [downloading, setDownloading] = useState(false);

  const overrides = templateOverrides[selectedTemplate];
  const theme = resolveResumeTemplateTheme(selectedTemplate, overrides);
  const displayName = candidateName.trim() || "Your Name";

  // Prefill from the saved profile (if any) so users don't re-type details.
  useEffect(() => {
    const loadProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (!data) {
        if (user.email) setEmail((current) => current || user.email || "");
        return;
      }
      setCandidateName((current) => current || data.full_name || "");
      setDesignation((current) => current || data.headline || "");
      setEmail((current) => current || data.email || user.email || "");
      setPhone((current) => current || data.phone || "");
      setLocation(
        (current) =>
          current || [data.city, data.country].filter(Boolean).join(", ")
      );
      setExperienceYears((current) =>
        current ||
        (data.experience_years !== null && data.experience_years !== undefined
          ? String(data.experience_years)
          : "")
      );
      setLinks((current) => ({
        linkedin: current.linkedin || data.linkedin || "",
        portfolio: current.portfolio || data.portfolio || "",
        dribbble: current.dribbble || "",
        behance: current.behance || data.behance || "",
        github: current.github || data.github || "",
        other: current.other || data.other_link || "",
      }));
    };
    loadProfile().catch((error) => console.error("Profile prefill failed:", error));
  }, []);

  const data: ResumeData = useMemo(
    () => ({
      contact: {
        email: email.trim(),
        phone: phone.trim(),
        location: location.trim(),
        links: LINK_FIELDS.map((field) => links[field.key].trim())
          .filter(Boolean)
          .map((url) => ({ url })),
      },
      summary: summary.trim(),
      skills: skillCategories
        .filter((category) => category.items.length)
        .map((category) => `${category.category}: ${category.items.join(", ")}`),
      experience: experiences.map((entry) => ({
        designation: entry.designation.trim(),
        company: entry.company.trim(),
        location: entry.location.trim(),
        duration: entry.duration.trim(),
        responsibilities: splitLines(entry.text),
      })),
      projects: projects
        .filter((entry) => entry.name.trim() || splitLines(entry.text).length)
        .map((entry) => ({
          name: entry.name.trim(),
          meta: "",
          link: entry.link.trim(),
          responsibilities: splitLines(entry.text),
        })),
      education: educations.map((entry) => ({
        qualification: entry.qualification.trim(),
        institution: entry.institution.trim(),
        location: entry.location.trim(),
        duration: entry.duration.trim(),
        details: splitLines(entry.details),
      })),
      certifications: certifications
        .filter((cert) => cert.title.trim())
        .map((cert) =>
          cert.link.trim() ? `${cert.title.trim()} — ${cert.link.trim()}` : cert.title.trim()
        ),
      languages: languages.map((language) => language.trim()).filter(Boolean),
    }),
    [
      email,
      phone,
      location,
      links,
      summary,
      skillCategories,
      experiences,
      projects,
      educations,
      certifications,
      languages,
    ]
  );

  const previewHtml = useMemo(
    () =>
      renderResumeFromData({
        data,
        templateId: selectedTemplate,
        candidateName: displayName,
        designation,
        overrides,
      }),
    [data, selectedTemplate, displayName, designation, overrides]
  );

  const updateOverrides = (patch: ResumeTemplateThemeOverrides) =>
    setTemplateOverrides((current) => ({
      ...current,
      [selectedTemplate]: { ...(current[selectedTemplate] || {}), ...patch },
    }));
  const resetOverrides = () =>
    setTemplateOverrides((current) => {
      const next = { ...current };
      delete next[selectedTemplate];
      return next;
    });

  const callAssist = async (payload: Record<string, unknown>) => {
    const response = await fetch("/api/cv-assist", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return response.json();
  };

  // ---- Skills ----
  const addSkillToCategory = (
    categories: SkillCategory[],
    category: string,
    skill: string
  ): SkillCategory[] => {
    const key = category.trim().toLowerCase();
    const existing = categories.find((item) => item.category.toLowerCase() === key);
    if (existing) {
      if (existing.items.some((item) => item.toLowerCase() === skill.toLowerCase())) {
        return categories;
      }
      return categories.map((item) =>
        item === existing ? { ...item, items: [...item.items, skill] } : item
      );
    }
    return [...categories, { category: category.trim() || "Other", items: [skill] }];
  };

  const handleAddSkill = async () => {
    const skill = skillInput.trim();
    if (!skill || categorizing) return;
    setCategorizing(true);
    try {
      const result = await callAssist({
        action: "categorize-skill",
        skill,
        existingCategories: skillCategories.map((category) => category.category),
      });
      const category = result?.success ? result.category : "Other";
      setSkillCategories((current) => addSkillToCategory(current, category, skill));
      setSkillInput("");
    } catch (error) {
      console.error(error);
      setSkillCategories((current) => addSkillToCategory(current, "Other", skill));
      setSkillInput("");
    } finally {
      setCategorizing(false);
    }
  };

  const removeSkill = (category: string, skill: string) =>
    setSkillCategories((current) =>
      current
        .map((item) =>
          item.category === category
            ? { ...item, items: item.items.filter((value) => value !== skill) }
            : item
        )
        .filter((item) => item.items.length)
    );

  // ---- Summary ----
  const generateSummary = async () => {
    const hasExperience = experiences.some(
      (entry) => entry.company.trim() || entry.text.trim()
    );
    console.log(hasExperience)
    if (!designation.trim() || skillCategories.length === 0 || !hasExperience) {
      toast.info(
        "Add your professional title, work experience, and a few skills first to generate a summary."
      );
      return;
    }
    setGeneratingSummary(true);
    try {
      const highlights = experiences
        .filter((entry) => entry.company.trim() || entry.text.trim())
        .map(
          (entry) =>
            `${entry.designation || ""} at ${entry.company || ""}: ${entry.text.replace(/\n/g, " ")}`
        );
      const result = await callAssist({
        action: "generate-summary",
        designation,
        experienceYears,
        skills: data.skills,
        experience: highlights,
      });
      if (result?.success && result.summary) setSummary(result.summary);
      else toast.error(result?.message || "Could not generate a summary.");
    } catch (error) {
      console.error(error);
      toast.error("Could not generate a summary right now.");
    } finally {
      setGeneratingSummary(false);
    }
  };

  // ---- Experience ----
  const updateExperience = (index: number, patch: Partial<ExperienceDraft>) =>
    setExperiences((current) =>
      current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    );
  const addExperience = () => setExperiences((current) => [...current, emptyExperience()]);
  const removeExperience = (index: number) =>
    setExperiences((current) => current.filter((_, i) => i !== index));

  const rephraseExperience = async (index: number) => {
    const entry = experiences[index];
    if (!entry.text.trim()) {
      toast.info("Write a few lines about what you did first.");
      return;
    }
    setRephrasingIndex(index);
    try {
      const result = await callAssist({
        action: "rephrase-experience",
        designation: entry.designation,
        company: entry.company,
        text: entry.text,
      });
      if (result?.success && Array.isArray(result.bullets) && result.bullets.length) {
        updateExperience(index, { text: result.bullets.join("\n") });
      } else {
        toast.error(result?.message || "Could not rephrase this experience.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Could not rephrase this experience right now.");
    } finally {
      setRephrasingIndex(null);
    }
  };

  // ---- Projects ----
  const updateProject = (index: number, patch: Partial<ProjectDraft>) =>
    setProjects((current) =>
      current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    );
  const addProject = () => setProjects((current) => [...current, emptyProject()]);
  const removeProject = (index: number) =>
    setProjects((current) => current.filter((_, i) => i !== index));

  const rephraseProject = async (index: number) => {
    const entry = projects[index];
    if (!entry.text.trim()) {
      toast.info("Write a few lines about the project first.");
      return;
    }
    setRephrasingProjectIndex(index);
    try {
      const result = await callAssist({
        action: "rephrase-experience",
        designation: "Project contributor",
        company: entry.name,
        text: entry.text,
      });
      if (result?.success && Array.isArray(result.bullets) && result.bullets.length) {
        updateProject(index, { text: result.bullets.join("\n") });
      } else {
        toast.error(result?.message || "Could not rephrase this project.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Could not rephrase this project right now.");
    } finally {
      setRephrasingProjectIndex(null);
    }
  };

  // ---- Education ----
  const updateEducation = (index: number, patch: Partial<EducationDraft>) =>
    setEducations((current) =>
      current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    );
  const addEducation = () => setEducations((current) => [...current, emptyEducation()]);
  const removeEducation = (index: number) =>
    setEducations((current) => current.filter((_, i) => i !== index));

  // ---- Certifications ----
  const updateCertification = (index: number, patch: Partial<CertificationDraft>) =>
    setCertifications((current) =>
      current.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    );
  const addCertification = () =>
    setCertifications((current) => [...current, { title: "", link: "" }]);
  const removeCertification = (index: number) =>
    setCertifications((current) => current.filter((_, i) => i !== index));

  // ---- Languages ----
  const updateLanguage = (index: number, value: string) =>
    setLanguages((current) => current.map((entry, i) => (i === index ? value : entry)));
  const addLanguage = () => setLanguages((current) => [...current, ""]);
  const removeLanguage = (index: number) =>
    setLanguages((current) => current.filter((_, i) => i !== index));

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        body: JSON.stringify({ html: previewHtml, type: "tailored-cv" }),
      });
      if (!response.ok) throw new Error("Failed to generate PDF.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${toSlugPart(candidateName || "resume")}-resume.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error(error);
      toast.error("Unable to download PDF right now.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Create a CV from scratch</h2>
          <p className="mt-1 text-sm text-slate-500">
            No resume yet? Fill in your details and let AI help you polish it into an
            ATS-ready PDF.
          </p>
        </div>
        <Button className="rounded-md" onClick={downloadPdf} disabled={downloading}>
          {downloading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download CV
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ---- Left: editor ---- */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          <div className="flex shrink-0 gap-1 bg-white px-4 pt-3">
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

          <div className="max-h-[72vh] flex-1 space-y-4 overflow-auto border-t border-slate-200 p-4">
            {editorTab === "content" ? (
              <>
                {/* Personal details */}
                <SectionCard icon={User} title="Personal details">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <span className={labelClass}>Full name</span>
                      <input
                        className={inputClass}
                        value={candidateName}
                        onChange={(event) => setCandidateName(event.target.value)}
                        placeholder="Jane Doe"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className={labelClass}>Professional title</span>
                      <input
                        className={inputClass}
                        value={designation}
                        onChange={(event) => setDesignation(event.target.value)}
                        placeholder="Project Coordinator"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className={labelClass}>Experience (years)</span>
                      <input
                        className={inputClass}
                        value={experienceYears}
                        onChange={(event) => setExperienceYears(event.target.value)}
                        placeholder="3"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className={labelClass}>Location</span>
                      <input
                        className={inputClass}
                        value={location}
                        onChange={(event) => setLocation(event.target.value)}
                        placeholder="City, Country"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className={labelClass}>Email</span>
                      <input
                        className={inputClass}
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="jane@email.com"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className={labelClass}>Phone</span>
                      <input
                        className={inputClass}
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="+1 555 0100"
                      />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    {LINK_FIELDS.map(({ key, label, placeholder, Icon }) => (
                      <div key={key} className="space-y-1">
                        <span className={labelClass}>{label}</span>
                        <div className="relative">
                          <Icon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            className={`${inputClass} pl-8`}
                            value={links[key]}
                            onChange={(event) =>
                              setLinks((current) => ({ ...current, [key]: event.target.value }))
                            }
                            placeholder={placeholder}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                {/* Skills (above summary) */}
                <SectionCard icon={Wrench} title="Skills">
                  <div className="relative">
                    <input
                      className={`${inputClass} pr-9`}
                      value={skillInput}
                      onChange={(event) => setSkillInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleAddSkill();
                        }
                      }}
                      placeholder="Type a skill and press Enter (e.g. React) — we'll categorize it"
                    />
                    {categorizing ? (
                      <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
                    ) : (
                      <Plus className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                    )}
                  </div>
                  {skillCategories.length > 0 ? (
                    <div className="mt-3 space-y-2.5">
                      {skillCategories.map((category) => (
                        <div key={category.category}>
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {category.category}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {category.items.map((skill) => (
                              <span
                                key={skill}
                                className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-2.5 pr-1 text-xs text-slate-700"
                              >
                                {skill}
                                <button
                                  type="button"
                                  aria-label={`Remove ${skill}`}
                                  className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                                  onClick={() => removeSkill(category.category, skill)}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-400">
                      No skills yet. Add them one at a time — each is sorted into a category.
                    </p>
                  )}
                </SectionCard>

                {/* Summary */}
                <SectionCard icon={FileText} title="Summary">
                  <div className="relative">
                    <textarea
                      className={`${inputClass} min-h-[110px] resize-y pb-10 leading-relaxed`}
                      value={summary}
                      onChange={(event) => setSummary(event.target.value)}
                      placeholder="A short professional summary — or generate one from your details."
                    />
                    <button
                      type="button"
                      onClick={generateSummary}
                      disabled={generatingSummary}
                      className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 mb-2"
                    >
                      {generatingSummary ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Generate summary
                    </button>
                  </div>
                </SectionCard>

                {/* Experience */}
                <SectionCard
                  icon={Briefcase}
                  title="Experience"
                  action={addEntryButton("Add role", addExperience)}
                >
                  <div className="space-y-3">
                    {experiences.map((entry, index) => (
                      <div
                        key={index}
                        className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="grid flex-1 grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <span className={labelClass}>Designation</span>
                              <input
                                className={inputClass}
                                value={entry.designation}
                                onChange={(event) =>
                                  updateExperience(index, { designation: event.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <span className={labelClass}>Company</span>
                              <input
                                className={inputClass}
                                value={entry.company}
                                onChange={(event) =>
                                  updateExperience(index, { company: event.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <span className={labelClass}>Location</span>
                              <input
                                className={inputClass}
                                value={entry.location}
                                onChange={(event) =>
                                  updateExperience(index, { location: event.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <span className={labelClass}>Duration</span>
                              <input
                                className={inputClass}
                                value={entry.duration}
                                onChange={(event) =>
                                  updateExperience(index, { duration: event.target.value })
                                }
                              />
                            </div>
                          </div>
                          {experiences.length > 1 ? (
                            <button
                              type="button"
                              aria-label="Remove role"
                              className="mt-5 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                              onClick={() => removeExperience(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                        <div className="space-y-1">
                          <span className={labelClass}>
                            What did you do at this company? (add at least 2-3 lines)
                          </span>
                          <div className="relative">
                            <textarea
                              className={`${inputClass} min-h-[96px] resize-y pb-10 leading-relaxed`}
                              value={entry.text}
                              onChange={(event) =>
                                updateExperience(index, { text: event.target.value })
                              }
                              placeholder="Describe your work here, then tap Rephrase to turn it into sharp, ATS-friendly bullet points."
                            />
                            <button
                              type="button"
                              onClick={() => rephraseExperience(index)}
                              disabled={rephrasingIndex === index}
                              className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 mb-2 disabled:opacity-60"
                            >
                              {rephrasingIndex === index ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Wand2 className="h-3.5 w-3.5" />
                              )}
                              Rephrase
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                {/* Projects */}
                <SectionCard
                  icon={FolderGit2}
                  title="Projects"
                  action={addEntryButton("Add project", addProject)}
                >
                  <div className="space-y-3">
                    {projects.map((entry, index) => (
                      <div
                        key={index}
                        className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="grid flex-1 grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <span className={labelClass}>Project name</span>
                              <input
                                className={inputClass}
                                value={entry.name}
                                onChange={(event) =>
                                  updateProject(index, { name: event.target.value })
                                }
                                placeholder="Portfolio website"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className={labelClass}>Link</span>
                              <input
                                className={inputClass}
                                value={entry.link}
                                onChange={(event) =>
                                  updateProject(index, { link: event.target.value })
                                }
                                placeholder="github.com/you/project"
                              />
                            </div>
                          </div>
                          {projects.length > 1 ? (
                            <button
                              type="button"
                              aria-label="Remove project"
                              className="mt-5 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                              onClick={() => removeProject(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                        <div className="space-y-1">
                          <span className={labelClass}>
                            What was this project about? (add at least 2-3 lines)
                          </span>
                          <div className="relative">
                            <textarea
                              className={`${inputClass} min-h-[96px] resize-y pb-10 leading-relaxed`}
                              value={entry.text}
                              onChange={(event) =>
                                updateProject(index, { text: event.target.value })
                              }
                              placeholder="Describe the project, then tap Rephrase to turn it into sharp, ATS-friendly bullet points."
                            />
                            <button
                              type="button"
                              onClick={() => rephraseProject(index)}
                              disabled={rephrasingProjectIndex === index}
                              className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                            >
                              {rephrasingProjectIndex === index ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Wand2 className="h-3.5 w-3.5" />
                              )}
                              Rephrase
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                {/* Education */}
                <SectionCard
                  icon={GraduationCap}
                  title="Education"
                  action={addEntryButton("Add education", addEducation)}
                >
                  <div className="space-y-3">
                    {educations.map((entry, index) => (
                      <div
                        key={index}
                        className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="grid flex-1 grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <span className={labelClass}>Qualification</span>
                              <input
                                className={inputClass}
                                value={entry.qualification}
                                onChange={(event) =>
                                  updateEducation(index, { qualification: event.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <span className={labelClass}>Institution</span>
                              <input
                                className={inputClass}
                                value={entry.institution}
                                onChange={(event) =>
                                  updateEducation(index, { institution: event.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <span className={labelClass}>Location</span>
                              <input
                                className={inputClass}
                                value={entry.location}
                                onChange={(event) =>
                                  updateEducation(index, { location: event.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <span className={labelClass}>Duration</span>
                              <input
                                className={inputClass}
                                value={entry.duration}
                                onChange={(event) =>
                                  updateEducation(index, { duration: event.target.value })
                                }
                              />
                            </div>
                          </div>
                          {educations.length > 1 ? (
                            <button
                              type="button"
                              aria-label="Remove education"
                              className="mt-5 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                              onClick={() => removeEducation(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </SectionCard>

                {/* Certifications */}
                <SectionCard
                  icon={Award}
                  title="Certifications"
                  action={addEntryButton("Add certification", addCertification)}
                >
                  <div className="space-y-2.5">
                    {certifications.map((entry, index) => (
                      <div key={index} className="flex items-end gap-2">
                        <div className="grid flex-1 grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <span className={labelClass}>Title</span>
                            <input
                              className={inputClass}
                              value={entry.title}
                              onChange={(event) =>
                                updateCertification(index, { title: event.target.value })
                              }
                              placeholder="Google Project Management"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className={labelClass}>Link</span>
                            <input
                              className={inputClass}
                              value={entry.link}
                              onChange={(event) =>
                                updateCertification(index, { link: event.target.value })
                              }
                              placeholder="https://credential…"
                            />
                          </div>
                        </div>
                        {certifications.length > 1 ? (
                          <button
                            type="button"
                            aria-label="Remove certification"
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                            onClick={() => removeCertification(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </SectionCard>

                {/* Languages */}
                <SectionCard
                  icon={LanguagesIcon}
                  title="Languages"
                  action={addEntryButton("Add language", addLanguage)}
                >
                  <div className="grid grid-cols-2 gap-2">
                    {languages.map((language, index) => (
                      <div key={index} className="flex items-center gap-1.5">
                        <input
                          className={inputClass}
                          value={language}
                          onChange={(event) => updateLanguage(index, event.target.value)}
                          placeholder="English"
                        />
                        {languages.length > 1 ? (
                          <button
                            type="button"
                            aria-label="Remove language"
                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                            onClick={() => removeLanguage(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </SectionCard>
              </>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Template
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {RESUME_TEMPLATE_CONFIGS.map((template) => {
                      const thumbTheme = resolveResumeTemplateTheme(template.id);
                      const active = selectedTemplate === template.id;
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => setSelectedTemplate(template.id)}
                          className={cn(
                            "overflow-hidden rounded-lg border bg-white text-left transition",
                            active
                              ? "border-slate-900 ring-2 ring-slate-900/10"
                              : "border-slate-200 hover:border-slate-400"
                          )}
                        >
                          <div
                            className="h-1.5 w-full"
                            style={{ backgroundColor: thumbTheme.accent }}
                          />
                          <div className="space-y-1 p-2">
                            <div
                              className="h-1.5 w-3/4 rounded-full"
                              style={{ backgroundColor: thumbTheme.headingColor }}
                            />
                            <div className="h-1 w-full rounded-full bg-slate-200" />
                            <div className="h-1 w-5/6 rounded-full bg-slate-200" />
                            <p className="pt-1 text-[11px] font-medium text-slate-700">
                              {template.label}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Customize
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 rounded-md px-3 text-xs"
                      onClick={resetOverrides}
                    >
                      Reset
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="text-xs text-slate-600">
                      Accent
                      <input
                        type="color"
                        className="mt-1 h-9 w-full cursor-pointer rounded-md border border-slate-300 bg-white p-1"
                        value={theme.accent}
                        onChange={(event) => updateOverrides({ accent: event.target.value })}
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      Heading color
                      <input
                        type="color"
                        className="mt-1 h-9 w-full cursor-pointer rounded-md border border-slate-300 bg-white p-1"
                        value={theme.headingColor}
                        onChange={(event) =>
                          updateOverrides({ headingColor: event.target.value })
                        }
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      Body color
                      <input
                        type="color"
                        className="mt-1 h-9 w-full cursor-pointer rounded-md border border-slate-300 bg-white p-1"
                        value={theme.bodyColor}
                        onChange={(event) =>
                          updateOverrides({ bodyColor: event.target.value })
                        }
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      Font
                      <select
                        className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs"
                        value={theme.fontFamily}
                        onChange={(event) =>
                          updateOverrides({ fontFamily: event.target.value })
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
                      Base font size ({theme.baseFontSize}px)
                      <input
                        type="range"
                        min={11}
                        max={15}
                        step={1}
                        className="mt-2 w-full"
                        value={theme.baseFontSize}
                        onChange={(event) =>
                          updateOverrides({ baseFontSize: Number(event.target.value) })
                        }
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      Line height ({theme.lineHeight.toFixed(2)})
                      <input
                        type="range"
                        min={1.35}
                        max={1.95}
                        step={0.05}
                        className="mt-2 w-full"
                        value={theme.lineHeight}
                        onChange={(event) =>
                          updateOverrides({ lineHeight: Number(event.target.value) })
                        }
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      Section spacing ({theme.sectionSpacing}px)
                      <input
                        type="range"
                        min={10}
                        max={24}
                        step={1}
                        className="mt-2 w-full"
                        value={theme.sectionSpacing}
                        onChange={(event) =>
                          updateOverrides({ sectionSpacing: Number(event.target.value) })
                        }
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ---- Right: live preview ---- */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-100 lg:sticky lg:top-4 lg:self-start">
          <div className="flex shrink-0 items-center justify-between px-4 py-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Preview
            </span>
            <div className="flex items-center gap-1.5 text-slate-500">
              <button
                type="button"
                aria-label="Zoom out"
                className="rounded-md border border-slate-300 bg-white p-1 hover:bg-slate-50"
                onClick={() =>
                  setPreviewZoom((z) => Math.max(0.6, Math.round((z - 0.1) * 10) / 10))
                }
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-9 text-center text-xs tabular-nums">
                {Math.round(previewZoom * 100)}%
              </span>
              <button
                type="button"
                aria-label="Zoom in"
                className="rounded-md border border-slate-300 bg-white p-1 hover:bg-slate-50"
                onClick={() =>
                  setPreviewZoom((z) => Math.min(1.5, Math.round((z + 0.1) * 10) / 10))
                }
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <div className="max-h-[78vh] flex-1 overflow-auto px-5 pb-6">
            <div
              className="mx-auto w-full max-w-[820px] overflow-hidden rounded-md bg-white shadow-md ring-1 ring-slate-200"
              style={{ zoom: previewZoom }}
            >
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
