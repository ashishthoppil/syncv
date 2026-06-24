"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "react-toastify";
import {
  Award,
  Briefcase,
  FileText,
  FolderGit2,
  GraduationCap,
  Languages as LanguagesIcon,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  renderResumeFromData,
  type ResumeContact,
  type ResumeData,
} from "@/components/resume-templates/render";
import {
  ResumeTemplateId,
  ResumeTemplateThemeOverrides,
} from "@/components/resume-templates/types";

type ResumeEditorProps = {
  data: ResumeData;
  onChange: (next: ResumeData) => void;
  templateId: ResumeTemplateId;
  candidateName: string;
  designation?: string;
  experienceYears?: string;
  photoUrl?: string;
  overrides?: ResumeTemplateThemeOverrides;
  useContactIcons?: boolean;
  /**
   * When false, render only the editable fields (no built-in live preview) so
   * the host can place the preview in its own pane. Defaults to true.
   */
  showPreview?: boolean;
};

type ExperienceDraft = {
  designation: string;
  company: string;
  location: string;
  duration: string;
  text: string;
};
type ProjectDraft = { name: string; link: string; text: string };
type EducationDraft = {
  qualification: string;
  institution: string;
  location: string;
  duration: string;
  details: string;
};
type CertificationDraft = { title: string; link: string };
type SkillCategory = { category: string; items: string[] };
type Drafts = {
  skillCategories: SkillCategory[];
  summary: string;
  experiences: ExperienceDraft[];
  projects: ProjectDraft[];
  educations: EducationDraft[];
  certifications: CertificationDraft[];
  languages: string[];
};

const labelClass = "block text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const inputClass =
  "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

const splitLines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);

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

// Parse "Category: a, b, c" skill strings into grouped chips.
const parseSkillStrings = (skills: string[] = []): SkillCategory[] => {
  const categories: SkillCategory[] = [];
  const byKey = new Map<string, SkillCategory>();
  skills.forEach((line) => {
    const match = String(line).match(/^([^:]+):\s*(.*)$/);
    const category = match ? match[1].trim() : "Skills";
    const itemsStr = match ? match[2] : String(line);
    const items = itemsStr
      .split(/[,;]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (!items.length) return;
    const key = category.toLowerCase();
    let cat = byKey.get(key);
    if (!cat) {
      cat = { category, items: [] };
      byKey.set(key, cat);
      categories.push(cat);
    }
    items.forEach((item) => {
      if (!cat!.items.some((existing) => existing.toLowerCase() === item.toLowerCase())) {
        cat!.items.push(item);
      }
    });
  });
  return categories;
};

// Split a certification string ("Name — Issuer — https://…") into title + link.
const parseCertification = (raw: string): CertificationDraft => {
  const value = String(raw || "").trim();
  const match = value.match(/(https?:\/\/[^\s|]+)/i);
  if (match) {
    const link = match[1];
    const title = value
      .slice(0, match.index)
      .replace(/[—–-]+\s*$/, "")
      .trim();
    return { title: title || value.replace(link, "").trim(), link };
  }
  return { title: value, link: "" };
};

const seedFromData = (data: ResumeData): Drafts => ({
  skillCategories: parseSkillStrings(data.skills || []),
  summary: data.summary || "",
  experiences:
    data.experience && data.experience.length
      ? data.experience.map((entry) => ({
          designation: entry.designation || "",
          company: entry.company || "",
          location: entry.location || "",
          duration: entry.duration || "",
          text: (entry.responsibilities || []).join("\n"),
        }))
      : [emptyExperience()],
  projects: (data.projects || []).map((entry) => ({
    name: entry.name || "",
    link: entry.link || "",
    text: (entry.responsibilities || []).join("\n"),
  })),
  educations:
    data.education && data.education.length
      ? data.education.map((entry) => ({
          qualification: entry.qualification || "",
          institution: entry.institution || "",
          location: entry.location || "",
          duration: entry.duration || "",
          details: (entry.details || []).join("\n"),
        }))
      : [emptyEducation()],
  certifications: (data.certifications || []).map(parseCertification),
  languages: data.languages && data.languages.length ? data.languages : [],
});

const draftsToData = (drafts: Drafts, contact?: ResumeContact): ResumeData => ({
  contact,
  summary: drafts.summary.trim(),
  skills: drafts.skillCategories
    .filter((category) => category.items.length)
    .map((category) => `${category.category}: ${category.items.join(", ")}`),
  experience: drafts.experiences.map((entry) => ({
    designation: entry.designation.trim(),
    company: entry.company.trim(),
    location: entry.location.trim(),
    duration: entry.duration.trim(),
    responsibilities: splitLines(entry.text),
  })),
  projects: drafts.projects
    .filter((entry) => entry.name.trim() || splitLines(entry.text).length)
    .map((entry) => ({
      name: entry.name.trim(),
      meta: "",
      link: entry.link.trim(),
      responsibilities: splitLines(entry.text),
    })),
  education: drafts.educations.map((entry) => ({
    qualification: entry.qualification.trim(),
    institution: entry.institution.trim(),
    location: entry.location.trim(),
    duration: entry.duration.trim(),
    details: splitLines(entry.details),
  })),
  certifications: drafts.certifications
    .filter((cert) => cert.title.trim())
    .map((cert) =>
      cert.link.trim() ? `${cert.title.trim()} — ${cert.link.trim()}` : cert.title.trim()
    ),
  languages: drafts.languages.map((language) => language.trim()).filter(Boolean),
});

const callAssist = async (payload: Record<string, unknown>) => {
  const response = await fetch("/api/cv-assist", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.json();
};

// Module scope so it keeps a stable identity across renders (otherwise every
// keystroke would remount the inputs and steal focus).
const SectionCard = ({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof Briefcase;
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
  <Button type="button" variant="outline" className="h-7 rounded-md px-2 text-xs" onClick={onClick}>
    <Plus className="mr-1 h-3.5 w-3.5" /> {label}
  </Button>
);

export const ResumeEditor = ({
  data,
  onChange,
  templateId,
  candidateName,
  designation,
  experienceYears,
  photoUrl,
  overrides,
  useContactIcons,
  showPreview = true,
}: ResumeEditorProps) => {
  const [drafts, setDrafts] = useState<Drafts>(() => seedFromData(data));
  // Tracks the data identity we last seeded from / emitted, so an external data
  // change re-seeds the editor, but our own onChange echoes don't.
  const syncedRef = useRef<ResumeData>(data);

  useEffect(() => {
    if (data === syncedRef.current) return;
    syncedRef.current = data;
    setDrafts(seedFromData(data));
  }, [data]);

  const commit = (next: Drafts) => {
    setDrafts(next);
    const emitted = draftsToData(next, data.contact);
    syncedRef.current = emitted;
    onChange(emitted);
  };

  const [skillInput, setSkillInput] = useState("");
  const [categorizing, setCategorizing] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [rephrasingIndex, setRephrasingIndex] = useState<number | null>(null);
  const [rephrasingProjectIndex, setRephrasingProjectIndex] = useState<number | null>(null);

  const previewHtml = useMemo(
    () =>
      showPreview
        ? renderResumeFromData({
            data: draftsToData(drafts, data.contact),
            templateId,
            candidateName,
            designation,
            photoUrl,
            overrides,
            useContactIcons,
          })
        : "",
    [
      showPreview,
      drafts,
      data.contact,
      templateId,
      candidateName,
      designation,
      photoUrl,
      overrides,
      useContactIcons,
    ]
  );

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
        existingCategories: drafts.skillCategories.map((category) => category.category),
      });
      const category = result?.success ? result.category : "Other";
      commit({
        ...drafts,
        skillCategories: addSkillToCategory(drafts.skillCategories, category, skill),
      });
      setSkillInput("");
    } catch (error) {
      console.error(error);
      commit({
        ...drafts,
        skillCategories: addSkillToCategory(drafts.skillCategories, "Other", skill),
      });
      setSkillInput("");
    } finally {
      setCategorizing(false);
    }
  };

  const removeSkill = (category: string, skill: string) =>
    commit({
      ...drafts,
      skillCategories: drafts.skillCategories
        .map((item) =>
          item.category === category
            ? { ...item, items: item.items.filter((value) => value !== skill) }
            : item
        )
        .filter((item) => item.items.length),
    });

  // ---- Summary ----
  const generateSummary = async () => {
    const hasExperience = drafts.experiences.some(
      (entry) => entry.company.trim() || entry.text.trim()
    );
    if (!(designation || "").trim() || drafts.skillCategories.length === 0 || !hasExperience) {
      toast.info(
        "Add a target title, work experience, and a few skills first to generate a summary."
      );
      return;
    }
    setGeneratingSummary(true);
    try {
      const highlights = drafts.experiences
        .filter((entry) => entry.company.trim() || entry.text.trim())
        .map(
          (entry) =>
            `${entry.designation || ""} at ${entry.company || ""}: ${entry.text.replace(/\n/g, " ")}`
        );
      const skills = drafts.skillCategories
        .filter((category) => category.items.length)
        .map((category) => `${category.category}: ${category.items.join(", ")}`);
      const result = await callAssist({
        action: "generate-summary",
        designation,
        experienceYears: experienceYears || "",
        skills,
        experience: highlights,
      });
      if (result?.success && result.summary) commit({ ...drafts, summary: result.summary });
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
    commit({
      ...drafts,
      experiences: drafts.experiences.map((entry, i) =>
        i === index ? { ...entry, ...patch } : entry
      ),
    });
  const addExperience = () =>
    commit({ ...drafts, experiences: [...drafts.experiences, emptyExperience()] });
  const removeExperience = (index: number) =>
    commit({ ...drafts, experiences: drafts.experiences.filter((_, i) => i !== index) });

  const rephraseExperience = async (index: number) => {
    const entry = drafts.experiences[index];
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
    commit({
      ...drafts,
      projects: drafts.projects.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    });
  const addProject = () => commit({ ...drafts, projects: [...drafts.projects, emptyProject()] });
  const removeProject = (index: number) =>
    commit({ ...drafts, projects: drafts.projects.filter((_, i) => i !== index) });

  const rephraseProject = async (index: number) => {
    const entry = drafts.projects[index];
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
    commit({
      ...drafts,
      educations: drafts.educations.map((entry, i) =>
        i === index ? { ...entry, ...patch } : entry
      ),
    });
  const addEducation = () =>
    commit({ ...drafts, educations: [...drafts.educations, emptyEducation()] });
  const removeEducation = (index: number) =>
    commit({ ...drafts, educations: drafts.educations.filter((_, i) => i !== index) });

  // ---- Certifications ----
  const updateCertification = (index: number, patch: Partial<CertificationDraft>) =>
    commit({
      ...drafts,
      certifications: drafts.certifications.map((entry, i) =>
        i === index ? { ...entry, ...patch } : entry
      ),
    });
  const addCertification = () =>
    commit({ ...drafts, certifications: [...drafts.certifications, { title: "", link: "" }] });
  const removeCertification = (index: number) =>
    commit({ ...drafts, certifications: drafts.certifications.filter((_, i) => i !== index) });

  // ---- Languages ----
  const updateLanguage = (index: number, value: string) =>
    commit({
      ...drafts,
      languages: drafts.languages.map((entry, i) => (i === index ? value : entry)),
    });
  const addLanguage = () => commit({ ...drafts, languages: [...drafts.languages, ""] });
  const removeLanguage = (index: number) =>
    commit({ ...drafts, languages: drafts.languages.filter((_, i) => i !== index) });

  const fields = (
    <div className="space-y-4">
      {/* Skills */}
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
        {drafts.skillCategories.length > 0 ? (
          <div className="mt-3 space-y-2.5">
            {drafts.skillCategories.map((category) => (
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
            value={drafts.summary}
            onChange={(event) => commit({ ...drafts, summary: event.target.value })}
            placeholder="A short professional summary — or generate one from your details."
          />
          <button
            type="button"
            onClick={generateSummary}
            disabled={generatingSummary}
            className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
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
          {drafts.experiences.map((entry, index) => (
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
                {drafts.experiences.length > 1 ? (
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
                    onChange={(event) => updateExperience(index, { text: event.target.value })}
                    placeholder="Describe your work here, then tap Rephrase to turn it into sharp, ATS-friendly bullet points."
                  />
                  <button
                    type="button"
                    onClick={() => rephraseExperience(index)}
                    disabled={rephrasingIndex === index}
                    className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
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
          {drafts.projects.length === 0 ? (
            <p className="text-xs text-slate-400">No projects yet. Add one if relevant.</p>
          ) : null}
          {drafts.projects.map((entry, index) => (
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
                      onChange={(event) => updateProject(index, { name: event.target.value })}
                      placeholder="Portfolio website"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className={labelClass}>Link</span>
                    <input
                      className={inputClass}
                      value={entry.link}
                      onChange={(event) => updateProject(index, { link: event.target.value })}
                      placeholder="github.com/you/project"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Remove project"
                  className="mt-5 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  onClick={() => removeProject(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1">
                <span className={labelClass}>
                  What was this project about? (add at least 2-3 lines)
                </span>
                <div className="relative">
                  <textarea
                    className={`${inputClass} min-h-[96px] resize-y pb-10 leading-relaxed`}
                    value={entry.text}
                    onChange={(event) => updateProject(index, { text: event.target.value })}
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
          {drafts.educations.map((entry, index) => (
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
                {drafts.educations.length > 1 ? (
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
              <div className="space-y-1">
                <span className={labelClass}>Details (one per line, optional)</span>
                <textarea
                  className={`${inputClass} resize-y leading-relaxed`}
                  rows={2}
                  value={entry.details}
                  onChange={(event) => updateEducation(index, { details: event.target.value })}
                />
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
          {drafts.certifications.length === 0 ? (
            <p className="text-xs text-slate-400">No certifications yet.</p>
          ) : null}
          {drafts.certifications.map((entry, index) => (
            <div key={index} className="flex items-end gap-2">
              <div className="grid flex-1 grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className={labelClass}>Title</span>
                  <input
                    className={inputClass}
                    value={entry.title}
                    onChange={(event) => updateCertification(index, { title: event.target.value })}
                    placeholder="Google Project Management"
                  />
                </div>
                <div className="space-y-1">
                  <span className={labelClass}>Link</span>
                  <input
                    className={inputClass}
                    value={entry.link}
                    onChange={(event) => updateCertification(index, { link: event.target.value })}
                    placeholder="https://credential…"
                  />
                </div>
              </div>
              <button
                type="button"
                aria-label="Remove certification"
                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                onClick={() => removeCertification(index)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
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
          {drafts.languages.length === 0 ? (
            <p className="col-span-2 text-xs text-slate-400">No languages yet.</p>
          ) : null}
          {drafts.languages.map((language, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <input
                className={inputClass}
                value={language}
                onChange={(event) => updateLanguage(index, event.target.value)}
                placeholder="English"
              />
              <button
                type="button"
                aria-label="Remove language"
                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                onClick={() => removeLanguage(index)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );

  if (!showPreview) return fields;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="max-h-[68vh] overflow-auto pr-1">{fields}</div>
      <div className="max-h-[68vh] overflow-auto rounded-lg border border-slate-200 bg-white">
        <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
      </div>
    </div>
  );
};
