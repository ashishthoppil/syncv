import { getResumeTemplateConfig, resolveResumeTemplateTheme } from "./config";
import type {
  ResumePersonalField,
  ResumeSectionKey,
  ResumeTemplateId,
  ResumeTemplateLayout,
  ResumeTemplateTheme,
  ResumeTemplateThemeOverrides,
} from "./types";

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

// Resume headers often put the job title on the same line as the name
// ("Priya Deshpande | Full Stack Developer (MERN)"). Cut at the separator, and
// as a fallback (separators can be lost in PDF text extraction) trim a
// trailing job-title phrase recognized by its occupational keyword.
const NAME_SEGMENT_SPLIT_RE = /\s*(?:\||·|•|—|–|,|\/|\t| {3,}| - )\s*/;
const TRAILING_TITLE_RE =
  /\s+(?:senior|junior|lead|principal|staff|full[ -]?stack|front[ -]?end|back[ -]?end|software|web|mobile|devops|cloud|engineer|developer|manager|analyst|designer|consultant|architect|scientist|specialist)\b[\s\S]*$/i;

// Section headers that two-column PDFs often emit BEFORE the candidate's name
// (the sidebar is extracted first, so the text can start with "CONTACT").
const SECTION_HEADER_RE =
  /^(contact(?:\s+(?:information|details|info|me))?|get in touch|summary|professional summary|profile|about(?:\s+me)?|objective|career objective|skills?|technical skills|core competencies|education|experience|work experience|professional experience|employment(?:\s+history)?|projects?|certifications?|licenses?|languages?|interests?|hobbies|references?|achievements?|awards?|publications?|volunteering|links?|portfolio|curriculum vitae|resume|cv)\s*:?\s*$/i;

// "Ithaca, NY" — a City, ST location line, not a name.
const LOCATION_LINE_RE = /,\s*[A-Z]{2}\.?$/;

// Letter-spaced name headers ("D E E   N I T A O") — collapse single spaces
// inside words, keeping 2+ space runs as word boundaries ("DEE NITAO").
const collapseLetterSpacing = (line: string) => {
  const tokens = line.trim().split(" ").filter(Boolean);
  const singles = tokens.filter((t) => t.length === 1).length;
  if (tokens.length < 4 || singles < tokens.length * 0.7) return line;
  return line
    .trim()
    .split(/\s{2,}/)
    .map((word) => word.replace(/ /g, ""))
    .join(" ");
};

const cleanNameLine = (line: string) => {
  const collapsed = collapseLetterSpacing(line);
  const nameSegment = collapsed.split(NAME_SEGMENT_SPLIT_RE).filter(Boolean)[0] || collapsed;
  let name = nameSegment.replace(/[^a-zA-Z.\s-]/g, "").trim();
  // PDF text extraction sometimes drops the spaces between name parts, yielding
  // a run-together name like "AleenaMariamBenny". When the line has no spaces but
  // clearly concatenates multiple capitalized words, restore spaces at the
  // lowercase→uppercase boundaries ("AleenaMariamBenny" → "Aleena Mariam Benny").
  if (name && !/\s/.test(name) && /[a-z][A-Z]/.test(name)) {
    name = name.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  }
  name = name.replace(TRAILING_TITLE_RE, "").trim() || name;
  return name;
};

// A lone occupational word ("Developer", "Manager") — the headline title, not
// part of a stacked name.
const SINGLE_TITLE_WORD_RE =
  /^(senior|junior|lead|principal|staff|freelance|software|web|mobile|devops|cloud|engineer|developer|manager|analyst|designer|consultant|architect|scientist|specialist|director|coordinator|intern|marketer|accountant|nurse|teacher|lawyer)$/i;

const isPlausibleNameLine = (line: string) => {
  if (SECTION_HEADER_RE.test(line)) return false;
  if (/[@\d]|https?:\/\/|www\./i.test(line)) return false;
  if (LOCATION_LINE_RE.test(line)) return false;
  const cleaned = cleanNameLine(line);
  if (cleaned.length < 2 || cleaned.length > 60) return false;
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= 5;
};

export const extractCandidateName = (resumeText: string) => {
  const lines = resumeText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return "Candidate";

  // Usual case: the resume starts with the candidate's name.
  if (isPlausibleNameLine(lines[0])) {
    let name = cleanNameLine(lines[0]) || "Candidate";
    // Stacked name headers put each name word on its own line ("PRIYA" /
    // "NAIR"). Absorb following single-word name-like lines; when the resume
    // has an email, each absorbed word must appear in its local part.
    if (!name.includes(" ")) {
      const emailLocal = (
        resumeText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || ""
      )
        .split("@")[0]
        .toLowerCase();
      for (let i = 1; i < Math.min(lines.length, 4); i += 1) {
        const line = lines[i];
        if (!/^[A-Za-z][A-Za-z.'-]*$/.test(line)) break;
        if (SECTION_HEADER_RE.test(line) || SINGLE_TITLE_WORD_RE.test(line)) break;
        const word = line.toLowerCase().replace(/[^a-z]/g, "");
        if (emailLocal && word.length >= 3 && !emailLocal.includes(word)) break;
        name = `${name} ${line}`;
        if (name.split(" ").length >= 4) break;
      }
    }
    return name;
  }

  // Two-column/sidebar PDFs emit the sidebar first ("CONTACT", email, phone…)
  // and the name header can land anywhere — often at the very end of the text.
  // Resume emails are almost always derived from the name, so anchor on a
  // name-like line that shares a token with the email local part.
  const email = resumeText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const emailTokens = email
    .split("@")[0]
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((token) => token.length >= 3);
  if (emailTokens.length) {
    for (const line of lines) {
      if (!isPlausibleNameLine(line)) continue;
      const lower = line.toLowerCase();
      if (emailTokens.some((token) => lower.includes(token))) {
        return cleanNameLine(line) || "Candidate";
      }
    }
  }

  // Otherwise take the first plausible multi-word line near the top.
  for (const line of lines.slice(0, 12)) {
    if (isPlausibleNameLine(line) && cleanNameLine(line).includes(" ")) {
      return cleanNameLine(line);
    }
  }

  return cleanNameLine(lines[0]) || "Candidate";
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

const normalizeSkillKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Generic trailing words that don't change the underlying skill, used so
// "Git workflows" collapses onto "Git" during de-duplication.
const GENERIC_TRAILING_SKILL_WORDS = new Set([
  "workflows",
  "workflow",
  "skills",
  "skill",
  "abilities",
  "ability",
  "proficiency",
  "knowledge",
  "expertise",
]);

const canonicalSkillKey = (skill: string) => {
  const words = normalizeSkillKey(skill).split(" ").filter(Boolean);
  while (
    words.length > 1 &&
    GENERIC_TRAILING_SKILL_WORDS.has(words[words.length - 1])
  ) {
    words.pop();
  }
  return words.join(" ");
};

// Profession-agnostic filler that ATS doesn't score as a hard skill. Kept
// deliberately narrow so genuine soft skills (Leadership, Communication,
// Teamwork, Time Management) survive.
const FILLER_SKILL_PHRASES = [
  "product mindset",
  "ownership mindset",
  "product thinking",
  "growth mindset",
  "problem solving",
  "analytical thinking",
  "critical thinking",
  "knowledge sharing",
  "technical enhancements",
  "fast paced",
  "attention to detail",
  "team player",
  "hard working",
  "hardworking",
  "self motivated",
  "self starter",
  "go getter",
  "results driven",
  "results oriented",
  "detail oriented",
];

const FILLER_SKILL_WORDS = new Set(["passionate", "dynamic", "proactive"]);

const isFillerSkill = (skill: string) => {
  const norm = normalizeSkillKey(skill);
  if (!norm) return true;
  if (FILLER_SKILL_WORDS.has(norm)) return true;
  return FILLER_SKILL_PHRASES.some(
    (phrase) => norm === phrase || norm.includes(phrase)
  );
};

const splitSkillItems = (value: string) =>
  value
    .split(/,(?![^()]*\))/)
    .map(cleanSkillLabel)
    .filter(Boolean);

type SkillCategory = { label: string | null; items: string[] };

const SKILL_LABEL_PATTERN = /^([A-Za-z][A-Za-z0-9 &/+().-]{0,38}?):\s*(.*)$/;

const parseSkillCategories = (
  skillLines: string[] = [],
  options: { filterFiller?: boolean } = {}
): SkillCategory[] => {
  const filterFiller = options.filterFiller !== false;
  const categories: SkillCategory[] = [];
  const byLabel = new Map<string, SkillCategory>();
  const seen = new Set<string>();

  const addItems = (label: string | null, rawItems: string[]) => {
    const cleaned = filterFiller
      ? rawItems.filter((item) => !isFillerSkill(item))
      : rawItems.filter(Boolean);
    if (!cleaned.length) return;
    const key = label ? label.toLowerCase() : "__uncategorized__";
    let category = byLabel.get(key);
    if (!category) {
      category = { label, items: [] };
      byLabel.set(key, category);
      categories.push(category);
    }
    cleaned.forEach((item) => {
      const canon = canonicalSkillKey(item);
      if (!canon || seen.has(canon)) return;
      seen.add(canon);
      category!.items.push(item);
    });
  };

  skillLines.forEach((rawLine) => {
    const line = cleanSkillLabel(rawLine);
    if (!line) return;
    const match = line.match(SKILL_LABEL_PATTERN);
    if (match && match[2]) {
      addItems(match[1].trim(), splitSkillItems(match[2]));
    } else {
      addItems(null, splitSkillItems(line));
    }
  });

  return categories.filter((category) => category.items.length);
};

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
  // Hard signals: an email, a real URL, a known profile domain, a contact glyph,
  // or a phone-number pattern.
  /@|https?:\/\/|www\.|linkedin\.com|github\.com|behance\.net|☎|✉|📞|📧|📱/i.test(
    line
  ) ||
  PHONE_PATTERN.test(line) ||
  // Labeled contact fields only — require the word to be used as a label
  // ("Phone:", "Location -") rather than as prose ("address customer concerns",
  // "mobile-first design", "contact stakeholders").
  /\b(?:phone|mobile|tel|telephone|e-?mail|contact|location|address|linkedin|github|behance|portfolio)\s*[:\-]/i.test(
    line
  );

const isRoleHeaderLine = (line: string) =>
  /\b(19|20)\d{2}\b/.test(line) ||
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i.test(line) ||
  line.includes("|") ||
  /\b(engineer|developer|manager|coordinator|analyst|consultant|specialist)\b/i.test(line);

const DATE_LIKE_PATTERN =
  /\b(19|20)\d{2}\b|present|current|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;

const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const DATE_TOKEN = `(?:${MONTH}\\s+\\d{4}|\\d{1,2}\\/\\d{2,4}|(?:19|20)\\d{2})`;
// Matches a trailing date range or single date at the end of a header line,
// e.g. "Sep 2024 - Jan 2025", "2020 - Present", "Jul 2022".
const DURATION_TAIL_PATTERN = new RegExp(
  `\\s*(${DATE_TOKEN}\\s*(?:[-–—]|to)\\s*(?:present|current|${DATE_TOKEN})|${DATE_TOKEN})\\s*$`,
  "i"
);

// Common job-title nouns across professions, used only as a fallback to split
// a delimiter-less "Designation Company" header.
const ROLE_NOUNS = new Set([
  "developer","engineer","manager","analyst","designer","consultant","lead",
  "architect","intern","specialist","coordinator","director","officer",
  "administrator","scientist","associate","executive","accountant","nurse",
  "teacher","writer","strategist","recruiter","technician","supervisor",
  "head","president","founder","owner","agent","representative","assistant",
  "programmer","trainee","editor","marketer","planner","advisor","instructor",
  "artist","therapist","pharmacist","physician","attorney","clerk",
]);

type ExperienceEntry = {
  designation: string;
  company: string;
  location: string;
  duration: string;
  bullets: string[];
};

// Fallback for headers with no pipes: split "Frontend Developer Acme Corp"
// into designation + company using the last recognizable role noun.
const splitDesignationCompany = (text: string) => {
  const words = text.split(/\s+/).filter(Boolean);
  let roleEnd = -1;
  words.forEach((word, index) => {
    const key = word.toLowerCase().replace(/[^a-z]/g, "");
    if (ROLE_NOUNS.has(key)) roleEnd = index;
  });
  if (roleEnd === -1 || roleEnd === words.length - 1) {
    return { designation: text, company: "" };
  }
  return {
    designation: words.slice(0, roleEnd + 1).join(" "),
    company: words.slice(roleEnd + 1).join(" "),
  };
};

// Splits a header into structured parts. Prefers the pipe-delimited
// "Designation | Company | Location | Duration" format, but degrades
// gracefully to best-effort parsing when the model omits the pipes.
const parseExperienceHeader = (line: string): ExperienceEntry => {
  const cleanLine = stripMarkdownBold(line).trim();
  const entry: ExperienceEntry = {
    designation: "",
    company: "",
    location: "",
    duration: "",
    bullets: [],
  };

  if (cleanLine.includes("|")) {
    const parts = cleanLine
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);
    const durationIdx = parts.findIndex((part) => DATE_LIKE_PATTERN.test(part));
    if (durationIdx !== -1) {
      entry.duration = parts.splice(durationIdx, 1)[0];
    }
    entry.designation = parts.shift() || "";
    entry.company = parts.shift() || "";
    entry.location = parts.join(", ");
    return entry;
  }

  // No pipes — best-effort parse from a natural-language header.
  let rest = cleanLine;
  const durationMatch = rest.match(DURATION_TAIL_PATTERN);
  if (durationMatch) {
    entry.duration = durationMatch[1].trim();
    rest = rest.slice(0, durationMatch.index ?? rest.length).trim();
  }

  const { designation, company } = splitDesignationCompany(rest);
  entry.designation = designation;

  // Peel a trailing "City, Region" location off the company text.
  const commaIdx = company.indexOf(",");
  if (commaIdx !== -1) {
    const beforeComma = company.slice(0, commaIdx).trim();
    const afterComma = company.slice(commaIdx); // keeps the comma
    const beforeWords = beforeComma.split(/\s+/).filter(Boolean);
    const city = beforeWords.pop() || "";
    entry.company = beforeWords.join(" ");
    entry.location = `${city}${afterComma}`.trim();
  } else {
    entry.company = company;
  }

  return entry;
};

const parseExperienceEntries = (lines: string[] = []): ExperienceEntry[] => {
  const entries: ExperienceEntry[] = [];
  let current: ExperienceEntry | null = null;

  lines.forEach((rawLine) => {
    const clean = stripMarkdownBold(rawLine).trim();
    if (!clean) return;
    const isBullet = /^[-*•]\s+/.test(clean);
    const deBulleted = clean.replace(/^[-*•]\s+/, "").trim();

    const startsNewEntry =
      !isBullet &&
      (clean.includes("|") ||
        (isRoleHeaderLine(clean) && (!current || current.bullets.length > 0)));

    if (startsNewEntry) {
      current = parseExperienceHeader(clean);
      entries.push(current);
      return;
    }

    if (!current) {
      current = {
        designation: deBulleted,
        company: "",
        location: "",
        duration: "",
        bullets: [],
      };
      entries.push(current);
      return;
    }

    current.bullets.push(deBulleted);
  });

  return entries;
};

const DEGREE_PATTERN =
  /\b(bachelor|master|associate|diploma|ph\.?d|doctorate|mba|m\.?sc|b\.?sc|b\.?tech|m\.?tech|b\.?e|m\.?e|bca|mca|b\.?a|m\.?a|b\.?com|m\.?com|ll\.?b|ll\.?m|bba|hsc|sslc)\b/i;
const INSTITUTION_PATTERN =
  /\b(university|college|institute|institution|school|academy|polytechnic|seminary)\b/i;

const isEducationHeaderLine = (line: string) =>
  line.includes("|") || DEGREE_PATTERN.test(line) || INSTITUTION_PATTERN.test(line);

type EducationEntry = {
  qualification: string;
  institution: string;
  location: string;
  duration: string;
  details: string[];
};

// Splits an education header into structured parts. Prefers the pipe-delimited
// "Qualification | Institution | Duration" format, with a best-effort fallback
// for plain-text headers that lack pipes.
const parseEducationHeader = (line: string): EducationEntry => {
  const cleanLine = stripMarkdownBold(line).trim();
  const entry: EducationEntry = {
    qualification: "",
    institution: "",
    location: "",
    duration: "",
    details: [],
  };

  if (cleanLine.includes("|")) {
    const parts = cleanLine
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);
    const durationIdx = parts.findIndex((part) => DATE_LIKE_PATTERN.test(part));
    if (durationIdx !== -1) {
      entry.duration = parts.splice(durationIdx, 1)[0];
    }
    entry.qualification = parts.shift() || "";
    entry.institution = parts.join(", ");
    return entry;
  }

  // No pipes — peel the trailing duration, then split qualification from the
  // institution at the institution keyword (capturing up to 2 preceding
  // proper-noun words, e.g. "Mahatma Gandhi University").
  let rest = cleanLine;
  const durationMatch = rest.match(DURATION_TAIL_PATTERN);
  if (durationMatch) {
    entry.duration = durationMatch[1].trim();
    rest = rest.slice(0, durationMatch.index ?? rest.length).trim();
  }

  const words = rest.split(/\s+/).filter(Boolean);
  let kwIdx = -1;
  words.forEach((word, index) => {
    if (
      /^(university|college|institute|institution|school|academy|polytechnic|seminary)[,.]?$/i.test(
        word
      )
    ) {
      kwIdx = index;
    }
  });

  if (kwIdx !== -1) {
    let start = kwIdx;
    let taken = 0;
    while (start - 1 >= 0 && taken < 2 && /^[A-Z]/.test(words[start - 1])) {
      start -= 1;
      taken += 1;
    }
    entry.institution = words.slice(start).join(" ");
    entry.qualification = words.slice(0, start).join(" ").trim();
  } else {
    entry.qualification = rest;
  }

  return entry;
};

const parseEducationEntries = (lines: string[] = []): EducationEntry[] => {
  const entries: EducationEntry[] = [];
  let current: EducationEntry | null = null;

  lines.forEach((rawLine) => {
    const clean = stripMarkdownBold(rawLine).trim();
    if (!clean) return;
    const isBullet = /^[-*•]\s+/.test(clean);
    const deBulleted = clean.replace(/^[-*•]\s+/, "").trim();

    if (!isBullet && isEducationHeaderLine(clean)) {
      current = parseEducationHeader(clean);
      entries.push(current);
      return;
    }

    if (!current) {
      current = parseEducationHeader(clean);
      entries.push(current);
      return;
    }

    current.details.push(deBulleted);
  });

  return entries;
};

type ProjectEntry = {
  name: string;
  meta: string; // tech stack / role descriptor following the name
  href: string; // optional project/demo/repo link
  bullets: string[];
};

const PROJECT_URL_PATTERN = /(https?:\/\/[^\s)]+|www\.[^\s)]+)/i;

// A project header is a short label-like line (not a full sentence) that
// introduces a new project. Description sentences and bullets are not headers.
const isProjectHeaderLine = (line: string) => {
  const text = line.replace(PROJECT_URL_PATTERN, "").trim();
  if (!text) return true; // a bare link line still starts/decorates an entry
  return text.length <= 90 && !/[.?!]$/.test(text);
};

// Splits a project header into name + optional tech/role meta + optional link.
const parseProjectHeader = (rawLine: string): ProjectEntry => {
  let text = rawLine.trim();
  let href = "";

  const urlMatch = text.match(PROJECT_URL_PATTERN);
  if (urlMatch) {
    href = normalizeLinkHref(urlMatch[1]);
    text = text.replace(urlMatch[1], "").trim();
  }
  // Drop separators left dangling once the URL is removed.
  text = text.replace(/[\s\-–—|:]+$/g, "").replace(/^[\s\-–—|:]+/g, "").trim();

  let name = text;
  let meta = "";
  const sepMatch = text.match(/\s+[|–—]\s+|\s+-\s+/);
  if (sepMatch && sepMatch.index !== undefined) {
    name = text.slice(0, sepMatch.index).trim();
    meta = text.slice(sepMatch.index + sepMatch[0].length).trim();
  }

  return { name, meta, href, bullets: [] };
};

const parseProjectEntries = (lines: string[] = []): ProjectEntry[] => {
  const entries: ProjectEntry[] = [];
  let current: ProjectEntry | null = null;

  lines.forEach((rawLine) => {
    const clean = stripMarkdownBold(rawLine).trim();
    if (!clean) return;
    const isBullet = /^[-*•]\s+/.test(clean);
    const deBulleted = clean.replace(/^[-*•]\s+/, "").trim();

    if (!isBullet && isProjectHeaderLine(clean)) {
      current = parseProjectHeader(clean);
      entries.push(current);
      return;
    }

    if (!current) {
      // Description-style first line with no header — synthesize an entry.
      current = { name: "", meta: "", href: "", bullets: [deBulleted] };
      entries.push(current);
      return;
    }

    current.bullets.push(deBulleted);
  });

  return entries;
};

// A line inside the certifications block that is really a sub-grouping label
// (e.g. "COURSES", "Licenses & Certifications") rather than a certification.
const CERT_SUBHEADING_PATTERN =
  /^(courses?|online courses?|certifications?|licen[cs]es?|trainings?|workshops?|moocs?|professional development|(?:courses?|licen[cs]es?|certifications?)\s*(?:&|and)\s*(?:courses?|licen[cs]es?|certifications?))$/i;

// Trailing "anchor" text that points at a credential link (e.g. "- Credentials").
const CERT_LABEL_PATTERN =
  /[\s\-–—|:]*(credentials?|verify(?:\s+\w+)?|view\s+(?:certificate|credential)|link)[\s:.\-–—]*$/i;

type CertificationLine =
  | { kind: "heading"; text: string }
  | { kind: "item"; text: string; href: string; label: string };

const parseCertificationLine = (rawLine: string): CertificationLine | null => {
  const clean = stripMarkdownBold(rawLine)
    .replace(/^[-*•]\s+/, "")
    .trim();
  if (!clean) return null;

  const headingCandidate = clean.replace(/[:•\-\s]+$/g, "").trim();
  if (CERT_SUBHEADING_PATTERN.test(headingCandidate)) {
    return { kind: "heading", text: headingCandidate };
  }

  let text = clean;
  let href = "";
  const urlMatch = text.match(/(https?:\/\/[^\s)]+|www\.[^\s)]+)/i);
  if (urlMatch) {
    href = normalizeLinkHref(urlMatch[1]);
    const at = urlMatch.index ?? 0;
    text = (text.slice(0, at) + text.slice(at + urlMatch[0].length)).trim();
  }

  let label = "";
  const labelMatch = text.match(CERT_LABEL_PATTERN);
  if (labelMatch) {
    label = labelMatch[1].trim();
    text = text.slice(0, labelMatch.index).trim();
  }
  // Tidy any separator left dangling after stripping the URL/label.
  text = text.replace(/[\s\-–—|:]+$/g, "").trim();

  return { kind: "item", text, href, label };
};

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
  "professional skills": "skills",
  "core skills": "skills",
  "key skills": "skills",
  "core competencies": "skills",
  competencies: "skills",
  experience: "experience",
  "work experience": "experience",
  "professional experience": "experience",
  "employment history": "experience",
  projects: "projects",
  project: "projects",
  education: "education",
  certifications: "certifications",
  certification: "certifications",
  courses: "certifications",
  course: "certifications",
  "online courses": "certifications",
  "courses & certifications": "certifications",
  "courses and certifications": "certifications",
  "certifications & courses": "certifications",
  "certifications and courses": "certifications",
  "licenses & certifications": "certifications",
  "licenses and certifications": "certifications",
  "licences & certifications": "certifications",
  "licences and certifications": "certifications",
  "certifications & licenses": "certifications",
  "certifications and licenses": "certifications",
  "professional development": "certifications",
  training: "certifications",
  trainings: "certifications",
  workshops: "certifications",
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

// Canonical form used for de-duplication: lowercased, no protocol/www/trailing slash.
const canonicalizeContactValue = (value: string) =>
  value
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "")
    .trim();

// Clean, ATS-friendly visible label: drop protocol + www. + trailing slash, keep the path.
const displayLabelForUrl = (value: string) =>
  value
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");

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
    // A candidate realistically has one profile per network, so dedup those by
    // kind alone — this catches www. vs non-www and http vs https variants that
    // a label-based key would miss. Everything else dedups on a canonical value.
    const key =
      item.kind === "linkedin" || item.kind === "github" || item.kind === "behance"
        ? item.kind
        : `${item.kind}:${canonicalizeContactValue(item.label)}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  const emailMatches = raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];
  emailMatches.forEach((email) => {
    addItem({ kind: "email", label: email, href: `mailto:${email}` });
  });

  // Strip emails, URLs, and year/date ranges before scanning for phone numbers so
  // they can't be mis-read as phones (e.g. the digits inside a LinkedIn vanity URL,
  // or duration ranges like "2019-2023" / "2016 – 2019").
  const phoneSearch = raw
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, " ")
    .replace(
      /(https?:\/\/[^\s<>()]+|www\.[^\s<>()]+|(?:linkedin|github)\.com\/[^\s<>()]+|behance\.net\/[^\s<>()]+)/gi,
      " "
    )
    .replace(/\b(?:19|20)\d{2}\s*[-–—]\s*((?:19|20)\d{2}|present|current)\b/gi, " ");

  const phoneMatches = phoneSearch.match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];
  phoneMatches.forEach((phone) => {
    const digitCount = (phone.match(/\d/g) || []).length;
    const hasCountryCode = /\+/.test(phone);
    // A genuine phone number has at least 10 digits, or a "+" country-code prefix.
    // This rejects stray short numbers (e.g. a 9-digit profile id).
    if (digitCount < 10 && !hasCountryCode) return;
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
      addItem({ kind: "linkedin", label: displayLabelForUrl(href), href });
      return;
    }
    if (/github\.com/i.test(href)) {
      addItem({ kind: "github", label: displayLabelForUrl(href), href });
      return;
    }
    if (/behance\.net/i.test(href)) {
      addItem({ kind: "behance", label: displayLabelForUrl(href), href });
      return;
    }
    if (/portfolio|about\.me|linktr\.ee/i.test(href)) {
      addItem({ kind: "link", label: displayLabelForUrl(href), href });
    }
  });

  // Surface location only when the resume explicitly labels it (Location:/Address:/Based in).
  // The capture class excludes "|" so it stops at the personal-line separator.
  const locationMatch = raw.match(
    /(?:location|address|based\s+in)\s*[:\-]?\s*([A-Za-z][A-Za-z .,'\/-]+)/i
  );
  if (locationMatch) {
    const location = locationMatch[1].trim().replace(/[,;]\s*$/, "");
    // Reject prose: a real location is short (a few comma-separated place names),
    // not a sentence. This stops captures like "address customer concerns, ..."
    const wordCount = location.split(/\s+/).filter(Boolean).length;
    if (location && location.length <= 60 && wordCount <= 6) {
      addItem({ kind: "location", label: location });
    }
  }

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
    // Skip year/date ranges (e.g. "2019-2023") so they aren't read as phones.
    const isDateRange = /^(?:19|20)\d{2}\s*[-–—]\s*((?:19|20)\d{2}|present|current)$/i.test(
      cleaned
    );
    const digitCount = (cleaned.match(/\d/g) || []).length;
    if (
      !isDateRange &&
      (digitCount >= 10 || /\+/.test(cleaned)) &&
      /(?:\+?\d[\d\s().-]{7,}\d)/.test(cleaned)
    ) {
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

// Inline SVG icons (Lucide for outline glyphs, Simple Icons for brand marks).
// Inline SVG renders identically in the browser preview and the Puppeteer PDF,
// inherits text color via currentColor, and—unlike an icon font—is never picked
// up as text by ATS parsers, so it can't pollute the parsed email/phone values.
const iconSvgForContactKind = (kind: ContactItem["kind"], color: string) => {
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="flex:none;display:block;">`;
  const stroke = `fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

  if (kind === "email") {
    return `${open}<g ${stroke}><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></g></svg>`;
  }
  if (kind === "phone") {
    return `${open}<g ${stroke}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></g></svg>`;
  }
  if (kind === "location") {
    return `${open}<g ${stroke}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></g></svg>`;
  }
  if (kind === "linkedin") {
    return `${open}<path fill="${color}" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"/></svg>`;
  }
  if (kind === "github") {
    return `${open}<path fill="${color}" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>`;
  }
  if (kind === "behance") {
    return `${open}<path fill="${color}" d="M22 7h-7V5h7v2zm1.726 10c-.442 1.297-2.029 3-5.101 3-3.074 0-5.564-1.729-5.564-5.675 0-3.91 2.325-5.92 5.466-5.92 3.082 0 4.964 1.782 5.375 4.426.078.506.109 1.188.095 2.14H15.97c.13 3.211 3.483 3.312 4.588 2.029h3.168zm-7.686-4h4.965c-.105-1.547-1.136-2.219-2.477-2.219-1.466 0-2.277.768-2.488 2.219zm-9.574 6.988H0V5.021h6.953c5.476.081 5.58 5.444 2.72 6.906 3.461 1.26 3.577 8.061-3.207 8.061zM3 11h3.584c2.508 0 2.906-3-.312-3H3v3zm3.391 3H3v3.016h3.341c3.055 0 2.868-3.016.05-3.016z"/></svg>`;
  }
  // generic / portfolio link
  return `${open}<g ${stroke}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></g></svg>`;
};

type RenderContext = {
  theme: ResumeTemplateTheme;
  layout: ResumeTemplateLayout;
  useContactIcons: boolean;
};

// Structured resume data — the single source of truth that flows from the
// optimizer all the way to the renderer and the field editor. No text round
// trip: every field has its own slot, so structure can never be lost or
// re-guessed from a flattened string.
export type ResumeContactLink = { label?: string; url: string };
export type ResumeContact = {
  email?: string;
  phone?: string;
  location?: string;
  links?: ResumeContactLink[];
};
export type ResumeExperienceItem = {
  designation?: string;
  company?: string;
  location?: string;
  duration?: string;
  responsibilities?: string[];
};
export type ResumeProjectItem = {
  name?: string;
  meta?: string;
  link?: string;
  responsibilities?: string[];
};
export type ResumeEducationItem = {
  qualification?: string;
  institution?: string;
  location?: string;
  duration?: string;
  details?: string[];
};
export type ResumeAdditionalSection = { title?: string; items?: string[] };
// Region-specific personal details (date of birth, nationality, visa status…).
// Each template decides which of these belong on the page — see
// headerDetails / sectionDetails in the template layout.
export type ResumePersonalDetails = Partial<Record<ResumePersonalField, string>>;
export type ResumeData = {
  contact?: ResumeContact;
  summary?: string;
  skills?: string[];
  experience?: ResumeExperienceItem[];
  projects?: ResumeProjectItem[];
  education?: ResumeEducationItem[];
  certifications?: string[];
  languages?: string[];
  references?: string[];
  additionalSections?: ResumeAdditionalSection[];
  personal?: ResumePersonalDetails;
};

// The normalized, ready-to-render shape. Both the text path (parse → this) and
// the data path (object → this) converge here so all section markup lives in
// exactly one place: renderResumeDocument.
type RenderedSections = {
  contactItems: ContactItem[];
  summaryText: string;
  skillCategories: SkillCategory[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  certifications: string[];
  languages: string[];
  references: string[];
  additionalSections: { title: string; items: string[] }[];
  personal: ResumePersonalDetails;
};

const splitLanguageLines = (lines: string[] = []): string[] =>
  lines
    .flatMap((line) =>
      stripMarkdownBold(line)
        .replace(/^[-*•]\s+/, "")
        .split(/\s*[•|;,]\s*|\s{2,}/)
    )
    .map((item) => item.trim())
    .filter(Boolean);

// ---- Dates -----------------------------------------------------------------

const MONTH_NUMBERS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};
const PRESENT_TOKEN_RE =
  /^(present|current|currently|now|ongoing|to\s+date|till\s+date|today)$/i;

// "Sep 2021" → "09/2021", "2019" → "2019", "Present" → "Current". Returns null
// for anything it can't read with certainty, so the caller keeps the original.
const toEuropassDate = (token: string): string | null => {
  const value = token.trim();
  if (PRESENT_TOKEN_RE.test(value)) return "Current";
  if (/^(19|20)\d{2}$/.test(value)) return value;
  const numeric = value.match(/^(\d{1,2})[/.](\d{4})$/);
  if (numeric && Number(numeric[1]) >= 1 && Number(numeric[1]) <= 12) {
    return `${numeric[1].padStart(2, "0")}/${numeric[2]}`;
  }
  const named = value.match(/^([a-z]{3,9})\.?,?\s+((?:19|20)\d{2})$/i);
  if (named) {
    const month = MONTH_NUMBERS[named[1].slice(0, 3).toLowerCase()];
    if (month) return `${month}/${named[2]}`;
  }
  return null;
};

// Normalizes a free-text duration to the template's convention: an en dash
// between the two ends everywhere, and Europass's bracketed MM/YYYY form.
// Durations that don't look like a date range pass through unchanged.
const formatDuration = (raw: string, style: ResumeTemplateLayout["dates"]) => {
  const value = (raw || "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  const parts = value
    .replace(/\s+(?:to|till|until)\s+/gi, " – ")
    .split(/\s*[-–—]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  const standard =
    parts.length && parts.length <= 2
      ? parts.map((part) => (PRESENT_TOKEN_RE.test(part) ? "Present" : part)).join(" – ")
      : value;
  if (style !== "europass") return standard;
  const converted = parts.length <= 2 ? parts.map(toEuropassDate) : [];
  const europass =
    converted.length && converted.every(Boolean) ? converted.join(" – ") : standard;
  return `[ ${europass} ]`;
};

// ---- Shared markup ---------------------------------------------------------

const MUTED_TEXT_COLOR = "#64748b";
const SEPARATOR_COLOR = "#94a3b8";
const KEEP_TOGETHER = "break-inside:avoid;page-break-inside:avoid;";

const textStyle = (ctx: RenderContext, extra = "") =>
  `font-size:${ctx.theme.baseFontSize}px;line-height:${ctx.theme.lineHeight};color:${ctx.theme.bodyColor};margin:0;${extra}`;

// A plain "|" between items: parsers read it as a delimiter, people as a
// divider. The spaces are real text so the PDF's text layer reads "a | b | c".
const separatorHtml = () =>
  `<span style="color:${SEPARATOR_COLOR};margin:0 4px;"> | </span>`;

// Side-by-side flex items (title ↔ dates, bullet ↔ text) are separated only by
// layout, so plain-text PDF extraction would glue them ("EngineerSep 2021").
// A trailing non-breaking space is invisible in the layout but keeps a real
// space in the text layer.
const TEXT_GAP = "&nbsp;";

const renderInlineRow = (
  parts: string[],
  ctx: RenderContext,
  align: "left" | "center",
  marginTop = 8
) =>
  parts.length
    ? `<p style="${textStyle(ctx, `margin:${marginTop}px 0 0;text-align:${align};`)}">${parts.join(
        separatorHtml()
      )}</p>`
    : "";

// Inline-block so a row wraps between items, never inside one ("Dubai, / UAE").
const INLINE_ITEM = "display:inline-block;max-width:100%;";

const labelledHtml = (label: string, valueHtml: string) =>
  `<span style="${INLINE_ITEM}"><span style="font-weight:600;">${escapeHtml(label)}:</span> ${valueHtml}</span>`;

// Real list items with a text bullet: every parser keeps "•" as the item
// marker, and the flex row gives wrapped lines a clean hanging indent.
const renderBulletsHtml = (itemsHtml: string[], ctx: RenderContext) =>
  itemsHtml.length
    ? `<ul style="list-style:none;margin:4px 0 0;padding:0;">${itemsHtml
        .map(
          (item) =>
            `<li style="${textStyle(
              ctx,
              `display:flex;gap:4px;margin:0 0 3px;${KEEP_TOGETHER}`
            )}"><span style="flex:none;color:${ctx.theme.accent};">•${TEXT_GAP}</span><span style="flex:1;min-width:0;">${item}</span></li>`
        )
        .join("")}</ul>`
    : "";

const renderBullets = (items: string[], ctx: RenderContext) =>
  renderBulletsHtml(normalizeExperienceBullets(items).map(escapeHtml), ctx);

const renderSectionHeading = (title: string, ctx: RenderContext) => {
  const { theme, layout } = ctx;
  const color = layout.headingTone === "accent" ? theme.accent : theme.headingColor;
  const base = `margin:${theme.sectionSpacing}px 0 8px;font-size:${theme.baseFontSize}px;line-height:1.3;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${color};break-after:avoid;page-break-after:avoid;`;
  const text = escapeHtml(title);
  const line = (lineColor: string) =>
    `<span aria-hidden="true" style="flex:1;height:1px;background:${lineColor};"></span>`;

  switch (layout.heading) {
    case "bar":
      return `<h2 style="${base}border-left:3px solid ${theme.accent};padding:1px 0 1px 9px;">${text}</h2>`;
    case "caps":
      return `<h2 style="${base}font-size:${theme.baseFontSize - 1}px;letter-spacing:.14em;padding-bottom:5px;border-bottom:1px solid ${theme.mutedAccent};">${text}</h2>`;
    case "line":
      return `<h2 style="${base}display:flex;align-items:center;gap:10px;"><span>${text}</span>${line(
        theme.accent
      )}</h2>`;
    case "centered":
      return `<h2 style="${base}display:flex;align-items:center;gap:14px;letter-spacing:.18em;">${line(
        theme.accent
      )}<span>${text}</span>${line(theme.accent)}</h2>`;
    default: {
      const ruleColor = layout.headingTone === "accent" ? theme.mutedAccent : theme.accent;
      return `<h2 style="${base}padding-bottom:4px;border-bottom:1px solid ${ruleColor};">${text}</h2>`;
    }
  }
};

type EntryHeaderParts = {
  title: string;
  subtitle?: string;
  // Pre-escaped HTML for the right-hand side of each row.
  asideHtml?: string;
  subAsideHtml?: string;
};

// Title left + dates right, then organisation left + location right — the
// layout recruiters scan fastest, and it reads in the same order as text.
const renderEntryHeader = (ctx: RenderContext, parts: EntryHeaderParts) => {
  const { theme } = ctx;
  let html = `<div style="${KEEP_TOGETHER}">`;
  html += `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;">`;
  html += `<h3 style="margin:0;font-size:${theme.baseFontSize + 1}px;line-height:1.35;font-weight:700;color:${theme.headingColor};">${escapeHtml(
    parts.title
  )}${parts.asideHtml ? TEXT_GAP : ""}</h3>`;
  if (parts.asideHtml) {
    html += `<span style="flex:none;font-size:${theme.baseFontSize}px;color:${theme.bodyColor};white-space:nowrap;">${parts.asideHtml}</span>`;
  }
  html += "</div>";
  if (parts.subtitle || parts.subAsideHtml) {
    html += `<div style="${textStyle(
      ctx,
      "display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-top:1px;"
    )}">`;
    html += `<span style="font-weight:600;">${escapeHtml(parts.subtitle || "")}${
      parts.subAsideHtml ? TEXT_GAP : ""
    }</span>`;
    if (parts.subAsideHtml) {
      html += `<span style="flex:none;max-width:45%;text-align:right;color:${MUTED_TEXT_COLOR};">${parts.subAsideHtml}</span>`;
    }
    html += "</div>";
  }
  return `${html}</div>`;
};

// Europass order: the bracketed dates lead the title, the organisation and
// place follow on their own line.
const renderEuropassEntryHeader = (
  ctx: RenderContext,
  parts: { title: string; dates: string; subtitle: string; location: string }
) => {
  const { theme } = ctx;
  let html = `<div style="${KEEP_TOGETHER}">`;
  html += `<div style="display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;">`;
  if (parts.dates) {
    html += `<span style="flex:none;font-size:${theme.baseFontSize - 1}px;color:${MUTED_TEXT_COLOR};white-space:nowrap;">${escapeHtml(
      parts.dates
    )}${TEXT_GAP}</span>`;
  }
  html += `<h3 style="margin:0;font-size:${theme.baseFontSize + 1}px;line-height:1.35;font-weight:700;color:${theme.headingColor};">${escapeHtml(
    parts.title
  )}</h3>`;
  html += "</div>";
  const place = [parts.subtitle, parts.location].filter(Boolean);
  if (place.length) {
    html += `<p style="${textStyle(ctx, "margin-top:1px;")}">${
      parts.subtitle ? `<span style="font-weight:600;">${escapeHtml(parts.subtitle)}</span>` : ""
    }${parts.subtitle && parts.location ? " – " : ""}${escapeHtml(parts.location)}</p>`;
  }
  return `${html}</div>`;
};

const renderTimedEntryHeader = (
  ctx: RenderContext,
  entry: { title: string; subtitle: string; duration: string; location: string }
) => {
  const dates = formatDuration(entry.duration, ctx.layout.dates);
  if (ctx.layout.entry === "europass") {
    return renderEuropassEntryHeader(ctx, {
      title: entry.title,
      dates,
      subtitle: entry.subtitle,
      location: entry.location,
    });
  }
  return renderEntryHeader(ctx, {
    title: entry.title,
    subtitle: entry.subtitle,
    asideHtml: dates ? escapeHtml(dates) : "",
    subAsideHtml: entry.location ? escapeHtml(entry.location) : "",
  });
};

// ---- Header ----------------------------------------------------------------

const EUROPASS_CONTACT_LABELS: Record<ContactItem["kind"], string> = {
  email: "Email address",
  phone: "Phone number",
  location: "Address",
  linkedin: "LinkedIn",
  github: "Website",
  behance: "Website",
  link: "Website",
};

const contactItemHtml = (item: ContactItem, labelled: boolean) => {
  const label = escapeHtml(item.label);
  const valueHtml = item.href
    ? `<a href="${escapeHtml(item.href)}" style="color:inherit;text-decoration:none;">${label}</a>`
    : label;
  return labelled
    ? labelledHtml(EUROPASS_CONTACT_LABELS[item.kind], valueHtml)
    : `<span style="${INLINE_ITEM}">${valueHtml}</span>`;
};

const renderContact = (
  items: ContactItem[],
  ctx: RenderContext,
  align: "left" | "center",
  marginTop = 8
) => {
  if (!items.length) return "";
  const { theme, layout } = ctx;
  if (layout.contact === "icons" && ctx.useContactIcons) {
    const itemStyle = `display:inline-flex;align-items:center;gap:6px;font-size:${theme.baseFontSize}px;line-height:${theme.lineHeight};color:${theme.bodyColor};text-decoration:none;`;
    const row = items
      .map((item) => {
        const inner = `${iconSvgForContactKind(item.kind, theme.accent)}<span>${escapeHtml(
          item.label
        )}${TEXT_GAP}</span>`;
        return item.href
          ? `<a href="${escapeHtml(item.href)}" style="${itemStyle}">${inner}</a>`
          : `<span style="${itemStyle}">${inner}</span>`;
      })
      .join("");
    return `<div style="display:flex;flex-wrap:wrap;justify-content:${
      align === "center" ? "center" : "flex-start"
    };gap:4px 12px;margin:10px 0 0;">${row}</div>`;
  }
  return renderInlineRow(
    items.map((item) => contactItemHtml(item, layout.contact === "labelled")),
    ctx,
    align,
    marginTop
  );
};

const personalItemsHtml = (
  personal: ResumePersonalDetails,
  specs: ResumeTemplateLayout["headerDetails"]
) =>
  specs
    .map((spec) => ({ spec, value: (personal[spec.field] || "").trim() }))
    .filter(({ value }) => value)
    .map(({ spec, value }) => labelledHtml(spec.label, escapeHtml(value)));

const renderHeader = (
  structured: RenderedSections,
  ctx: RenderContext,
  meta: { candidateName: string; designation?: string; photoUrl?: string }
) => {
  const { theme, layout } = ctx;
  const align = layout.header === "center" ? "center" : "left";
  const nameStyle = `margin:0;font-size:${Math.round(
    theme.baseFontSize * 2.15
  )}px;line-height:1.15;font-weight:700;color:${theme.headingColor};${
    layout.nameCase === "upper"
      ? "text-transform:uppercase;letter-spacing:.1em;"
      : "letter-spacing:-.01em;"
  }`;
  const nameHtml = `<h1 style="${nameStyle}">${escapeHtml(meta.candidateName)}</h1>`;
  const designationHtml = meta.designation
    ? `<p style="margin:5px 0 0;font-size:${theme.baseFontSize + 2}px;line-height:1.35;font-weight:600;color:${theme.accent};">${escapeHtml(
        meta.designation
      )}</p>`
    : "";
  const detailItems = personalItemsHtml(structured.personal, layout.headerDetails);
  const photoHtml =
    layout.photo !== "none" && theme.showPhoto && meta.photoUrl
      ? `<img src="${escapeHtml(meta.photoUrl)}" alt="Profile photo" style="display:block;flex:none;width:92px;height:115px;object-fit:cover;border-radius:6px;border:1px solid ${theme.mutedAccent};" />`
      : "";
  const frame = layout.headerRule
    ? `border-bottom:2px solid ${theme.accent};padding-bottom:14px;`
    : "padding-bottom:4px;";

  if (layout.header === "europass") {
    // Europass leads with the personal information, then the contact lines.
    const text = `${nameHtml}${designationHtml}${renderInlineRow(
      detailItems,
      ctx,
      "left"
    )}${renderContact(structured.contactItems, ctx, "left", detailItems.length ? 4 : 8)}`;
    return photoHtml
      ? `<header style="${frame}display:flex;gap:18px;align-items:flex-start;">${photoHtml}<div style="flex:1;min-width:0;">${text}</div></header>`
      : `<header style="${frame}">${text}</header>`;
  }

  const text = `${nameHtml}${designationHtml}${renderContact(
    structured.contactItems,
    ctx,
    align
  )}${renderInlineRow(detailItems, ctx, align, 4)}`;
  if (layout.header === "split" && photoHtml) {
    return `<header style="${frame}display:flex;gap:20px;align-items:flex-start;justify-content:space-between;"><div style="flex:1;min-width:0;">${text}</div>${photoHtml}</header>`;
  }
  return `<header style="${frame}text-align:${align};">${text}</header>`;
};

// ---- Sections ----------------------------------------------------------------

const NATIVE_LANGUAGE_RE = /\b(native|mother\s*tongue|first\s+language)\b/i;
const CEFR_LEVEL_RE = /\b[ABC][12]\b/;

const splitLanguageLevel = (item: string) => {
  const clean = stripMarkdownBold(item).trim();
  const paren = clean.match(/^(.+?)\s*\((.+)\)\s*$/);
  if (paren) return { name: paren[1].trim(), level: paren[2].trim() };
  const separated = clean.match(/^(.+?)\s*[-–—:|]\s*(.+)$/);
  if (separated) return { name: separated[1].trim(), level: separated[2].trim() };
  return { name: clean, level: "" };
};

// Europass language block: mother tongue(s) first, then other languages with
// the level the candidate gave — plus the CEFR key when levels use it.
const renderEuropassLanguages = (languages: string[], ctx: RenderContext) => {
  const natives: string[] = [];
  const others: { name: string; level: string }[] = [];
  languages.forEach((item) => {
    const { name, level } = splitLanguageLevel(item);
    if (!name) return;
    if (NATIVE_LANGUAGE_RE.test(item)) natives.push(name);
    else others.push({ name, level });
  });
  let html = "";
  if (natives.length) {
    html += `<p style="${textStyle(ctx)}">${labelledHtml(
      "Mother tongue(s)",
      escapeHtml(natives.join(", "))
    )}</p>`;
  }
  if (others.length) {
    if (natives.length) {
      html += `<p style="${textStyle(ctx, "margin-top:6px;font-weight:600;")}">Other language(s):</p>`;
    }
    html += renderBulletsHtml(
      others.map(({ name, level }) =>
        level
          ? `<span style="font-weight:600;">${escapeHtml(name)}</span> – ${escapeHtml(level)}`
          : `<span style="font-weight:600;">${escapeHtml(name)}</span>`
      ),
      ctx
    );
  }
  if (languages.some((item) => CEFR_LEVEL_RE.test(item))) {
    html += `<p style="${textStyle(
      ctx,
      `margin-top:4px;font-size:${ctx.theme.baseFontSize - 2}px;color:${MUTED_TEXT_COLOR};`
    )}">Levels: A1 and A2: Basic user; B1 and B2: Independent user; C1 and C2: Proficient user</p>`;
  }
  return html;
};

const renderCertifications = (lines: string[], ctx: RenderContext) => {
  const items = lines
    .map(parseCertificationLine)
    .filter((item): item is CertificationLine => item !== null);
  let html = "";
  let pending: string[] = [];
  const flush = () => {
    html += renderBulletsHtml(pending, ctx);
    pending = [];
  };
  items.forEach((item) => {
    if (item.kind === "heading") {
      flush();
      html += `<p style="${textStyle(
        ctx,
        `margin:8px 0 2px;font-weight:700;color:${ctx.theme.headingColor};`
      )}">${escapeHtml(item.text)}</p>`;
      return;
    }
    let inner = escapeHtml(item.text);
    if (item.href) {
      inner += ` — <a href="${escapeHtml(item.href)}" style="color:inherit;text-decoration:underline;">${escapeHtml(
        item.label || "Credentials"
      )}</a>`;
    }
    pending.push(inner);
  });
  flush();
  return html;
};

const renderSection = (
  key: ResumeSectionKey,
  s: RenderedSections,
  ctx: RenderContext
): string => {
  const { theme, layout } = ctx;
  const heading = () => renderSectionHeading(layout.headings[key], ctx);

  switch (key) {
    case "summary":
      return s.summaryText
        ? `${heading()}<p style="${textStyle(ctx)}">${withInlineFormatting(s.summaryText)}</p>`
        : "";

    case "skills": {
      if (!s.skillCategories.length) return "";
      const hasLabels = s.skillCategories.some((category) => category.label);
      if (!hasLabels) {
        const inline = s.skillCategories.flatMap((category) => category.items);
        return `${heading()}<p style="${textStyle(ctx)}">${escapeHtml(inline.join(", "))}</p>`;
      }
      return `${heading()}${s.skillCategories
        .map(
          (category) =>
            `<p style="${textStyle(ctx, "margin:0 0 3px;")}">${
              category.label
                ? `<strong style="font-weight:700;color:${theme.headingColor};">${escapeHtml(
                    category.label
                  )}:</strong> `
                : ""
            }${escapeHtml(category.items.join(", "))}</p>`
        )
        .join("")}`;
    }

    case "experience":
      if (!s.experience.length) return "";
      return `${heading()}${s.experience
        .map(
          (entry) =>
            `<div style="margin:0 0 11px;">${renderTimedEntryHeader(ctx, {
              title: entry.designation || entry.company,
              subtitle: entry.designation ? entry.company : "",
              duration: entry.duration,
              location: entry.location,
            })}${renderBullets(entry.bullets, ctx)}</div>`
        )
        .join("")}`;

    case "projects":
      if (!s.projects.length) return "";
      return `${heading()}${s.projects
        .map((entry) => {
          let html = '<div style="margin:0 0 10px;">';
          if (entry.name || entry.href) {
            html += renderEntryHeader(ctx, {
              title: entry.name,
              asideHtml: entry.href
                ? `<a href="${escapeHtml(entry.href)}" style="color:inherit;text-decoration:underline;">${escapeHtml(
                    displayLabelForUrl(entry.href)
                  )}</a>`
                : "",
            });
          }
          if (entry.meta) {
            html += `<p style="${textStyle(ctx, "margin-top:1px;font-style:italic;")}">${escapeHtml(
              entry.meta
            )}</p>`;
          }
          return `${html}${renderBullets(entry.bullets, ctx)}</div>`;
        })
        .join("")}`;

    case "education":
      if (!s.education.length) return "";
      return `${heading()}${s.education
        .map(
          (entry) =>
            `<div style="margin:0 0 10px;">${renderTimedEntryHeader(ctx, {
              title: entry.qualification || entry.institution,
              subtitle: entry.qualification ? entry.institution : "",
              duration: entry.duration,
              location: entry.location,
            })}${renderBullets(entry.details, ctx)}</div>`
        )
        .join("")}`;

    case "certifications": {
      const body = renderCertifications(s.certifications, ctx);
      return body ? `${heading()}${body}` : "";
    }

    case "languages":
      if (!s.languages.length) return "";
      if (layout.languages === "europass") {
        return `${heading()}${renderEuropassLanguages(s.languages, ctx)}`;
      }
      return `${heading()}${renderInlineRow(
        s.languages
          .map((item) => stripMarkdownBold(item).trim())
          .filter(Boolean)
          .map((item) => `<span style="${INLINE_ITEM}">${escapeHtml(item)}</span>`),
        ctx,
        "left",
        0
      )}`;

    case "personal": {
      const items = personalItemsHtml(s.personal, layout.sectionDetails);
      if (!items.length) return "";
      return `${heading()}<div style="display:flex;flex-wrap:wrap;column-gap:24px;row-gap:3px;">${items
        .map(
          (item) =>
            `<p style="${textStyle(ctx, "width:calc(50% - 12px);")}">${item}</p>`
        )
        .join("")}</div>`;
    }

    case "additional":
      return s.additionalSections
        .filter((section) => section.title && section.items.length)
        .map(
          (section) =>
            `${renderSectionHeading(section.title, ctx)}${renderBullets(section.items, ctx)}`
        )
        .join("");

    case "references":
      if (s.references.length) return `${heading()}${renderBullets(s.references, ctx)}`;
      return layout.referencesFallback
        ? `${heading()}<p style="${textStyle(ctx, "font-style:italic;")}">${escapeHtml(
            layout.referencesFallback
          )}</p>`
        : "";

    default:
      return "";
  }
};

// Single source of truth for resume markup: the template's header, then its
// sections in the order its convention dictates. Used by both the legacy text
// input and the structured object input.
const renderResumeDocument = (
  structured: RenderedSections,
  options: {
    templateId: ResumeTemplateId;
    overrides?: ResumeTemplateThemeOverrides;
    candidateName: string;
    designation?: string;
    photoUrl?: string;
    useContactIcons: boolean;
  }
) => {
  const config = getResumeTemplateConfig(options.templateId);
  const theme = resolveResumeTemplateTheme(options.templateId, options.overrides);
  const ctx: RenderContext = {
    theme,
    layout: config.layout,
    useContactIcons: options.useContactIcons,
  };
  const body = config.layout.sections.map((key) => renderSection(key, structured, ctx)).join("");
  // The PDF route prints A4 by default; a later @page rule wins, so US
  // templates carry their own Letter page size inside the document.
  const pageCss = config.layout.page === "letter" ? "<style>@page { size: letter; }</style>" : "";

  return `<div style="font-family:${theme.fontFamily};background:#fff;color:${theme.bodyColor};padding:24px;">${pageCss}${renderHeader(
    structured,
    ctx,
    options
  )}${body || `<p style="${textStyle(ctx, `margin-top:16px;color:${MUTED_TEXT_COLOR};`)}">No content available.</p>`}</div>`;
};

const sectionsFromText = (resumeText: string): RenderedSections => {
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

  const summarySectionLines = sections.summary || [];
  const summaryLines = summarySectionLines.length
    ? summarySectionLines
    : preludeWithoutPersonal.filter((line) => !isRoleHeaderLine(line));

  return {
    contactItems: personalLines.length
      ? extractContactItems(personalLines, knownProfileLinks)
      : [],
    summaryText: summaryLines.join(" ").trim(),
    skillCategories: parseSkillCategories(sections.skills || []),
    experience: parseExperienceEntries(sections.experience || []),
    projects: parseProjectEntries(sections.projects || []),
    education: parseEducationEntries(sections.education || []),
    certifications: sections.certifications || [],
    languages: splitLanguageLines(sections.languages || []),
    references: (sections.references || []).map((line) =>
      stripMarkdownBold(line).replace(/^[-*•]\s+/, "").trim()
    ),
    additionalSections: [],
    personal: {},
  };
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
}) =>
  renderResumeDocument(sectionsFromText(resumeText), {
    templateId,
    overrides,
    candidateName,
    designation,
    photoUrl,
    useContactIcons,
  });

// Normalize a user-entered link into a clickable href, adding https:// to bare
// domains (e.g. "dribbble.com/you" -> "https://dribbble.com/you").
const contactHrefFromUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
};

// Build contact items DIRECTLY from the structured contact object. Unlike the
// text path's heuristic extractContactItems (which only recognizes a few
// networks and silently drops the rest), this renders EVERY link the user
// entered — portfolio, Dribbble, Behance, Git, or any other website.
const buildContactItemsFromData = (contact: ResumeContact): ContactItem[] => {
  const items: ContactItem[] = [];
  const email = (contact.email || "").trim();
  if (email) items.push({ kind: "email", label: email, href: `mailto:${email}` });
  const phone = (contact.phone || "").trim();
  if (phone) {
    items.push({
      kind: "phone",
      label: phone,
      href: `tel:${phone.replace(/[^\d+]/g, "")}`,
    });
  }
  const location = (contact.location || "").trim();
  if (location) items.push({ kind: "location", label: location });
  (contact.links || []).forEach((link) => {
    const url = (link?.url || "").trim();
    if (!url) return;
    const href = contactHrefFromUrl(url);
    let kind: ContactItem["kind"] = "link";
    if (/linkedin\.com/i.test(href)) kind = "linkedin";
    else if (/github\.com|gitlab\.com/i.test(href)) kind = "github";
    else if (/behance\.net/i.test(href)) kind = "behance";
    items.push({
      kind,
      label: link.label?.trim() || displayLabelForUrl(href),
      href,
    });
  });
  return items;
};

const trimPersonalDetails = (personal: ResumePersonalDetails = {}) => {
  const trimmed: ResumePersonalDetails = {};
  (Object.keys(personal) as ResumePersonalField[]).forEach((field) => {
    const value = String(personal[field] || "").trim();
    if (value) trimmed[field] = value;
  });
  return trimmed;
};

// Data-first path: builds the normalized section shape straight from the
// structured ResumeData object (no text parsing).
const sectionsFromData = (data: ResumeData): RenderedSections => ({
  contactItems: data.contact ? buildContactItemsFromData(data.contact) : [],
  summaryText: (data.summary || "").trim(),
  // Structured skills are intentional user/AI input — keep them as-is (the
  // filler filter is only for cleaning up messy parsed text).
  skillCategories: parseSkillCategories(data.skills || [], { filterFiller: false }),
  experience: (data.experience || []).map((entry) => ({
    designation: entry.designation || "",
    company: entry.company || "",
    location: entry.location || "",
    duration: entry.duration || "",
    bullets: entry.responsibilities || [],
  })),
  projects: (data.projects || []).map((entry) => ({
    name: entry.name || "",
    meta: entry.meta || "",
    href: entry.link || "",
    bullets: entry.responsibilities || [],
  })),
  education: (data.education || []).map((entry) => ({
    qualification: entry.qualification || "",
    institution: entry.institution || "",
    location: entry.location || "",
    duration: entry.duration || "",
    details: entry.details || [],
  })),
  certifications: data.certifications || [],
  languages: data.languages || [],
  references: (data.references || []).map((item) => item.trim()).filter(Boolean),
  additionalSections: (data.additionalSections || [])
    .map((section) => ({
      title: (section.title || "").trim(),
      items: (section.items || []).map((item) => item.trim()).filter(Boolean),
    }))
    .filter((section) => section.title && section.items.length),
  personal: trimPersonalDetails(data.personal),
});

export const renderResumeFromData = ({
  data,
  templateId,
  candidateName,
  designation,
  photoUrl,
  overrides,
  useContactIcons = true,
}: {
  data: ResumeData;
  templateId: ResumeTemplateId;
  candidateName: string;
  designation?: string;
  photoUrl?: string;
  overrides?: ResumeTemplateThemeOverrides;
  useContactIcons?: boolean;
}) =>
  renderResumeDocument(sectionsFromData(data), {
    templateId,
    overrides,
    candidateName,
    designation,
    photoUrl,
    useContactIcons,
  });

// Plain-text projection of the structured resume — used client-side for the
// analyzer re-evaluation and as a download fallback. Mirrors the server's
// resumeObjectToText so scoring sees the same content the renderer shows.
export const resumeDataToText = (data: ResumeData): string => {
  const blocks: string[] = [];
  const clean = (v?: string) => (v || "").trim();

  const contact = data.contact;
  if (contact) {
    const contactLine = [
      contact.email,
      contact.phone,
      contact.location,
      ...(contact.links || []).map((l) => l.url),
    ]
      .map(clean)
      .filter(Boolean)
      .join(" | ");
    if (contactLine) blocks.push(contactLine);
  }
  if (clean(data.summary)) blocks.push("SUMMARY", clean(data.summary));
  if (data.skills?.length) blocks.push("SKILLS", data.skills.join("\n"));
  if (data.experience?.length) {
    blocks.push("EXPERIENCE");
    data.experience.forEach((entry) => {
      const header = [entry.designation, entry.company, entry.location, entry.duration]
        .map(clean)
        .filter(Boolean)
        .join(" | ");
      if (header) blocks.push(header);
      (entry.responsibilities || []).forEach((line) => {
        if (clean(line)) blocks.push(`- ${clean(line)}`);
      });
    });
  }
  if (data.projects?.length) {
    blocks.push("PROJECTS");
    data.projects.forEach((entry) => {
      if (clean(entry.name)) blocks.push(clean(entry.name));
      (entry.responsibilities || []).forEach((line) => {
        if (clean(line)) blocks.push(`- ${clean(line)}`);
      });
    });
  }
  if (data.education?.length) {
    blocks.push("EDUCATION");
    data.education.forEach((entry) => {
      const header = [entry.qualification, entry.institution, entry.location, entry.duration]
        .map(clean)
        .filter(Boolean)
        .join(" | ");
      if (header) blocks.push(header);
      (entry.details || []).forEach((line) => {
        if (clean(line)) blocks.push(`- ${clean(line)}`);
      });
    });
  }
  if (data.certifications?.length) {
    blocks.push("CERTIFICATIONS");
    data.certifications.forEach((line) => {
      if (clean(line)) blocks.push(`- ${clean(line)}`);
    });
  }
  if (data.languages?.length) {
    blocks.push("LANGUAGES");
    data.languages.forEach((line) => {
      if (clean(line)) blocks.push(`- ${clean(line)}`);
    });
  }
  (data.additionalSections || []).forEach((section) => {
    const title = clean(section.title);
    const items = (section.items || []).map(clean).filter(Boolean);
    if (!title || !items.length) return;
    blocks.push(title.toUpperCase());
    items.forEach((item) => blocks.push(`- ${item}`));
  });
  return blocks.join("\n").trim();
};

const escapeRegExpLiteral = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const KEYWORD_HIGHLIGHT_STYLE =
  "background-color:rgba(16,185,129,0.18);color:inherit;border-radius:2px;padding:0 1px;";

/**
 * Wrap occurrences of `keywords` in a faint <mark> so the user can see what the
 * AI added and where. PREVIEW ONLY — never call this for the download/PDF HTML.
 *
 * Highlighting is applied strictly to text BETWEEN tags: the templates are
 * inline-style heavy, so replacing across the whole string would corrupt markup
 * (e.g. a keyword like "Design" or "Grid" matching inside a style attribute).
 */
export const highlightKeywordsInHtml = (
  html: string,
  keywords: string[] = []
): string => {
  const unique = Array.from(
    new Set(
      (keywords || [])
        .map((keyword) => String(keyword || "").trim())
        .filter((keyword) => keyword.length > 1)
    )
    // Longest first so "Applicant Tracking Systems" wins over "Systems".
  ).sort((a, b) => b.length - a.length);
  if (!unique.length || !html) return html;

  const patterns = unique
    .map((keyword) => {
      const words = keyword.split(/\s+/).filter(Boolean).map(escapeRegExpLiteral);
      if (!words.length) return "";
      // Allow flexible separators between words, and only anchor with \b where
      // the keyword edge is a word char (so "ES6+", "CI/CD", "Node.js" match).
      const body = words.join("(?:\\W|_){1,3}");
      const start = /\w/.test(keyword[0]) ? "\\b" : "";
      const end = /\w/.test(keyword[keyword.length - 1]) ? "\\b" : "(?!\\w)";
      return `${start}${body}${end}`;
    })
    .filter(Boolean);
  if (!patterns.length) return html;

  const matcher = new RegExp(`(?:${patterns.join("|")})`, "gi");

  let insideStyle = false;
  return html
    .split(/(<[^>]*>)/)
    .map((segment, index) => {
      // Odd indices are tags — leave them untouched, noting when a template's
      // <style> block opens or closes so its CSS is never highlighted.
      if (index % 2 === 1) {
        if (/^<style\b/i.test(segment)) insideStyle = true;
        else if (/^<\/style>/i.test(segment)) insideStyle = false;
        return segment;
      }
      if (!segment || insideStyle) return segment;
      return segment.replace(
        matcher,
        (match) => `<mark style="${KEYWORD_HIGHLIGHT_STYLE}">${match}</mark>`
      );
    })
    .join("");
};

export const renderCoverLetterHtml = (content: string) => {
  const plain = stripMarkdownBold(content);
  const blocks = plain
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const dateAtLineEndRegex =
    /^(.*?)(?:\s{2,}|,\s+)(\w+\s+\d{1,2},\s+\d{4}|\d{1,2}\s+\w+\s+\d{4})\s*$/i;

  // The closing/sign-off block ("Yours sincerely," + name + contact lines).
  const closingRegex =
    /^(yours\s+(sincerely|faithfully|truly)|sincerely|faithfully|best\s+regards|kind\s+regards|warm\s+regards|regards|respectfully|thank\s+you|best|cheers)\b/i;

  const paragraphs = blocks
    .map((part, index) => {
      const lines = part.split("\n").map((line) => line.trim()).filter(Boolean);

      // Sign-off: give it clear space above, keep the closing line apart from
      // the name/contact lines, and breathe between those lines.
      if (closingRegex.test(lines[0] || "")) {
        const closing = `<p style="font-size:13px;line-height:1.7;color:#334155;margin:28px 0 12px;">${escapeHtml(
          lines[0]
        )}</p>`;
        const rest = lines.slice(1);
        const restMarkup = rest.length
          ? `<p style="font-size:13px;line-height:1.9;color:#334155;margin:0;">${rest
              .map((line) => escapeHtml(line))
              .join("<br/>")}</p>`
          : "";
        return `${closing}${restMarkup}`;
      }

      // Greeting (first block): recipient / date line, with generous space
      // before the body.
      if (index === 0) {
        const firstLineMatch = (lines[0] || "").match(dateAtLineEndRegex);
        if (firstLineMatch) {
          const left = firstLineMatch[1].trim();
          const date = firstLineMatch[2].trim();
          const rest = lines.slice(1).join("\n").trim();
          const row = `<div style=\"display:flex;justify-content:space-between;align-items:flex-start;gap:12px;font-size:13px;line-height:1.7;color:#334155;margin:0 0 6px;\"><span>${escapeHtml(
            left
          )}</span><span style=\"text-align:right;white-space:nowrap;\">${escapeHtml(
            date
          )}</span></div>`;
          const restMarkup = rest
            ? `<p style=\"font-size:13px;line-height:1.7;color:#334155;margin:0 0 22px;\">${escapeHtml(
                rest
              ).replace(/\n/g, "<br/>")}</p>`
            : "";
          return `${row}${restMarkup}`;
        }
        return `<p style="font-size:13px;line-height:1.7;color:#334155;margin:0 0 22px;">${escapeHtml(
          part
        ).replace(/\n/g, "<br/>")}</p>`;
      }

      // Body paragraph.
      return `<p style=\"font-size:13px;line-height:1.75;color:#334155;margin:0 0 16px;\">${escapeHtml(
        part
      ).replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");

  const heading =
    '<h1 style="font-size:24px;font-weight:700;color:#0f172a;margin:0 0 24px;padding:0 0 12px;border-bottom:1px solid #e2e8f0;letter-spacing:-0.01em;">Cover Letter</h1>';

  return `<section style="padding:8px 0;">${heading}${paragraphs}</section>`;
};
