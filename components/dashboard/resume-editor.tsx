"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  renderResumeFromData,
  type ResumeData,
  type ResumeEducationItem,
  type ResumeExperienceItem,
  type ResumeProjectItem,
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
  photoUrl?: string;
  overrides?: ResumeTemplateThemeOverrides;
  useContactIcons?: boolean;
};

const linesToText = (lines?: string[]) => (lines || []).join("\n");
const textToLines = (text: string) =>
  text
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s+/, "").trimEnd())
    .filter((line) => line.trim().length > 0);

const labelClass = "block text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const inputClass =
  "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10";
const textareaClass = `${inputClass} resize-y leading-relaxed`;
const cardClass = "rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2";
const sectionTitleClass = "text-sm font-semibold text-slate-900";

export const ResumeEditor = ({
  data,
  onChange,
  templateId,
  candidateName,
  designation,
  photoUrl,
  overrides,
  useContactIcons,
}: ResumeEditorProps) => {
  const previewHtml = useMemo(
    () =>
      renderResumeFromData({
        data,
        templateId,
        candidateName,
        designation,
        photoUrl,
        overrides,
        useContactIcons,
      }),
    [data, templateId, candidateName, designation, photoUrl, overrides, useContactIcons]
  );

  const patch = (next: Partial<ResumeData>) => onChange({ ...data, ...next });

  // ---- Experience ---------------------------------------------------------
  const experience = data.experience || [];
  const updateExperience = (index: number, next: Partial<ResumeExperienceItem>) =>
    patch({
      experience: experience.map((item, i) => (i === index ? { ...item, ...next } : item)),
    });
  const addExperience = () =>
    patch({
      experience: [
        ...experience,
        { designation: "", company: "", location: "", duration: "", responsibilities: [] },
      ],
    });
  const removeExperience = (index: number) =>
    patch({ experience: experience.filter((_, i) => i !== index) });

  // ---- Education ----------------------------------------------------------
  const education = data.education || [];
  const updateEducation = (index: number, next: Partial<ResumeEducationItem>) =>
    patch({
      education: education.map((item, i) => (i === index ? { ...item, ...next } : item)),
    });
  const addEducation = () =>
    patch({
      education: [
        ...education,
        { qualification: "", institution: "", location: "", duration: "", details: [] },
      ],
    });
  const removeEducation = (index: number) =>
    patch({ education: education.filter((_, i) => i !== index) });

  // ---- Projects -----------------------------------------------------------
  const projects = data.projects || [];
  const updateProject = (index: number, next: Partial<ResumeProjectItem>) =>
    patch({
      projects: projects.map((item, i) => (i === index ? { ...item, ...next } : item)),
    });
  const addProject = () =>
    patch({ projects: [...projects, { name: "", link: "", responsibilities: [] }] });
  const removeProject = (index: number) =>
    patch({ projects: projects.filter((_, i) => i !== index) });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* ---- Editable fields ---- */}
      <div className="max-h-[68vh] space-y-5 overflow-auto pr-1">
        {/* Summary */}
        <div className="space-y-1.5">
          <span className={labelClass}>Summary</span>
          <textarea
            className={textareaClass}
            rows={4}
            value={data.summary || ""}
            onChange={(event) => patch({ summary: event.target.value })}
            placeholder="Professional summary"
          />
        </div>

        {/* Skills */}
        <div className="space-y-1.5">
          <span className={labelClass}>Skills (one category per line)</span>
          <textarea
            className={textareaClass}
            rows={4}
            value={linesToText(data.skills)}
            onChange={(event) => patch({ skills: textToLines(event.target.value) })}
            placeholder="Tools: Jira, Trello"
          />
        </div>

        {/* Experience */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={sectionTitleClass}>Experience</span>
            <Button
              type="button"
              variant="outline"
              className="h-7 rounded-md px-2 text-xs"
              onClick={addExperience}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add role
            </Button>
          </div>
          {experience.map((item, index) => (
            <div key={index} className={cardClass}>
              <div className="flex items-start justify-between gap-2">
                <div className="grid flex-1 grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className={labelClass}>Designation</span>
                    <input
                      className={inputClass}
                      value={item.designation || ""}
                      onChange={(event) =>
                        updateExperience(index, { designation: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <span className={labelClass}>Company</span>
                    <input
                      className={inputClass}
                      value={item.company || ""}
                      onChange={(event) =>
                        updateExperience(index, { company: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <span className={labelClass}>Location</span>
                    <input
                      className={inputClass}
                      value={item.location || ""}
                      onChange={(event) =>
                        updateExperience(index, { location: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <span className={labelClass}>Duration</span>
                    <input
                      className={inputClass}
                      value={item.duration || ""}
                      onChange={(event) =>
                        updateExperience(index, { duration: event.target.value })
                      }
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-5 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  onClick={() => removeExperience(index)}
                  aria-label="Remove role"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1">
                <span className={labelClass}>Responsibilities (one per line)</span>
                <textarea
                  className={textareaClass}
                  rows={4}
                  value={linesToText(item.responsibilities)}
                  onChange={(event) =>
                    updateExperience(index, {
                      responsibilities: textToLines(event.target.value),
                    })
                  }
                />
              </div>
            </div>
          ))}
        </div>

        {/* Projects */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={sectionTitleClass}>Projects</span>
            <Button
              type="button"
              variant="outline"
              className="h-7 rounded-md px-2 text-xs"
              onClick={addProject}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add project
            </Button>
          </div>
          {projects.map((item, index) => (
              <div key={index} className={cardClass}>
                <div className="flex items-start justify-between gap-2">
                  <div className="grid flex-1 grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className={labelClass}>Name</span>
                      <input
                        className={inputClass}
                        value={item.name || ""}
                        onChange={(event) =>
                          updateProject(index, { name: event.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <span className={labelClass}>Link</span>
                      <input
                        className={inputClass}
                        value={item.link || ""}
                        onChange={(event) =>
                          updateProject(index, { link: event.target.value })
                        }
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mt-5 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    onClick={() => removeProject(index)}
                    aria-label="Remove project"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-1">
                  <span className={labelClass}>Details (one per line)</span>
                  <textarea
                    className={textareaClass}
                    rows={3}
                    value={linesToText(item.responsibilities)}
                    onChange={(event) =>
                      updateProject(index, {
                        responsibilities: textToLines(event.target.value),
                      })
                    }
                  />
                </div>
              </div>
            ))}
        </div>

        {/* Education */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={sectionTitleClass}>Education</span>
            <Button
              type="button"
              variant="outline"
              className="h-7 rounded-md px-2 text-xs"
              onClick={addEducation}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add education
            </Button>
          </div>
          {education.map((item, index) => (
            <div key={index} className={cardClass}>
              <div className="flex items-start justify-between gap-2">
                <div className="grid flex-1 grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className={labelClass}>Qualification</span>
                    <input
                      className={inputClass}
                      value={item.qualification || ""}
                      onChange={(event) =>
                        updateEducation(index, { qualification: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <span className={labelClass}>Institution</span>
                    <input
                      className={inputClass}
                      value={item.institution || ""}
                      onChange={(event) =>
                        updateEducation(index, { institution: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <span className={labelClass}>Location</span>
                    <input
                      className={inputClass}
                      value={item.location || ""}
                      onChange={(event) =>
                        updateEducation(index, { location: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <span className={labelClass}>Duration</span>
                    <input
                      className={inputClass}
                      value={item.duration || ""}
                      onChange={(event) =>
                        updateEducation(index, { duration: event.target.value })
                      }
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-5 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500"
                  onClick={() => removeEducation(index)}
                  aria-label="Remove education"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-1">
                <span className={labelClass}>Details (one per line)</span>
                <textarea
                  className={textareaClass}
                  rows={2}
                  value={linesToText(item.details)}
                  onChange={(event) =>
                    updateEducation(index, { details: textToLines(event.target.value) })
                  }
                />
              </div>
            </div>
          ))}
        </div>

        {/* Certifications */}
        <div className="space-y-1.5">
          <span className={labelClass}>Certifications (one per line)</span>
          <textarea
            className={textareaClass}
            rows={3}
            value={linesToText(data.certifications)}
            onChange={(event) =>
              patch({ certifications: textToLines(event.target.value) })
            }
          />
        </div>

        {/* Languages */}
        <div className="space-y-1.5">
          <span className={labelClass}>Languages (one per line)</span>
          <textarea
            className={textareaClass}
            rows={3}
            value={linesToText(data.languages)}
            onChange={(event) => patch({ languages: textToLines(event.target.value) })}
          />
        </div>
      </div>

      {/* ---- Live preview ---- */}
      <div className="max-h-[68vh] overflow-auto rounded-lg border border-slate-200 bg-white">
        <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
      </div>
    </div>
  );
};
