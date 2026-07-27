import { supabase } from "@/lib/supabaseClient";
import {
  serializeResumeText,
  type BaseResumeDraft,
} from "@/components/dashboard/resume-form";
import type {
  ResumeTemplateId,
  ResumeTemplateThemeOverrides,
} from "@/components/resume-templates/types";

// The JSON blob persisted in profiles.base_resume — the editable draft plus the
// presentation choices, so the Base Resume editor and previews round-trip.
export type StoredBaseResume = {
  draft: BaseResumeDraft;
  template: ResumeTemplateId;
  overrides?: ResumeTemplateThemeOverrides;
};

type BaseResumeUser = { id?: string; email?: string } | null;

// Builds the profiles upsert row. Keeps the contact-level columns in sync with
// the structured draft so the rest of the app (which still reads those columns)
// stays correct, and stores the full draft + a text serialization for scans.
export const buildBaseResumeUpsert = (
  user: BaseResumeUser,
  draft: BaseResumeDraft,
  template: ResumeTemplateId,
  overrides?: ResumeTemplateThemeOverrides
) => {
  const [city, ...countryParts] = draft.location.split(",");
  const stored: StoredBaseResume = { draft, template, overrides };
  return {
    id: user?.id,
    email: user?.email || draft.email,
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
    base_resume: stored,
    base_resume_text: serializeResumeText(draft),
    base_resume_updated_at: new Date().toISOString(),
  };
};

export const saveBaseResume = async (
  user: BaseResumeUser,
  draft: BaseResumeDraft,
  template: ResumeTemplateId,
  overrides?: ResumeTemplateThemeOverrides
) => {
  if (!user?.id) throw new Error("No user session. Please log in again.");
  const payload = buildBaseResumeUpsert(user, draft, template, overrides);
  const { error } = await supabase.from("profiles").upsert(payload);
  if (error) throw error;
};
