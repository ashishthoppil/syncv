import { NextResponse } from "next/server";

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

const sanitizeAllowedCharacters = (text = "") =>
  text
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/[^\w\s.,:;!?()&/'"%+\-*@#\n]/g, " ")
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

const ensureResumeIncludesContactInfo = (resumeText = "", contactLines = []) => {
  const resume = ensureString(resumeText);
  if (!resume || !contactLines.length) return resume;

  const existingContact = extractContactLines(resume).map((line) => normalizeText(line));
  const missing = contactLines.filter(
    (line) => !existingContact.includes(normalizeText(line))
  );
  if (!missing.length) return resume;

  const lines = resume.split("\n");
  const summaryHeaderIndex = lines.findIndex((line) => /^\s*summary\s*:?\s*$/i.test(line));
  const insertAt = summaryHeaderIndex >= 0 ? summaryHeaderIndex : 0;
  const contactBlock = [`CONTACT: ${missing.join(" | ")}`];

  const updated =
    insertAt === 0
      ? [...contactBlock, "", ...lines]
      : [...lines.slice(0, insertAt), ...contactBlock, "", ...lines.slice(insertAt)];

  return updated.join("\n").replace(/\n{3,}/g, "\n\n").trim();
};

const ensureResumeIncludesLinks = (resumeText = "", originalLinks = []) => {
  const resume = ensureString(resumeText);
  if (!resume || !originalLinks.length) return resume;

  const existing = new Set(extractExternalLinks(resume).map((item) => normalizeText(item)));
  const missing = originalLinks.filter((link) => !existing.has(normalizeText(link)));
  if (!missing.length) return resume;

  const lines = resume.split("\n");
  const contactLineIndex = lines.findIndex((line) => /^\s*contact\s*:/i.test(line));
  if (contactLineIndex >= 0) {
    const existingContactParts = lines[contactLineIndex]
      .replace(/^\s*contact\s*:/i, "")
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);
    const merged = Array.from(
      new Set(
        [...existingContactParts, ...missing].map((part) => part.trim()).filter(Boolean)
      )
    );
    lines[contactLineIndex] = `CONTACT: ${merged.join(" | ")}`;
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  const summaryHeaderIndex = lines.findIndex((line) => /^\s*summary\s*:?\s*$/i.test(line));
  const insertAt = summaryHeaderIndex >= 0 ? summaryHeaderIndex : 0;
  const linkBlock = [`CONTACT: ${missing.join(" | ")}`];

  const updated =
    insertAt === 0
      ? [...linkBlock, "", ...lines]
      : [...lines.slice(0, insertAt), ...linkBlock, "", ...lines.slice(insertAt)];

  return updated.join("\n").replace(/\n{3,}/g, "\n\n").trim();
};

const removeProfileLinksLines = (resumeText = "") =>
  String(resumeText || "")
    .split("\n")
    .filter((line) => !/^\s*(profile\s+links|links)\s*:/i.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

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

const boldLikelyExperienceLines = (resume = "") => {
  const lines = resume.split("\n");
  const titleRegex =
    /\b(engineer|developer|manager|coordinator|teacher|analyst|specialist|assistant|consultant|intern|lead|officer|executive|designer)\b/i;
  const companyRegex =
    /\b(inc|corp|corporation|llc|ltd|limited|pvt|university|school|college)\b/i;

  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (/^\*\*.*\*\*$/.test(trimmed)) return line;
      const isBullet = /^[-*•]\s+/.test(trimmed);
      const isSentenceLike = /[.?!]$/.test(trimmed);
      const isLikelyHeading = trimmed.length <= 90 && !isBullet && !isSentenceLike;
      if (isLikelyHeading && (titleRegex.test(trimmed) || companyRegex.test(trimmed))) {
        return `**${trimmed}**`;
      }
      return line;
    })
    .join("\n");
};

const extractCandidateName = (resume = "") => {
  const first = resume
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)[0];
  if (!first) return "";
  return first.replace(/[^a-zA-Z.\s-]/g, "").trim();
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
    timeZone: "Asia/Kolkata",
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
  const safeEmail = email || "email@example.com";
  const safePhone = phone || "+91XXXXXXXXXX";
  const orgLine = organization || "Company Name";
  const date = formatTodayDate();

  return [
    `Hiring Manager,                                ${date}`,
    `${orgLine},`,
    "",
    safeBody,
    "",
    "Your's Faithfully,",
    safeName,
    safeEmail,
    safePhone,
  ].join("\n");
};

const removeCandidateNameLine = (resume = "", candidateName = "") => {
  if (!candidateName) return resume;
  const target = normalizeText(candidateName);
  const lines = resume.split("\n");
  if (!lines.length) return resume;

  const firstClean = normalizeText(lines[0].replace(/\*\*/g, "").trim());
  if (firstClean && firstClean === target) {
    return lines.slice(1).join("\n").trim();
  }
  return resume;
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

const removeInjectedTargetDesignationLines = (
  resume = "",
  targetDesignation = "",
  originalTitles = []
) => {
  const normalizedTarget = normalizeText(targetDesignation);
  if (!normalizedTarget) return resume;

  const hasTargetInOriginal = originalTitles.some(
    (title) => normalizeText(title) === normalizedTarget
  );
  if (hasTargetInOriginal) return resume;

  return resume
    .split("\n")
    .filter((line) => {
      const cleaned = line.replace(/\*\*/g, "").trim();
      if (!cleaned) return true;
      return normalizeText(cleaned) !== normalizedTarget;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const ensureString = (value) => String(value || "").trim();
const ensureStringArray = (value) =>
  Array.isArray(value)
    ? value.map((item) => ensureString(item)).filter(Boolean)
    : [];

const resumeSectionsToText = (payload = {}) => {
  const blocks = [];
  const summary = ensureString(payload?.summary);
  const skills = ensureStringArray(payload?.skills);
  const experience = Array.isArray(payload?.experience) ? payload.experience : [];
  const projects = Array.isArray(payload?.projects) ? payload.projects : [];
  const education = Array.isArray(payload?.education) ? payload.education : [];
  const certifications = ensureStringArray(payload?.certifications);

  if (summary) blocks.push("SUMMARY", summary);
  if (skills.length) blocks.push("SKILLS", skills.join(", "));
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
      const bullets = ensureStringArray(item?.bullets || item?.details);
      bullets.forEach((bullet) => blocks.push(`- ${bullet}`));
    });
  }
  if (education.length) {
    blocks.push("EDUCATION");
    education.forEach((item) => {
      const qualification = ensureString(item?.qualification || item?.degree);
      const institution = ensureString(item?.institution || item?.university);
      const duration = ensureString(item?.duration || item?.dates);
      const header = [qualification, institution, duration].filter(Boolean).join(" | ");
      if (header) blocks.push(header);
      ensureStringArray(item?.details).forEach((detail) => blocks.push(`- ${detail}`));
    });
  }
  if (certifications.length) {
    blocks.push("CERTIFICATIONS");
    certifications.forEach((cert) => blocks.push(`- ${cert}`));
  }

  return blocks.join("\n").trim();
};

const normalizeModelResumeOutput = (value) => {
  if (!value) return "";

  if (typeof value === "object") {
    return resumeSectionsToText(value);
  }

  let text = ensureString(value);
  if (!text) return "";

  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === "string") {
      text = ensureString(parsed);
    } else if (parsed && typeof parsed === "object") {
      if (typeof parsed.optimizedResume === "string") {
        text = ensureString(parsed.optimizedResume);
      } else {
        text = resumeSectionsToText(parsed);
      }
    }
  } catch {
    // keep as plain text
  }

  return text;
};

const extractSectionsFromText = (text = "") => {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sections = {};
  let current = "";
  const headerRegex =
    /^(summary|skills|experience|projects|education|certifications)\s*:?$/i;

  for (const line of lines) {
    const m = line.match(headerRegex);
    if (m) {
      current = m[1].toLowerCase();
      if (!sections[current]) sections[current] = [];
      continue;
    }
    if (current) {
      sections[current].push(line);
    }
  }
  return sections;
};

const parseExperienceFromRawResume = (resumeText = "") => {
  const lines = resumeText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const entries = [];
  let current = null;

  const durationRangeRegex =
    /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}\s*[-–]\s*(?:present|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4})|\b\d{4}\s*[-–]\s*(?:present|\d{4}))/i;

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
  const durationRegex =
    /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}\s*[-–]\s*(?:present|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4})|\b\d{4}\s*[-–]\s*(?:present|\d{4}))$/i;
  const m = value.match(durationRegex);
  if (!m) return { location: value.trim(), duration: "" };
  const duration = ensureString(m[1]);
  const location = ensureString(value.replace(durationRegex, "").replace(/[,-]\s*$/, ""));
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


const generateWithModel = async ({ apiKey, prompt, maxTokens = 1800 }) => {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: maxTokens,
      messages: [
        {
          role: "system",
          content:
            "Write truthful ATS-focused resumes and cover letters. Return plain text only.",
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
      resume,
      jd,
      organization = "",
      designation = "",
      missingKeywords = [],
      selectedMissingKeywords = [],
      matchedKeywords = [],
      analysisSuggestions = [],
      formattingWarnings = [],
      scoreBreakdown = null,
      titleAnalysis = null,
      experienceAnalysis = null,
      careerChangeApproved = false,
      resumeRoleFamily = "",
      targetRoleFamily = "",
    } = await req.json();

    if (!resume || !jd) {
      return NextResponse.json({
        success: false,
        message: "Resume and job description are required.",
      });
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
    const safeExperienceAnalysis =
      experienceAnalysis && typeof experienceAnalysis === "object"
        ? experienceAnalysis
        : {};
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
    const factualExperienceBaseline = sanitizeExperienceEntries(parseExperienceFromRawResume(resume));
    const factualEducationBaseline = parseEducationFromSection(
      extractSectionsFromText(resume).education || resume.split("\n")
    ).slice(0, 8);

    const resumePrompt = [
      "You are an ATS-focused resume writer.",
      "Generate an updated CV text tailored to the JD.",
      "",
      "Hard rules:",
      "- Integrate missing keywords only where they naturally fit.",
      "- Do NOT add fake claims or fake experience.",
      "- Keep content truthful and professional.",
      "- Do NOT change existing organizations/employers, job titles/designations, education qualifications, or certifications.",
      "- Keep all existing organization names and designations from resume as-is.",
      "- Preserve all professional links from the original resume (LinkedIn, GitHub, Behance, portfolio, and similar).",
      "- Preserve candidate contact information (email, phone, social links) from the original resume.",
      careerChangeApproved
        ? "- Only include missing keywords explicitly approved by the candidate."
        : "",
      careerChangeApproved ? "- In career-change mode, do not add skills unless hands-on evidence exists in the original resume." : "",
      "- Keep resume concise and ATS-friendly with clear section headings and bullet points.",
      "- Use this CV structure exactly: SUMMARY, SKILLS, EXPERIENCE, PROJECTS (optional), EDUCATION.",
      "- Bold company names and designations in resume using markdown **...**.",
      "- Do not include candidate name in the resume body output.",
      "- Do not use decorative symbols or unusual characters.",
      "- Improve resume quality based on analyzer feedback while staying truthful.",
      "- If career-change mode is on, emphasize transferable strengths without falsifying role history.",
      "- Keep output plain text, no markdown fences.",
      "",
      `Organization: ${organization}`,
      `Designation: ${designation}`,
      `Career-change mode approved by candidate: ${careerChangeApproved ? "Yes" : "No"}`,
      `User-approved keywords for career change: ${selectedFromMissing.join(", ") || "None selected"}`,
      `Role transition context: ${roleTransition}`,
      `Matched keywords: ${safeMatched.join(", ") || "None"}`,
      `Missing keywords to incorporate: ${missingForCareerChange.join(", ") || "None"}`,
      `Analyzer suggestions: ${safeSuggestions.join(" | ") || "None"}`,
      `ATS formatting warnings to address: ${safeFormattingWarnings.join(" | ") || "None"}`,
      `Current score breakdown: ${JSON.stringify(safeScoreBreakdown)}`,
      `Title analysis: ${JSON.stringify(safeTitleAnalysis)}`,
      `Experience analysis: ${JSON.stringify(safeExperienceAnalysis)}`,
      `Must preserve these titles: ${originalTitles.join(" | ") || "None"}`,
      `Must preserve these organizations: ${originalOrganizations.join(" | ") || "None"}`,
      `Factual experience baseline (must not omit): ${JSON.stringify(factualExperienceBaseline.slice(0, 8))}`,
      `Factual education baseline (must not omit): ${JSON.stringify(factualEducationBaseline.slice(0, 8))}`,
      "",
      "Return only the optimized resume text.",
      "",
      "Job Description:",
      jd.slice(0, 7000),
      "",
      "Current Resume:",
      resume.slice(0, 7000),
    ].join("\n");

    const optimizedResumeRaw = await generateWithModel({
      apiKey,
      prompt: resumePrompt,
      maxTokens: 1800,
    });

    const optimizedResume = stripPlaceholdersAndTemplateLabels(
      normalizeModelResumeOutput(optimizedResumeRaw)
    );

    if (!optimizedResume) {
      return NextResponse.json({
        success: false,
        message: "Generated content is incomplete.",
      });
    }

    const uncoveredAfterPass1 = missingForCareerChange.filter(
      (keyword) => !hasKeyword(optimizedResume, keyword)
    );

    let finalResume = optimizedResume;
    if (uncoveredAfterPass1.length) {
      const revisionPrompt = [
        "Revise the resume text below to naturally include all required missing keywords.",
        "Do not invent fake projects/roles. Keep claims realistic.",
        "Keep the same CV structure and improve ATS readability.",
        `Must include these keywords naturally: ${uncoveredAfterPass1.join(", ")}`,
        "Return only the revised resume text.",
        "",
        "Current optimized resume:",
        optimizedResume.slice(0, 9000),
      ].join("\n");

      const revised = await generateWithModel({
        apiKey,
        prompt: revisionPrompt,
        maxTokens: 1200,
      });
      const revisedResume = normalizeModelResumeOutput(revised);
      if (revisedResume) {
        finalResume = stripPlaceholdersAndTemplateLabels(revisedResume);
      }
    }

    const missingProtectedTitles = originalTitles.filter(
      (title) => !includesLineLoosely(finalResume, title)
    );
    const missingProtectedOrgs = originalOrganizations.filter(
      (org) => !includesLineLoosely(finalResume, org)
    );

    if (missingProtectedTitles.length || missingProtectedOrgs.length) {
      const preservePrompt = [
        "Revise this resume preserving original factual history.",
        "Do not alter existing employers, designations, education, or certifications.",
        `Restore these missing original titles exactly: ${missingProtectedTitles.join(" | ") || "None"}`,
        `Restore these missing original organizations exactly: ${missingProtectedOrgs.join(" | ") || "None"}`,
        "Keep resume ATS-friendly and keep missing-keyword improvements where truthful.",
        "Return only the revised resume text.",
        "",
        "Current resume draft:",
        finalResume.slice(0, 9000),
      ].join("\n");

      const preserved = await generateWithModel({
        apiKey,
        prompt: preservePrompt,
        maxTokens: 1200,
      });
      const preservedResume = normalizeModelResumeOutput(preserved);
      if (preservedResume) {
        finalResume = stripPlaceholdersAndTemplateLabels(preservedResume);
      }
    }

    const stillMissingKeywords = missingForCareerChange.filter(
      (keyword) => !hasKeyword(finalResume, keyword)
    );
    const incorporatedKeywords = missingForCareerChange.filter((keyword) =>
      hasKeyword(finalResume, keyword)
    );

    const coverLetterPrompt = [
      "You are an ATS-focused cover letter writer.",
      "Generate a tailored cover letter for the target role.",
      "Hard rules:",
      "- Keep content truthful and grounded in the provided resume.",
      "- Do not invent fake employers, titles, education, or certifications.",
      "- Cover letter length: 250-350 words.",
      "- Structure: opening, role fit paragraph, impact paragraph, closing.",
      "- Mention the organization name explicitly.",
      "- Do NOT include heading text like 'Tailored Cover Letter'.",
      "- Do NOT use placeholders like [Candidate Address], [Date], [Your Name].",
      "- Keep output plain text, no markdown fences.",
      "",
      `Organization: ${organization}`,
      `Designation: ${designation}`,
      "",
      "Job Description:",
      jd.slice(0, 7000),
      "",
      "Optimized Resume:",
      finalResume.slice(0, 9000),
    ].join("\n");

    const coverLetterRaw = await generateWithModel({
      apiKey,
      prompt: coverLetterPrompt,
      maxTokens: 1200,
    });

    let finalCoverLetter = stripPlaceholdersAndTemplateLabels(coverLetterRaw);
    if (organization && !finalCoverLetter.toLowerCase().includes(organization.toLowerCase())) {
      finalCoverLetter = `I am excited to apply for this role at ${organization}.\n\n${finalCoverLetter}`;
    }
    finalCoverLetter = stripPlaceholdersAndTemplateLabels(finalCoverLetter);
    finalCoverLetter = enforceCoverLetterStructure({
      rawCoverLetter: finalCoverLetter,
      organization,
      candidateName,
      email: candidateEmail,
      phone: candidatePhone,
    });
    finalResume = stripPlaceholdersAndTemplateLabels(finalResume);
    finalResume = removeCandidateNameLine(finalResume, candidateName);
    finalResume = removeInjectedTargetDesignationLines(
      finalResume,
      designation,
      originalTitles
    );
    finalResume = removeProfileLinksLines(finalResume);
    finalResume = ensureResumeIncludesContactInfo(finalResume, sourceContactLines);
    finalResume = ensureResumeIncludesLinks(finalResume, sourceLinks);
    finalResume = boldLikelyExperienceLines(finalResume);
    finalResume = sanitizeAllowedCharacters(finalResume);
    finalCoverLetter = sanitizeAllowedCharacters(finalCoverLetter);

    const optimizedResumeText = finalResume;

    return NextResponse.json({
      success: true,
      message: {
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
