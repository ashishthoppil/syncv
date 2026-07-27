"use client";

// Shared resume-form building blocks. These controlled section cards and the
// draft <-> ResumeData converters are reused by:
//   - the onboarding wizard (one card per step)
//   - the Base Resume editor (all cards at once)
//   - Create CV from scratch (kept internally)
// Keeping the inputs here means the three surfaces never drift apart.

import { useState, type ReactNode } from "react";
import { toast } from "react-toastify";
import {
  Award,
  Briefcase,
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
import type { ResumeData } from "@/components/resume-templates/render";

// ---- Types -----------------------------------------------------------------

export type ExperienceDraft = {
  designation: string;
  company: string;
  location: string;
  duration: string;
  text: string;
};
export type EducationDraft = {
  qualification: string;
  institution: string;
  location: string;
  duration: string;
  details: string;
};
export type CertificationDraft = { title: string; link: string };
export type ProjectDraft = { name: string; link: string; text: string };
export type SkillCategory = { category: string; items: string[] };
export type AdditionalSectionDraft = { title: string; text: string };
export type LinkKey =
  | "linkedin"
  | "portfolio"
  | "dribbble"
  | "behance"
  | "github"
  | "other";

export type BaseResumeDraft = {
  candidateName: string;
  designation: string;
  experienceYears: string;
  email: string;
  phone: string;
  location: string;
  links: Record<LinkKey, string>;
  skillCategories: SkillCategory[];
  summary: string;
  experiences: ExperienceDraft[];
  projects: ProjectDraft[];
  educations: EducationDraft[];
  certifications: CertificationDraft[];
  languages: string[];
  additionalSections: AdditionalSectionDraft[];
};

export const LINK_FIELDS: {
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

// ---- Factories -------------------------------------------------------------

export const emptyExperience = (): ExperienceDraft => ({
  designation: "",
  company: "",
  location: "",
  duration: "",
  text: "",
});
export const emptyEducation = (): EducationDraft => ({
  qualification: "",
  institution: "",
  location: "",
  duration: "",
  details: "",
});
export const emptyProject = (): ProjectDraft => ({ name: "", link: "", text: "" });
export const emptyAdditionalSection = (): AdditionalSectionDraft => ({
  title: "",
  text: "",
});

export const emptyBaseResumeDraft = (): BaseResumeDraft => ({
  candidateName: "",
  designation: "",
  experienceYears: "",
  email: "",
  phone: "",
  location: "",
  links: {
    linkedin: "",
    portfolio: "",
    dribbble: "",
    behance: "",
    github: "",
    other: "",
  },
  skillCategories: [],
  summary: "",
  experiences: [emptyExperience()],
  projects: [emptyProject()],
  educations: [emptyEducation()],
  certifications: [{ title: "", link: "" }],
  languages: [""],
  additionalSections: [],
});

// ---- Shared style + helpers ------------------------------------------------

export const labelClass =
  "block text-[11px] font-semibold uppercase tracking-wide text-slate-500";
export const inputClass =
  "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

export const splitLines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);

const joinLines = (values: string[] = []) => values.join("\n");

// SectionCard is module-scope so it keeps a stable identity across renders —
// otherwise every keystroke would remount the inputs and steal focus.
export const SectionCard = ({
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

export const AddEntryButton = ({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) => (
  <Button
    type="button"
    variant="outline"
    className="h-7 rounded-md px-2 text-xs"
    onClick={onClick}
  >
    <Plus className="mr-1 h-3.5 w-3.5" /> {label}
  </Button>
);

const callAssist = async (payload: Record<string, unknown>) => {
  const response = await fetch("/api/cv-assist", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.json();
};

// ---- Converters ------------------------------------------------------------

// Draft -> ResumeData (the shape the templates render from).
export const draftToResumeData = (draft: BaseResumeDraft): ResumeData => ({
  contact: {
    email: draft.email.trim(),
    phone: draft.phone.trim(),
    location: draft.location.trim(),
    links: LINK_FIELDS.map((field) => draft.links[field.key].trim())
      .filter(Boolean)
      .map((url) => ({ url })),
  },
  summary: draft.summary.trim(),
  skills: draft.skillCategories
    .filter((category) => category.items.length)
    .map((category) => `${category.category}: ${category.items.join(", ")}`),
  experience: draft.experiences
    .filter(
      (entry) =>
        entry.company.trim() ||
        entry.designation.trim() ||
        splitLines(entry.text).length
    )
    .map((entry) => ({
      designation: entry.designation.trim(),
      company: entry.company.trim(),
      location: entry.location.trim(),
      duration: entry.duration.trim(),
      responsibilities: splitLines(entry.text),
    })),
  projects: draft.projects
    .filter((entry) => entry.name.trim() || splitLines(entry.text).length)
    .map((entry) => ({
      name: entry.name.trim(),
      meta: "",
      link: entry.link.trim(),
      responsibilities: splitLines(entry.text),
    })),
  education: draft.educations
    .filter(
      (entry) =>
        entry.qualification.trim() ||
        entry.institution.trim() ||
        splitLines(entry.details).length
    )
    .map((entry) => ({
      qualification: entry.qualification.trim(),
      institution: entry.institution.trim(),
      location: entry.location.trim(),
      duration: entry.duration.trim(),
      details: splitLines(entry.details),
    })),
  certifications: draft.certifications
    .filter((cert) => cert.title.trim())
    .map((cert) =>
      cert.link.trim()
        ? `${cert.title.trim()} — ${cert.link.trim()}`
        : cert.title.trim()
    ),
  languages: draft.languages.map((language) => language.trim()).filter(Boolean),
  additionalSections: draft.additionalSections
    .filter((section) => section.title.trim() && splitLines(section.text).length)
    .map((section) => ({
      title: section.title.trim(),
      items: splitLines(section.text),
    })),
});

// A structured base resume returned by the extraction endpoint, or persisted.
export type ExtractedBaseResume = {
  candidateName?: string;
  designation?: string;
  experienceYears?: string | number;
  contact?: {
    email?: string;
    phone?: string;
    location?: string;
    links?: { label?: string; url?: string }[];
  };
  links?: Partial<Record<LinkKey, string>>;
  summary?: string;
  skills?: string[];
  experience?: {
    designation?: string;
    company?: string;
    location?: string;
    duration?: string;
    responsibilities?: string[];
  }[];
  projects?: { name?: string; link?: string; responsibilities?: string[] }[];
  education?: {
    qualification?: string;
    institution?: string;
    location?: string;
    duration?: string;
    details?: string[];
  }[];
  certifications?: string[];
  languages?: string[];
  additionalSections?: { title?: string; items?: string[] }[];
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// A comparable score for the END of a role's duration, so experiences can be
// ordered latest-first. "Present"/"Current" ranks highest; unparseable dates
// rank lowest (pushed to the bottom). Score = year*12 + month.
const experienceEndScore = (duration = ""): number => {
  const value = duration.toLowerCase();
  // The end is whatever follows the range separator (fall back to the whole string).
  const parts = value.split(/[-–—]|\bto\b/);
  const end = (parts[parts.length - 1] || value).trim();

  // Finite sentinels (not Infinity) so ties like two "Present" roles subtract
  // to 0 rather than NaN and fall back to stable index order.
  if (/present|current|now|ongoing|to date|till date/.test(end)) {
    return 9e15;
  }

  const monthName = end.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  const numericMonthYear = end.match(/(\d{1,2})[/.\-](\d{4})/); // MM/YYYY
  const yearOnly = end.match(/(19|20)\d{2}/);

  const year = numericMonthYear
    ? Number(numericMonthYear[2])
    : yearOnly
    ? Number(yearOnly[0])
    : null;
  if (year === null) return -9e15;

  const month = numericMonthYear
    ? Number(numericMonthYear[1])
    : monthName
    ? MONTHS[monthName[1]]
    : 12; // year-only → treat as end of that year

  return year * 12 + month;
};

// Latest role first, oldest last. Stable for ties / unparseable durations, so
// the original relative order is preserved where dates can't disambiguate.
export const sortExperiencesLatestFirst = <T extends { duration: string }>(
  experiences: T[]
): T[] =>
  experiences
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const diff = experienceEndScore(b.entry.duration) - experienceEndScore(a.entry.duration);
      return diff !== 0 ? diff : a.index - b.index;
    })
    .map(({ entry }) => entry);

const linkKeyForUrl = (url: string): LinkKey => {
  const value = url.toLowerCase();
  if (value.includes("linkedin.com")) return "linkedin";
  if (value.includes("dribbble.com")) return "dribbble";
  if (value.includes("behance.net")) return "behance";
  if (value.includes("github.com") || value.includes("gitlab.com")) return "github";
  return "other";
};

// Placeholder/generic names the model sometimes emits instead of a real
// category (most often by echoing the schema's "Category: ..." example). These
// must never become a visible heading — bucket their items under "Skills".
const GENERIC_CATEGORY_NAMES = new Set([
  "category",
  "categories",
  "categoryname",
  "skill",
  "skills",
  "item",
  "items",
  "other",
  "others",
  "misc",
  "miscellaneous",
]);

const parseSkillCategory = (raw: string): SkillCategory => {
  const [head, ...rest] = raw.split(":");
  if (rest.length) {
    const name = head.trim();
    const isGeneric = GENERIC_CATEGORY_NAMES.has(name.toLowerCase());
    return {
      category: isGeneric || !name ? "Skills" : name,
      items: rest
        .join(":")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };
  }
  return { category: "Skills", items: [raw.trim()].filter(Boolean) };
};

// Fold categories that share a name (case-insensitive) into one, de-duping
// items — otherwise the editor renders duplicate headings and, before keys were
// made unique, crashed with a duplicate-key error.
const mergeSkillCategories = (categories: SkillCategory[]): SkillCategory[] => {
  const byName = new Map<string, SkillCategory>();
  categories.forEach((category) => {
    const key = category.category.trim().toLowerCase();
    const existing = byName.get(key);
    if (existing) {
      category.items.forEach((item) => {
        if (!existing.items.some((i) => i.toLowerCase() === item.toLowerCase())) {
          existing.items.push(item);
        }
      });
    } else {
      byName.set(key, { category: category.category, items: [...category.items] });
    }
  });
  return Array.from(byName.values());
};

const splitCertification = (raw: string): CertificationDraft => {
  const match = raw.match(/^(.*?)(?:\s+[—-]\s+)(https?:\/\/\S+)$/);
  if (match) return { title: match[1].trim(), link: match[2].trim() };
  return { title: raw.trim(), link: "" };
};

// Extraction/persisted structured resume -> editable draft.
export const extractedToDraft = (source: ExtractedBaseResume): BaseResumeDraft => {
  const draft = emptyBaseResumeDraft();
  draft.candidateName = (source.candidateName || "").trim();
  draft.designation = (source.designation || "").trim();
  draft.experienceYears =
    source.experienceYears !== undefined && source.experienceYears !== null
      ? String(source.experienceYears)
      : "";
  draft.email = (source.contact?.email || "").trim();
  draft.phone = (source.contact?.phone || "").trim();
  draft.location = (source.contact?.location || "").trim();

  // Links can arrive either pre-keyed or as a flat contact.links array.
  if (source.links) {
    (Object.keys(draft.links) as LinkKey[]).forEach((key) => {
      draft.links[key] = (source.links?.[key] || "").trim();
    });
  }
  (source.contact?.links || []).forEach((link) => {
    const url = (link?.url || "").trim();
    if (!url) return;
    const key = linkKeyForUrl(url);
    if (!draft.links[key]) draft.links[key] = url;
    else if (!draft.links.other) draft.links.other = url;
  });

  draft.summary = (source.summary || "").trim();

  const skills = mergeSkillCategories(
    (source.skills || []).map(parseSkillCategory).filter((c) => c.items.length)
  );
  if (skills.length) draft.skillCategories = skills;

  const experiences = (source.experience || []).map((entry) => ({
    designation: (entry.designation || "").trim(),
    company: (entry.company || "").trim(),
    location: (entry.location || "").trim(),
    duration: (entry.duration || "").trim(),
    text: joinLines(entry.responsibilities || []),
  }));
  draft.experiences = experiences.length
    ? sortExperiencesLatestFirst(experiences)
    : [emptyExperience()];

  const projects = (source.projects || []).map((entry) => ({
    name: (entry.name || "").trim(),
    link: (entry.link || "").trim(),
    text: joinLines(entry.responsibilities || []),
  }));
  draft.projects = projects.length ? projects : [emptyProject()];

  const educations = (source.education || []).map((entry) => ({
    qualification: (entry.qualification || "").trim(),
    institution: (entry.institution || "").trim(),
    location: (entry.location || "").trim(),
    duration: (entry.duration || "").trim(),
    details: joinLines(entry.details || []),
  }));
  draft.educations = educations.length ? educations : [emptyEducation()];

  const certifications = (source.certifications || []).map(splitCertification);
  draft.certifications = certifications.length ? certifications : [{ title: "", link: "" }];

  const languages = (source.languages || []).map((l) => (l || "").trim()).filter(Boolean);
  draft.languages = languages.length ? languages : [""];

  draft.additionalSections = (source.additionalSections || [])
    .filter((section) => (section.title || "").trim())
    .map((section) => ({
      title: (section.title || "").trim(),
      text: joinLines(section.items || []),
    }));

  return draft;
};

// Draft -> plain resume text, used by the scan/analyze/tailor pipeline which
// consumes resumes as text and keys off uppercase section headers.
export const serializeResumeText = (draft: BaseResumeDraft): string => {
  const lines: string[] = [];
  const name = draft.candidateName.trim();
  if (name) lines.push(name);
  if (draft.designation.trim()) lines.push(draft.designation.trim());

  const contactBits = [draft.email, draft.phone, draft.location]
    .map((v) => v.trim())
    .filter(Boolean);
  if (contactBits.length) lines.push(contactBits.join(" | "));
  LINK_FIELDS.forEach((field) => {
    const url = draft.links[field.key].trim();
    if (url) lines.push(`${field.label}: ${url}`);
  });

  const data = draftToResumeData(draft);

  if (data.summary) {
    lines.push("", "SUMMARY", data.summary);
  }
  if (data.skills?.length) {
    lines.push("", "SKILLS", ...data.skills);
  }
  if (data.experience?.length) {
    lines.push("", "EXPERIENCE");
    data.experience.forEach((entry) => {
      const header = [entry.designation, entry.company].filter(Boolean).join(" — ");
      const meta = [entry.location, entry.duration].filter(Boolean).join(" | ");
      lines.push([header, meta].filter(Boolean).join(" | "));
      (entry.responsibilities || []).forEach((bullet) => lines.push(`- ${bullet}`));
    });
  }
  if (data.projects?.length) {
    lines.push("", "PROJECTS");
    data.projects.forEach((entry) => {
      lines.push([entry.name, entry.link].filter(Boolean).join(" — "));
      (entry.responsibilities || []).forEach((bullet) => lines.push(`- ${bullet}`));
    });
  }
  if (data.education?.length) {
    lines.push("", "EDUCATION");
    data.education.forEach((entry) => {
      const header = [entry.qualification, entry.institution].filter(Boolean).join(" — ");
      const meta = [entry.location, entry.duration].filter(Boolean).join(" | ");
      lines.push([header, meta].filter(Boolean).join(" | "));
      (entry.details || []).forEach((detail) => lines.push(`- ${detail}`));
    });
  }
  if (data.certifications?.length) {
    lines.push("", "CERTIFICATIONS");
    data.certifications.forEach((cert) => lines.push(`- ${cert}`));
  }
  if (data.languages?.length) {
    lines.push("", "LANGUAGES");
    data.languages.forEach((language) => lines.push(`- ${language}`));
  }
  (data.additionalSections || []).forEach((section) => {
    lines.push("", (section.title || "").toUpperCase());
    (section.items || []).forEach((item) => lines.push(`- ${item}`));
  });

  return lines.join("\n").trim();
};

// Validation used by the wizard to gate mandatory steps.
export const stepHasContent = {
  personal: (draft: BaseResumeDraft) =>
    Boolean(draft.candidateName.trim() && draft.email.trim()),
  summary: (draft: BaseResumeDraft) => Boolean(draft.summary.trim()),
  skills: (draft: BaseResumeDraft) =>
    draft.skillCategories.some((category) => category.items.length),
  education: (draft: BaseResumeDraft) =>
    draft.educations.some(
      (entry) => entry.qualification.trim() || entry.institution.trim()
    ),
};

// ---- Section cards ---------------------------------------------------------

export const PersonalDetailsCard = ({
  draft,
  update,
}: {
  draft: BaseResumeDraft;
  update: (patch: Partial<BaseResumeDraft>) => void;
}) => (
  <SectionCard icon={User} title="Personal details">
    <div className="grid grid-cols-2 gap-2.5">
      <div className="space-y-1">
        <span className={labelClass}>Full name</span>
        <input
          className={inputClass}
          value={draft.candidateName}
          onChange={(event) => update({ candidateName: event.target.value })}
          placeholder="Jane Doe"
        />
      </div>
      <div className="space-y-1">
        <span className={labelClass}>Professional title</span>
        <input
          className={inputClass}
          value={draft.designation}
          onChange={(event) => update({ designation: event.target.value })}
          placeholder="Project Coordinator"
        />
      </div>
      <div className="space-y-1">
        <span className={labelClass}>Experience (years)</span>
        <input
          className={inputClass}
          value={draft.experienceYears}
          onChange={(event) => update({ experienceYears: event.target.value })}
          placeholder="3"
        />
      </div>
      <div className="space-y-1">
        <span className={labelClass}>Location</span>
        <input
          className={inputClass}
          value={draft.location}
          onChange={(event) => update({ location: event.target.value })}
          placeholder="City, Country"
        />
      </div>
      <div className="space-y-1">
        <span className={labelClass}>Email</span>
        <input
          className={inputClass}
          value={draft.email}
          onChange={(event) => update({ email: event.target.value })}
          placeholder="jane@email.com"
        />
      </div>
      <div className="space-y-1">
        <span className={labelClass}>Phone</span>
        <input
          className={inputClass}
          value={draft.phone}
          onChange={(event) => update({ phone: event.target.value })}
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
              value={draft.links[key]}
              onChange={(event) =>
                update({ links: { ...draft.links, [key]: event.target.value } })
              }
              placeholder={placeholder}
            />
          </div>
        </div>
      ))}
    </div>
  </SectionCard>
);

export const SkillsCard = ({
  value,
  onChange,
}: {
  value: SkillCategory[];
  onChange: (next: SkillCategory[]) => void;
}) => {
  const [skillInput, setSkillInput] = useState("");
  const [categorizing, setCategorizing] = useState(false);

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
        existingCategories: value.map((category) => category.category),
      });
      const category = result?.success ? result.category : "Other";
      onChange(addSkillToCategory(value, category, skill));
      setSkillInput("");
    } catch (error) {
      console.error(error);
      onChange(addSkillToCategory(value, "Other", skill));
      setSkillInput("");
    } finally {
      setCategorizing(false);
    }
  };

  const removeSkill = (category: string, skill: string) =>
    onChange(
      value
        .map((item) =>
          item.category === category
            ? { ...item, items: item.items.filter((v) => v !== skill) }
            : item
        )
        .filter((item) => item.items.length)
    );

  return (
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
      {value.length > 0 ? (
        <div className="mt-3 space-y-2.5">
          {value.map((category, index) => (
            <div key={`${category.category}-${index}`}>
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
  );
};

export const SummaryCard = ({
  draft,
  update,
}: {
  draft: BaseResumeDraft;
  update: (patch: Partial<BaseResumeDraft>) => void;
}) => {
  const [generating, setGenerating] = useState(false);

  const generateSummary = async () => {
    const hasExperience = draft.experiences.some(
      (entry) => entry.company.trim() || entry.text.trim()
    );
    if (!draft.designation.trim() || draft.skillCategories.length === 0 || !hasExperience) {
      toast.info(
        "Add your professional title, work experience, and a few skills first to generate a summary."
      );
      return;
    }
    setGenerating(true);
    try {
      const highlights = draft.experiences
        .filter((entry) => entry.company.trim() || entry.text.trim())
        .map(
          (entry) =>
            `${entry.designation || ""} at ${entry.company || ""}: ${entry.text.replace(
              /\n/g,
              " "
            )}`
        );
      const result = await callAssist({
        action: "generate-summary",
        designation: draft.designation,
        experienceYears: draft.experienceYears,
        skills: draftToResumeData(draft).skills,
        experience: highlights,
      });
      if (result?.success && result.summary) update({ summary: result.summary });
      else toast.error(result?.message || "Could not generate a summary.");
    } catch (error) {
      console.error(error);
      toast.error("Could not generate a summary right now.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SectionCard icon={FileText} title="Summary">
      <div className="relative">
        <textarea
          className={`${inputClass} min-h-[110px] resize-y pb-10 leading-relaxed`}
          value={draft.summary}
          onChange={(event) => update({ summary: event.target.value })}
          placeholder="A short professional summary — or generate one from your details."
        />
        <button
          type="button"
          onClick={generateSummary}
          disabled={generating}
          className="absolute bottom-2 right-2 mb-2 inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {generating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          Generate summary
        </button>
      </div>
    </SectionCard>
  );
};

export const ExperienceCard = ({
  value,
  onChange,
}: {
  value: ExperienceDraft[];
  onChange: (next: ExperienceDraft[]) => void;
}) => {
  const [rephrasingIndex, setRephrasingIndex] = useState<number | null>(null);

  const updateEntry = (index: number, patch: Partial<ExperienceDraft>) =>
    onChange(value.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  const addEntry = () => onChange([...value, emptyExperience()]);
  const removeEntry = (index: number) => onChange(value.filter((_, i) => i !== index));

  const rephrase = async (index: number) => {
    const entry = value[index];
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
        updateEntry(index, { text: result.bullets.join("\n") });
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

  return (
    <SectionCard
      icon={Briefcase}
      title="Experience"
      action={<AddEntryButton label="Add role" onClick={addEntry} />}
    >
      <div className="space-y-3">
        {value.map((entry, index) => (
          <div
            key={index}
            className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Experience {index + 1}
              </span>
              {value.length > 1 ? (
                <button
                  type="button"
                  aria-label="Remove role"
                  className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  onClick={() => removeEntry(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className={labelClass}>Designation</span>
                <input
                  className={inputClass}
                  value={entry.designation}
                  onChange={(event) =>
                    updateEntry(index, { designation: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <span className={labelClass}>Company</span>
                <input
                  className={inputClass}
                  value={entry.company}
                  onChange={(event) => updateEntry(index, { company: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <span className={labelClass}>Location</span>
                <input
                  className={inputClass}
                  value={entry.location}
                  onChange={(event) => updateEntry(index, { location: event.target.value })}
                />
              </div>
              <div className="space-y-1">
                <span className={labelClass}>Duration</span>
                <input
                  className={inputClass}
                  value={entry.duration}
                  onChange={(event) => updateEntry(index, { duration: event.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <span className={labelClass}>
                What did you do at this company? (add at least 2-3 lines)
              </span>
              <div className="relative">
                <textarea
                  className={`${inputClass} min-h-[96px] resize-y pb-10 leading-relaxed`}
                  value={entry.text}
                  onChange={(event) => updateEntry(index, { text: event.target.value })}
                  placeholder="Describe your work here, then tap Rephrase to turn it into sharp, ATS-friendly bullet points."
                />
                <button
                  type="button"
                  onClick={() => rephrase(index)}
                  disabled={rephrasingIndex === index}
                  className="absolute bottom-2 right-2 mb-2 inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
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
  );
};

export const ProjectsCard = ({
  value,
  onChange,
}: {
  value: ProjectDraft[];
  onChange: (next: ProjectDraft[]) => void;
}) => {
  const [rephrasingIndex, setRephrasingIndex] = useState<number | null>(null);

  const updateEntry = (index: number, patch: Partial<ProjectDraft>) =>
    onChange(value.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  const addEntry = () => onChange([...value, emptyProject()]);
  const removeEntry = (index: number) => onChange(value.filter((_, i) => i !== index));

  const rephrase = async (index: number) => {
    const entry = value[index];
    if (!entry.text.trim()) {
      toast.info("Write a few lines about the project first.");
      return;
    }
    setRephrasingIndex(index);
    try {
      const result = await callAssist({
        action: "rephrase-experience",
        designation: "Project contributor",
        company: entry.name,
        text: entry.text,
      });
      if (result?.success && Array.isArray(result.bullets) && result.bullets.length) {
        updateEntry(index, { text: result.bullets.join("\n") });
      } else {
        toast.error(result?.message || "Could not rephrase this project.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Could not rephrase this project right now.");
    } finally {
      setRephrasingIndex(null);
    }
  };

  return (
    <SectionCard
      icon={FolderGit2}
      title="Projects"
      action={<AddEntryButton label="Add project" onClick={addEntry} />}
    >
      <div className="space-y-3">
        {value.map((entry, index) => (
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
                    onChange={(event) => updateEntry(index, { name: event.target.value })}
                    placeholder="Portfolio website"
                  />
                </div>
                <div className="space-y-1">
                  <span className={labelClass}>Link</span>
                  <input
                    className={inputClass}
                    value={entry.link}
                    onChange={(event) => updateEntry(index, { link: event.target.value })}
                    placeholder="github.com/you/project"
                  />
                </div>
              </div>
              {value.length > 1 ? (
                <button
                  type="button"
                  aria-label="Remove project"
                  className="mt-5 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  onClick={() => removeEntry(index)}
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
                  onChange={(event) => updateEntry(index, { text: event.target.value })}
                  placeholder="Describe the project, then tap Rephrase to turn it into sharp, ATS-friendly bullet points."
                />
                <button
                  type="button"
                  onClick={() => rephrase(index)}
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
  );
};

export const EducationCard = ({
  value,
  onChange,
}: {
  value: EducationDraft[];
  onChange: (next: EducationDraft[]) => void;
}) => {
  const updateEntry = (index: number, patch: Partial<EducationDraft>) =>
    onChange(value.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  const addEntry = () => onChange([...value, emptyEducation()]);
  const removeEntry = (index: number) => onChange(value.filter((_, i) => i !== index));

  return (
    <SectionCard
      icon={GraduationCap}
      title="Education"
      action={<AddEntryButton label="Add education" onClick={addEntry} />}
    >
      <div className="space-y-3">
        {value.map((entry, index) => (
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
                      updateEntry(index, { qualification: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <span className={labelClass}>Institution</span>
                  <input
                    className={inputClass}
                    value={entry.institution}
                    onChange={(event) =>
                      updateEntry(index, { institution: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <span className={labelClass}>Location</span>
                  <input
                    className={inputClass}
                    value={entry.location}
                    onChange={(event) => updateEntry(index, { location: event.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <span className={labelClass}>Duration</span>
                  <input
                    className={inputClass}
                    value={entry.duration}
                    onChange={(event) => updateEntry(index, { duration: event.target.value })}
                  />
                </div>
              </div>
              {value.length > 1 ? (
                <button
                  type="button"
                  aria-label="Remove education"
                  className="mt-5 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  onClick={() => removeEntry(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <div className="space-y-1">
              <span className={labelClass}>Details (optional — one per line)</span>
              <textarea
                className={`${inputClass} min-h-[64px] resize-y leading-relaxed`}
                value={entry.details}
                onChange={(event) => updateEntry(index, { details: event.target.value })}
                placeholder="Honors, relevant coursework, GPA…"
              />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
};

export const CertificationsCard = ({
  value,
  onChange,
}: {
  value: CertificationDraft[];
  onChange: (next: CertificationDraft[]) => void;
}) => {
  const updateEntry = (index: number, patch: Partial<CertificationDraft>) =>
    onChange(value.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  const addEntry = () => onChange([...value, { title: "", link: "" }]);
  const removeEntry = (index: number) => onChange(value.filter((_, i) => i !== index));

  return (
    <SectionCard
      icon={Award}
      title="Certifications"
      action={<AddEntryButton label="Add certification" onClick={addEntry} />}
    >
      <div className="space-y-2.5">
        {value.map((entry, index) => (
          <div key={index} className="flex items-end gap-2">
            <div className="grid flex-1 grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className={labelClass}>Title</span>
                <input
                  className={inputClass}
                  value={entry.title}
                  onChange={(event) => updateEntry(index, { title: event.target.value })}
                  placeholder="Google Project Management"
                />
              </div>
              <div className="space-y-1">
                <span className={labelClass}>Link</span>
                <input
                  className={inputClass}
                  value={entry.link}
                  onChange={(event) => updateEntry(index, { link: event.target.value })}
                  placeholder="https://credential…"
                />
              </div>
            </div>
            {value.length > 1 ? (
              <button
                type="button"
                aria-label="Remove certification"
                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                onClick={() => removeEntry(index)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </SectionCard>
  );
};

export const LanguagesCard = ({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) => {
  const updateEntry = (index: number, next: string) =>
    onChange(value.map((entry, i) => (i === index ? next : entry)));
  const addEntry = () => onChange([...value, ""]);
  const removeEntry = (index: number) => onChange(value.filter((_, i) => i !== index));

  return (
    <SectionCard
      icon={LanguagesIcon}
      title="Languages"
      action={<AddEntryButton label="Add language" onClick={addEntry} />}
    >
      <div className="grid grid-cols-2 gap-2">
        {value.map((language, index) => (
          <div key={index} className="flex items-center gap-1.5">
            <input
              className={inputClass}
              value={language}
              onChange={(event) => updateEntry(index, event.target.value)}
              placeholder="English"
            />
            {value.length > 1 ? (
              <button
                type="button"
                aria-label="Remove language"
                className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                onClick={() => removeEntry(index)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </SectionCard>
  );
};

// Additional sections carry an editable title (awards, publications, volunteering…).
export const AdditionalSectionsCard = ({
  value,
  onChange,
}: {
  value: AdditionalSectionDraft[];
  onChange: (next: AdditionalSectionDraft[]) => void;
}) => {
  const updateEntry = (index: number, patch: Partial<AdditionalSectionDraft>) =>
    onChange(value.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  const addEntry = () => onChange([...value, emptyAdditionalSection()]);
  const removeEntry = (index: number) => onChange(value.filter((_, i) => i !== index));

  return (
    <SectionCard
      icon={FileText}
      title="Additional sections"
      action={<AddEntryButton label="Add section" onClick={addEntry} />}
    >
      {value.length === 0 ? (
        <p className="text-xs text-slate-400">
          Extra sections found in your resume (awards, publications, volunteering…) appear
          here. You can rename each section title and edit its contents.
        </p>
      ) : (
        <div className="space-y-3">
          {value.map((entry, index) => (
            <div
              key={index}
              className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/60 p-3"
            >
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <span className={labelClass}>Section title</span>
                  <input
                    className={inputClass}
                    value={entry.title}
                    onChange={(event) => updateEntry(index, { title: event.target.value })}
                    placeholder="Awards"
                  />
                </div>
                <button
                  type="button"
                  aria-label="Remove section"
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  onClick={() => removeEntry(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1">
                <span className={labelClass}>Items (one per line)</span>
                <textarea
                  className={`${inputClass} min-h-[72px] resize-y leading-relaxed`}
                  value={entry.text}
                  onChange={(event) => updateEntry(index, { text: event.target.value })}
                  placeholder="One item per line"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
};
