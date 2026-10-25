import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  Tab,
  TabStopType,
  Table,
  TableBorders,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
  type IBordersOptions,
  type IParagraphOptions,
  type IRunOptions,
  type ParagraphChild,
} from "docx";
import { getResumeTemplateConfig, resolveResumeTemplateTheme } from "./config";
import {
  CEFR_LEVEL_RE,
  displayLabelForUrl,
  EUROPASS_CONTACT_LABELS,
  formatDuration,
  NATIVE_LANGUAGE_RE,
  normalizeExperienceBullets,
  parseCertificationLine,
  parseCoverLetter,
  resumeSectionsFromData,
  resumeSectionsFromText,
  splitLanguageLevel,
  stripMarkdownBold,
  type ResumeData,
  type ResumeSectionContactItem,
  type ResumeSections,
} from "./render";
import type {
  ResumePersonalFieldSpec,
  ResumeSectionKey,
  ResumeTemplateId,
  ResumeTemplateLayout,
  ResumeTemplateTheme,
  ResumeTemplateThemeOverrides,
} from "./types";

/**
 * Word (.docx) downloads of the tailored resume and cover letter.
 *
 * The PDF is the template's HTML printed by Chromium. Word can't take that
 * HTML, so this lays the same content out natively — real paragraphs, dates on
 * a right tab stop, Word bullets — which keeps the file editable and readable
 * by an ATS. It reads the very sections the HTML renderer builds (render.ts)
 * and follows the template's section order, headings, colours, font and page
 * size; decoration Word has no equivalent for (contact icons, the lines either
 * side of a heading) becomes the nearest native thing.
 *
 * Imported on demand, when someone picks Word, so the docx library stays out of
 * the dashboard bundle.
 */

// ---- Units -------------------------------------------------------------------
// The templates are sized in CSS px. 1px = 0.75pt, so 15 twips (1/20 pt) or 1.5
// half-points, which are Word's units for spacing and type size respectively.

const twips = (px: number) => Math.round(px * 15);
const halfPoints = (px: number) => Math.round(px * 1.5);
/** Letter-spacing in em, as twips for `characterSpacing`. */
const tracking = (em: number, fontPx: number) => Math.round(em * fontPx * 15);
const lineSpacing = (lineHeight: number) => Math.round(240 * lineHeight);
const hex = (color: string) => color.replace(/^#/, "").toUpperCase();

const PAGE_SIZES = {
  a4: { width: 11906, height: 16838 },
  letter: { width: 12240, height: 15840 },
};
// The PDF route's @page margins (18mm × 12mm) plus the template's 24px padding,
// so a page holds about as much as the PDF's does.
const PAGE_MARGINS = { top: 1020, bottom: 1020, left: 1040, right: 1040 };

const MUTED_TEXT_COLOR = "64748B";
const SEPARATOR_COLOR = "94A3B8";
const BULLETS = "resume-bullets";

// Same footprint as the photo in the HTML header.
const PHOTO_SIZE = { width: 92, height: 115 };

// Only links Word can open; anything else stays plain text.
const SAFE_HREF_RE = /^(https?:|mailto:|tel:)/i;

/**
 * Word takes one font name, not a CSS stack. Helvetica Neue isn't installed on
 * Windows, where Word would quietly swap in its own default, so it becomes the
 * closest font that is everywhere.
 */
const wordFont = (stack: string) => {
  const first = stack.split(",")[0].replace(/['"]/g, "").trim();
  return !first || first === "Helvetica Neue" ? "Arial" : first;
};

type RunOptions = Omit<IRunOptions, "text">;
type MakeRun = (value: string, options?: RunOptions) => TextRun;

/**
 * Every run carries its font, size and colour itself. Word would take them from
 * the document defaults, but other viewers don't — macOS Quick Look, which is
 * how a Mac previews an attachment, draws runs without them in 12pt Times.
 */
const runMaker =
  (base: RunOptions): MakeRun =>
  (value, options = {}) =>
    new TextRun({ ...base, ...options, text: value });

type Ctx = {
  theme: ResumeTemplateTheme;
  layout: ResumeTemplateLayout;
  /** Text width between the margins — where right-aligned dates sit. */
  contentWidth: number;
  text: MakeRun;
};

// Paragraphs are built as options and constructed at the end, so an entry's
// last paragraph can still be given the gap that separates it from the next.
type Para = IParagraphOptions;

const spaceAfter = (paras: Para[], px: number): Para[] => {
  if (!paras.length) return paras;
  const last = paras[paras.length - 1];
  return [...paras.slice(0, -1), { ...last, spacing: { ...last.spacing, after: twips(px) } }];
};

const tab = () => new TextRun({ children: [new Tab()] });

const link = (ctx: Ctx, href: string, label: string, options: RunOptions = {}) =>
  SAFE_HREF_RE.test(href)
    ? new ExternalHyperlink({ link: href, children: [ctx.text(label, options)] })
    : ctx.text(label, options);

/** "**Led** the rollout" → a bold run and a plain one, as the summary allows. */
const inlineRuns = (ctx: Ctx, value: string): TextRun[] =>
  value
    .replace(/\\\*/g, "*")
    .split(/(\*\*.+?\*\*)/g)
    .filter(Boolean)
    .map((part) =>
      /^\*\*.+\*\*$/.test(part)
        ? ctx.text(part.slice(2, -2), { bold: true })
        : ctx.text(part.replace(/\*\*/g, ""))
    );

const withSeparators = (ctx: Ctx, groups: ParagraphChild[][]): ParagraphChild[] =>
  groups.flatMap((group, index) =>
    index ? [ctx.text(" | ", { color: SEPARATOR_COLOR }), ...group] : group
  );

const labelled = (ctx: Ctx, label: string, value: ParagraphChild): ParagraphChild[] => [
  ctx.text(`${label}: `, { bold: true }),
  value,
];

const rightTab = (ctx: Ctx) => [{ type: TabStopType.RIGHT, position: ctx.contentWidth }];

// ---- Building blocks ---------------------------------------------------------

const sectionHeading = (title: string, ctx: Ctx): Para => {
  const { theme, layout } = ctx;
  const color = hex(layout.headingTone === "accent" ? theme.accent : theme.headingColor);
  const size = layout.heading === "caps" ? theme.baseFontSize - 1 : theme.baseFontSize;
  const letterSpacing =
    layout.heading === "centered" ? 0.18 : layout.heading === "caps" ? 0.14 : 0.08;
  const rule = (lineColor: string, gapPx = 4): IBordersOptions => ({
    bottom: {
      style: BorderStyle.SINGLE,
      size: 6,
      color: hex(lineColor),
      space: Math.round(gapPx * 0.75),
    },
  });

  let border: IBordersOptions;
  let indent: Para["indent"];
  switch (layout.heading) {
    case "bar":
      border = { left: { style: BorderStyle.SINGLE, size: 18, color: hex(theme.accent), space: 7 } };
      indent = { left: twips(12) };
      break;
    case "caps":
      border = rule(theme.mutedAccent, 5);
      break;
    // The HTML draws a line beside (or either side of) the heading; Word's
    // nearest native form is a rule beneath it.
    case "line":
    case "centered":
      border = rule(theme.accent);
      break;
    default:
      border = rule(layout.headingTone === "accent" ? theme.mutedAccent : theme.accent);
  }

  return {
    keepNext: true,
    keepLines: true,
    alignment: layout.heading === "centered" ? AlignmentType.CENTER : undefined,
    border,
    indent,
    spacing: { before: twips(theme.sectionSpacing), after: twips(8), line: lineSpacing(1.3) },
    children: [
      ctx.text(title, {
        bold: true,
        allCaps: true,
        color,
        size: halfPoints(size),
        characterSpacing: tracking(letterSpacing, size),
      }),
    ],
  };
};

const bulletParas = (items: ParagraphChild[][]): Para[] =>
  items.map((children, index) => ({
    numbering: { reference: BULLETS, level: 0 },
    keepLines: true,
    spacing: { before: index === 0 ? twips(4) : 0, after: twips(3) },
    children,
  }));

const bullets = (ctx: Ctx, items: string[] = []): Para[] =>
  bulletParas(normalizeExperienceBullets(items).map((item) => [ctx.text(item)]));

/** Title with its dates (or link) on the right, then organisation and place. */
const entryHeader = (
  ctx: Ctx,
  parts: { title: string; aside?: ParagraphChild; subtitle?: string; subAside?: string }
): Para[] => {
  const { theme } = ctx;
  const paras: Para[] = [
    {
      keepNext: true,
      keepLines: true,
      tabStops: rightTab(ctx),
      spacing: { line: lineSpacing(1.35) },
      children: [
        ctx.text(parts.title, {
          bold: true,
          size: halfPoints(theme.baseFontSize + 1),
          color: hex(theme.headingColor),
        }),
        ...(parts.aside ? [tab(), parts.aside] : []),
      ],
    },
  ];
  if (parts.subtitle || parts.subAside) {
    paras.push({
      keepNext: true,
      keepLines: true,
      tabStops: rightTab(ctx),
      spacing: { before: twips(1) },
      children: [
        ctx.text(parts.subtitle || "", { bold: true }),
        ...(parts.subAside ? [tab(), ctx.text(parts.subAside, { color: MUTED_TEXT_COLOR })] : []),
      ],
    });
  }
  return paras;
};

const timedEntryHeader = (
  ctx: Ctx,
  entry: { title: string; subtitle: string; duration: string; location: string }
): Para[] => {
  const dates = formatDuration(entry.duration, ctx.layout.dates);
  if (ctx.layout.entry !== "europass") {
    return entryHeader(ctx, {
      title: entry.title,
      aside: dates ? ctx.text(dates) : undefined,
      subtitle: entry.subtitle,
      subAside: entry.location,
    });
  }
  // Europass: the bracketed dates lead the title; organisation and place follow.
  const { theme } = ctx;
  const paras: Para[] = [
    {
      keepNext: true,
      keepLines: true,
      children: [
        ...(dates
          ? [
              ctx.text(`${dates}  `, {
                color: MUTED_TEXT_COLOR,
                size: halfPoints(theme.baseFontSize - 1),
              }),
            ]
          : []),
        ctx.text(entry.title, {
          bold: true,
          size: halfPoints(theme.baseFontSize + 1),
          color: hex(theme.headingColor),
        }),
      ],
    },
  ];
  if (entry.subtitle || entry.location) {
    paras.push({
      keepNext: true,
      keepLines: true,
      spacing: { before: twips(1) },
      children: [
        ...(entry.subtitle ? [ctx.text(entry.subtitle, { bold: true })] : []),
        ...(entry.subtitle && entry.location ? [ctx.text(" – ")] : []),
        ...(entry.location ? [ctx.text(entry.location)] : []),
      ],
    });
  }
  return paras;
};

const personalItems = (
  ctx: Ctx,
  personal: ResumeSections["personal"],
  specs: ResumePersonalFieldSpec[]
): ParagraphChild[][] =>
  specs
    .map((spec) => ({ spec, value: (personal[spec.field] || "").trim() }))
    .filter(({ value }) => value)
    .map(({ spec, value }) => labelled(ctx, spec.label, ctx.text(value)));

const contactItem = (
  ctx: Ctx,
  item: ResumeSectionContactItem,
  isLabelled: boolean
): ParagraphChild[] => {
  const value = item.href ? link(ctx, item.href, item.label) : ctx.text(item.label);
  return isLabelled ? labelled(ctx, EUROPASS_CONTACT_LABELS[item.kind], value) : [value];
};

// ---- Sections ----------------------------------------------------------------

const certificationParas = (lines: string[], ctx: Ctx): Para[] => {
  const paras: Para[] = [];
  let pending: ParagraphChild[][] = [];
  const flush = () => {
    paras.push(...bulletParas(pending));
    pending = [];
  };
  lines.forEach((line) => {
    const item = parseCertificationLine(line);
    if (!item) return;
    if (item.kind === "heading") {
      flush();
      paras.push({
        keepNext: true,
        spacing: { before: twips(8), after: twips(2) },
        children: [ctx.text(item.text, { bold: true, color: hex(ctx.theme.headingColor) })],
      });
      return;
    }
    pending.push(
      item.href
        ? [
            ctx.text(`${item.text} — `),
            link(ctx, item.href, item.label || "Credentials", { underline: {} }),
          ]
        : [ctx.text(item.text)]
    );
  });
  flush();
  return paras;
};

const europassLanguageParas = (languages: string[], ctx: Ctx): Para[] => {
  const natives: string[] = [];
  const others: { name: string; level: string }[] = [];
  languages.forEach((item) => {
    const { name, level } = splitLanguageLevel(item);
    if (!name) return;
    if (NATIVE_LANGUAGE_RE.test(item)) natives.push(name);
    else others.push({ name, level });
  });
  const paras: Para[] = [];
  if (natives.length) {
    paras.push({ children: labelled(ctx, "Mother tongue(s)", ctx.text(natives.join(", "))) });
  }
  if (others.length) {
    if (natives.length) {
      paras.push({
        spacing: { before: twips(6) },
        children: [ctx.text("Other language(s):", { bold: true })],
      });
    }
    paras.push(
      ...bulletParas(
        others.map(({ name, level }) =>
          level
            ? [ctx.text(name, { bold: true }), ctx.text(` – ${level}`)]
            : [ctx.text(name, { bold: true })]
        )
      )
    );
  }
  if (languages.some((item) => CEFR_LEVEL_RE.test(item))) {
    paras.push({
      spacing: { before: twips(4) },
      children: [
        ctx.text(
          "Levels: A1 and A2: Basic user; B1 and B2: Independent user; C1 and C2: Proficient user",
          { size: halfPoints(ctx.theme.baseFontSize - 2), color: MUTED_TEXT_COLOR }
        ),
      ],
    });
  }
  return paras;
};

const sectionParas = (key: ResumeSectionKey, s: ResumeSections, ctx: Ctx): Para[] => {
  const { theme, layout } = ctx;
  const heading = () => sectionHeading(layout.headings[key], ctx);

  switch (key) {
    case "summary":
      return s.summaryText ? [heading(), { children: inlineRuns(ctx, s.summaryText) }] : [];

    case "skills": {
      if (!s.skillCategories.length) return [];
      if (!s.skillCategories.some((category) => category.label)) {
        const inline = s.skillCategories.flatMap((category) => category.items);
        return [heading(), { children: [ctx.text(inline.join(", "))] }];
      }
      return [
        heading(),
        ...s.skillCategories.map((category) => ({
          spacing: { after: twips(3) },
          children: [
            ...(category.label
              ? [ctx.text(`${category.label}: `, { bold: true, color: hex(theme.headingColor) })]
              : []),
            ctx.text(category.items.join(", ")),
          ],
        })),
      ];
    }

    case "experience":
      if (!s.experience.length) return [];
      return [
        heading(),
        ...s.experience.flatMap((entry) =>
          spaceAfter(
            [
              ...timedEntryHeader(ctx, {
                title: entry.designation || entry.company,
                subtitle: entry.designation ? entry.company : "",
                duration: entry.duration,
                location: entry.location,
              }),
              ...bullets(ctx, entry.bullets),
            ],
            11
          )
        ),
      ];

    case "projects":
      if (!s.projects.length) return [];
      return [
        heading(),
        ...s.projects.flatMap((entry) =>
          spaceAfter(
            [
              ...(entry.name || entry.href
                ? entryHeader(ctx, {
                    title: entry.name,
                    aside: entry.href
                      ? link(ctx, entry.href, displayLabelForUrl(entry.href), { underline: {} })
                      : undefined,
                  })
                : []),
              ...(entry.meta
                ? [
                    {
                      spacing: { before: twips(1) },
                      children: [ctx.text(entry.meta, { italics: true })],
                    },
                  ]
                : []),
              ...bullets(ctx, entry.bullets),
            ],
            10
          )
        ),
      ];

    case "education":
      if (!s.education.length) return [];
      return [
        heading(),
        ...s.education.flatMap((entry) =>
          spaceAfter(
            [
              ...timedEntryHeader(ctx, {
                title: entry.qualification || entry.institution,
                subtitle: entry.qualification ? entry.institution : "",
                duration: entry.duration,
                location: entry.location,
              }),
              ...bullets(ctx, entry.details),
            ],
            10
          )
        ),
      ];

    case "certifications": {
      const body = certificationParas(s.certifications, ctx);
      return body.length ? [heading(), ...body] : [];
    }

    case "languages": {
      if (!s.languages.length) return [];
      if (layout.languages === "europass") {
        return [heading(), ...europassLanguageParas(s.languages, ctx)];
      }
      const items = s.languages.map((item) => stripMarkdownBold(item).trim()).filter(Boolean);
      return [
        heading(),
        { children: withSeparators(ctx, items.map((item) => [ctx.text(item)])) },
      ];
    }

    case "personal": {
      const items = personalItems(ctx, s.personal, layout.sectionDetails);
      if (!items.length) return [];
      // Two to a line, as the HTML lays them out.
      const rows: Para[] = [];
      for (let i = 0; i < items.length; i += 2) {
        rows.push({
          tabStops: [{ type: TabStopType.LEFT, position: Math.round(ctx.contentWidth / 2) }],
          spacing: { after: twips(3) },
          children: [...items[i], ...(items[i + 1] ? [tab(), ...items[i + 1]] : [])],
        });
      }
      return [heading(), ...rows];
    }

    case "additional":
      return s.additionalSections
        .filter((section) => section.title && section.items.length)
        .flatMap((section) => [sectionHeading(section.title, ctx), ...bullets(ctx, section.items)]);

    case "references":
      if (s.references.length) return [heading(), ...bullets(ctx, s.references)];
      return layout.referencesFallback
        ? [heading(), { children: [ctx.text(layout.referencesFallback, { italics: true })] }]
        : [];

    default:
      return [];
  }
};

// ---- Header ------------------------------------------------------------------

const headerParas = (
  s: ResumeSections,
  ctx: Ctx,
  meta: { candidateName: string; designation?: string }
): Para[] => {
  const { theme, layout } = ctx;
  const alignment = layout.header === "center" ? AlignmentType.CENTER : AlignmentType.LEFT;
  const namePx = Math.round(theme.baseFontSize * 2.15);
  const upper = layout.nameCase === "upper";

  const name: Para = {
    alignment,
    keepNext: true,
    spacing: { line: lineSpacing(1.15) },
    children: [
      ctx.text(meta.candidateName, {
        bold: true,
        size: halfPoints(namePx),
        color: hex(theme.headingColor),
        allCaps: upper,
        characterSpacing: upper ? tracking(0.1, namePx) : undefined,
      }),
    ],
  };
  const designation: Para[] = meta.designation
    ? [
        {
          alignment,
          keepNext: true,
          spacing: { before: twips(5), line: lineSpacing(1.35) },
          children: [
            ctx.text(meta.designation, {
              bold: true,
              size: halfPoints(theme.baseFontSize + 2),
              color: hex(theme.accent),
            }),
          ],
        },
      ]
    : [];
  const details = personalItems(ctx, s.personal, layout.headerDetails);
  const contact = s.contactItems.map((item) =>
    contactItem(ctx, item, layout.contact === "labelled")
  );
  const row = (groups: ParagraphChild[][], beforePx: number): Para[] =>
    groups.length
      ? [
          {
            alignment,
            keepNext: true,
            spacing: { before: twips(beforePx) },
            children: withSeparators(ctx, groups),
          },
        ]
      : [];

  // Europass leads with the personal information, then the contact lines.
  return layout.header === "europass"
    ? [name, ...designation, ...row(details, 8), ...row(contact, details.length ? 4 : 8)]
    : [name, ...designation, ...row(contact, 8), ...row(details, 4)];
};

// The frame under the header, matching the HTML's padding.
const headerRule = (ctx: Ctx) => ({
  style: BorderStyle.SINGLE,
  size: 12,
  color: hex(ctx.theme.accent),
  space: 10,
});

/**
 * With a photo the header becomes a borderless two-column table — text beside
 * the picture, as the template has it. A floating image would let Word reflow
 * the text around it unpredictably, and the header rule underneath through it.
 */
const photoHeader = (paras: Para[], photo: Uint8Array, ctx: Ctx) => {
  const { theme, layout } = ctx;
  const photoColumn = twips(PHOTO_SIZE.width + 20);
  const textColumn = ctx.contentWidth - photoColumn;
  const photoLeft = layout.photo === "left";
  const margins = { top: 0, bottom: twips(layout.headerRule ? 14 : 4), left: 0, right: 0 };
  const textCell = new TableCell({
    width: { size: textColumn, type: WidthType.DXA },
    verticalAlign: VerticalAlignTable.TOP,
    margins,
    children: paras.map((options) => new Paragraph(options)),
  });
  const photoCell = new TableCell({
    width: { size: photoColumn, type: WidthType.DXA },
    verticalAlign: VerticalAlignTable.TOP,
    margins,
    children: [
      new Paragraph({
        alignment: photoLeft ? AlignmentType.LEFT : AlignmentType.RIGHT,
        children: [
          new ImageRun({
            type: "jpg",
            data: photo,
            transformation: PHOTO_SIZE,
            altText: { name: "Profile photo", title: "Profile photo", description: "Profile photo" },
            outline: {
              type: "solidFill",
              solidFillType: "rgb",
              value: hex(theme.mutedAccent),
              width: 9525,
            },
          }),
        ],
      }),
    ],
  });
  return new Table({
    width: { size: ctx.contentWidth, type: WidthType.DXA },
    columnWidths: photoLeft ? [photoColumn, textColumn] : [textColumn, photoColumn],
    borders: layout.headerRule
      ? { ...TableBorders.NONE, bottom: headerRule(ctx) }
      : TableBorders.NONE,
    rows: [new TableRow({ children: photoLeft ? [photoCell, textCell] : [textCell, photoCell] })],
  });
};

// ---- Photo -------------------------------------------------------------------

/**
 * The profile photo, cropped like the HTML's `object-fit: cover` and saved as
 * a JPEG at three times its printed size — sharp, without embedding a
 * multi-megabyte original. Null when it can't be fetched or drawn, and the
 * resume is then simply built without it.
 */
const loadPhoto = async (url: string): Promise<Uint8Array | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement("canvas");
    canvas.width = PHOTO_SIZE.width * 3;
    canvas.height = PHOTO_SIZE.height * 3;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const scale = Math.max(canvas.width / bitmap.width, canvas.height / bitmap.height);
    const width = bitmap.width * scale;
    const height = bitmap.height * scale;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9)
    );
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  } catch {
    return null;
  }
};

// ---- Documents ---------------------------------------------------------------

export type ResumeDocxOptions = {
  /** The structured resume — preferred. */
  data?: ResumeData | null;
  /** Older documents with no structured data fall back to their text. */
  resumeText?: string;
  templateId: ResumeTemplateId;
  candidateName: string;
  designation?: string;
  photoUrl?: string;
  /** Ready-cropped JPEG bytes, in place of fetching `photoUrl`. */
  photo?: Uint8Array | null;
  overrides?: ResumeTemplateThemeOverrides;
};

export const buildResumeDocument = async (options: ResumeDocxOptions) => {
  const config = getResumeTemplateConfig(options.templateId);
  const theme = resolveResumeTemplateTheme(options.templateId, options.overrides);
  const page = PAGE_SIZES[config.layout.page];
  const baseRun: RunOptions = {
    font: wordFont(theme.fontFamily),
    size: halfPoints(theme.baseFontSize),
    color: hex(theme.bodyColor),
  };
  const ctx: Ctx = {
    theme,
    layout: config.layout,
    contentWidth: page.width - PAGE_MARGINS.left - PAGE_MARGINS.right,
    text: runMaker(baseRun),
  };
  const sections = options.data
    ? resumeSectionsFromData(options.data)
    : resumeSectionsFromText(options.resumeText || "");

  const wantsPhoto = config.layout.photo !== "none" && theme.showPhoto;
  const photo = wantsPhoto
    ? options.photo || (options.photoUrl ? await loadPhoto(options.photoUrl) : null)
    : null;

  const header = headerParas(sections, ctx, options);
  let headerBlock: (Paragraph | Table)[];
  if (photo) {
    headerBlock = [photoHeader(header, photo, ctx)];
  } else {
    const framed = config.layout.headerRule
      ? header.map((para, index) =>
          index === header.length - 1 ? { ...para, border: { bottom: headerRule(ctx) } } : para
        )
      : header;
    headerBlock = framed.map((para) => new Paragraph(para));
  }

  const body = config.layout.sections.flatMap((key) => sectionParas(key, sections, ctx));
  const content: Para[] = body.length
    ? body
    : [
        {
          spacing: { before: twips(16) },
          children: [ctx.text("No content available.", { color: MUTED_TEXT_COLOR })],
        },
      ];

  return new Document({
    creator: "SynCV",
    title: `${options.candidateName} – Resume`,
    styles: {
      default: {
        document: {
          run: baseRun,
          paragraph: { spacing: { before: 0, after: 0, line: lineSpacing(theme.lineHeight) } },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: BULLETS,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 220, hanging: 220 } },
                run: { color: hex(theme.accent) },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: { page: { size: page, margin: PAGE_MARGINS } },
        children: [...headerBlock, ...content.map((para) => new Paragraph(para))],
      },
    ],
  });
};

export const renderResumeDocx = async (options: ResumeDocxOptions) =>
  Packer.toBlob(await buildResumeDocument(options));

// The cover letter's PDF look (renderCoverLetterHtml): 13px slate text, a ruled
// "Cover Letter" heading, and the sign-off set apart.
const LETTER_RUN: RunOptions = { font: "Arial", size: halfPoints(13), color: "334155" };

export const buildCoverLetterDocument = (content: string, candidateName = "") => {
  const page = PAGE_SIZES.a4;
  const contentWidth = page.width - PAGE_MARGINS.left - PAGE_MARGINS.right;
  const text = runMaker(LETTER_RUN);
  const lines = (value: string) =>
    value.split("\n").map((line, index) => text(line, { break: index ? 1 : undefined }));

  const paras: Para[] = parseCoverLetter(content).flatMap((block): Para[] => {
    if (block.kind === "closing") {
      return [
        {
          spacing: { before: twips(28), after: twips(12), line: lineSpacing(1.7) },
          children: [text(block.closing)],
        },
        ...(block.signature.length
          ? [{ spacing: { line: lineSpacing(1.9) }, children: lines(block.signature.join("\n")) }]
          : []),
      ];
    }
    if (block.kind === "dated-opening") {
      return [
        {
          tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }],
          spacing: { after: twips(6), line: lineSpacing(1.7) },
          children: [text(block.recipient), tab(), text(block.date)],
        },
        ...(block.rest
          ? [{ spacing: { after: twips(22), line: lineSpacing(1.7) }, children: lines(block.rest) }]
          : []),
      ];
    }
    if (block.kind === "opening") {
      return [{ spacing: { after: twips(22), line: lineSpacing(1.7) }, children: lines(block.text) }];
    }
    return [{ spacing: { after: twips(16), line: lineSpacing(1.75) }, children: lines(block.text) }];
  });

  return new Document({
    creator: "SynCV",
    title: candidateName ? `${candidateName} – Cover Letter` : "Cover Letter",
    styles: {
      default: {
        document: { run: LETTER_RUN, paragraph: { spacing: { before: 0, after: 0 } } },
      },
    },
    sections: [
      {
        properties: { page: { size: page, margin: PAGE_MARGINS } },
        children: [
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "E2E8F0", space: 9 } },
            spacing: { after: twips(24) },
            children: [text("Cover Letter", { bold: true, size: halfPoints(24), color: "0F172A" })],
          }),
          ...paras.map((para) => new Paragraph(para)),
        ],
      },
    ],
  });
};

export const renderCoverLetterDocx = (content: string, candidateName?: string) =>
  Packer.toBlob(buildCoverLetterDocument(content, candidateName));
