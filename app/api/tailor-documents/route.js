import { NextResponse } from "next/server";
import {
  countFreeTrialScans,
  FREE_TRIAL_SCAN_LIMIT,
  getPlanForUser,
  getSupabaseAdminClient,
} from "@/lib/server/subscriptions";
import {
  isHumanLanguageEntry,
  isLanguageKeyword,
  languageWordsIn,
  languageNamesFromKeywords,
  sharesLanguage,
} from "@/lib/languages";

const normalizeText = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s.+#/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasKeyword = (text = "", keyword = "") => {
  const normalizedText = normalizeText(text);
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) return false;

  const words = normalizedKeyword.split(" ").filter(Boolean);
  if (!words.length) return false;
  const pattern = words.map((word) => escapeRegex(word)).join("(?:\\W|_){1,3}");
  // Only anchor with \b where the keyword edge is a word char. Keywords ending
  // (or starting) with punctuation — "ES6+", "C++", "C#", ".NET" — would never
  // match a trailing \b after the non-word char, so anchor conditionally.
  const startAnchor = /\w/.test(normalizedKeyword[0]) ? "\\b" : "";
  const endAnchor = /\w/.test(normalizedKeyword[normalizedKeyword.length - 1])
    ? "\\b"
    : "(?!\\w)";
  const regex = new RegExp(`${startAnchor}${pattern}${endAnchor}`, "i");
  return regex.test(normalizedText);
};

const stripPlaceholdersAndTemplateLabels = (text = "") =>
  text
    .replace(/\[[^\]]+\]/g, "")
    .replace(/^\s*tailored cover letter\s*$/gim, "")
    .replace(/^\s*tailored resume\s*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

// Map common "smart" (non-ASCII) punctuation to its ASCII equivalent so it
// survives the ASCII-only strip below. Without this, curly apostrophes turn
// "Women's" into "Women s" and en/em dashes blow holes in date ranges
// ("2019–2023" -> "2019 2023").
const normalizeSmartPunctuation = (text = "") =>
  text
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/[•‣◦⁃∙]/g, "-")
    .replace(/…/g, "...");

const sanitizeAllowedCharacters = (text = "") =>
  normalizeSmartPunctuation(text)
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/[^\w\s.,:;!?()&/'"%+\-*@#|\n]/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const normalizeUrlCandidate = (value = "") => {
  const cleaned = ensureString(value).replace(/[),.;]+$/g, "");
  if (!cleaned) return "";
  if (/^https?:\/\//i.test(cleaned)) return cleaned;
  if (
    /^(www\.)?(linkedin\.com|github\.com|behance\.net|gitlab\.com|medium\.com|dribbble\.com|portfolio\.|about\.me|linktr\.ee)/i.test(
      cleaned
    )
  ) {
    return `https://${cleaned.replace(/^www\./i, "www.")}`;
  }
  return "";
};

// Identity key for a URL so the same profile listed in two forms — with/without
// "www.", "http" vs "https", a trailing slash, or differing case — dedupes to a
// single entry (e.g. "www.linkedin.com/in/x" and "linkedin.com/in/x").
const canonicalLinkKey = (url = "") =>
  ensureString(url)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");

const extractExternalLinks = (text = "") => {
  const content = String(text || "");
  const links = [];
  const seen = new Set();

  const add = (raw = "") => {
    const normalized = normalizeUrlCandidate(raw);
    if (!normalized) return;
    const key = canonicalLinkKey(normalized);
    if (seen.has(key)) return;
    seen.add(key);
    links.push(normalized);
  };

  const directUrlRegex = /(?:https?:\/\/|www\.)[^\s<>()]+/gi;
  let m;
  while ((m = directUrlRegex.exec(content)) !== null) add(m[0]);

  const domainPathRegex =
    /\b(linkedin\.com\/[^\s<>()]+|github\.com\/[^\s<>()]+|behance\.net\/[^\s<>()]+|gitlab\.com\/[^\s<>()]+|medium\.com\/[^\s<>()]+|dribbble\.com\/[^\s<>()]+)\b/gi;
  let d;
  while ((d = domainPathRegex.exec(content)) !== null) add(d[0]);

  return links;
};

const extractProfileLinksOnly = (text = "") =>
  extractExternalLinks(text)
    .filter((link) =>
      /linkedin\.com|github\.com|behance\.net|portfolio|about\.me|linktr\.ee|gitlab\.com|medium\.com/i.test(
        String(link || "")
      )
    )
    .slice(0, 6);

// A label-only line ("CONTACT", "Email:", "Get in touch") — a section heading
// or field label with no actual data on it.
const CONTACT_LABEL_LINE_RE =
  /^(contact( (information|details|info|me))?|get in touch|reach me|e-?mail|phone|mobile|tel|address|location)\s*:?\s*$/i;

// Bullet lines are body content (experience/projects), never contact info.
const BULLET_LINE_RE = /^[-*•·▪◦]\s/;
// Hard contact evidence: an email, URL, known profile domain, or phone number.
const HARD_CONTACT_EVIDENCE_RE =
  /@|https?:\/\/|www\.|linkedin\.com|github\.com|behance\.net|\+\d[\d\s().-]{7,}\d/i;
// A labelled contact field ("Phone: …", "Email - …"). Bare keywords are NOT
// enough — sentences like "…web and mobile clients" must not qualify.
const CONTACT_LABEL_INLINE_RE = /\b(?:phone|mobile|tel|e-?mail|contact)\s*[:–-]/i;

const extractContactLines = (text = "") => {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const seen = new Set();
  const output = [];

  for (const line of lines.slice(0, 20)) {
    if (CONTACT_LABEL_LINE_RE.test(line) || BULLET_LINE_RE.test(line)) continue;
    if (HARD_CONTACT_EVIDENCE_RE.test(line) || CONTACT_LABEL_INLINE_RE.test(line)) {
      const key = normalizeText(line);
      if (!seen.has(key)) {
        seen.add(key);
        output.push(line);
      }
    }
  }

  return output.slice(0, 4);
};

const extractLikelyTitles = (resume = "") => {
  const titleRegex =
    /\b(engineer|developer|manager|coordinator|teacher|analyst|specialist|assistant|consultant|intern|lead|officer|executive|designer)\b/i;
  return resume
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 3 && line.length < 90 && titleRegex.test(line))
    .slice(0, 20);
};

const extractLikelyOrganizations = (resume = "") => {
  const orgRegex = /\b(inc|corp|corporation|llc|ltd|limited|pvt|university|school|college)\b/i;
  return resume
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 3 && line.length < 120 && orgRegex.test(line))
    .slice(0, 20);
};

const includesLineLoosely = (text = "", line = "") => {
  const t = normalizeText(text);
  const l = normalizeText(line);
  if (!l) return true;
  return t.includes(l);
};

// Resume headers often put the job title on the same line as the name
// ("Priya Deshpande | Full Stack Developer (MERN)"). Cut at the separator, and
// as a fallback (separators can be lost in PDF text extraction) trim a
// trailing job-title phrase recognized by its occupational keyword.
const NAME_SEGMENT_SPLIT_RE = /\s*(?:\||·|•|—|–|,|\/|\t| {3,}| - )\s*/;
const TRAILING_TITLE_RE =
  /\s+(?:senior|junior|lead|principal|staff|full[ -]?stack|front[ -]?end|back[ -]?end|software|web|mobile|devops|cloud|engineer|developer|manager|analyst|designer|consultant|architect|scientist|specialist)\b[\s\S]*$/i;

// Section headers that two-column PDFs often emit BEFORE the candidate's name
// (the sidebar is extracted first, so the text can start with "CONTACT").
const NAME_SECTION_HEADER_RE =
  /^(contact(?:\s+(?:information|details|info|me))?|get in touch|summary|professional summary|profile|about(?:\s+me)?|objective|career objective|skills?|technical skills|core competencies|education|experience|work experience|professional experience|employment(?:\s+history)?|projects?|certifications?|licenses?|languages?|interests?|hobbies|references?|achievements?|awards?|publications?|volunteering|links?|portfolio|curriculum vitae|resume|cv)\s*:?\s*$/i;

// "Ithaca, NY" — a City, ST location line, not a name.
const LOCATION_LINE_RE = /,\s*[A-Z]{2}\.?$/;

// Letter-spaced name headers ("D E E   N I T A O") — collapse single spaces
// inside words, keeping 2+ space runs as word boundaries ("DEE NITAO").
const collapseLetterSpacing = (line = "") => {
  const tokens = line.trim().split(" ").filter(Boolean);
  const singles = tokens.filter((t) => t.length === 1).length;
  if (tokens.length < 4 || singles < tokens.length * 0.7) return line;
  return line
    .trim()
    .split(/\s{2,}/)
    .map((word) => word.replace(/ /g, ""))
    .join(" ");
};

const cleanNameLine = (line = "") => {
  const collapsed = collapseLetterSpacing(line);
  const nameSegment = collapsed.split(NAME_SEGMENT_SPLIT_RE).filter(Boolean)[0] || collapsed;
  let name = nameSegment.replace(/[^a-zA-Z.\s-]/g, "").trim();
  // Restore word boundaries when the name header was extracted glued together
  // (e.g. "AleenaMariamBenny" from a tightly-kerned PDF heading).
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

const isPlausibleNameLine = (line = "") => {
  if (NAME_SECTION_HEADER_RE.test(line)) return false;
  if (/[@\d]|https?:\/\/|www\./i.test(line)) return false;
  if (LOCATION_LINE_RE.test(line)) return false;
  const cleaned = cleanNameLine(line);
  if (cleaned.length < 2 || cleaned.length > 60) return false;
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.length >= 1 && words.length <= 5;
};

const extractCandidateName = (resume = "") => {
  const lines = resume
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return "";

  // Usual case: the resume starts with the candidate's name.
  if (isPlausibleNameLine(lines[0])) {
    let name = cleanNameLine(lines[0]);
    // Stacked name headers put each name word on its own line ("PRIYA" /
    // "NAIR"). Absorb following single-word name-like lines; when the resume
    // has an email, each absorbed word must appear in its local part.
    if (name && !name.includes(" ")) {
      const emailLocal = extractCandidateEmail(resume).split("@")[0].toLowerCase();
      for (let i = 1; i < Math.min(lines.length, 4); i += 1) {
        const line = lines[i];
        if (!/^[A-Za-z][A-Za-z.'-]*$/.test(line)) break;
        if (NAME_SECTION_HEADER_RE.test(line) || SINGLE_TITLE_WORD_RE.test(line)) break;
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
  const email = extractCandidateEmail(resume);
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
        return cleanNameLine(line);
      }
    }
  }

  // Otherwise take the first plausible multi-word line near the top.
  for (const line of lines.slice(0, 12)) {
    if (isPlausibleNameLine(line) && cleanNameLine(line).includes(" ")) {
      return cleanNameLine(line);
    }
  }

  return cleanNameLine(lines[0]);
};

const extractCandidateEmail = (resume = "") => {
  const m = String(resume || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0].trim() : "";
};

const extractCandidatePhone = (resume = "") => {
  const m = String(resume || "").match(/(?:\+?\d[\d\s().-]{7,}\d)/);
  return m ? m[0].replace(/\s+/g, " ").trim() : "";
};

const stripCoverLetterFrame = (text = "") => {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const filtered = [];
  let inSignature = false;
  for (const line of lines) {
    if (/^dear\b/i.test(line)) continue;
    if (/^hiring manager[,:]?\s*$/i.test(line)) continue;
    if (/^to whom it may concern[,:]?\s*$/i.test(line)) continue;
    if (/^sincerely[,:]?\s*$/i.test(line)) {
      inSignature = true;
      continue;
    }
    if (/^yours?\s+faithfully[,:]?\s*$/i.test(line)) {
      inSignature = true;
      continue;
    }
    if (/^regards[,:]?\s*$/i.test(line) || /^best regards[,:]?\s*$/i.test(line)) {
      inSignature = true;
      continue;
    }
    if (inSignature) continue;
    filtered.push(line);
  }

  return filtered.join("\n").replace(/\n{3,}/g, "\n\n").trim();
};

const formatTodayDate = () =>
  new Date().toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

const enforceCoverLetterStructure = ({
  rawCoverLetter = "",
  organization = "",
  candidateName = "",
  email = "",
  phone = "",
}) => {
  const body = stripCoverLetterFrame(rawCoverLetter);
  const safeBody =
    body ||
    "I am writing to express my interest in this opportunity and how my background aligns with the role requirements.";
  const safeName = candidateName || "Candidate Name";
  const safeEmail = email || "";
  const safePhone = phone || "";
  const orgLine = organization || "Company Name";
  const date = formatTodayDate();

  const footerLines = ["Yours sincerely,", safeName];
  if (safeEmail) footerLines.push(safeEmail);
  if (safePhone) footerLines.push(safePhone);

  return [
    `Hiring Manager,                                ${date}`,
    `${orgLine},`,
    "",
    safeBody,
    "",
    ...footerLines,
  ].join("\n");
};

const extractResumeEvidenceTokens = (resume = "") =>
  new Set(
    normalizeText(resume)
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );

const filterMissingByHandsOnEvidence = (missingKeywords = [], resume = "") => {
  const evidence = extractResumeEvidenceTokens(resume);
  return missingKeywords.filter((keyword) => {
    const words = normalizeText(keyword)
      .split(/\s+/)
      .filter((w) => w.length > 2);
    if (!words.length) return false;
    return words.some((w) => evidence.has(w));
  });
};

const ensureString = (value) => String(value || "").trim();
const ensureStringArray = (value) =>
  Array.isArray(value)
    ? value.map((item) => ensureString(item)).filter(Boolean)
    : [];

// Languages can arrive as an array, a single comma/bullet-joined string, or an
// array containing such joined strings (e.g. "English • Hindi • Malayalam").
// Flatten everything into individual, de-duplicated language entries. A
// proficiency qualifier in parentheses, e.g. "English (Native)", is preserved.
const normalizeLanguageList = (value) => {
  const raw = Array.isArray(value)
    ? value.map((item) => ensureString(item))
    : [ensureString(value)];
  const out = [];
  const seen = new Set();
  raw
    .filter(Boolean)
    .flatMap((item) => item.split(/\s*[•|;,\n]\s*|\s{2,}/))
    .map((item) => item.replace(/^[-*•\s]+/, "").trim())
    .filter(Boolean)
    .forEach((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(item);
    });
  return out;
};

// Human-language vocabulary + helpers are shared with the keyword-picker UI so
// language-fluency keywords are handled identically on both sides.

// Rewritten summaries sometimes keep the original resume's role-title opener
// AND add the requested one ("Front-End Developer with proven experience at
// Zillow. Senior Frontend Engineer with over 4 years…") — a double
// introduction. When the first two sentences are both role-title openers,
// keep only the second (the role-targeted one).
const ROLE_OPENER_RE =
  /^[A-Z][A-Za-z+#./ -]{0,60}\b(developer|engineer|designer|analyst|manager|architect|consultant|specialist|scientist|administrator|accountant|marketer|writer|nurse|teacher|lawyer)\b[^.!?]{0,80}\bwith\b/i;
const dropDuplicateRoleOpener = (summary = "") => {
  const sentences = summary.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length < 2) return summary;
  if (ROLE_OPENER_RE.test(sentences[0]) && ROLE_OPENER_RE.test(sentences[1])) {
    return sentences.slice(1).join(" ");
  }
  return summary;
};

const resumeSectionsToText = (payload = {}) => {
  const blocks = [];
  const summary = ensureString(payload?.summary);
  const skills = ensureStringArray(payload?.skills);
  const experience = Array.isArray(payload?.experience) ? payload.experience : [];
  const projects = Array.isArray(payload?.projects) ? payload.projects : [];
  const education = Array.isArray(payload?.education) ? payload.education : [];
  const certifications = ensureStringArray(payload?.certifications);
  const languages = normalizeLanguageList(payload?.languages);

  if (summary) blocks.push("SUMMARY", summary);
  if (skills.length) {
    // Categorized skill lines (e.g. "Languages: JavaScript, TypeScript") must
    // stay on separate lines. A flat list of individual skills is joined inline.
    const looksCategorized = skills.some((skill) => /^[^,]+:\s/.test(skill));
    blocks.push("SKILLS", skills.join(looksCategorized ? "\n" : ", "));
  }
  if (experience.length) {
    blocks.push("EXPERIENCE");
    experience.forEach((item) => {
      const company = ensureString(item?.company || item?.organization);
      const designation = ensureString(item?.designation || item?.title);
      const location = ensureString(item?.location);
      const duration = ensureString(item?.duration || item?.dates);
      const header = [designation, company, location, duration].filter(Boolean).join(" | ");
      if (header) blocks.push(header);
      const bullets = ensureStringArray(item?.bullets || item?.responsibilities);
      bullets.forEach((bullet) => blocks.push(`- ${bullet}`));
    });
  }
  if (projects.length) {
    blocks.push("PROJECTS");
    projects.forEach((item) => {
      const name = ensureString(item?.name || item?.title);
      if (name) blocks.push(name);
      const bullets = ensureStringArray(
        item?.bullets || item?.responsibilities || item?.details
      );
      bullets.forEach((bullet) => blocks.push(`- ${bullet}`));
    });
  }
  if (education.length) {
    blocks.push("EDUCATION");
    education.forEach((item) => {
      const qualification = ensureString(item?.qualification || item?.degree);
      const institution = ensureString(item?.institution || item?.university);
      const location = ensureString(item?.location);
      const duration = ensureString(item?.duration || item?.dates);
      const header = [qualification, institution, location, duration]
        .filter(Boolean)
        .join(" | ");
      if (header) blocks.push(header);
      ensureStringArray(item?.details).forEach((detail) => blocks.push(`- ${detail}`));
    });
  }
  if (certifications.length) {
    blocks.push("CERTIFICATIONS");
    certifications.forEach((cert) => blocks.push(`- ${cert}`));
  }
  if (languages.length) {
    // One language per line so the template renders a clean bullet list rather
    // than a single crammed line ("English • Hindi • Malayalam").
    blocks.push("LANGUAGES");
    languages.forEach((language) => blocks.push(`- ${language}`));
  }
  const additionalSections = Array.isArray(payload?.additionalSections)
    ? payload.additionalSections
    : [];
  additionalSections.forEach((section) => {
    const title = ensureString(section?.title);
    const items = ensureStringArray(section?.items);
    if (!title || !items.length) return;
    blocks.push(title.toUpperCase());
    items.forEach((item) => blocks.push(`- ${item}`));
  });

  return blocks.join("\n").trim();
};

// Shared JSON schema instruction for every model pass (pass-1, revision,
// preserve). Keeping all passes on the SAME structured shape means their output
// always flows back through resumeSectionsToText, so the deterministic
// formatting (pipe-delimited headers, one language per line, separate education
// location/duration) is never lost to a free-text reformat.
const STRUCTURED_RESUME_SCHEMA_LINES = [
  "Return a SINGLE valid JSON object (no markdown, no code fences, no commentary) with EXACTLY this shape:",
  "{",
  '  "summary": "string",',
  '  "skills": ["Category: item, item, item", "..."],',
  '  "experience": [{ "designation": "string", "company": "string", "location": "string", "duration": "string", "bullets": ["string", "..."] }],',
  '  "projects": [{ "name": "string", "bullets": ["string", "..."] }],',
  '  "education": [{ "qualification": "string", "institution": "string", "location": "string", "duration": "string", "details": ["string"] }],',
  '  "certifications": ["string"],',
  '  "languages": ["string"]',
  "}",
  "Keep designation, company, location, and duration as SEPARATE fields — never concatenate them into one string. Keep each education entry's location and duration in their own fields. List spoken languages ONE per array item — never cram them into a single string or place them in skills. Bullets and details are plain strings with NO leading dash or bullet character. Omit projects/certifications/languages entirely only if the original resume never mentioned them. Do not add any keys beyond those listed.",
];

// ---------------------------------------------------------------------------
// Structured resume object pipeline.
//
// The optimizer keeps the resume as a structured object end-to-end (no text
// round-trip). resumeSectionsToText is only used to derive a plain-text view for
// keyword checks, the analyzer, and downloads. The object is what the frontend
// renders and edits.
// ---------------------------------------------------------------------------

// Canonicalize a raw model object into the exact shape the renderer/editor use.
const normalizeResumeObject = (obj = {}) => {
  const o = obj && typeof obj === "object" ? obj : {};
  return {
    summary: dropDuplicateRoleOpener(ensureString(o.summary)),
    skills: ensureStringArray(o.skills),
    experience: (Array.isArray(o.experience) ? o.experience : [])
      .map((e) => ({
        designation: ensureString(e?.designation || e?.title),
        company: ensureString(e?.company || e?.organization),
        location: ensureString(e?.location),
        duration: ensureString(e?.duration || e?.dates),
        responsibilities: ensureStringArray(e?.responsibilities || e?.bullets),
      }))
      .filter((e) => e.designation || e.company || e.responsibilities.length),
    projects: (Array.isArray(o.projects) ? o.projects : [])
      .map((p) => ({
        name: ensureString(p?.name || p?.title),
        meta: ensureString(p?.meta || p?.tech),
        link: ensureString(p?.link || p?.href || p?.url),
        responsibilities: ensureStringArray(
          p?.responsibilities || p?.bullets || p?.details
        ),
      }))
      .filter((p) => p.name || p.responsibilities.length),
    education: (Array.isArray(o.education) ? o.education : [])
      .map((ed) => ({
        qualification: ensureString(ed?.qualification || ed?.degree),
        institution: ensureString(ed?.institution || ed?.university),
        location: ensureString(ed?.location),
        duration: ensureString(ed?.duration || ed?.dates),
        details: ensureStringArray(ed?.details),
      }))
      .filter((ed) => ed.qualification || ed.institution),
    certifications: ensureStringArray(o.certifications),
    languages: normalizeLanguageList(o.languages).filter(isHumanLanguageEntry),
    additionalSections: (Array.isArray(o.additionalSections) ? o.additionalSections : [])
      .map((section) => ({
        title: ensureString(section?.title),
        items: ensureStringArray(section?.items),
      }))
      .filter((section) => section.title && section.items.length),
  };
};

// Parse a model response (JSON string or already-parsed object) into the
// canonical resume object. Returns null if it cannot be parsed.
const parseModelResumeObject = (raw) => {
  if (raw && typeof raw === "object") return normalizeResumeObject(raw);
  const text = ensureString(raw);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return normalizeResumeObject(parsed);
  } catch {
    // not JSON
  }
  return null;
};

const normCompanyKey = (value) =>
  ensureString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Object-level safety net mirroring reconcileExperienceSection: guarantees every
// factual baseline role survives (the model sometimes merges/drops roles that
// share a title). Optimized bullets are matched back to their role by company.
const reconcileExperienceObjects = (experience = [], baseline = []) => {
  if (baseline.length < 2) {
    // A single real role must still survive. Keep the model's rewritten role;
    // only restore it from the factual baseline if the model dropped it entirely.
    if (baseline.length === 1 && experience.length === 0) {
      const only = baseline[0];
      return [
        {
          designation: ensureString(only.designation),
          company: ensureString(only.company),
          location: ensureString(only.location),
          duration: ensureString(only.duration),
          responsibilities: ensureStringArray(only.bullets),
        },
      ];
    }
    return experience;
  }
  const present = (company) => {
    const key = normCompanyKey(company);
    if (!key) return false;
    return experience.some((e) => {
      const ek = normCompanyKey(e.company);
      return ek && (ek.includes(key) || key.includes(ek));
    });
  };
  const allPresent = baseline.every((b) => present(b.company));
  if (allPresent && experience.length >= baseline.length) return experience;

  return baseline.map((b) => {
    const bKey = normCompanyKey(b.company);
    const match = experience.find((e) => {
      const ek = normCompanyKey(e.company);
      return ek && bKey && (ek.includes(bKey) || bKey.includes(ek));
    });
    return {
      designation: ensureString(b.designation) || ensureString(match?.designation),
      company: ensureString(b.company),
      location: ensureString(b.location) || ensureString(match?.location),
      duration: ensureString(b.duration) || ensureString(match?.duration),
      responsibilities:
        match && match.responsibilities.length
          ? match.responsibilities
          : ensureStringArray(b.bullets),
    };
  });
};

// Safety net: a role must never be hollowed out. If the model kept a role but
// stripped its bullets (e.g. because it read as off-target for the JD), restore
// that role's original bullets from the factual baseline. Roles are matched by
// company; the goal is to modify/re-angle experience, never to gut it.
const backfillEmptyRoleBullets = (experience = [], baseline = []) =>
  (Array.isArray(experience) ? experience : []).map((entry) => {
    if (ensureStringArray(entry?.responsibilities).length) return entry;
    const key = normCompanyKey(entry?.company);
    if (!key) return entry;
    const match = baseline.find((b) => {
      const bk = normCompanyKey(b.company);
      return bk && (bk.includes(key) || key.includes(bk));
    });
    const baselineBullets = ensureStringArray(match?.bullets);
    return baselineBullets.length
      ? { ...entry, responsibilities: baselineBullets }
      : entry;
  });

// Backstop: drop "experience" entries that are actually education, skills, or
// other non-job content the model may have mis-placed. Identity checks against
// section labels / degrees, plus an education-grade heuristic (institution +
// CGPA/class bullets) catch the common cases without removing real jobs.
const INSTITUTION_RE = /\b(university|college|institute|school|polytechnic|academy|seminary)\b/i;
const EDU_GRADE_RE = /\b(cgpa|gpa|first\s+class|second\s+class|distinction|percentage|\d+%|grade|marks?)\b/i;
const dropNonJobExperience = (experience = []) =>
  (Array.isArray(experience) ? experience : []).filter((entry) => {
    const company = ensureString(entry?.company);
    const designation = ensureString(entry?.designation);
    if (
      NON_EXPERIENCE_LABEL_RE.test(company) ||
      NON_EXPERIENCE_LABEL_RE.test(designation) ||
      DEGREE_LABEL_RE.test(company) ||
      DEGREE_LABEL_RE.test(designation)
    ) {
      return false;
    }
    // Education-as-a-job: an institution with mostly grade/CGPA "bullets".
    const bullets = ensureStringArray(entry?.responsibilities);
    const isInstitution = INSTITUTION_RE.test(company) || INSTITUTION_RE.test(designation);
    if (isInstitution && bullets.length) {
      const gradeLike = bullets.filter((b) => EDU_GRADE_RE.test(b)).length;
      if (gradeLike >= Math.ceil(bullets.length / 2)) return false;
    }
    return true;
  });

// Backstop: drop experience entries the model fabricated from the resume's
// HEADLINE (the job-title line under the candidate's name, e.g. "Freelance
// Front-End Developer") rather than from the work-history section. These show
// up with a placeholder company ("None", "N/A") because no employer exists.
const PLACEHOLDER_COMPANY_RE =
  /^(none|n\/?a|nil|unknown|not\s+(?:applicable|specified|available)|-+|—+)$/i;
const dropFabricatedExperience = (experience = [], resumeText = "") => {
  const headlineLines = ensureString(resumeText)
    .split("\n")
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .slice(0, 5);
  return (Array.isArray(experience) ? experience : []).filter((entry) => {
    const company = ensureString(entry?.company);
    if (company && !PLACEHOLDER_COMPANY_RE.test(company)) return true;
    // No real employer: keep only if it still looks like a genuine role —
    // it has bullets AND its title wasn't lifted from the resume headline.
    const bullets = ensureStringArray(entry?.responsibilities);
    if (!bullets.length) return false;
    const designation = normalizeText(ensureString(entry?.designation));
    if (designation && headlineLines.includes(designation)) return false;
    return true;
  });
};

// Shaped like "City, Region" — alpha words split by one or two commas. Kept
// strict so skill lists ("PHP, Laravel, MySQL, REST APIs") don't slip in.
const LOCATION_SHAPE_RE = /^[A-Za-z][A-Za-z .'()-]*,\s*[A-Za-z][A-Za-z .'()-]*(,\s*[A-Za-z][A-Za-z .'()-]*)?$/;
const TITLE_WORD_RE =
  /\b(engineer|developer|manager|coordinator|teacher|analyst|specialist|assistant|consultant|intern|lead|officer|executive|designer|architect|scientist)\b/i;

const isPlausibleContactLine = (l) => {
  if (!l || /@/.test(l)) return false;
  if (CONTACT_LABEL_LINE_RE.test(l)) return false; // bare heading like "CONTACT"
  if (BULLET_LINE_RE.test(l) || l.length > 60) return false; // body bullet / sentence
  if (/https?:\/\/|www\.|linkedin|github|behance|gitlab|medium|dribbble/i.test(l)) {
    return false;
  }
  const digitCount = (l.match(/\d/g) || []).length;
  if (digitCount >= 7) return false; // looks like a phone number
  return /[a-zA-Z]/.test(l);
};

// Pick the location line out of the raw contact lines (not an email, link, or
// phone number). Falls back to scanning the resume head for a "City, Region"
// line sitting next to the email/phone — many resumes list the location bare,
// so it never qualifies as a contact line by keyword.
// A conversational/greeting line ("Hi, I'm Jake") — comma-shaped like a
// location but never one.
const GREETING_LINE_RE = /^(hi|hello|hey|greetings)\b|\bI['’]?m\b|\bI am\b/i;

const extractContactLocation = (contactLines = [], resumeText = "") => {
  const candidate = (contactLines || []).find((line) =>
    isPlausibleContactLine(ensureString(line))
  );
  if (candidate) return ensureString(candidate);

  const lines = String(resumeText || "")
    .split("\n")
    .map((line) => line.trim())
    .slice(0, 20);
  const anchorIndexes = lines
    .map((line, index) =>
      /@|\+?\d[\d\s().-]{7,}\d/.test(line) ? index : -1
    )
    .filter((index) => index >= 0);

  // Single-row contact headers pack everything together
  // ("email | +1 … | Denver, CO | site.me | linkedin.com/…"). Strip the hard
  // contact tokens from the anchor line itself and look for a "City, Region"
  // fragment in what remains. Runs FIRST: a fragment from the contact row
  // itself is far more reliable than a shape-matched neighboring line.
  for (const anchor of anchorIndexes) {
    const stripped = lines[anchor]
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
      .replace(/(?:https?:\/\/|www\.)\S+/gi, " ")
      .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/\S*)?/gi, " ") // bare domains/links
      .replace(/\+?\d[\d\s().-]{7,}\d/g, " ");
    const fragment = stripped.match(
      /[A-Z][A-Za-z.'-]*(?: [A-Z][A-Za-z.'-]*)*,\s*[A-Z][A-Za-z.'-]*(?: [A-Z][A-Za-z.'-]*)*/
    );
    if (
      fragment &&
      fragment[0].length <= 60 &&
      !TITLE_WORD_RE.test(fragment[0]) &&
      !GREETING_LINE_RE.test(fragment[0])
    ) {
      return ensureString(fragment[0]);
    }
  }

  // Fallback: a bare "City, Region" line sitting next to the email/phone.
  const fallback = lines.find((line, index) => {
    if (!anchorIndexes.some((anchor) => Math.abs(anchor - index) <= 2)) return false;
    if (line.length > 60 || TITLE_WORD_RE.test(line)) return false;
    if (GREETING_LINE_RE.test(line)) return false;
    return LOCATION_SHAPE_RE.test(line) && isPlausibleContactLine(line);
  });
  return fallback ? ensureString(fallback) : "";
};

// --- Anti-fabrication grounding -------------------------------------------
// A resume must never contain facts the candidate did not provide. We verify
// model-produced factual records (degrees, certifications) against the ORIGINAL
// resume text and drop anything not grounded in it.
const FACT_STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "of", "in", "at", "to", "a", "an", "on",
  "by", "or", "as",
]);
const significantTokens = (text = "") =>
  normalizeText(text)
    .split(/\s+/)
    .filter((w) => w.length > 2 && !FACT_STOPWORDS.has(w));
const buildResumeTokenSet = (resumeText = "") => new Set(significantTokens(resumeText));
// True when at least `minRatio` of the text's significant tokens appear in the
// original resume — i.e. the claim is supported by the source document.
const isGroundedInResume = (text, resumeTokenSet, minRatio = 0.6) => {
  const toks = significantTokens(text);
  if (!toks.length) return true;
  const present = toks.filter((t) => resumeTokenSet.has(t)).length;
  return present / toks.length >= minRatio;
};
// Keep only education entries grounded in the resume. Identity is the
// institution when present, else the qualification — this removes invented
// degrees while preserving the candidate's real ones.
const dropFabricatedEducation = (education = [], resumeTokenSet) =>
  (Array.isArray(education) ? education : []).filter((entry) => {
    const identifier =
      ensureString(entry?.institution) || ensureString(entry?.qualification);
    if (!identifier) return false;
    return isGroundedInResume(identifier, resumeTokenSet);
  });
// Keep only certifications grounded in the resume.
const dropFabricatedCertifications = (certifications = [], resumeTokenSet) =>
  ensureStringArray(certifications).filter((cert) =>
    isGroundedInResume(cert, resumeTokenSet)
  );

// Run the allowed-character sanitizer over every string field of the object so
// smart punctuation / stray glyphs never reach the renderer or downloads.
const sanitizeResumeObject = (data = {}) => {
  const s = (v) => sanitizeAllowedCharacters(ensureString(v));
  const sArr = (arr) => ensureStringArray(arr).map(s).filter(Boolean);
  return {
    summary: s(data.summary),
    skills: sArr(data.skills),
    experience: (data.experience || []).map((e) => ({
      designation: s(e.designation),
      company: s(e.company),
      location: s(e.location),
      duration: s(e.duration),
      responsibilities: sArr(e.responsibilities),
    })),
    projects: (data.projects || []).map((p) => ({
      name: s(p.name),
      meta: s(p.meta),
      link: ensureString(p.link),
      responsibilities: sArr(p.responsibilities),
    })),
    education: (data.education || []).map((ed) => ({
      qualification: s(ed.qualification),
      institution: s(ed.institution),
      location: s(ed.location),
      duration: s(ed.duration),
      details: sArr(ed.details),
    })),
    certifications: sArr(data.certifications),
    languages: sArr(data.languages),
    contact: data.contact
      ? {
          email: s(data.contact.email),
          phone: s(data.contact.phone),
          location: s(data.contact.location),
          links: (Array.isArray(data.contact.links) ? data.contact.links : [])
            .map((l) => ({
              url: ensureString(l?.url),
              ...(l?.label ? { label: s(l.label) } : {}),
            }))
            .filter((l) => l.url),
        }
      : undefined,
  };
};

// Derive the plain-text resume view (contact header + sections) used for keyword
// coverage, the analyzer, and downloads. The structured object stays the source
// of truth; this is a one-way projection.
const resumeObjectToText = (data = {}) => {
  const contact = data.contact || {};
  const contactLines = [
    ensureString(contact.email),
    ensureString(contact.phone),
    ensureString(contact.location),
    ...(Array.isArray(contact.links) ? contact.links : []).map((l) =>
      ensureString(l?.url)
    ),
  ].filter(Boolean);
  const body = resumeSectionsToText(data);
  return [contactLines.join(" | "), body].filter(Boolean).join("\n\n").trim();
};

// Section keywords in priority order (first match wins). Resume headers vary a
// lot in the wild ("Professional Experience & Internship", "Career Objective",
// "Key Interests & Areas of Expertise"), so we match on the keyword rather than
// the whole line — but only on lines that pass the heading-shape guard below,
// so body sentences that merely contain a keyword are not treated as headers.
const SECTION_HEADER_KEYWORDS = [
  ["summary", /\b(summary|profile|objective|about(\s+me)?)\b/i],
  ["experience", /\b(experience|employment|internships?|work(\s+(history|information))?|career(\s+history)?)\b/i],
  ["interests", /\b(interests?|hobbies|activities|areas?\s+of\s+expertise)\b/i],
  ["projects", /\bprojects?\b/i],
  ["education", /\b(education|academics?|academic\s+background|qualifications?|studies)\b/i],
  [
    "certifications",
    /\b(certifications?|certificates?|licen[sc]es?|courses?|trainings?|workshops?)\b/i,
  ],
  ["languages", /\b(languages?|language\s+competenc(?:y|ies))\b/i],
  ["skills", /\b(skills?|competenc(?:y|ies)|proficienc(?:y|ies)|expertise|tools?)\b/i],
  ["contact", /\b(contact(\s+(details|information|info))?|get\s+in\s+touch)\b/i],
];

// True when a line LOOKS like a section header: short, no sentence-ending
// punctuation, no commas/list separators, and Title/UPPER-cased when it runs
// longer than 4 words. This is what makes keyword matching safe against prose
// like "Gained hands-on experience in patient care".
const looksLikeHeading = (rawLine = "") => {
  const line = ensureString(rawLine);
  if (!line || /^[-*•]/.test(line) || /,/.test(line)) return false;
  const clean = line.replace(/[\s:]+$/, "").trim();
  if (!clean || clean.length > 64) return false;
  if (/[.!?]$/.test(clean)) return false;
  const words = clean.split(/\s+/);
  if (words.length > 6) return false;
  if (words.length > 4) {
    const significant = words.filter((w) => w.replace(/[^A-Za-z]/g, "").length >= 3);
    if (!significant.every((w) => /^[A-Z0-9]/.test(w))) return false;
  }
  return true;
};

const detectSectionHeader = (line = "") => {
  if (!looksLikeHeading(line)) return null;
  const clean = ensureString(line).replace(/[\s:]+$/, "").trim();
  for (const [key, pattern] of SECTION_HEADER_KEYWORDS) {
    if (pattern.test(clean)) return key;
  }
  return null;
};

const extractSectionsFromText = (text = "") => {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sections = {};
  let current = "";

  for (const line of lines) {
    const key = detectSectionHeader(line);
    if (key) {
      current = key;
      if (!sections[current]) sections[current] = [];
      continue;
    }
    if (current) {
      sections[current].push(line);
    }
  }
  return sections;
};

// A single date token: optional month name, optional "MM/" or "M." prefix,
// then a 4-digit year. Covers "2023", "12/2023", "Jan 2023", "January 2023".
const DURATION_DATE_TOKEN =
  "(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s+)?(?:\\d{1,2}[\\/.]\\s*)?\\d{4}";
// A full range: "<date> - <date|present>". Handles "12/2023 - Present",
// "02/2022 - 04/2023", "2019 - 2023", "Jan 2020 - Mar 2021".
const DURATION_RANGE_PATTERN = new RegExp(
  `(${DURATION_DATE_TOKEN}\\s*[-–—]\\s*(?:present|current|ongoing|${DURATION_DATE_TOKEN}))`,
  "i"
);
const DURATION_RANGE_TAIL_PATTERN = new RegExp(
  `(${DURATION_DATE_TOKEN}\\s*[-–—]\\s*(?:present|current|ongoing|${DURATION_DATE_TOKEN}))$`,
  "i"
);

const parseExperienceFromRawResume = (resumeText = "") => {
  const lines = resumeText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const entries = [];
  let current = null;

  const durationRangeRegex = DURATION_RANGE_PATTERN;

  const flush = () => {
    if (current) entries.push(current);
    current = null;
  };

  for (const line of lines) {
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    if (bullet && current) {
      current.bullets.push(ensureString(bullet[1]));
      continue;
    }

    // A standalone accolade-section heading ("Selected Product Wins") ends the
    // current entry — its list items are not experience bullets.
    if (
      looksLikeHeading(line) &&
      isHeadingCased(line) &&
      ADDITIONAL_SECTION_TITLE_RE.test(line)
    ) {
      flush();
      continue;
    }

    // Format: "Designation Duration" ("Group Product Manager 2024 – Present"),
    // with "Company — Location" on the following line.
    const durationTail = line.match(DURATION_RANGE_TAIL_PATTERN);
    if (durationTail && !line.includes("|") && !/^[a-z]/.test(line)) {
      const prefix = ensureString(line.slice(0, durationTail.index))
        .replace(/[,—–|-]\s*$/, "")
        .trim();
      if (prefix && TITLE_WORD_RE.test(prefix) && !/[.?!]$/.test(prefix)) {
        flush();
        current = {
          company: "",
          designation: prefix,
          location: "",
          duration: ensureString(durationTail[1]),
          bullets: [],
        };
        continue;
      }
    }

    // Format: "Location | Duration" — the metadata line under a
    // "Designation — Company" header (handled below). Must run BEFORE the
    // "Designation | Company" branch, which would otherwise turn the location
    // into a designation and the date range into a company.
    if (current && !current.duration && line.includes("|") && durationRangeRegex.test(line)) {
      const [leftRaw, rightRaw] = line.split("|");
      const left = ensureString(leftRaw);
      const right = ensureString(rightRaw);
      const leftLooksLikeLocation =
        /^(remote|hybrid|on-?site)$/i.test(left) ||
        /^[A-Za-z][A-Za-z .'-]*(,\s*[A-Za-z][A-Za-z .'-]*)+$/.test(left);
      if (leftLooksLikeLocation && durationRangeRegex.test(right)) {
        if (!current.location) current.location = left;
        current.duration = right;
        continue;
      }
    }

    // Em/en-dash header line. Two shapes share it:
    //   "Designation — Company"  (new entry; location/duration follow)
    //   "Company — Location"     (metadata for the "Designation Duration"
    //                             entry begun on the previous line)
    const dashHeader = line.match(/^(.{2,80}?)\s+[—–]\s+(.{2,80})$/);
    if (
      dashHeader &&
      !durationRangeRegex.test(line) &&
      !/[.?!]$/.test(line) &&
      /^[A-Z0-9]/.test(line) &&
      !/\b(implemented|improved|designed|developed|built|created|led|worked|enhanced)\b/i.test(line)
    ) {
      const left = ensureString(dashHeader[1]);
      const right = ensureString(dashHeader[2]);
      const rightIsLocation =
        /^(remote|hybrid|on-?site)$/i.test(right) || LOCATION_SHAPE_RE.test(right);
      if (current && current.designation && !current.company && rightIsLocation) {
        current.company = left;
        if (!current.location) current.location = right;
        continue;
      }
      flush();
      current = {
        company: right,
        designation: left,
        location: "",
        duration: "",
        bullets: [],
      };
      continue;
    }

    // Format: Designation | Company - Location Duration
    if (line.includes("|") && durationRangeRegex.test(line)) {
      flush();
      const [designationPart, rightRaw] = line.split("|");
      const right = ensureString(rightRaw);
      const rightParts = right.split(" - ");
      const company = ensureString(rightParts.shift());
      const tail = ensureString(rightParts.join(" - "));
      const { location, duration } = extractDurationFromTail(tail);
      current = {
        company,
        designation: ensureString(designationPart),
        location,
        duration,
        bullets: [],
      };
      continue;
    }

    // Format: Company - Location Duration (designation comes next line)
    if (line.includes(" - ") && durationRangeRegex.test(line) && !/[.?!]$/.test(line)) {
      flush();
      const [companyPart, ...rest] = line.split(" - ");
      const tail = ensureString(rest.join(" - "));
      const { location, duration } = extractDurationFromTail(tail);
      current = {
        company: ensureString(companyPart),
        designation: "",
        location,
        duration,
        bullets: [],
      };
      continue;
    }

    if (current && !current.designation && line.length < 120 && !line.includes("|")) {
      current.designation = line;
      continue;
    }

    if (current) {
      current.bullets.push(line);
    }
  }

  flush();
  return entries;
};

const extractDurationFromTail = (tail = "") => {
  const value = ensureString(tail);
  if (!value) return { location: "", duration: "" };
  const m = value.match(DURATION_RANGE_TAIL_PATTERN);
  if (!m) return { location: value.trim(), duration: "" };
  const duration = ensureString(m[1]);
  const location = ensureString(
    value.replace(DURATION_RANGE_TAIL_PATTERN, "").replace(/[,-]\s*$/, "")
  );
  return { location, duration };
};

const normalizeCombinedExperienceEntry = (entry = {}) => {
  const normalized = {
    company: ensureString(entry?.company),
    designation: ensureString(entry?.designation),
    location: ensureString(entry?.location),
    duration: ensureString(entry?.duration),
    bullets: ensureStringArray(entry?.bullets),
  };

  if (normalized.company.includes("|")) {
    const [left, right] = normalized.company.split("|").map((part) => part.trim());
    if (left && !normalized.designation) normalized.designation = left;
    if (right) {
      const rightParts = right.split(" - ");
      if (rightParts.length >= 2) {
        normalized.company = ensureString(rightParts.shift() || normalized.company);
        const tail = ensureString(rightParts.join(" - "));
        const { location, duration } = extractDurationFromTail(tail);
        if (!normalized.location && location) normalized.location = location;
        if (!normalized.duration && duration) normalized.duration = duration;
      } else {
        normalized.company = right;
      }
    }
  }

  if (
    normalized.designation &&
    /\b(implemented|improved|designed|developed|built|created|led|worked|enhanced)\b/i.test(
      normalized.designation
    ) &&
    normalized.company.includes("|")
  ) {
    normalized.designation = normalized.company.split("|")[0]?.trim() || normalized.designation;
  }

  return normalized;
};

// A line that is really a different section header, not a job title/company.
const NON_EXPERIENCE_LABEL_RE =
  /^(education|academic\s+background|qualifications?|language\s+competencies|languages?|languages\s+known|skills|technical\s+skills|core\s+skills|key\s+skills|certifications?|certificates?|courses?|licenses?|summary|professional\s+summary|profile|objective|projects?|interests|hobbies|references?|awards?|achievements?)\b/i;
// An academic degree — should never be an employer or job title. "associate"
// and "master" need degree context: "Associate Product Manager" and
// "Scrum Master" are job titles, not degrees.
const DEGREE_LABEL_RE =
  /\b(bachelor|master(?:'?s)?\s+(?:of|in|degree)|associate(?:'?s)?\s+(?:degree|diploma|of\s+[a-z]+)|diploma|ph\.?d|doctorate|mba|m\.?sc|b\.?sc|b\.?tech|m\.?tech|bca|mca|b\.?a|m\.?a|b\.?com|m\.?com|ll\.?b|ll\.?m|bba)\b/i;

// Skills must never duplicate the certifications section. When the model emits
// a "Certifications:"/"Licenses:" category inside skills anyway, remove it and
// move any items the certifications field doesn't already cover.
const CERT_SKILL_CATEGORY_RE =
  /^\s*(certifications?|licen[sc]es?|credentials?)(\s*(&|and)\s*(certifications?|licen[sc]es?|credentials?))?\s*$/i;
const stripCertificationSkills = (skills = [], certifications = []) => {
  const keptSkills = [];
  const movedItems = [];
  for (const line of skills) {
    const match = String(line || "").match(/^([^:]+):\s*(.*)$/);
    if (match && CERT_SKILL_CATEGORY_RE.test(match[1])) {
      match[2]
        .split(/[,;]/)
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => movedItems.push(item));
      continue;
    }
    keptSkills.push(line);
  }
  const mergedCertifications = certifications.slice();
  const existingLower = mergedCertifications.map((cert) => cert.toLowerCase());
  movedItems.forEach((item) => {
    const lower = item.toLowerCase();
    if (!existingLower.some((cert) => cert.includes(lower))) {
      mergedCertifications.push(item);
      existingLower.push(lower);
    }
  });
  return { skills: keptSkills, certifications: mergedCertifications };
};

// Guardrail against skill-category sprawl. The keyword-integration passes tend
// to mint one category per JD keyword ("Distributed computing: Microservices"),
// producing a wall of single-item groups that reads as keyword stuffing. This
// deterministic pass merges same-named categories and collapses any overflow —
// thinnest groups first — into one "Additional Skills" line, so the 3-6
// category target the prompt asks for actually holds.
//
// It is purely a PRESENTATION pass: every skill token is preserved (nothing is
// dropped), so keyword-match scoring is unaffected — the wall of categories
// just becomes fewer lines carrying the same terms.
const MAX_SKILL_CATEGORIES = 6;
const OVERFLOW_SKILL_CATEGORY = "Additional Skills";
// Generic grouping labels ("Backend", "Tools") carry no keyword value on their
// own — only their items do. A non-generic name ("Distributed computing",
// "Security") IS the JD keyword, so it is worth preserving when the group is
// folded. Used to decide whether a folded category contributes its name.
const GENERIC_SKILL_BUCKETS = new Set([
  "skills", "language", "languages", "framework", "frameworks", "library",
  "libraries", "tool", "tools", "tooling", "technology", "technologies", "tech",
  "tech stack", "stack", "cloud", "devops", "database", "databases", "data",
  "backend", "back end", "frontend", "front end", "full stack", "full-stack",
  "testing", "platform", "platforms", "system", "systems", "software", "other",
  "others", "misc", "miscellaneous", "programming languages", "methodologies",
  "concepts", "core", "core skills", "additional skills",
]);

const parseSkillLine = (line) => {
  const raw = String(line || "").trim();
  if (!raw) return null;
  const match = raw.match(/^([^:]+):\s*(.*)$/);
  if (!match) return { category: "Skills", items: [raw] };
  const category = match[1].trim();
  const items = match[2]
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!category || !items.length) return null;
  return { category, items };
};

const dedupeSkillItems = (items = []) => {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
};

// Append user-confirmed keywords to the skills section (into an existing broad
// category if one exists, else a new "Additional Skills" line). Used to
// guarantee that keywords the user vouched for in the picker actually appear.
const appendSelectedSkills = (skills = [], keywords = []) => {
  const list = Array.isArray(skills) ? skills.slice() : [];
  if (!keywords.length) return list;
  const additions = keywords.join(", ");
  const idx = list.findIndex((entry) =>
    /^(additional skills|technical skills|core skills|skills|tools)\s*:/i.test(String(entry))
  );
  if (idx >= 0) {
    list[idx] = `${String(list[idx]).replace(/[\s,]*$/, "")}, ${additions}`;
    return list;
  }
  return [...list, `Additional Skills: ${additions}`];
};

const consolidateSkillCategories = (skills = []) => {
  // Parse + merge categories that share a name (first casing wins).
  const order = [];
  const byKey = new Map();
  for (const line of skills) {
    const parsed = parseSkillLine(line);
    if (!parsed) continue;
    const key = parsed.category.toLowerCase();
    let cat = byKey.get(key);
    if (!cat) {
      cat = { category: parsed.category, items: [] };
      byKey.set(key, cat);
      order.push(cat);
    }
    cat.items.push(...parsed.items);
  }
  const categories = order
    .map((cat) => ({ category: cat.category, items: dedupeSkillItems(cat.items) }))
    .filter((cat) => cat.items.length);

  const toLine = (cat) => `${cat.category}: ${cat.items.join(", ")}`;
  if (categories.length <= MAX_SKILL_CATEGORIES) return categories.map(toLine);

  // Over the cap: keep the richest groups, fold the thinnest. Stable sort by
  // item count so genuine multi-skill groups survive and the one-item
  // JD-keyword groups collapse first.
  const ranked = categories
    .map((cat, index) => ({ ...cat, index }))
    .sort((a, b) => b.items.length - a.items.length || a.index - b.index);
  const kept = ranked.slice(0, MAX_SKILL_CATEGORIES - 1);
  const overflow = ranked.slice(MAX_SKILL_CATEGORIES - 1);

  const overflowItems = [];
  for (const cat of overflow) {
    // Keep every real skill (never dropped — scoring depends on it). Also keep
    // the category name when it is a concept keyword rather than a generic
    // bucket label, so a JD term like "Distributed computing" survives while
    // "Backend" (a mere label) does not crowd out its actual tool.
    overflowItems.push(...cat.items);
    if (!GENERIC_SKILL_BUCKETS.has(cat.category.toLowerCase())) {
      overflowItems.push(cat.category);
    }
  }
  const additional = dedupeSkillItems(overflowItems);

  const result = kept.sort((a, b) => a.index - b.index).map(toLine);
  if (additional.length) {
    result.push(`${OVERFLOW_SKILL_CATEGORY}: ${additional.join(", ")}`);
  }
  return result;
};

// A company/designation that is really a date ("May 2020", "Aug 2022 – Present")
// — the telltale of a misparsed header line. Such entries must never enter the
// factual baseline: reconcileExperienceObjects REPLACES the model's experience
// with the baseline when they disagree, so junk here destroys good output.
const DATE_SHAPED_HEADER_RE = new RegExp(
  `^(?:${DURATION_DATE_TOKEN}(?:\\s*[-–—]\\s*(?:present|current|ongoing|${DURATION_DATE_TOKEN}))?)$`,
  "i"
);

const sanitizeExperienceEntries = (entries = []) => {
  const clean = Array.isArray(entries) ? entries : [];
  const seen = new Set();

  const cleaned = clean
    .map((item) => normalizeCombinedExperienceEntry(item))
    .map((item) => ({
      company: ensureString(item.company).replace(/[.?!]\s*$/, ""),
      designation: ensureString(item.designation).replace(/[.?!]\s*$/, ""),
      location: ensureString(item.location),
      duration: ensureString(item.duration),
      bullets: ensureStringArray(item.bullets).filter(
        (bullet) =>
          bullet &&
          !/^(company|designation|location|duration)\s*:/i.test(bullet) &&
          !/^profile\s+links\s*:/i.test(bullet) &&
          bullet.length > 3
      ),
    }))
    .filter((item) => {
      const combined = `${item.company} ${item.designation}`.trim();
      const hasSentenceAsHeader =
        /[.?!]$/.test(item.company) ||
        /[.?!]$/.test(item.designation) ||
        /\b(implemented|improved|designed|developed|built|created|led|worked|enhanced)\b/i.test(
          combined
        );
      // Reject entries whose company/designation is actually a different section
      // header (EDUCATION, LANGUAGE COMPETENCIES, ...) or an academic degree —
      // these slip in when a parser bleeds past the experience section.
      const looksLikeOtherSection =
        NON_EXPERIENCE_LABEL_RE.test(item.company) ||
        NON_EXPERIENCE_LABEL_RE.test(item.designation) ||
        DEGREE_LABEL_RE.test(item.company) ||
        DEGREE_LABEL_RE.test(item.designation);
      if (looksLikeOtherSection) return false;
      // Date-shaped or location-shaped header fields mean the parser latched
      // onto a metadata line, not a real "title @ employer" pair.
      if (
        DATE_SHAPED_HEADER_RE.test(item.company) ||
        DATE_SHAPED_HEADER_RE.test(item.designation) ||
        (LOCATION_SHAPE_RE.test(item.designation) && !TITLE_WORD_RE.test(item.designation)) ||
        (LOCATION_SHAPE_RE.test(item.company) && !TITLE_WORD_RE.test(item.designation))
      ) {
        return false;
      }
      const looksLikeRealRole =
        item.company.length > 1 &&
        item.designation.length > 1 &&
        (item.duration.length > 0 || item.location.length > 0 || item.bullets.length > 0);
      if (!looksLikeRealRole) return false;
      if (hasSentenceAsHeader) return false;

      const key = `${normalizeText(item.company)}::${normalizeText(item.designation)}::${normalizeText(
        item.duration
      )}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return cleaned;
};

const parseEducationFromSection = (sectionLines = []) => {
  const entries = [];
  let current = null;
  const degreeRegex =
    /\b(bachelor|master|b\.?\s?tech|m\.?\s?tech|b\.?\s?e|m\.?\s?e|bsc|msc|bca|mca|diploma|phd|doctorate|associate)\b/i;
  const institutionRegex = /\b(university|college|school|institute|academy)\b/i;
  const durationRegex =
    /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}\s*[-–]\s*(?:present|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4})|\b\d{4}\s*[-–]\s*(?:present|\d{4})|\b(19|20)\d{2}\b)/i;

  const flush = () => {
    if (current) entries.push(current);
    current = null;
  };

  for (const raw of sectionLines) {
    const line = ensureString(raw.replace(/^[-*•]\s*/, ""));
    if (!line) continue;

    if (degreeRegex.test(line)) {
      flush();
      current = { qualification: line, institution: "", duration: "", details: [] };
      continue;
    }

    if (current && !current.institution && institutionRegex.test(line)) {
      current.institution = line;
      continue;
    }

    if (current && !current.duration && durationRegex.test(line)) {
      current.duration = line;
      continue;
    }

    if (current) {
      current.details.push(line);
    }
  }

  flush();
  return entries;
};

// Sections with no dedicated schema slot — awards, publications, speaking,
// volunteering, interests, memberships… Parsed deterministically from the
// original resume so they can be preserved verbatim in the output. The model
// never generates these: factual accolades are not tailoring targets.
const ADDITIONAL_SECTION_TITLE_RE =
  /\b(awards?|honou?rs?|recognition|publications?|talks?|speaking|community|volunteer(?:ing)?|exhibitions?|teaching|professional\s+development|interests?|hobbies|patents?|memberships?|affiliations?|extracurriculars?|clients|wins)\b/i;

// Section headers are Title Case or ALL CAPS ("Speaking & Community",
// "AWARDS"); list items usually aren't ("Community radio", "Various clients").
const HEADING_CONNECTOR_WORDS = new Set(["and", "or", "of", "the", "in", "for", "with", "to", "at", "on", "a", "an"]);
const isHeadingCased = (line = "") => {
  const significant = line
    .split(/\s+/)
    .filter((word) => word.replace(/[^A-Za-z]/g, "").length >= 3)
    .filter((word) => !HEADING_CONNECTOR_WORDS.has(word.toLowerCase()));
  return significant.length > 0 && significant.every((word) => /^[A-Z]/.test(word));
};

const parseAdditionalSections = (resumeText = "") => {
  const lines = String(resumeText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const sections = [];
  let current = null;
  let sectionHasBullets = false;
  for (const line of lines) {
    if (
      looksLikeHeading(line) &&
      isHeadingCased(line) &&
      ADDITIONAL_SECTION_TITLE_RE.test(line) &&
      !/^[-*•·▪◦]/.test(line)
    ) {
      current = { title: line.replace(/[\s:]+$/, "").trim(), items: [] };
      sections.push(current);
      sectionHasBullets = false;
      continue;
    }
    // Any other recognized section header — or a stray education line (degree
    // names bleed into sidebar flows on multi-column PDFs) — ends the section.
    if (detectSectionHeader(line) || DEGREE_LABEL_RE.test(line)) {
      current = null;
      continue;
    }
    if (!current) continue;
    const isBulleted = /^[-*•·▪◦]\s*/.test(line);
    const item = line.replace(/^[-*•·▪◦]\s*/, "").trim();
    if (!item) continue;
    if (isBulleted) sectionHasBullets = true;
    // Continuation detection: in a bulleted section, any non-bulleted line is
    // a wrap of the previous item. In unbulleted sections, fall back to shape
    // signals (starts lowercase/digit/punctuation, or previous item ends
    // mid-phrase with a connector word or comma).
    const prev = current.items[current.items.length - 1] || "";
    const isContinuation =
      !isBulleted &&
      current.items.length > 0 &&
      (sectionHasBullets ||
        /^[a-z0-9(&"'—–-]/.test(item) ||
        /[,&/—–-]$/.test(prev) ||
        /\b(?:and|or|of|the|in|for|with|to|at|on|a|an)$/i.test(prev));
    if (isContinuation) {
      current.items[current.items.length - 1] += ` ${item}`;
    } else {
      current.items.push(item);
    }
  }
  return sections
    .map((section) => ({
      title: section.title,
      items: section.items.filter(Boolean).slice(0, 12),
    }))
    .filter((section) => section.items.length)
    .slice(0, 6);
};

// Flattens the LANGUAGES section of a raw resume into individual language
// entries. Source lines are frequently bullet- or comma-joined on a single line
// (e.g. "• English • Hindi • Malayalam"), so split aggressively.
const parseLanguagesFromSection = (sectionLines = []) =>
  normalizeLanguageList(sectionLines).filter(isHumanLanguageEntry);

// Extracts project entries (name + bullets) from the PROJECTS section of a raw
// resume so the model can be told to preserve them. Project names are heading
// lines (no leading bullet glyph); indented/bulleted lines are scope details.
const parseProjectsFromSection = (sectionLines = []) => {
  const entries = [];
  let current = null;
  const bulletRegex = /^[-*•▪◦·]\s+/;

  const flush = () => {
    if (current && current.name) entries.push(current);
    current = null;
  };

  for (const raw of sectionLines) {
    const line = ensureString(raw);
    if (!line) continue;

    if (bulletRegex.test(line)) {
      const bullet = ensureString(line.replace(bulletRegex, ""));
      if (current && bullet) current.bullets.push(bullet);
      continue;
    }

    // A non-bulleted line starts a new project. Keep only the project name
    // (drop any trailing tech/link descriptor after a separator) for the baseline.
    flush();
    const name = ensureString(line.split(/\s+[|–—]\s+/)[0]);
    current = { name, bullets: [] };
  }

  flush();
  return entries;
};


const generateWithModel = async ({
  apiKey,
  prompt,
  maxTokens = 3500,
  systemPrompt,
  jsonMode = false,
}) => {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.2,
      max_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages: [
        {
          role: "system",
          content:
            systemPrompt ||
            "You are an expert ATS resume writer with deep knowledge of recruiting, applicant tracking systems, and modern hiring practices. Produce truthful, factually grounded resumes and cover letters. Never invent employers, titles, dates, certifications, or accomplishments. Return plain text only - no markdown fences or commentary.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${errorText}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty content.");
  }

  return String(content).trim();
};

export async function POST(req) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        message: "OPENAI_API_KEY is not set.",
      });
    }

    const {
      userId = "",
      resume,
      jd,
      organization = "",
      designation = "",
      missingKeywords = [],
      selectedMissingKeywords = [],
      matchedKeywords = [],
      weightedKeywords = [],
      hasSummary = false,
      analysisSuggestions = [],
      formattingWarnings = [],
      scoreBreakdown = null,
      titleAnalysis = null,
      careerChangeApproved = false,
      resumeRoleFamily = "",
      targetRoleFamily = "",
      includeCoverLetter = true,
      // When true, the user has explicitly chosen (in the pre-optimization
      // modal) which missing keywords they can genuinely back up. Only those
      // are integrated — everything else stays out to preserve no-fabrication.
      keywordSelectionApplied = false,
      // The base resume's structured experience (authoritative field mapping).
      // When present, it is used as the factual baseline instead of re-parsing
      // the resume text — which loses the company/location distinction.
      structuredExperience = [],
    } = await req.json();

    if (!resume || !jd) {
      return NextResponse.json({
        success: false,
        message: "Resume and job description are required.",
      });
    }

    let shouldGenerateCoverLetter = Boolean(includeCoverLetter);
    if (userId) {
      const supabase = getSupabaseAdminClient();
      const activePlan = await getPlanForUser(supabase, userId);
      if (activePlan) {
        if (!activePlan.allowsCoverLetter) {
          shouldGenerateCoverLetter = false;
        }
      } else {
        // Free-trial users may optimize the result of a scan they already spent
        // a free trial on — including a cover letter, so the trial covers every
        // feature. Once the trial is fully exhausted, ask them to subscribe.
        const freeTrialUsed = await countFreeTrialScans(supabase, userId);
        if (freeTrialUsed < 1 || freeTrialUsed > FREE_TRIAL_SCAN_LIMIT) {
          return NextResponse.json({
            success: false,
            message: "Please subscribe to a plan to optimize your resume.",
          });
        }
      }
    }

    const safeMissing = Array.isArray(missingKeywords)
      ? missingKeywords.filter(Boolean).slice(0, 50)
      : [];
    const safeSelectedMissing = Array.isArray(selectedMissingKeywords)
      ? selectedMissingKeywords.filter(Boolean).slice(0, 50)
      : [];
    const hasExplicitCareerSelection = Array.isArray(selectedMissingKeywords);
    const selectedFromMissing = safeSelectedMissing.filter((keyword) =>
      safeMissing.includes(keyword)
    );
    const safeMatched = Array.isArray(matchedKeywords)
      ? matchedKeywords.filter(Boolean).slice(0, 25)
      : [];
    const safeSuggestions = Array.isArray(analysisSuggestions)
      ? analysisSuggestions.filter(Boolean).slice(0, 12)
      : [];
    const safeFormattingWarnings = Array.isArray(formattingWarnings)
      ? formattingWarnings.filter(Boolean).slice(0, 8)
      : [];
    const safeScoreBreakdown =
      scoreBreakdown && typeof scoreBreakdown === "object" ? scoreBreakdown : {};
    const safeTitleAnalysis =
      titleAnalysis && typeof titleAnalysis === "object" ? titleAnalysis : {};
    const candidateName = extractCandidateName(resume);
    const candidateEmail = extractCandidateEmail(resume);
    const candidatePhone = extractCandidatePhone(resume);
    const sourceLinks = extractProfileLinksOnly(resume);
    const sourceContactLines = extractContactLines(resume);
    // The set of keywords the model is instructed to weave in. When the user
    // has vouched for specific keywords in the pre-optimization modal, integrate
    // ONLY those (may be empty). Otherwise fall back to the prior behavior.
    const keywordsForIntegration = keywordSelectionApplied
      ? selectedFromMissing
      : careerChangeApproved
      ? hasExplicitCareerSelection
        ? selectedFromMissing
        : filterMissingByHandsOnEvidence(safeMissing, resume)
      : safeMissing;
    // Language-fluency keywords never go to Skills or bullets — they belong in
    // the LANGUAGES section, injected deterministically after the model pass.
    // So keep them OUT of the set the model weaves into skills/experience.
    const missingForCareerChange = keywordsForIntegration.filter(
      (keyword) => !isLanguageKeyword(keyword)
    );
    const selectedLanguageNames = languageNamesFromKeywords(
      keywordsForIntegration.filter((keyword) => isLanguageKeyword(keyword))
    );
    const originalTitles = extractLikelyTitles(resume);
    const originalOrganizations = extractLikelyOrganizations(resume);
    const roleTransition =
      careerChangeApproved && resumeRoleFamily && targetRoleFamily
        ? `${resumeRoleFamily} -> ${targetRoleFamily}`
        : "No";
    // Parse experience ONLY from the experience section. Walking the whole
    // resume lets the parser bleed into EDUCATION / LANGUAGE COMPETENCIES /
    // "Profile Links:" and fabricate junk roles (e.g. designation
    // "LANGUAGE COMPETENCIES", company "Master of Science"). Falls back to the
    // whole resume when no experience header is detected.
    const experienceSectionText = (extractSectionsFromText(resume).experience || []).join(
      "\n"
    );
    // Prefer the structured experience from the base resume (exact field
    // mapping). Only fall back to text-parsing when it isn't supplied (guest
    // scans, or a base resume with no experience entries).
    const structuredBaseline = (Array.isArray(structuredExperience) ? structuredExperience : [])
      .map((entry) => ({
        designation: ensureString(entry?.designation),
        company: ensureString(entry?.company),
        location: ensureString(entry?.location),
        duration: ensureString(entry?.duration),
        bullets: ensureStringArray(entry?.responsibilities || entry?.bullets),
      }))
      .filter((entry) => entry.designation || entry.company || entry.bullets.length);
    const factualExperienceBaseline = structuredBaseline.length
      ? sanitizeExperienceEntries(structuredBaseline)
      : sanitizeExperienceEntries(
          parseExperienceFromRawResume(experienceSectionText || resume)
        );
    const factualEducationBaseline = parseEducationFromSection(
      extractSectionsFromText(resume).education || resume.split("\n")
    ).slice(0, 8);
    const factualProjectsBaseline = parseProjectsFromSection(
      extractSectionsFromText(resume).projects || []
    ).slice(0, 8);
    const hasProjectsSection = factualProjectsBaseline.length > 0;
    const factualLanguagesBaseline = parseLanguagesFromSection(
      extractSectionsFromText(resume).languages || []
    ).slice(0, 12);
    const hasLanguagesSection = factualLanguagesBaseline.length > 0;
    const additionalSectionsBaseline = parseAdditionalSections(resume);

    const safeWeightedKeywords = Array.isArray(weightedKeywords) ? weightedKeywords : [];
    const matchedKeywordSet = new Set(safeMatched.map((k) => k.toLowerCase()));
    // Summary must only reference skills the candidate already has — never inject missing keywords.
    // Use the highest-weight matched keywords as the hint so the summary stays honest.
    const highPriorityMatchedKeywords = safeWeightedKeywords
      .filter((k) => matchedKeywordSet.has(k.keyword.toLowerCase()))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map((k) => k.keyword);
    const summaryKeywordHint = highPriorityMatchedKeywords.length
      ? highPriorityMatchedKeywords.join(", ")
      : safeMatched.slice(0, 3).join(", ") || "none";

    const resumePrompt = [
      "You are an expert ATS-focused resume writer specializing in highly relevant, role-targeted resumes.",
      "Rewrite the candidate's resume to maximize ATS match against the target role while remaining 100% truthful.",
      "",
      "OUTPUT FORMAT: Return a SINGLE valid JSON object (no markdown, no code fences, no commentary) with EXACTLY this shape:",
      "{",
      '  "summary": "string",',
      '  "skills": ["Category: item, item, item", "..."],',
      '  "experience": [{ "designation": "string", "company": "string", "location": "string", "duration": "string", "bullets": ["string", "..."] }],',
      '  "projects": [{ "name": "string", "bullets": ["string", "..."] }],',
      '  "education": [{ "qualification": "string", "institution": "string", "location": "string", "duration": "string", "details": ["string"] }],',
      '  "certifications": ["string"],',
      '  "languages": ["string"]',
      "}",
      "Keep designation, company, location, and duration as SEPARATE fields — never concatenate them into one string. Bullets and details are plain strings with NO leading dash or bullet character. Omit projects/certifications/languages entirely if the original resume doesn't mention them. Do not add any keys beyond those listed.",
      "",
      "PER-SECTION RULES:",
      hasSummary
        ? `1. summary (REWRITE MODE): A summary already exists — rewrite it to target the role more precisely. Keep the candidate's voice and factual experience level. 3-4 sentences, 60-80 words. Open with seniority + domain (e.g. "Senior Backend Engineer with 6 years..."). REWRITE means REPLACE: produce one cohesive paragraph with EXACTLY ONE role-title opening sentence — never keep the original summary's opening sentence and then add a second "Title with N years..." opener after it; fold the original's facts (employers, achievements) into the new sentences instead. Reference only skills and experience already present in the resume; these confirmed keywords may be highlighted: ${summaryKeywordHint}. Rules: NEVER mention a skill, tool, or technology that is not evidenced in the original resume; no "I" statements; no hollow filler ("results-driven", "passionate", "go-getter", "dynamic") unless tied to a specific fact.`
        : `1. summary (GENERATE MODE): No summary exists — write one from scratch using ONLY facts already present in the resume. 3-4 sentences, 60-80 words. Structure: (a) open with seniority + domain ("Senior X Engineer with N years of experience in..."), (b) highlight 2-3 skills that are confirmed in the resume AND relevant to the target role, (c) close with a concise value statement. These confirmed keywords may be used: ${summaryKeywordHint}. Rules: NEVER claim a skill, tool, certification, or experience that is not in the original resume — not even to match the JD; no "I" statements; no generic filler.`,
      "2. skills: An array of 3-6 strings (NEVER more than 6), each a logical category formatted as 'Category: item, item, item'. Choose categories that fit THIS candidate's profession — do not assume software/engineering. Examples by field: software → Languages, Frameworks, Tools, Cloud; marketing → Channels, Analytics, Tools, Content; nursing/healthcare → Clinical Skills, Systems/EMR, Patient Care, Communication; finance → Accounting, Analysis, Software, Compliance; design → Design, Prototyping, Tools, Research. NEVER use a 'Certifications' or 'Licenses' category in skills — certifications have their own dedicated field and must not be duplicated here. List ONLY concrete, named hard skills, tools, and technologies here (e.g. React, GraphQL, Docker, Jest) — each category should hold 3-8 such items. DO NOT create a catch-all bucket named 'Concepts', 'Additional', 'Additional Skills', 'Other', or 'Miscellaneous', and DO NOT stuff a long list of job-description phrases into skills. A keyword belongs in skills ONLY if it is a real, named tool / technology / hard skill the candidate actually uses. Concept, practice, methodology, quality, domain, or ways-of-working keywords (e.g. 'user-centric design', 'high-traffic systems', 'code review', 'documentation', 'system design', 'progressive enhancement', 'cross-functional collaboration', 'consumer-facing products') must NOT be listed as skills — instead weave them into the SUMMARY or the single most relevant EXPERIENCE / PROJECT bullet. Do NOT include vague filler or buzzwords (e.g. 'Product Mindset', 'Ownership Mindset', 'Problem-Solving Skills', 'Analytical Thinking', 'Fast-Paced Environments', 'Attention to Detail', 'Team Player') and never a phrase like '1 to 3 years experience'; genuine, named soft skills (Leadership, Communication, Teamwork, Time Management) are allowed sparingly. Avoid near-duplicates (e.g. 'Git' and 'Git workflows').",
      "3. experience: An array of role objects — ONLY real jobs, internships, or volunteer positions belong here. KEEP EVERY role from the work-history section — never drop, merge, or hollow out a role because it looks unrelated to the target job. When a role seems off-target, do NOT remove it: instead RE-ANGLE its bullets to foreground the responsibilities, transferable skills, tools, and outcomes most relevant to the target role and its keywords, while staying 100% truthful to what the candidate actually did. Every role must keep a substantive set of bullets (3-6), never be reduced to an empty or near-empty entry. Include ONLY roles listed in the resume's work-history section: the headline/job-title line under the candidate's name (e.g. 'Freelance Front-End Developer') is a title, NOT a job entry — never turn it into one. Never output placeholder company values like 'None' or 'N/A'; use an empty string only for a real listed role whose employer is genuinely absent. NEVER place education/degrees, skills, languages, certifications, or interests in the experience array (they have their own fields). Fill designation, company, location, and duration as separate fields (leave a field as an empty string only if truly unknown). Each bullet starts with a strong action verb. QUANTIFICATION (critical): surface EVERY number, %, $, duration, volume, frequency, team size, or scale already present anywhere in the resume and LEAD the bullet with it. If the resume states a concrete fact that can be expressed as a figure (e.g. 'reduced load time from 5s to 2s' → 'cut load time 60%', 'handled tickets for 3 teams' → 'supported 3 teams'), express it as a metric — but ONLY when the resume literally supports the number. KEYWORD WEAVING: for each missing keyword that genuinely relates to a role's real work, integrate it INTO an existing bullet by rewording that bullet so the keyword reads naturally in context — never tack it on as a tag or a parenthetical list, and never add a new bare bullet that just names a keyword. Spread keywords across the DIFFERENT roles (put each where it fits best) rather than clustering many into one role. If the original resume states a metric, preserve it verbatim. NEVER invent, estimate, or inflate a number, percentage, employer, name, or claim the resume does not support.",
      hasProjectsSection
        ? "4. projects: The original resume HAS a projects section, so the output JSON MUST include a non-empty projects array containing EVERY original project (match the baseline above). Each project object has a clear name and 1-3 bullets describing scope and impact. Weave any missing keyword that genuinely relates to a project INTO that project's bullets by rewording them naturally — never as an appended tag, and only where the project truly used it. Never drop a project to save space."
        : "4. projects: The original resume has no projects section — omit the projects key entirely. Do not invent projects.",
      "5. education: Output ONLY the education entries that literally appear in the original resume (match the factual education baseline below) — output exactly that many entries, no more. NEVER add, split, duplicate, or invent a degree, institution, or graduation year (e.g. do not add a Bachelor's the candidate never listed). Each object has qualification, institution, location, duration as separate fields, plus optional detail strings for honors/coursework. Put the city/country in the location field — never merge it into institution or duration. Preserve every degree exactly as written.",
      "6. certifications: Array of strings, each 'Cert name — Issuer (year if known)'. Include ONLY certifications that appear in the original resume — never invent a credential. If the original resume includes a verification/credential URL for a certification or course, append it to that string EXACTLY as written (e.g. 'Front-End Web Development with React — Coursera — https://coursera.org/verify/ABC123'). Never invent, guess, or shorten URLs — include one only if it is present in the original resume.",
      "7. languages: Array of spoken/written languages exactly as listed in the original resume, ONE language per array item (format each item like 'Language' or 'Language (Proficiency)'). Copy ONLY languages that literally appear in the original resume — never add a language the candidate did not list, and never infer one from the candidate's name, location, or nationality. Never cram multiple languages into a single string and never bullet-join them. Do NOT place spoken languages in the skills section. Omit the key entirely if the resume lists no languages.",
      keywordSelectionApplied && missingForCareerChange.length
        ? `USER-CONFIRMED SKILLS (MANDATORY): The candidate has personally confirmed they have hands-on experience with EACH of these keywords: ${missingForCareerChange.join(
            ", "
          )}. You MUST include EVERY one of them in the output, placed where it is MOST contextually relevant (see KEYWORD DISTRIBUTION) — a named tool/technology in a skills category, everything else woven into the summary or the most relevant experience/project bullet. The candidate's confirmation IS the evidence, so do NOT omit any as "unrelated" or "unevidenced". You may still NOT fabricate metrics, numbers, employers, dates, or achievements around them — only reflect the skill itself truthfully.`
        : "",
      "KEYWORD DISTRIBUTION (critical): spread the missing keywords EVENLY across the summary, the skills categories, and the experience bullets (and project bullets when a keyword relates to a project) so the whole resume improves — this is the difference between a tailored resume and keyword stuffing. NEVER concentrate many keywords into a single skills category or any catch-all bucket. Place each keyword where it is most contextually relevant: named tools/technologies → a fitting skills category; concepts, practices, qualities, domains, and ways of working → woven naturally into the summary or the single most relevant experience/project bullet. NEVER add keywords to the education or certifications sections.",
      "",
      "HARD CONSTRAINTS (zero tolerance):",
      "- Never invent employers, dates, titles, certifications, degrees, or quantified achievements.",
      "- Preserve every original employer name, job title, dates, education qualification, and certification VERBATIM.",
      "- Preserve all contact info and professional links from the original resume.",
      "- Bullets are plain strings with no leading dash, bullet glyph, emoji, or decorative symbol (the template adds bullet styling).",
      "- Do not include the candidate's name anywhere in the JSON (it will be added by the template).",
      "- Output must be a single valid JSON object only — no markdown fences, no preamble, no commentary.",
      "- Keep total length appropriate to the candidate's experience: <=1 page text equivalent for <5 yrs, <=2 pages for senior.",
      careerChangeApproved
        ? "- CAREER-CHANGE MODE: Include only candidate-approved keywords; emphasize transferable skills truthfully. Never claim experience the candidate does not have."
        : "- Integrate every missing keyword that the candidate plausibly has hands-on experience with.",
      "",
      "QUALITY TARGETS:",
      "- Every bullet should start with an action verb (led, built, designed, optimized, reduced, increased, etc.).",
      "- Aim for at least 60% of EXPERIENCE bullets to include a quantified outcome (%, $, time, scale, users) drawn from or genuinely supported by the resume — prioritize surfacing real numbers over adding more bullets. Do not fabricate figures to hit this target.",
      "- Address each analyzer suggestion and formatting warning below.",
      "",
      `Target organization: ${organization}`,
      `Target designation: ${designation}`,
      `Career-change mode approved: ${careerChangeApproved ? "Yes" : "No"}`,
      `User-approved keywords for career change: ${selectedFromMissing.join(", ") || "None selected"}`,
      `Role transition context: ${roleTransition}`,
      `Already-matched keywords (keep referenced): ${safeMatched.join(", ") || "None"}`,
      `Missing keywords to incorporate: ${missingForCareerChange.join(", ") || "None"}`,
      `Analyzer suggestions: ${safeSuggestions.join(" | ") || "None"}`,
      `ATS formatting warnings to fix: ${safeFormattingWarnings.join(" | ") || "None"}`,
      `Score breakdown to improve: ${JSON.stringify(safeScoreBreakdown)}`,
      `Title analysis: ${JSON.stringify(safeTitleAnalysis)}`,
      `Original titles (preserve exactly): ${originalTitles.join(" | ") || "None"}`,
      `Original organizations (preserve exactly): ${originalOrganizations.join(" | ") || "None"}`,
      `Factual experience baseline (preserve every role; never omit): ${JSON.stringify(factualExperienceBaseline.slice(0, 10))}`,
      `Factual education baseline (preserve every entry): ${JSON.stringify(factualEducationBaseline.slice(0, 8))}`,
      hasLanguagesSection
        ? `Factual languages baseline (the original resume HAS a languages section — you MUST output a non-empty languages array with each of these, one per item; never omit it and never merge them into skills): ${JSON.stringify(factualLanguagesBaseline)}`
        : "Factual languages baseline: None (original resume has no languages section).",
      hasProjectsSection
        ? `Factual projects baseline (the original resume HAS a projects section — you MUST include every one of these projects; never omit the projects section): ${JSON.stringify(factualProjectsBaseline)}`
        : "Factual projects baseline: None (original resume has no projects section).",
      "",
      "Return only the JSON object following the schema above.",
      "",
      "Job Description:",
      jd.slice(0, 7000),
      "",
      "Current Resume:",
      resume.slice(0, 9000),
    ].join("\n");

    const optimizedResumeRaw = await generateWithModel({
      apiKey,
      prompt: resumePrompt,
      maxTokens: 3500,
      jsonMode: true,
    });

    let resumeData = parseModelResumeObject(optimizedResumeRaw);
    if (!resumeData) {
      return NextResponse.json({
        success: false,
        message: "Generated content is incomplete.",
      });
    }

    const uncoveredAfterPass1 = missingForCareerChange.filter(
      (keyword) => !hasKeyword(resumeObjectToText(resumeData), keyword)
    );

    if (uncoveredAfterPass1.length) {
      const revisionPrompt = [
        "Revise the resume below to naturally include EVERY one of the listed keywords without losing truthfulness.",
        "",
        "OUTPUT FORMAT:",
        ...STRUCTURED_RESUME_SCHEMA_LINES,
        "",
        "Integration rules:",
        "- Add a keyword that names a concrete tool/framework/technology to the MOST RELATED existing skills category. Do NOT create a new category per keyword; keep skills to at most 6 categories, each grouping several related items.",
        "- Add a keyword that names a method, practice, or broad concept (e.g. code review, documentation, distributed computing, system design) to an experience bullet where the candidate performed that work; if none fits, include it as an item inside a related skills category. Either way it must appear in the resume — do NOT give it its own standalone category.",
        "- Never fabricate companies, dates, titles, projects, certifications, or numeric outcomes.",
        "- Preserve EVERY experience role, project, education entry, certification, and language already present — do not drop or merge any.",
        "- Every bullet starts with a strong action verb.",
        `Required missing keywords to add: ${uncoveredAfterPass1.join(", ")}`,
        "Return only the JSON object.",
        "",
        "Current optimized resume:",
        resumeObjectToText(resumeData).slice(0, 12000),
      ].join("\n");

      const revised = await generateWithModel({
        apiKey,
        prompt: revisionPrompt,
        maxTokens: 3000,
        jsonMode: true,
      });
      const revisedData = parseModelResumeObject(revised);
      if (revisedData) resumeData = revisedData;
    }

    const draftText = resumeObjectToText(resumeData);
    const missingProtectedTitles = originalTitles.filter(
      (title) => !includesLineLoosely(draftText, title)
    );
    const missingProtectedOrgs = originalOrganizations.filter(
      (org) => !includesLineLoosely(draftText, org)
    );

    if (missingProtectedTitles.length || missingProtectedOrgs.length) {
      const preservePrompt = [
        "Restore the original factual history below into this resume draft.",
        "",
        "OUTPUT FORMAT:",
        ...STRUCTURED_RESUME_SCHEMA_LINES,
        "",
        "Strict rules:",
        "- Do NOT change any other employers, designations, education entries, certifications, or languages already present.",
        "- Restore each missing item exactly as written, in the correct chronological order.",
        "- Retain all keyword improvements from the current draft where they remain truthful.",
        "- Every bullet starts with a strong action verb.",
        `Restore these original titles exactly: ${missingProtectedTitles.join(" | ") || "None"}`,
        `Restore these original organizations exactly: ${missingProtectedOrgs.join(" | ") || "None"}`,
        "Return only the JSON object.",
        "",
        "Current resume draft:",
        draftText.slice(0, 12000),
      ].join("\n");

      const preserved = await generateWithModel({
        apiKey,
        prompt: preservePrompt,
        maxTokens: 3000,
        jsonMode: true,
      });
      const preservedData = parseModelResumeObject(preserved);
      if (preservedData) resumeData = preservedData;
    }

    // Safety net: the model can collapse multiple roles into one (especially
    // when two roles share a title), silently dropping employers. Rebuild the
    // experience list deterministically from the factual baseline so every
    // company survives with its bullets grouped under the right role.
    if (factualExperienceBaseline.length >= 2) {
      resumeData.experience = reconcileExperienceObjects(
        resumeData.experience,
        factualExperienceBaseline
      );
    }
    // Backstop: drop anything that slipped into experience but is really
    // education / skills / interests (mis-placed by the model).
    resumeData.experience = dropFabricatedExperience(
      dropNonJobExperience(resumeData.experience),
      resume
    );
    // Never leave a surviving role without bullets — restore them from the
    // original resume so experience is re-angled to the JD, not gutted.
    if (factualExperienceBaseline.length) {
      resumeData.experience = backfillEmptyRoleBullets(
        resumeData.experience,
        factualExperienceBaseline
      );
    }

    // Safety net: original resume had a projects section but the model dropped
    // it across the passes — re-inject the original projects verbatim.
    if (hasProjectsSection && !resumeData.projects.length) {
      resumeData.projects = factualProjectsBaseline.map((project) => ({
        name: ensureString(project.name),
        meta: "",
        link: "",
        responsibilities: ensureStringArray(project.bullets),
      }));
    }
    // Inverse guard: no projects section in the original resume means NO
    // projects in the output. The model sometimes misfiles stray content here
    // (speaking engagements, community roles) despite being told to omit it.
    if (!hasProjectsSection) {
      resumeData.projects = [];
    }

    // Languages. Two sources are legitimate: (1) languages already in the base
    // resume, and (2) languages the user explicitly vouched for in the keyword
    // picker (JD language requirements they confirmed they meet). Everything
    // else the model may have invented is dropped (anti-fabrication, e.g.
    // seeding "Hindi" for an India-based candidate). A LANGUAGES section is
    // created when the user adds a language and none existed before.
    {
      const allowedLanguageWords = new Set([
        ...factualLanguagesBaseline.flatMap((entry) => languageWordsIn(entry)),
        ...selectedLanguageNames.flatMap((name) => languageWordsIn(name)),
      ]);

      // Start from the base resume's factual languages (preserved verbatim).
      const finalLanguages = factualLanguagesBaseline.slice();

      // Keep only model-emitted languages that are grounded (baseline or user-
      // selected), and not already present.
      resumeData.languages.forEach((entry) => {
        const grounded = languageWordsIn(entry).some((word) =>
          allowedLanguageWords.has(word)
        );
        if (grounded && !finalLanguages.some((existing) => sharesLanguage(existing, entry))) {
          finalLanguages.push(entry);
        }
      });

      // Add the user-vouched JD languages that aren't already listed.
      selectedLanguageNames.forEach((name) => {
        if (!finalLanguages.some((existing) => sharesLanguage(existing, name))) {
          finalLanguages.push(name);
        }
      });

      resumeData.languages = finalLanguages.filter(isHumanLanguageEntry);
    }

    // Additional sections (awards, publications, speaking, volunteering,
    // interests…) have no schema slot for the model. They are attached
    // deterministically from the original resume AFTER all model passes:
    // factual accolades are preserved verbatim, never tailored or invented.
    resumeData.additionalSections = additionalSectionsBaseline.map((section) => ({
      title: section.title,
      items: section.items.slice(),
    }));

    // Certifications listed inside the skills section duplicate the dedicated
    // CERTIFICATIONS section — strip them, moving unlisted items across. Runs
    // before certification grounding so moved items are verified too.
    const certSkillSplit = stripCertificationSkills(
      resumeData.skills,
      resumeData.certifications
    );
    resumeData.skills = certSkillSplit.skills;
    resumeData.certifications = certSkillSplit.certifications;

    // Collapse skill-category sprawl from the keyword passes into the 3-6
    // category target, without dropping the underlying keywords.
    resumeData.skills = consolidateSkillCategories(resumeData.skills);

    // Anti-fabrication: drop any education entry or certification the model
    // invented (not grounded in the original resume). A resume must never claim
    // a degree or credential the candidate did not provide.
    const resumeTokenSet = buildResumeTokenSet(resume);
    resumeData.education = dropFabricatedEducation(resumeData.education, resumeTokenSet);
    resumeData.certifications = dropFabricatedCertifications(
      resumeData.certifications,
      resumeTokenSet
    );

    // Safety net: keep education if the model dropped (or we filtered) it.
    if (!resumeData.education.length && factualEducationBaseline.length) {
      resumeData.education = factualEducationBaseline.map((ed) => ({
        qualification: ensureString(ed.qualification),
        institution: ensureString(ed.institution),
        location: ensureString(ed.location),
        duration: ensureString(ed.duration),
        details: ensureStringArray(ed.details),
      }));
    }

    // Attach deterministic contact info — never model-generated, taken straight
    // from the original resume so it is always accurate.
    resumeData.contact = {
      email: candidateEmail,
      phone: candidatePhone,
      location: extractContactLocation(sourceContactLines, resume),
      links: sourceLinks
        .map((url) => ({ url: ensureString(url) }))
        .filter((l) => l.url),
    };

    resumeData = sanitizeResumeObject(resumeData);

    // Guarantee: keywords the user personally confirmed in the picker must
    // appear. If the model still omitted any, add them to the skills section —
    // the safe, truthful place, since the user vouched for the skill itself.
    // Never adds fabricated metrics or claims.
    if (keywordSelectionApplied && missingForCareerChange.length) {
      const projected = resumeObjectToText(resumeData);
      const stillMissingSelected = missingForCareerChange.filter(
        (keyword) => !hasKeyword(projected, keyword)
      );
      if (stillMissingSelected.length) {
        resumeData.skills = appendSelectedSkills(
          resumeData.skills,
          stillMissingSelected
        );
        resumeData = sanitizeResumeObject(resumeData);
      }
    }

    // One-way plain-text projection for keyword coverage, the analyzer, and
    // downloads. The object remains the source of truth.
    const optimizedResumeText = resumeObjectToText(resumeData);

    // Coverage is reported against the FULL missing list (not just the
    // integration target) so the UI can show everything that was left out —
    // including keywords the user chose not to add.
    const coverageKeywords = safeMissing.length ? safeMissing : missingForCareerChange;
    const stillMissingKeywords = coverageKeywords.filter(
      (keyword) => !hasKeyword(optimizedResumeText, keyword)
    );
    const incorporatedKeywords = coverageKeywords.filter((keyword) =>
      hasKeyword(optimizedResumeText, keyword)
    );

    let finalCoverLetter = "";
    if (shouldGenerateCoverLetter) {
      const coverLetterPrompt = [
        "You are an expert cover letter writer crafting short, high-impact, role-tailored cover letters.",
        "Generate a concise cover letter for the target role grounded in the resume below.",
        "Structure (three short paragraphs):",
        "1. Opening (1-2 sentences): name the organization and designation, and state the single strongest reason the candidate fits, drawn from their actual experience.",
        "2. Evidence (2-3 sentences): connect the candidate's most relevant experience and skills from the resume to the JD's top requirements, including one quantified achievement if the resume has one.",
        "3. Closing (1-2 sentences): brief enthusiasm and a clear call to action.",
        "Hard rules:",
        "- 120-180 words total. Never exceed 200 words. Shorter is better than padded.",
        "- Truthful and grounded ONLY in the resume content. Do not invent employers, titles, schools, certifications, or metrics.",
        "- Every claim must trace back to the candidate's actual experience in the resume; do not claim familiarity with JD requirements the resume does not support.",
        "- Explicitly mention the organization name at least once in the opening paragraph.",
        "- Do not include any salutation (Dear/Hiring Manager), date, address, sign-off, or candidate name - these are added separately.",
        "- Do not include heading text like 'Tailored Cover Letter' or 'Cover Letter'.",
        "- Do not use placeholders like [Candidate Address], [Date], [Your Name], [Company].",
        "- Plain text only, no markdown fences, no bullet points.",
        "",
        `Organization: ${organization}`,
        `Designation: ${designation}`,
        "",
        "Job Description:",
        jd.slice(0, 7000),
        "",
        "Optimized Resume:",
        optimizedResumeText.slice(0, 9000),
      ].join("\n");

      const coverLetterRaw = await generateWithModel({
        apiKey,
        prompt: coverLetterPrompt,
        maxTokens: 800,
      });

      finalCoverLetter = stripPlaceholdersAndTemplateLabels(coverLetterRaw);
      if (organization && !finalCoverLetter.toLowerCase().includes(organization.toLowerCase())) {
        // Splice org reference into the first paragraph naturally rather than prepending.
        const paragraphs = finalCoverLetter.split(/\n{2,}/);
        if (paragraphs.length > 0) {
          const opening = paragraphs[0];
          const designationFragment = designation ? `${designation} role` : "role";
          paragraphs[0] = `${opening.replace(/\.$/, "")} at ${organization} for the ${designationFragment}.`;
          finalCoverLetter = paragraphs.join("\n\n");
        }
      }
      finalCoverLetter = stripPlaceholdersAndTemplateLabels(finalCoverLetter);
      finalCoverLetter = enforceCoverLetterStructure({
        rawCoverLetter: finalCoverLetter,
        organization,
        candidateName,
        email: candidateEmail,
        phone: candidatePhone,
      });
      finalCoverLetter = sanitizeAllowedCharacters(finalCoverLetter);
    }

    return NextResponse.json({
      success: true,
      message: {
        optimizedResume: resumeData,
        optimizedResumeText,
        coverLetter: finalCoverLetter,
        incorporatedKeywords,
        stillMissingKeywords,
      },
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error.message,
    });
  }
}
