import {
  ResumeTemplateConfig,
  ResumeTemplateId,
  ResumeTemplateTheme,
  ResumeTemplateThemeOverrides,
} from "./types";

export const RESUME_FONT_OPTIONS = [
  "Arial, sans-serif",
  "'Helvetica Neue', Arial, sans-serif",
  "Georgia, serif",
  "'Times New Roman', serif",
  "'Trebuchet MS', sans-serif",
  "Verdana, sans-serif",
] as const;

export const RESUME_TEMPLATE_CONFIGS: ResumeTemplateConfig[] = [
  {
    id: "classic-blue",
    label: "Classic Blue",
    description: "Clean baseline template with subtle blue accents.",
    defaults: {
      accent: "#2563eb",
      mutedAccent: "#dbeafe",
      headingColor: "#0f172a",
      bodyColor: "#334155",
      fontFamily: "Arial, sans-serif",
      showPhoto: false,
      baseFontSize: 13,
      lineHeight: 1.65,
      sectionSpacing: 16,
      headerStyle: "band",
    },
  },
  {
    id: "bold-modern",
    label: "Bold Modern",
    description: "Strong typography and sharp separation for modern roles.",
    defaults: {
      accent: "#111827",
      mutedAccent: "#e5e7eb",
      headingColor: "#111827",
      bodyColor: "#374151",
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      showPhoto: false,
      baseFontSize: 13,
      lineHeight: 1.6,
      sectionSpacing: 16,
      headerStyle: "underline",
    },
  },
  {
    id: "analyst-photo",
    label: "Analyst Photo",
    description: "Structured analytical look with optional profile photo.",
    defaults: {
      accent: "#1d4ed8",
      mutedAccent: "#dbeafe",
      headingColor: "#1e3a8a",
      bodyColor: "#334155",
      fontFamily: "Arial, sans-serif",
      showPhoto: true,
      baseFontSize: 13,
      lineHeight: 1.62,
      sectionSpacing: 16,
      headerStyle: "split",
    },
  },
  {
    id: "minimal-slate",
    label: "Minimal Slate",
    description: "Minimal ATS-first format with restrained styling.",
    defaults: {
      accent: "#475569",
      mutedAccent: "#e2e8f0",
      headingColor: "#0f172a",
      bodyColor: "#475569",
      fontFamily: "Verdana, sans-serif",
      showPhoto: false,
      baseFontSize: 12,
      lineHeight: 1.65,
      sectionSpacing: 14,
      headerStyle: "underline",
    },
  },
  {
    id: "executive-serif",
    label: "Executive Serif",
    description: "Traditional executive style with serif typography.",
    defaults: {
      accent: "#7c2d12",
      mutedAccent: "#ffedd5",
      headingColor: "#431407",
      bodyColor: "#44403c",
      fontFamily: "Georgia, serif",
      showPhoto: false,
      baseFontSize: 13,
      lineHeight: 1.7,
      sectionSpacing: 18,
      headerStyle: "band",
    },
  },
];

export const getResumeTemplateConfig = (templateId: ResumeTemplateId) =>
  RESUME_TEMPLATE_CONFIGS.find((template) => template.id === templateId) ||
  RESUME_TEMPLATE_CONFIGS[0];

const normalizeColor = (value: string, fallback: string) =>
  /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;

export const resolveResumeTemplateTheme = (
  templateId: ResumeTemplateId,
  overrides: ResumeTemplateThemeOverrides = {}
): ResumeTemplateTheme => {
  const template = getResumeTemplateConfig(templateId);
  const theme = { ...template.defaults, ...overrides };

  return {
    ...theme,
    accent: normalizeColor(theme.accent, template.defaults.accent),
    mutedAccent: normalizeColor(theme.mutedAccent, template.defaults.mutedAccent),
    headingColor: normalizeColor(theme.headingColor, template.defaults.headingColor),
    bodyColor: normalizeColor(theme.bodyColor, template.defaults.bodyColor),
    baseFontSize: Math.max(11, Math.min(15, Number(theme.baseFontSize) || template.defaults.baseFontSize)),
    lineHeight: Math.max(1.35, Math.min(1.95, Number(theme.lineHeight) || template.defaults.lineHeight)),
    sectionSpacing: Math.max(10, Math.min(24, Number(theme.sectionSpacing) || template.defaults.sectionSpacing)),
  };
};
