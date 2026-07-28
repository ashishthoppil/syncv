import { supabase } from "@/lib/supabaseClient";
import {
  serializeResumeText,
  emptyBaseResumeDraft,
  type BaseResumeDraft,
} from "@/components/dashboard/resume-form";
import type {
  ResumeTemplateId,
  ResumeTemplateThemeOverrides,
} from "@/components/resume-templates/types";

export const MAX_BASE_RESUMES = 5;
export const DEFAULT_BASE_RESUME_NAME = "Default Base CV";

// The JSON blob persisted in base_resumes.resume — the editable draft plus the
// presentation choices, so the editor and previews round-trip.
export type StoredBaseResume = {
  draft: BaseResumeDraft;
  template: ResumeTemplateId;
  overrides?: ResumeTemplateThemeOverrides;
};

// A single named base resume, as used by the UI.
export type BaseResumeRecord = {
  id: string;
  name: string;
  isDefault: boolean;
  draft: BaseResumeDraft;
  template: ResumeTemplateId;
  overrides?: ResumeTemplateThemeOverrides;
  resumeText: string;
  updatedAt: string;
};

type BaseResumeUser = { id?: string; email?: string } | null;

type BaseResumeRow = {
  id: string;
  name: string | null;
  is_default: boolean | null;
  resume: StoredBaseResume | null;
  resume_text: string | null;
  updated_at: string | null;
};

const rowToRecord = (row: BaseResumeRow): BaseResumeRecord => {
  const stored = row.resume || ({} as StoredBaseResume);
  return {
    id: row.id,
    name: row.name || "Untitled resume",
    isDefault: Boolean(row.is_default),
    draft: stored.draft || emptyBaseResumeDraft(),
    template: stored.template || "bold-modern",
    overrides: stored.overrides,
    resumeText: row.resume_text || "",
    updatedAt: row.updated_at || "",
  };
};

// The contact fields the scan/tailor pipeline reads for the optimized resume's
// header — derived from a specific base resume so scans use the right details.
export const contactFromDraft = (draft: BaseResumeDraft) => ({
  email: draft.email || "",
  phone: draft.phone || "",
  linkedin: draft.links.linkedin || "",
  portfolio: draft.links.portfolio || "",
  github: draft.links.github || "",
  behance: draft.links.behance || "",
  otherLink: draft.links.other || "",
});

// Keep the profiles contact columns in sync from the DEFAULT resume, since other
// surfaces (Settings, etc.) still read them. Non-fatal if it fails.
const syncProfileContact = async (user: BaseResumeUser, draft: BaseResumeDraft) => {
  if (!user?.id) return;
  const [city, ...countryParts] = draft.location.split(",");
  try {
    await supabase.from("profiles").upsert({
      id: user.id,
      email: user.email || draft.email,
      full_name: draft.candidateName,
      headline: draft.designation,
      phone: draft.phone,
      city: city?.trim() || "",
      country: countryParts.join(",").trim(),
      experience_years: draft.experienceYears ? Number(draft.experienceYears) : null,
      linkedin: draft.links.linkedin,
      portfolio: draft.links.portfolio,
      behance: draft.links.behance,
      github: draft.links.github,
      other_link: draft.links.other,
    });
  } catch (error) {
    console.error("Failed to sync profile contact:", error);
  }
};

export const listBaseResumes = async (
  userId: string
): Promise<BaseResumeRecord[]> => {
  const { data, error } = await supabase
    .from("base_resumes")
    .select("id, name, is_default, resume, resume_text, updated_at")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => rowToRecord(row as BaseResumeRow));
};

export const countBaseResumes = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from("base_resumes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return Number(count || 0);
};

type SaveInput = {
  name: string;
  draft: BaseResumeDraft;
  template: ResumeTemplateId;
  overrides?: ResumeTemplateThemeOverrides;
  isDefault?: boolean;
};

// Ensure exactly one default: clears the flag on the user's other rows.
const clearOtherDefaults = async (userId: string, exceptId?: string) => {
  let query = supabase
    .from("base_resumes")
    .update({ is_default: false })
    .eq("user_id", userId);
  if (exceptId) query = query.neq("id", exceptId);
  const { error } = await query;
  if (error) throw error;
};

export const createBaseResume = async (
  user: BaseResumeUser,
  input: SaveInput
): Promise<BaseResumeRecord> => {
  if (!user?.id) throw new Error("No user session. Please log in again.");

  const existing = await listBaseResumes(user.id);
  if (existing.length >= MAX_BASE_RESUMES) {
    throw new Error(`You can have at most ${MAX_BASE_RESUMES} base resumes.`);
  }
  // The very first resume is always the default.
  const isDefault = input.isDefault ?? existing.length === 0;
  if (isDefault) await clearOtherDefaults(user.id);

  const stored: StoredBaseResume = {
    draft: input.draft,
    template: input.template,
    overrides: input.overrides,
  };
  const { data, error } = await supabase
    .from("base_resumes")
    .insert({
      user_id: user.id,
      name: input.name || "Untitled resume",
      resume: stored,
      resume_text: serializeResumeText(input.draft),
      is_default: isDefault,
    })
    .select("id, name, is_default, resume, resume_text, updated_at")
    .single();
  if (error) throw error;

  if (isDefault) await syncProfileContact(user, input.draft);
  return rowToRecord(data as BaseResumeRow);
};

export const updateBaseResume = async (
  user: BaseResumeUser,
  id: string,
  input: SaveInput
): Promise<BaseResumeRecord> => {
  if (!user?.id) throw new Error("No user session. Please log in again.");

  const stored: StoredBaseResume = {
    draft: input.draft,
    template: input.template,
    overrides: input.overrides,
  };
  const { data, error } = await supabase
    .from("base_resumes")
    .update({
      name: input.name || "Untitled resume",
      resume: stored,
      resume_text: serializeResumeText(input.draft),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, name, is_default, resume, resume_text, updated_at")
    .single();
  if (error) throw error;

  const record = rowToRecord(data as BaseResumeRow);
  if (record.isDefault) await syncProfileContact(user, input.draft);
  return record;
};

export const renameBaseResume = async (
  userId: string,
  id: string,
  name: string
) => {
  const { error } = await supabase
    .from("base_resumes")
    .update({ name: name || "Untitled resume" })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
};

export const setDefaultBaseResume = async (userId: string, id: string) => {
  await clearOtherDefaults(userId, id);
  const { error } = await supabase
    .from("base_resumes")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
};

export const deleteBaseResume = async (userId: string, id: string) => {
  const { data: target } = await supabase
    .from("base_resumes")
    .select("is_default")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase
    .from("base_resumes")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;

  // If we removed the default, promote the oldest remaining resume.
  if (target?.is_default) {
    const remaining = await listBaseResumes(userId);
    if (remaining.length) {
      await setDefaultBaseResume(userId, remaining[0].id);
    }
  }
};

export const duplicateBaseResume = async (
  user: BaseResumeUser,
  record: BaseResumeRecord
): Promise<BaseResumeRecord> =>
  createBaseResume(user, {
    name: `Copy of ${record.name}`.slice(0, 80),
    draft: record.draft,
    template: record.template,
    overrides: record.overrides,
    isDefault: false,
  });
