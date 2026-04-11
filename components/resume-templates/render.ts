import { resolveResumeTemplateTheme } from "./config";
import { ResumeTemplateId, ResumeTemplateThemeOverrides } from "./types";

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

const normalizeMarkdownMarkers = (value: string) => value.replace(/\\\*/g, "*");

const stripMarkdownBold = (value: string) =>
  normalizeMarkdownMarkers(value).replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*\*/g, "");

export const extractCandidateName = (resumeText: string) => {
  const lines = resumeText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return "Candidate";
  const firstLine = lines[0].replace(/[^a-zA-Z.\s-]/g, "").trim();
  if (!firstLine) return "Candidate";
  return firstLine;
};

export const toSlugPart = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";

const withInlineFormatting = (input: string) => {
  const normalized = normalizeMarkdownMarkers(input);
  return escapeHtml(normalized).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
};

const cleanSkillLabel = (skill: string) =>
  stripMarkdownBold(skill)
    .replace(/^[-*•]\s*/, "")
    .trim();

const toUniqueSkillItems = (skills: string[] = []) =>
  Array.from(
    new Set(
      skills
        .map(cleanSkillLabel)
        .flatMap((skill) =>
          skill
            .split(/,(?![^()]*\))/)
            .map((part) => part.trim())
            .filter(Boolean)
        )
    )
  );

const normalizeExperienceBullets = (bullets: string[] = []) => {
  const merged: string[] = [];
  bullets.forEach((rawBullet) => {
    const bullet = stripMarkdownBold(rawBullet)
      .replace(/^[-*•]\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!bullet) return;

    const isLikelyContinuation =
      /^[a-z]/.test(bullet) &&
      bullet.split(/\s+/).length <= 6 &&
      merged.length > 0;

    if (isLikelyContinuation) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${bullet}`.trim();
    } else {
      merged.push(bullet);
    }
  });
  return merged;
};

const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/;

const isContactLine = (line: string) =>
  /@|https?:\/\/|www\.|linkedin(?:\.com)?|github(?:\.com)?|behance(?:\.net)?|phone\b|mobile\b|contact\b|email\b|location\b|address\b|☎|✉/i.test(
    line
  ) || PHONE_PATTERN.test(line);

const isRoleHeaderLine = (line: string) =>
  /\b(19|20)\d{2}\b/.test(line) ||
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(line) ||
  line.includes("|") ||
  /\b(engineer|developer|manager|coordinator|analyst|consultant|specialist)\b/i.test(line);

const normalizeHeader = (line: string) =>
  stripMarkdownBold(line)
    .replace(/^[-*•·▪◦]+\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .toLowerCase()
    .replace(/[:\s]+$/g, "")
    .trim();

const HEADER_ALIASES: Record<string, string> = {
  summary: "summary",
  profile: "summary",
  "professional summary": "summary",
  skills: "skills",
  "technical skills": "skills",
  experience: "experience",
  "work experience": "experience",
  "professional experience": "experience",
  "employment history": "experience",
  projects: "projects",
  project: "projects",
  education: "education",
  certifications: "certifications",
  certification: "certifications",
  languages: "languages",
  language: "languages",
  "languages known": "languages",
  "language competencies": "languages",
  references: "references",
  reference: "references",
};

type ContactItem = {
  kind: "phone" | "email" | "linkedin" | "github" | "behance" | "link" | "location";
  label: string;
  href?: string;
};
type KnownProfileLinks = {
  linkedin?: string;
  github?: string;
  behance?: string;
  other?: string[];
};

const normalizeLinkHref = (value: string) => {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(www\.)/i.test(trimmed)) return `https://${trimmed}`;
  if (/^(linkedin\.com|github\.com|behance\.net|gitlab\.com|medium\.com)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return "";
};

const extractKnownProfileLinks = (text = ""): KnownProfileLinks => {
  const content = stripMarkdownBold(text);
  const urls =
    content.match(
      /(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+|(?:linkedin|github)\.com\/[^\s<>()]+|behance\.net\/[^\s<>()]+)/gi
    ) || [];
  const known: KnownProfileLinks = { other: [] };

  urls.forEach((raw) => {
    const href = normalizeLinkHref(raw);
    if (!href) return;
    if (!known.linkedin && /linkedin\.com/i.test(href)) {
      known.linkedin = href;
      return;
    }
    if (!known.github && /github\.com/i.test(href)) {
      known.github = href;
      return;
    }
    if (!known.behance && /behance\.net/i.test(href)) {
      known.behance = href;
      return;
    }
    known.other?.push(href);
  });

  return known;
};

const extractContactItems = (
  personalLines: string[] = [],
  knownProfileLinks: KnownProfileLinks = {}
): ContactItem[] => {
  const raw = stripMarkdownBold(personalLines.join(" | "));
  const items: ContactItem[] = [];
  const seen = new Set<string>();

  const addItem = (item: ContactItem) => {
    const key = `${item.kind}:${item.label.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  const emailMatches = raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];
  emailMatches.forEach((email) => {
    addItem({ kind: "email", label: email, href: `mailto:${email}` });
  });

  const phoneMatches = raw.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];
  phoneMatches.forEach((phone) => {
    const normalized = phone.replace(/\s+/g, " ").trim();
    addItem({
      kind: "phone",
      label: normalized,
      href: `tel:${normalized.replace(/[^\d+]/g, "")}`,
    });
  });

  const urlMatches =
    raw.match(
      /(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+|(?:linkedin|github)\.com\/[^\s<>()]+|behance\.net\/[^\s<>()]+)/gi
    ) || [];
  urlMatches.forEach((rawUrl) => {
    const href = normalizeLinkHref(rawUrl);
    if (!href) return;
    if (/linkedin\.com/i.test(href)) {
      addItem({ kind: "linkedin", label: href, href });
      return;
    }
    if (/github\.com/i.test(href)) {
      addItem({ kind: "github", label: href, href });
      return;
    }
    if (/behance\.net/i.test(href)) {
      addItem({ kind: "behance", label: href, href });
      return;
    }
    if (/portfolio|about\.me|linktr\.ee/i.test(href)) {
      addItem({ kind: "link", label: href, href });
    }
  });

  if (items.length) return items;

  const chunks = raw
    .split(/\s*\|\s*|,\s*/)
    .map((item) => item.trim())
    .filter(Boolean);

  chunks.forEach((chunk) => {
    const cleaned = chunk.replace(/^(contact|email|phone|mobile|linkedin|github|behance)\s*:\s*/i, "").trim();

    if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(cleaned)) {
      addItem({ kind: "email", label: cleaned, href: `mailto:${cleaned}` });
      return;
    }
    if (/(?:\+?\d[\d\s().-]{7,}\d)/.test(cleaned)) {
      const normalized = cleaned.replace(/\s+/g, " ").trim();
      addItem({
        kind: "phone",
        label: normalized,
        href: `tel:${normalized.replace(/[^\d+]/g, "")}`,
      });
      return;
    }
    if (/linkedin/i.test(cleaned)) {
      const href = normalizeLinkHref(cleaned);
      addItem({
        kind: "linkedin",
        label: cleaned,
        href: href || knownProfileLinks.linkedin || undefined,
      });
      return;
    }
    if (/github/i.test(cleaned)) {
      const href = normalizeLinkHref(cleaned);
      addItem({
        kind: "github",
        label: cleaned,
        href: href || knownProfileLinks.github || undefined,
      });
      return;
    }
    if (/behance/i.test(cleaned)) {
      const href = normalizeLinkHref(cleaned);
      addItem({
        kind: "behance",
        label: cleaned,
        href: href || knownProfileLinks.behance || undefined,
      });
      return;
    }
    if (/https?:\/\/|www\.|portfolio|gitlab|medium/i.test(cleaned)) {
      const href = normalizeLinkHref(cleaned);
      if (href && /portfolio|about\.me|linktr\.ee/i.test(href)) {
        addItem({ kind: "link", label: cleaned, href });
      }
      return;
    }
    if (/^(location|address)\s*:/i.test(chunk)) {
      addItem({
        kind: "location",
        label: chunk.replace(/^(location|address)\s*:\s*/i, "").trim(),
      });
    }
  });

  return items;
};

const iconForContactKind = (kind: ContactItem["kind"]) => {
  if (kind === "phone") return "☎";
  if (kind === "email") return "✉";
  if (kind === "linkedin") return "in";
  if (kind === "github") return "gh";
  if (kind === "behance") return "be";
  if (kind === "location") return "loc";
  return "🔗";
};

const renderResumeBodyFromText = (
  resumeText: string,
  options: {
    headingColor: string;
    bodyColor: string;
    sectionSpacing: number;
    baseFontSize: number;
    lineHeight: number;
    useContactIcons: boolean;
  }
) => {
  const lines = resumeText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const sections: Record<string, string[]> = {};
  let current = "prelude";

  lines.forEach((line) => {
    const normalized = normalizeHeader(line);
    const mappedHeader = HEADER_ALIASES[normalized];
    if (mappedHeader) {
      current = mappedHeader;
      if (!sections[current]) sections[current] = [];
      return;
    }
    if (!sections[current]) sections[current] = [];
    sections[current].push(line);
  });

  let html = "";
  const preludeLines = sections.prelude || [];
  const promotedPersonalLines: string[] = [];
  Object.keys(sections).forEach((sectionKey) => {
    if (sectionKey === "prelude") return;
    sections[sectionKey] = (sections[sectionKey] || []).filter((line) => {
      if (isContactLine(line)) {
        promotedPersonalLines.push(line);
        return false;
      }
      return true;
    });
  });
  const personalLines = [...preludeLines.filter(isContactLine), ...promotedPersonalLines];
  const preludeWithoutPersonal = preludeLines.filter((line) => !isContactLine(line));
  const knownProfileLinks = extractKnownProfileLinks(lines.join("\n"));

  if (personalLines.length) {
    const contactItems = extractContactItems(personalLines, knownProfileLinks);
    if (contactItems.length) {
      if (options.useContactIcons) {
        html += `<div style="display:flex;flex-wrap:wrap;gap:8px 10px;margin:0 0 10px;">`;
        contactItems.forEach((item) => {
          const icon = iconForContactKind(item.kind);
          const text = `<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;background:#e2e8f0;color:#0f172a;font-size:10px;font-weight:700;">${escapeHtml(
            icon
          )}</span><span>${escapeHtml(item.label)}</span>`;
          if (item.href) {
            html += `<a href="${escapeHtml(
              item.href
            )}" style="display:inline-flex;align-items:center;gap:6px;font-size:${options.baseFontSize}px;line-height:${options.lineHeight};color:${options.bodyColor};text-decoration:none;">${text}</a>`;
          } else {
            html += `<span style="display:inline-flex;align-items:center;gap:6px;font-size:${options.baseFontSize}px;line-height:${options.lineHeight};color:${options.bodyColor};">${text}</span>`;
          }
        });
        html += `</div>`;
      } else {
        const plainItems = contactItems.map((item) => {
          const label = escapeHtml(item.label);
          if (!item.href) return label;
          return `<a href="${escapeHtml(
            item.href
          )}" style="color:${options.bodyColor};text-decoration:none;">${label}</a>`;
        });
        html += `<p style="font-size:${options.baseFontSize + 2}px;line-height:${options.lineHeight};color:${options.bodyColor};margin:0 0 10px;">${plainItems.join(
          " | "
        )}</p>`;
      }
    }
  }

  const sectionHeadingStyle = `font-size:12px;font-weight:700;margin:${options.sectionSpacing}px 0 6px;color:${options.headingColor};letter-spacing:.04em;text-transform:uppercase;`;

  const summarySectionLines = sections.summary || [];
  const summaryLines = summarySectionLines.length
    ? summarySectionLines
    : preludeWithoutPersonal.filter((line) => !isRoleHeaderLine(line));
  const summaryText = summaryLines.join(" ").trim();
  if (summaryText) {
    html += `<h3 style=\"${sectionHeadingStyle}\">SUMMARY</h3>`;
    html += `<p style=\"font-size:${options.baseFontSize}px;line-height:${options.lineHeight};color:${options.bodyColor};margin:0 0 10px;\">${withInlineFormatting(
      summaryText
    )}</p>`;
  }

  const skillLines = sections.skills || [];
  if (skillLines.length) {
    const inlineSkills = toUniqueSkillItems(skillLines);
    html += `<h3 style=\"${sectionHeadingStyle}\">SKILLS</h3>`;
    html += `<p style=\"font-size:${options.baseFontSize}px;line-height:${options.lineHeight};color:${options.bodyColor};margin:0 0 10px;\">${escapeHtml(
      inlineSkills.join(", ")
    )}</p>`;
  }

  const renderSectionLines = (
    title: string,
    sectionLines: string[] = [],
    sectionOptions: {
      forceBullets?: boolean;
      treatAllAsBullets?: boolean;
      educationMode?: boolean;
      projectMode?: boolean;
    } = {}
  ) => {
    if (!sectionLines.length) return;
    html += `<h3 style=\"${sectionHeadingStyle}\">${title}</h3>`;
    let bullets: string[] = [];
    const isProjectTitleLine = (line: string) =>
      line.length <= 90 &&
      !/[.?!]$/.test(line) &&
      !/^https?:\/\//i.test(line) &&
      !line.toLowerCase().startsWith("description:");
    const isEducationHeaderLine = (line: string) =>
      line.includes("|") ||
      /\b(19|20)\d{2}\b/.test(line) ||
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(line);

    const flushBullets = () => {
      const normalized = normalizeExperienceBullets(bullets);
      if (normalized.length) {
        html += '<div style="margin:6px 0 10px;">';
        normalized.forEach((bullet) => {
          html += `<p style=\"font-size:${options.baseFontSize}px;line-height:${options.lineHeight};color:${options.bodyColor};margin:0 0 6px;\">• ${escapeHtml(
            bullet
          )}</p>`;
        });
        html += "</div>";
      }
      bullets = [];
    };

    sectionLines.forEach((line) => {
      const cleanLine = stripMarkdownBold(line).trim();
      const isBulletLine = /^[-*•]\s+/.test(cleanLine);
      const deBulleted = cleanLine.replace(/^[-*•]\s+/, "").trim();

      // Projects should read as "Title" + description text, without bullet glyphs.
      if (sectionOptions.projectMode) {
        flushBullets();
        if (isProjectTitleLine(deBulleted)) {
          html += `<p style=\"font-size:${options.baseFontSize}px;line-height:${options.lineHeight};color:${options.bodyColor};margin:0 0 4px;\"><strong>${escapeHtml(
            deBulleted
          )}</strong></p>`;
        } else {
          html += `<p style=\"font-size:${options.baseFontSize}px;line-height:${options.lineHeight};color:${options.bodyColor};margin:0 0 8px;\">${escapeHtml(
            deBulleted
          )}</p>`;
        }
        return;
      }

      // Education should keep period/details as plain lines, not forced bullets.
      if (sectionOptions.educationMode) {
        flushBullets();
        if (isEducationHeaderLine(deBulleted)) {
          html += `<p style=\"font-size:${options.baseFontSize}px;line-height:${options.lineHeight};color:${options.bodyColor};margin:0 0 4px;\"><strong>${escapeHtml(
            deBulleted
          )}</strong></p>`;
        } else {
          html += `<p style=\"font-size:${options.baseFontSize}px;line-height:${options.lineHeight};color:${options.bodyColor};margin:0 0 8px;\">${escapeHtml(
            deBulleted
          )}</p>`;
        }
        return;
      }

      if (isBulletLine) {
        bullets.push(cleanLine);
        return;
      }

      const shouldForceBullet =
        sectionOptions.forceBullets &&
        (sectionOptions.treatAllAsBullets || !isRoleHeaderLine(cleanLine));

      if (shouldForceBullet) {
        bullets.push(cleanLine);
        return;
      }
      if (sectionOptions.forceBullets && isRoleHeaderLine(cleanLine)) {
        flushBullets();
        html += `<p style=\"font-size:${options.baseFontSize}px;line-height:${options.lineHeight};color:${options.bodyColor};margin:0 0 6px;\"><strong>${escapeHtml(
          cleanLine
        )}</strong></p>`;
        return;
      }

      flushBullets();
      html += `<p style=\"font-size:${options.baseFontSize}px;line-height:${options.lineHeight};color:${options.bodyColor};margin:0 0 6px;\">${escapeHtml(
        cleanLine
      )}</p>`;
    });
    flushBullets();
  };

  if ((sections.experience || []).length) {
    renderSectionLines("EXPERIENCE", sections.experience || [], { forceBullets: true });
  }
  if ((sections.projects || []).length) {
    renderSectionLines("PROJECTS", sections.projects || [], { projectMode: true });
  }
  if ((sections.education || []).length) {
    renderSectionLines("EDUCATION", sections.education || [], {
      educationMode: true,
    });
  }
  if ((sections.certifications || []).length) {
    renderSectionLines("CERTIFICATIONS", sections.certifications || [], {
      forceBullets: true,
      treatAllAsBullets: true,
    });
  }
  if ((sections.languages || []).length) {
    renderSectionLines("LANGUAGES", sections.languages || [], {
      forceBullets: true,
      treatAllAsBullets: true,
    });
  }
  if ((sections.references || []).length) {
    renderSectionLines("REFERENCES", sections.references || [], {
      forceBullets: true,
      treatAllAsBullets: true,
    });
  }

  return html || '<p style="font-size:13px;color:#64748b;">No content available.</p>';
};

export const renderResumeHtml = ({
  resumeText,
  templateId,
  candidateName,
  designation,
  photoUrl,
  overrides,
  useContactIcons = true,
}: {
  resumeText: string;
  templateId: ResumeTemplateId;
  candidateName: string;
  designation?: string;
  photoUrl?: string;
  overrides?: ResumeTemplateThemeOverrides;
  useContactIcons?: boolean;
}) => {
  const theme = resolveResumeTemplateTheme(templateId, overrides);
  const body = renderResumeBodyFromText(resumeText, {
    headingColor: theme.headingColor,
    bodyColor: theme.bodyColor,
    sectionSpacing: theme.sectionSpacing,
    baseFontSize: theme.baseFontSize,
    lineHeight: theme.lineHeight,
    useContactIcons,
  });
  const safeName = escapeHtml(candidateName);
  const safeDesignation = escapeHtml(designation || "");
  const imageBlock =
    theme.showPhoto && photoUrl
      ? `<div style=\"display:flex;justify-content:flex-end;\"><img src=\"${photoUrl}\" alt=\"Profile\" style=\"width:92px;height:92px;object-fit:cover;border-radius:8px;border:1px solid ${theme.mutedAccent};\" /></div>`
      : "";

  const headerBand =
    theme.headerStyle === "band"
      ? `<div style=\"background:${theme.accent};height:12px;margin-bottom:14px;border-radius:3px;\"></div>`
      : "";

  const headerUnderline =
    theme.headerStyle === "underline"
      ? `<div style=\"border-bottom:2px solid ${theme.accent};padding-bottom:10px;margin-bottom:14px;\">`
      : "";

  const headerUnderlineEnd = theme.headerStyle === "underline" ? "</div>" : "";

  const splitHeader =
    theme.headerStyle === "split"
      ? `<div style=\"display:grid;grid-template-columns:1fr auto;gap:16px;align-items:start;border-bottom:2px solid ${theme.accent};padding-bottom:10px;margin-bottom:14px;\"><div>`
      : "";

  const splitHeaderEnd = theme.headerStyle === "split" ? `</div>${imageBlock}</div>` : "";

  const headingMarkup =
    theme.headerStyle === "split"
      ? `${splitHeader}<h2 style=\"font-size:36px;line-height:1.1;font-weight:800;margin:0;color:${theme.headingColor};\">${safeName}</h2>${
          safeDesignation
            ? `<p style=\"margin:8px 0 0;font-size:${theme.baseFontSize + 1}px;font-weight:700;color:${theme.bodyColor};\">${safeDesignation}</p>`
            : ""
        }${splitHeaderEnd}`
      : `${headerUnderline}<h2 style=\"font-size:36px;line-height:1.1;font-weight:800;margin:0;color:${theme.headingColor};\">${safeName}</h2>${
          safeDesignation
            ? `<p style=\"margin:8px 0 0;font-size:${theme.baseFontSize + 1}px;font-weight:700;color:${theme.bodyColor};\">${safeDesignation}</p>`
            : ""
        }${headerUnderlineEnd}`;

  return `
    <div style="font-family:${theme.fontFamily};background:#fff;padding:24px;">
      ${headerBand}
      ${theme.headerStyle === "band" ? headingMarkup.replace(headerUnderline, "").replace(headerUnderlineEnd, "") : headingMarkup}
      ${theme.headerStyle === "band" && theme.showPhoto ? imageBlock : ""}
      ${body}
      <div style="margin-top:14px;height:4px;background:${theme.mutedAccent};border-radius:999px;"></div>
    </div>
  `;
};

export const renderCoverLetterHtml = (content: string) => {
  const plain = stripMarkdownBold(content);
  const blocks = plain
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const dateAtLineEndRegex =
    /^(.*?)(?:\s{2,}|,\s+)(\w+\s+\d{1,2},\s+\d{4}|\d{1,2}\s+\w+\s+\d{4})\s*$/i;

  const paragraphs = blocks
    .map((part, index) => {
      if (index === 0) {
        const firstLine = part.split("\n")[0]?.trim() || "";
        const firstLineMatch = firstLine.match(dateAtLineEndRegex);
        if (firstLineMatch) {
          const left = firstLineMatch[1].trim();
          const date = firstLineMatch[2].trim();
          const rest = part.split("\n").slice(1).join("\n").trim();
          const row = `<div style=\"display:flex;justify-content:space-between;align-items:flex-start;gap:12px;font-size:13px;line-height:1.7;color:#334155;margin:0 0 4px;\"><span>${escapeHtml(
            left
          )}</span><span style=\"text-align:right;white-space:nowrap;\">${escapeHtml(
            date
          )}</span></div>`;
          const restMarkup = rest
            ? `<p style=\"font-size:13px;line-height:1.7;color:#334155;margin:0 0 12px;\">${escapeHtml(
                rest
              ).replace(/\n/g, "<br/>")}</p>`
            : "";
          return `${row}${restMarkup}`;
        }
      }

      return `<p style=\"font-size:13px;line-height:1.7;color:#334155;margin:0 0 12px;\">${escapeHtml(
        part
      ).replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");

  return `<section>${paragraphs}</section>`;
};
