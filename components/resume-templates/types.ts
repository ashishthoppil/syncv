// Template ids are persisted with every saved resume (base_resumes.resume and
// the job tracker payload), so an id must never be renamed — change the label
// in config.ts instead.
export type ResumeTemplateId =
  | "us-standard"
  | "uk-cv"
  | "australian"
  | "europass"
  | "middle-east"
  | "classic-blue"
  | "bold-modern"
  | "analyst-photo"
  | "minimal-slate"
  | "executive-serif";

export type ResumeTemplateGroup = "regional" | "modern";

// The user-adjustable look. Saved overrides are a partial of this.
export type ResumeTemplateTheme = {
  accent: string;
  mutedAccent: string;
  headingColor: string;
  bodyColor: string;
  fontFamily: string;
  showPhoto: boolean;
  baseFontSize: number;
  lineHeight: number;
  sectionSpacing: number;
};

export type ResumeTemplateThemeOverrides = Partial<ResumeTemplateTheme>;

export type ResumeSectionKey =
  | "summary"
  | "skills"
  | "experience"
  | "projects"
  | "education"
  | "certifications"
  | "languages"
  | "personal"
  | "additional"
  | "references";

export type ResumePersonalField =
  | "dateOfBirth"
  | "nationality"
  | "gender"
  | "maritalStatus"
  | "workAuthorization"
  | "drivingLicence";

export type ResumePersonalFieldSpec = {
  field: ResumePersonalField;
  label: string;
};

// The fixed structure of a template — what a regional convention dictates
// (page size, section order and names, which personal details belong on the
// page). Not user-adjustable.
export type ResumeTemplateLayout = {
  page: "a4" | "letter";
  header: "left" | "center" | "split" | "europass";
  headerRule: boolean;
  nameCase: "normal" | "upper";
  contact: "icons" | "inline" | "labelled";
  heading: "rule" | "bar" | "caps" | "line" | "centered";
  headingTone: "accent" | "heading";
  entry: "standard" | "europass";
  dates: "standard" | "europass";
  languages: "inline" | "europass";
  photo: "none" | "left" | "right";
  sections: ResumeSectionKey[];
  headings: Record<ResumeSectionKey, string>;
  // Personal details shown under the contact line.
  headerDetails: ResumePersonalFieldSpec[];
  // Personal details shown as their own section (the "personal" key above).
  sectionDetails: ResumePersonalFieldSpec[];
  // Printed under the references heading when the resume lists none. Leave
  // empty where the convention is to omit references altogether (US).
  referencesFallback: string;
};

export type ResumeTemplateConfig = {
  id: ResumeTemplateId;
  label: string;
  description: string;
  group: ResumeTemplateGroup;
  layout: ResumeTemplateLayout;
  defaults: ResumeTemplateTheme;
};
