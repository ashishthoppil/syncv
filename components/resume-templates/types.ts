export type ResumeTemplateId =
  | "classic-blue"
  | "bold-modern"
  | "analyst-photo"
  | "minimal-slate"
  | "executive-serif";

export type ResumeHeaderStyle = "band" | "underline" | "split";

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
  headerStyle: ResumeHeaderStyle;
};

export type ResumeTemplateThemeOverrides = Partial<ResumeTemplateTheme>;

export type ResumeTemplateConfig = {
  id: ResumeTemplateId;
  label: string;
  description: string;
  defaults: ResumeTemplateTheme;
};
