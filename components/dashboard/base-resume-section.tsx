"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  Download,
  Eye,
  FileText,
  Loader2,
  Minus,
  Palette,
  Plus,
  SaveIcon,
  UploadCloud,
  UserCircle2Icon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import {
  RESUME_FONT_OPTIONS,
  resolveResumeTemplateTheme,
} from "@/components/resume-templates/config";
import { ResumeTemplatePicker } from "@/components/dashboard/template-picker";
import type {
  ResumeTemplateId,
  ResumeTemplateThemeOverrides,
} from "@/components/resume-templates/types";
import {
  renderResumeFromData,
  toSlugPart,
} from "@/components/resume-templates/render";
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
  draftToResumeData,
  emptyBaseResumeDraft,
  extractedToDraft,
  type BaseResumeDraft,
  type ExtractedBaseResume,
} from "@/components/dashboard/resume-form";
import { saveBaseResume, type StoredBaseResume } from "@/lib/base-resume";

type BaseResumeSectionProps = {
  user: {
    id?: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  } | null;
};

export const BaseResumeSection = ({ user }: BaseResumeSectionProps) => {
  const [draft, setDraft] = useState<BaseResumeDraft>(emptyBaseResumeDraft());
  const [selectedTemplate, setSelectedTemplate] =
    useState<ResumeTemplateId>("bold-modern");
  const [templateOverrides, setTemplateOverrides] = useState<
    Record<string, ResumeTemplateThemeOverrides>
  >({});
  const [editorTab, setEditorTab] = useState<"content" | "design">("content");
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [parsingResume, setParsingResume] = useState(false);

  const overrides = templateOverrides[selectedTemplate];
  const theme = resolveResumeTemplateTheme(selectedTemplate, overrides);
  const displayName = draft.candidateName.trim() || "Your Name";

  const update = (patch: Partial<BaseResumeDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  // Load the saved base resume (or fall back to contact-level profile fields).
  useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      const stored = data?.base_resume as StoredBaseResume | null;
      if (stored?.draft) {
        setDraft(stored.draft);
        if (stored.template) setSelectedTemplate(stored.template);
        if (stored.overrides)
          setTemplateOverrides({ [stored.template || "bold-modern"]: stored.overrides });
      } else if (data) {
        // No structured base resume yet — seed contact from profile columns.
        setDraft((current) => ({
          ...current,
          candidateName: data.full_name || "",
          designation: data.headline || "",
          email: data.email || user.email || "",
          phone: data.phone || "",
          location: [data.city, data.country].filter(Boolean).join(", "),
          experienceYears:
            data.experience_years !== null && data.experience_years !== undefined
              ? String(data.experience_years)
              : "",
          links: {
            ...current.links,
            linkedin: data.linkedin || "",
            portfolio: data.portfolio || "",
            behance: data.behance || "",
            github: data.github || "",
            other: data.other_link || "",
          },
        }));
      } else if (user.email) {
        setDraft((current) => ({ ...current, email: user.email || "" }));
      }
      setLoading(false);
    };
    load().catch((error) => {
      console.error("Failed to load base resume:", error);
      setLoading(false);
    });
  }, [user?.id, user?.email]);

  const data = useMemo(() => draftToResumeData(draft), [draft]);
  const previewHtml = useMemo(
    () =>
      renderResumeFromData({
        data,
        templateId: selectedTemplate,
        candidateName: displayName,
        designation: draft.designation,
        overrides,
      }),
    [data, selectedTemplate, displayName, draft.designation, overrides]
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

  const handleResumeUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("extractBaseResume", "true");
    setParsingResume(true);
    try {
      const response = await fetch("/api/scan", { method: "POST", body: formData });
      const result = await response.json();
      if (!result.success || !result.baseResume) {
        toast.error(result.message || "Failed to read that resume.");
        return;
      }
      setDraft(extractedToDraft(result.baseResume as ExtractedBaseResume));
      toast.success("Resume extracted. Review each field, then save.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to read that resume.");
    } finally {
      setParsingResume(false);
      event.target.value = "";
    }
  };

  const persist = async () => {
    if (!user?.id) {
      toast.error("No user session. Please log in again.");
      return;
    }
    setSaving(true);
    try {
      await saveBaseResume(user, draft, selectedTemplate, overrides);
      toast.success("Base resume saved.");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save base resume.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

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
      anchor.download = `${toSlugPart(draft.candidateName || "base")}-resume.pdf`;
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

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <UserCircle2Icon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Base Resume</h1>
            <p className="text-sm text-slate-500">
              This is the master resume every scan is tailored from. Edit any field and save.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <label
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50",
              parsingResume && "pointer-events-none opacity-60"
            )}
          >
            {parsingResume ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            {parsingResume ? "Reading…" : "Re-upload"}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx"
              onChange={handleResumeUpload}
              disabled={parsingResume}
            />
          </label>
          <Button variant="outline" className="rounded-md" onClick={() => setPreviewOpen(true)}>
            <Eye className="mr-2 h-4 w-4" /> Preview
          </Button>
          <Button variant="outline" className="rounded-md" onClick={downloadPdf} disabled={downloading}>
            {downloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download
          </Button>
          <Button className="rounded-md" onClick={persist} disabled={saving}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <SaveIcon className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        </div>
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
                <PersonalDetailsCard draft={draft} update={update} />
                <SkillsCard
                  value={draft.skillCategories}
                  onChange={(next) => update({ skillCategories: next })}
                />
                <SummaryCard draft={draft} update={update} />
                <ExperienceCard
                  value={draft.experiences}
                  onChange={(next) => update({ experiences: next })}
                />
                <ProjectsCard
                  value={draft.projects}
                  onChange={(next) => update({ projects: next })}
                />
                <EducationCard
                  value={draft.educations}
                  onChange={(next) => update({ educations: next })}
                />
                <CertificationsCard
                  value={draft.certifications}
                  onChange={(next) => update({ certifications: next })}
                />
                <LanguagesCard
                  value={draft.languages}
                  onChange={(next) => update({ languages: next })}
                />
                <AdditionalSectionsCard
                  value={draft.additionalSections}
                  onChange={(next) => update({ additionalSections: next })}
                />
              </>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Template
                  </p>
                  <ResumeTemplatePicker
                    selected={selectedTemplate}
                    onSelect={setSelectedTemplate}
                  />
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
                        onChange={(event) => updateOverrides({ bodyColor: event.target.value })}
                      />
                    </label>
                    <label className="text-xs text-slate-600">
                      Font
                      <select
                        className="mt-1 h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs"
                        value={theme.fontFamily}
                        onChange={(event) => updateOverrides({ fontFamily: event.target.value })}
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

      {previewOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/50 p-4 sm:p-8"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="relative w-full max-w-[880px]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Close preview"
              className="absolute -top-2 right-0 -translate-y-full rounded-md bg-white/90 p-2 text-slate-700 shadow hover:bg-white"
              onClick={() => setPreviewOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
            <div
              className="overflow-hidden rounded-md bg-white shadow-2xl"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
};
