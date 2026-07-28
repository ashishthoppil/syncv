"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  Copy,
  Download,
  Eye,
  FileText,
  Loader2,
  Minus,
  MoreVertical,
  Palette,
  Plus,
  SaveIcon,
  Star,
  Trash2,
  UploadCloud,
  UserCircle2Icon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
import {
  createBaseResume,
  deleteBaseResume,
  duplicateBaseResume,
  listBaseResumes,
  setDefaultBaseResume,
  updateBaseResume,
  MAX_BASE_RESUMES,
  type BaseResumeRecord,
} from "@/lib/base-resume";

type SectionUser = {
  id?: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
} | null;

// What the editor is bound to. `id: null` means a new, unsaved resume.
type EditorInitial = {
  id: string | null;
  name: string;
  draft: BaseResumeDraft;
  template: ResumeTemplateId;
  overrides?: ResumeTemplateThemeOverrides;
};

const buildPreviewHtml = (rec: {
  draft: BaseResumeDraft;
  template: ResumeTemplateId;
  overrides?: ResumeTemplateThemeOverrides;
}) =>
  renderResumeFromData({
    data: draftToResumeData(rec.draft),
    templateId: rec.template,
    candidateName: rec.draft.candidateName.trim() || "Your Name",
    designation: rec.draft.designation,
    overrides: rec.overrides,
  });

const downloadPdfFromHtml = async (html: string, fileBase: string) => {
  const response = await fetch("/api/generate-pdf", {
    method: "POST",
    body: JSON.stringify({ html, type: "tailored-cv" }),
  });
  if (!response.ok) throw new Error("Failed to generate PDF.");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `${toSlugPart(fileBase || "base")}-resume.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
};

// ---------------------------------------------------------------------------
// Editor — the full single-resume editing surface (content + design + preview).
// ---------------------------------------------------------------------------

const BaseResumeEditor = ({
  user,
  initial,
  onBack,
  onSaved,
}: {
  user: SectionUser;
  initial: EditorInitial;
  onBack: () => void;
  onSaved: () => void;
}) => {
  const [recordId, setRecordId] = useState<string | null>(initial.id);
  const [name, setName] = useState(initial.name);
  const [draft, setDraft] = useState<BaseResumeDraft>(initial.draft);
  const [selectedTemplate, setSelectedTemplate] = useState<ResumeTemplateId>(
    initial.template
  );
  const [templateOverrides, setTemplateOverrides] = useState<
    Record<string, ResumeTemplateThemeOverrides>
  >(initial.overrides ? { [initial.template]: initial.overrides } : {});
  const [editorTab, setEditorTab] = useState<"content" | "design">("content");
  const [previewZoom, setPreviewZoom] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [parsingResume, setParsingResume] = useState(false);

  const overrides = templateOverrides[selectedTemplate];
  const theme = resolveResumeTemplateTheme(selectedTemplate, overrides);

  const update = (patch: Partial<BaseResumeDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const previewHtml = useMemo(
    () => buildPreviewHtml({ draft, template: selectedTemplate, overrides }),
    [draft, selectedTemplate, overrides]
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
    // Experience (years) is required — it drives the experience-relevance score.
    if (
      !draft.experienceYears.trim() ||
      !Number.isFinite(Number(draft.experienceYears))
    ) {
      setEditorTab("content");
      toast.error("Please enter your total years of experience (a number).");
      return;
    }
    setSaving(true);
    try {
      const input = {
        name: name.trim() || "Untitled resume",
        draft,
        template: selectedTemplate,
        overrides,
      };
      const record = recordId
        ? await updateBaseResume(user, recordId, input)
        : await createBaseResume(user, input);
      setRecordId(record.id);
      if (!name.trim()) setName(record.name);
      toast.success("Base resume saved.");
      onSaved();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save base resume."
      );
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      await downloadPdfFromHtml(previewHtml, draft.candidateName || name);
    } catch (error) {
      console.error(error);
      toast.error("Unable to download PDF right now.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 rounded-md"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" /> Base resumes
          </Button>
          <input
            className="w-56 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name this resume"
          />
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
            {parsingResume ? "Reading…" : "Replace from file"}
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
          <Button
            variant="outline"
            className="rounded-md"
            onClick={downloadPdf}
            disabled={downloading}
          >
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
        {/* Left: editor */}
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

        {/* Right: live preview */}
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

// ---------------------------------------------------------------------------
// Manager — the table of base resumes with create / duplicate / default / delete.
// ---------------------------------------------------------------------------

const formatDate = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

export const BaseResumeSection = ({ user }: { user: SectionUser }) => {
  const [records, setRecords] = useState<BaseResumeRecord[] | null>(null);
  const [editor, setEditor] = useState<EditorInitial | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  // Fixed-position coords for the open row menu so it isn't clipped by the
  // table's overflow container.
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);

  const openRowMenu = (id: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (menuId === id) {
      setMenuId(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setMenuId(id);
  };

  const reload = useCallback(async () => {
    if (!user?.id) {
      setRecords([]);
      return;
    }
    try {
      setRecords(await listBaseResumes(user.id));
    } catch (error) {
      console.error("Failed to load base resumes:", error);
      toast.error("Could not load your base resumes.");
      setRecords([]);
    }
  }, [user?.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  const atLimit = (records?.length || 0) >= MAX_BASE_RESUMES;

  const startManual = () => {
    setAddMenuOpen(false);
    const draft = emptyBaseResumeDraft();
    if (user?.email) draft.email = user.email;
    setEditor({ id: null, name: "", draft, template: "bold-modern" });
  };

  const startUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAddMenuOpen(false);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("extractBaseResume", "true");
    setParsing(true);
    try {
      const response = await fetch("/api/scan", { method: "POST", body: formData });
      const data = await response.json();
      if (!data.success || !data.baseResume) {
        toast.error(data.message || "We couldn't read that resume.");
        return;
      }
      const draft = extractedToDraft(data.baseResume as ExtractedBaseResume);
      if (!draft.email && user?.email) draft.email = user.email;
      const fileBase = file.name.replace(/\.[^.]+$/, "");
      setEditor({ id: null, name: fileBase, draft, template: "bold-modern" });
    } catch (error) {
      console.error(error);
      toast.error("We couldn't read that resume.");
    } finally {
      setParsing(false);
      event.target.value = "";
    }
  };

  const openEdit = (rec: BaseResumeRecord) =>
    setEditor({
      id: rec.id,
      name: rec.name,
      draft: rec.draft,
      template: rec.template,
      overrides: rec.overrides,
    });

  const handleDuplicate = async (rec: BaseResumeRecord) => {
    if (atLimit) {
      toast.info(`You can have at most ${MAX_BASE_RESUMES} base resumes.`);
      return;
    }
    setBusyId(rec.id);
    setMenuId(null);
    try {
      const copy = await duplicateBaseResume(user, rec);
      await reload();
      openEdit(copy);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not duplicate.");
    } finally {
      setBusyId(null);
    }
  };

  const handleSetDefault = async (rec: BaseResumeRecord) => {
    if (!user?.id) return;
    setBusyId(rec.id);
    setMenuId(null);
    try {
      await setDefaultBaseResume(user.id, rec.id);
      await reload();
      toast.success(`“${rec.name}” is now your default.`);
    } catch (error) {
      console.error(error);
      toast.error("Could not set default.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (rec: BaseResumeRecord) => {
    if (!user?.id) return;
    if (!window.confirm(`Delete “${rec.name}”? This can't be undone.`)) return;
    setBusyId(rec.id);
    setMenuId(null);
    try {
      await deleteBaseResume(user.id, rec.id);
      await reload();
      toast.success("Base resume deleted.");
    } catch (error) {
      console.error(error);
      toast.error("Could not delete base resume.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (rec: BaseResumeRecord) => {
    setBusyId(rec.id);
    setMenuId(null);
    try {
      await downloadPdfFromHtml(
        buildPreviewHtml(rec),
        rec.draft.candidateName || rec.name
      );
    } catch (error) {
      console.error(error);
      toast.error("Unable to download PDF right now.");
    } finally {
      setBusyId(null);
    }
  };

  if (editor) {
    return (
      <BaseResumeEditor
        user={user}
        initial={editor}
        onBack={() => {
          setEditor(null);
          reload();
        }}
        onSaved={reload}
      />
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <UserCircle2Icon className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Base Resumes</h1>
            <p className="text-sm text-slate-500">
              Keep up to {MAX_BASE_RESUMES} master resumes. Scans are tailored from the one
              you pick. Your default is used unless you choose another.
            </p>
          </div>
        </div>

        <div className="relative">
          <Button
            className="rounded-md"
            onClick={() => setAddMenuOpen((open) => !open)}
            disabled={atLimit || parsing}
            title={atLimit ? `Limit of ${MAX_BASE_RESUMES} reached` : undefined}
          >
            {parsing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add base resume
          </Button>
          {addMenuOpen && !atLimit ? (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setAddMenuOpen(false)}
              />
              <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  <UploadCloud className="h-4 w-4 text-slate-500" />
                  <span>
                    Upload a resume
                    <span className="block text-[11px] text-slate-400">
                      Extract from PDF / DOC
                    </span>
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                    onChange={startUpload}
                  />
                </label>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  onClick={startManual}
                >
                  <FileText className="h-4 w-4 text-slate-500" />
                  <span>
                    Start from scratch
                    <span className="block text-[11px] text-slate-400">
                      Fill in the details
                    </span>
                  </span>
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {atLimit ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          You&apos;ve reached the limit of {MAX_BASE_RESUMES} base resumes. Delete one to add
          another.
        </p>
      ) : null}

      {records === null ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-10 text-center">
          <p className="text-sm font-medium text-slate-700">No base resumes yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Add your first one — upload a file or build it from scratch.
          </p>
          <Button className="mt-4 rounded-md" onClick={startManual}>
            <Plus className="mr-2 h-4 w-4" /> Create base resume
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Owner</th>
                  <th className="hidden px-4 py-3 md:table-cell">Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((rec) => (
                  <tr key={rec.id} className="group hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openEdit(rec)}
                        className="flex items-center gap-2 text-left font-medium text-slate-900 hover:underline"
                      >
                        {rec.name}
                        {rec.isDefault ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            <Star className="h-3 w-3 fill-emerald-500 text-emerald-500" />
                            Default
                          </span>
                        ) : null}
                      </button>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {rec.draft.designation || "No title"}
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">
                      {rec.draft.candidateName || "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-slate-500 md:table-cell">
                      {formatDate(rec.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-md"
                          onClick={() => openEdit(rec)}
                        >
                          Edit
                        </Button>
                        <div className="relative">
                          <button
                            type="button"
                            aria-label="More actions"
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                            onClick={(event) => openRowMenu(rec.id, event)}
                            disabled={busyId === rec.id}
                          >
                            {busyId === rec.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreVertical className="h-4 w-4" />
                            )}
                          </button>
                          {menuId === rec.id && menuPos ? (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setMenuId(null)}
                              />
                              <div
                                className="fixed z-50 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
                                style={{ top: menuPos.top, right: menuPos.right }}
                              >
                                {!rec.isDefault ? (
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                    onClick={() => handleSetDefault(rec)}
                                  >
                                    <Star className="h-4 w-4 text-slate-500" /> Set as default
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                  onClick={() => handleDuplicate(rec)}
                                  disabled={atLimit}
                                >
                                  <Copy className="h-4 w-4 text-slate-500" /> Duplicate
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                                  onClick={() => handleDownload(rec)}
                                >
                                  <Download className="h-4 w-4 text-slate-500" /> Download
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                                  onClick={() => handleDelete(rec)}
                                >
                                  <Trash2 className="h-4 w-4" /> Delete
                                </button>
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
