import { NextResponse } from "next/server";
import { getPlanForUser, getSupabaseAdminClient } from "@/lib/server/subscriptions";

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
  const regex = new RegExp(`\\b${pattern}\\b`, "i");
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

const extractExternalLinks = (text = "") => {
  const content = String(text || "");
  const links = [];
  const seen = new Set();

  const add = (raw = "") => {
    const normalized = normalizeUrlCandidate(raw);
    if (!normalized) return;
    const key = normalizeText(normalized);
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

const extractContactLines = (text = "") => {
  const lines = String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const seen = new Set();
  const output = [];

  for (const line of lines.slice(0, 20)) {
    if (
      /@|https?:\/\/|www\.|linkedin\.com|github\.com|behance\.net|phone\b|mobile\b|contact\b|email\b|\+\d[\d\s().-]{7,}\d/i.test(
        line
      )
    ) {
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

const extractCandidateName = (resume = "") => {
  const first = resume
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)[0];
  if (!first) return "";
  let name = first.replace(/[^a-zA-Z.\s-]/g, "").trim();
  // Restore word boundaries when the name header was extracted glued together
  // (e.g. "AleenaMariamBenny" from a tightly-kerned PDF heading).
  if (name && !/\s/.test(name) && /[a-z][A-Z]/.test(name)) {
    name = name.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  }
  return name;
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
    summary: ensureString(o.summary),
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
    languages: normalizeLanguageList(o.languages),
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
  if (baseline.length < 2) return experience;
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

// Pick the location line out of the raw contact lines (not an email, link, or
// phone number).
const extractContactLocation = (contactLines = []) => {
  const candidate = (contactLines || []).find((line) => {
    const l = ensureString(line);
    if (!l || /@/.test(l)) return false;
    if (/https?:\/\/|www\.|linkedin|github|behance|gitlab|medium|dribbble/i.test(l)) {
      return false;
    }
    const digitCount = (l.match(/\d/g) || []).length;
    if (digitCount >= 7) return false; // looks like a phone number
    return /[a-zA-Z]/.test(l);
  });
  return ensureString(candidate);
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

const extractSectionsFromText = (text = "") => {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sections = {};
  let current = "";
  const headerRegex =
    /^(?:(summary|professional\s+summary|profile|objective)|(skills|technical\s+skills|professional\s+skills|core\s+skills|key\s+skills|core\s+competencies|competencies)|(experience|work\s+experience|professional\s+experience|employment\s+history|work\s+history)|(projects?|personal\s+projects?|key\s+projects?)|(education|academic\s+background|qualifications?)|(certifications?|courses?|licenses?)|(languages?|languages\s+known|language\s+competencies))\s*:?$/i;

  // Each capture group corresponds to one canonical section key, in order.
  const groupKeys = [
    "summary",
    "skills",
    "experience",
    "projects",
    "education",
    "certifications",
    "languages",
  ];

  for (const line of lines) {
    const m = line.match(headerRegex);
    if (m) {
      const matchedIndex = groupKeys.findIndex((_, idx) => m[idx + 1] !== undefined);
      current = matchedIndex >= 0 ? groupKeys[matchedIndex] : "";
      if (current && !sections[current]) sections[current] = [];
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
// An academic degree — should never be an employer or job title.
const DEGREE_LABEL_RE =
  /\b(bachelor|master|associate|diploma|ph\.?d|doctorate|mba|m\.?sc|b\.?sc|b\.?tech|m\.?tech|bca|mca|b\.?a|m\.?a|b\.?com|m\.?com|ll\.?b|ll\.?m|bba)\b/i;

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

// Flattens the LANGUAGES section of a raw resume into individual language
// entries. Source lines are frequently bullet- or comma-joined on a single line
// (e.g. "• English • Hindi • Malayalam"), so split aggressively.
const parseLanguagesFromSection = (sectionLines = []) =>
  normalizeLanguageList(sectionLines);

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
      if (!activePlan) {
        return NextResponse.json({
          success: false,
          message: "Please subscribe to a plan to optimize your resume.",
        });
      }
      if (!activePlan.allowsCoverLetter) {
        shouldGenerateCoverLetter = false;
      }
    }

    const safeMissing = Array.isArray(missingKeywords)
      ? missingKeywords.filter(Boolean).slice(0, 25)
      : [];
    const safeSelectedMissing = Array.isArray(selectedMissingKeywords)
      ? selectedMissingKeywords.filter(Boolean).slice(0, 25)
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
    const missingForCareerChange = careerChangeApproved
      ? hasExplicitCareerSelection
        ? selectedFromMissing
        : filterMissingByHandsOnEvidence(safeMissing, resume)
      : safeMissing;
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
    const factualExperienceBaseline = sanitizeExperienceEntries(
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
        ? `1. summary (REWRITE MODE): A summary already exists — rewrite it to target the role more precisely. Keep the candidate's voice and factual experience level. 3-4 sentences, 60-80 words. Open with seniority + domain (e.g. "Senior Backend Engineer with 6 years..."). Reference only skills and experience already present in the resume; these confirmed keywords may be highlighted: ${summaryKeywordHint}. Rules: NEVER mention a skill, tool, or technology that is not evidenced in the original resume; no "I" statements; no hollow filler ("results-driven", "passionate", "go-getter", "dynamic") unless tied to a specific fact.`
        : `1. summary (GENERATE MODE): No summary exists — write one from scratch using ONLY facts already present in the resume. 3-4 sentences, 60-80 words. Structure: (a) open with seniority + domain ("Senior X Engineer with N years of experience in..."), (b) highlight 2-3 skills that are confirmed in the resume AND relevant to the target role, (c) close with a concise value statement. These confirmed keywords may be used: ${summaryKeywordHint}. Rules: NEVER claim a skill, tool, certification, or experience that is not in the original resume — not even to match the JD; no "I" statements; no generic filler.`,
      "2. skills: An array of 3-6 strings, each a logical category formatted as 'Category: item, item, item'. Choose categories that fit THIS candidate's profession — do not assume software/engineering. Examples by field: software → Languages, Frameworks, Tools, Cloud; marketing → Channels, Analytics, Tools, Content; nursing/healthcare → Clinical Skills, Certifications, Systems/EMR, Patient Care; finance → Accounting, Analysis, Software, Compliance; design → Design, Prototyping, Tools, Research. Include every matched keyword and every missing keyword that has evidence in the candidate's original resume. List concrete, recognizable hard skills, tools, and certifications. Do NOT include vague filler or buzzwords (e.g. 'Product Mindset', 'Ownership Mindset', 'Problem-Solving Skills', 'Analytical Thinking', 'Fast-Paced Environments', 'Attention to Detail', 'Team Player'); genuine, named soft skills (Leadership, Communication, Teamwork, Time Management) are allowed sparingly. Avoid near-duplicates (e.g. 'Git' and 'Git workflows').",
      "3. experience: An array of role objects. Fill designation, company, location, and duration as separate fields (leave a field as an empty string only if truly unknown). Provide 3-6 bullets per role, each starting with a strong action verb. Lead with quantified impact wherever the resume provides ANY number, scale, or outcome — %, $, time saved, volume, users, team size, frequency, growth. If the original resume states a metric, preserve it; if it implies scale (e.g. 'large team', 'high traffic'), express it concretely only when the resume supports it. Integrate missing keywords ONLY where they describe actual past work. NEVER invent or inflate metrics, names, or claims.",
      hasProjectsSection
        ? "4. projects: The original resume HAS a projects section, so the output JSON MUST include a non-empty projects array containing EVERY original project (match the baseline above). Each project object has a clear name and 1-3 bullets describing scope and impact. Add keywords only where the project truly used them. Never drop a project to save space."
        : "4. projects: The original resume has no projects section — omit the projects key entirely. Do not invent projects.",
      "5. education: Output ONLY the education entries that literally appear in the original resume (match the factual education baseline below) — output exactly that many entries, no more. NEVER add, split, duplicate, or invent a degree, institution, or graduation year (e.g. do not add a Bachelor's the candidate never listed). Each object has qualification, institution, location, duration as separate fields, plus optional detail strings for honors/coursework. Put the city/country in the location field — never merge it into institution or duration. Preserve every degree exactly as written.",
      "6. certifications: Array of strings, each 'Cert name — Issuer (year if known)'. Include ONLY certifications that appear in the original resume — never invent a credential. If the original resume includes a verification/credential URL for a certification or course, append it to that string EXACTLY as written (e.g. 'Front-End Web Development with React — Coursera — https://coursera.org/verify/ABC123'). Never invent, guess, or shorten URLs — include one only if it is present in the original resume.",
      "7. languages: Array of spoken/written languages exactly as listed in the original resume, ONE language per array item (e.g. ['English', 'Hindi', 'Malayalam'] or ['English (Native)', 'Spanish (Fluent)']). Never cram multiple languages into a single string and never bullet-join them. Do NOT place spoken languages in the skills section. Omit the key entirely if the resume lists no languages.",
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
        "- Add keywords that describe tools/frameworks/technologies to the skills array.",
        "- Add keywords that describe methods/practices to experience bullets where the candidate actually performed that work.",
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

    // Safety net: original listed languages but the model dropped/merged them.
    if (hasLanguagesSection && !resumeData.languages.length) {
      resumeData.languages = factualLanguagesBaseline.slice();
    }

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
      location: extractContactLocation(sourceContactLines),
      links: sourceLinks
        .map((url) => ({ url: ensureString(url) }))
        .filter((l) => l.url),
    };

    resumeData = sanitizeResumeObject(resumeData);

    // One-way plain-text projection for keyword coverage, the analyzer, and
    // downloads. The object remains the source of truth.
    const optimizedResumeText = resumeObjectToText(resumeData);

    const stillMissingKeywords = missingForCareerChange.filter(
      (keyword) => !hasKeyword(optimizedResumeText, keyword)
    );
    const incorporatedKeywords = missingForCareerChange.filter((keyword) =>
      hasKeyword(optimizedResumeText, keyword)
    );

    let finalCoverLetter = "";
    if (shouldGenerateCoverLetter) {
      const coverLetterPrompt = [
        "You are an expert cover letter writer crafting concise, role-tailored cover letters.",
        "Generate a cover letter for the target role grounded in the resume below.",
        "Structure (four short paragraphs):",
        "1. Opening (2-3 sentences): name the organization and designation, briefly state interest and a high-level value statement.",
        "2. Role fit (3-4 sentences): cite 2-3 specific skills/experiences from the resume that map to the JD's top requirements.",
        "3. Impact (2-3 sentences): reference one quantified achievement from the resume showing relevant impact.",
        "4. Closing (1-2 sentences): express enthusiasm and a clear call to action.",
        "Hard rules:",
        "- 250-350 words total.",
        "- Truthful and grounded ONLY in the resume content. Do not invent employers, titles, schools, certifications, or metrics.",
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
        maxTokens: 1500,
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
