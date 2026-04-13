import { NextResponse } from "next/server";
import {
  countWeeklyScans,
  getPlanForUser,
  getSupabaseAdminClient,
} from "@/lib/server/subscriptions";

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "of",
  "to",
  "for",
  "in",
  "on",
  "with",
  "at",
  "by",
  "from",
  "as",
  "is",
  "are",
  "was",
  "were",
  "this",
  "that",
  "these",
  "those",
  "be",
  "been",
  "being",
  "it",
  "its",
  "your",
  "you",
  "we",
  "our",
  "us",
  "their",
  "they",
  "them",
  "will",
  "can",
  "should",
  "could",
  "may",
  "might",
  "about",
  "into",
  "over",
  "per",
  "via",
  "such",
  "than",
  "so",
  "if",
  "also",
  "any",
  "all",
  "each",
  "more",
  "most",
  "other",
  "some",
  "few",
  "very",
  "work",
  "working",
  "role",
  "position",
  "team",
  "company",
  "candidate",
  "required",
  "preferred",
  "must",
  "good",
  "strong",
  "excellent",
  "years",
  "year",
  "yrs",
]);

const DOMAIN_SINGLE_WORD_ALLOWLIST = new Set([
  "ui",
  "ux",
  "qa",
  "js",
  "ts",
  "css",
  "api",
  "aws",
  "gcp",
  "sql",
  "html",
]);

const GENERIC_NOISE_WORDS = new Set([
  "best",
  "build",
  "capabilities",
  "improve",
  "job",
  "description",
  "process",
  "please",
  "focuses",
  "emerging",
  "qualification",
  "qualifications",
  "about",
  "impact",
  "global",
  "millions",
  "users",
  "region",
  "regions",
  "ies",
  "adci",
  "karnataka",
  "amazon",
  "amazonians",
]);

const JD_SECTION_NOISE_HEADERS = [
  /^about the job$/i,
  /^description$/i,
  /^about us$/i,
  /^what you'll work on$/i,
  /^technical areas$/i,
  /^impact$/i,
  /^basic qualifications$/i,
  /^preferred qualifications$/i,
];

const SEMANTIC_EQUIVALENTS = {
  frontend: ["front-end", "ui", "client-side", "web-ui"],
  backend: ["back-end", "server-side", "api"],
  javascript: ["js", "ecmascript"],
  typescript: ["ts"],
  react: ["reactjs", "react.js"],
  nextjs: ["next", "next.js"],
  nodejs: ["node", "node.js"],
  postgres: ["postgresql"],
  mongodb: ["mongo", "mongo db"],
  aws: ["amazon web services"],
  gcp: ["google cloud", "google cloud platform"],
  azure: ["microsoft azure"],
  cicd: ["ci/cd", "continuous integration", "continuous delivery"],
  k8s: ["kubernetes"],
  ai: ["artificial intelligence"],
  ml: ["machine learning"],
  ui: ["user interface"],
  ux: ["user experience"],
};

const CURATED_FALLBACK_TERMS = [
  "frontend development",
  "web development",
  "mobile development",
  "javascript",
  "typescript",
  "html",
  "css",
  "react",
  "angular",
  "node.js",
  "object-oriented design",
  "data structures",
  "algorithm design",
  "problem solving",
  "complexity analysis",
  "agile software development",
  "latency optimization",
  "web performance optimization",
  "mobile app optimization",
  "backend optimization",
  "performance monitoring",
  "performance analytics",
];

const KEYWORD_EXTRACTION_CACHE = new Map();
const KEYWORD_CACHE_LIMIT = 120;

const stripHtml = (value = "") => value.replace(/<[^>]*>/g, " ");

const normalizeToken = (token = "") =>
  token
    .toLowerCase()
    .replace(/[^a-z0-9+#.\-/]/g, "")
    .replace(/(^[.\-/]+|[.\-/]+$)/g, "");

const normalizePhrase = (value = "") =>
  stripHtml(value)
    .toLowerCase()
    .replace(/[^a-z0-9+#.\-/\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const canonical = (value = "") =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();

const tokenize = (value = "") =>
  stripHtml(value)
    .toLowerCase()
    .replace(/[^a-z0-9+#.\-/\s]/g, " ")
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildKeywordCacheKey = (cleanedJd = "", organization = "", designation = "") =>
  [cleanedJd, organization, designation]
    .map((value) => normalizePhrase(value || ""))
    .join("::");

const extractOrganizationTokens = (organization = "") =>
  tokenize(organization).filter((token) => token.length > 2);

const extractJdExclusionTokens = (jd = "", organization = "") => {
  const tokens = new Set(["amazon", "amazonians", "adci", "karnataka", "india", "job", "id"]);
  extractOrganizationTokens(organization).forEach((token) => tokens.add(canonical(token)));

  const companyMatch = jd.match(/company\s*-\s*(.+)/i);
  if (companyMatch?.[1]) {
    tokenize(companyMatch[1]).forEach((token) => tokens.add(canonical(token)));
  }

  return tokens;
};

const preprocessJobDescription = (jd = "") => {
  let normalized = stripHtml(jd)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  normalized = normalized.replace(/https?:\/\/\S+/gi, " ");
  normalized = normalized.replace(/our inclusive culture[\s\S]*$/i, " ");
  normalized = normalized.replace(/company\s*-.*$/gim, " ");
  normalized = normalized.replace(/job\s*id\s*:\s*.*$/gim, " ");

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !JD_SECTION_NOISE_HEADERS.some((regex) => regex.test(line)))
    .filter((line) => !/^please\b/i.test(line));

  return lines.join("\n");
};

const buildResumeIndex = (resumeText = "") => {
  const tokens = tokenize(resumeText);
  const tokenSet = new Set(tokens);
  const canonicalTokenSet = new Set(tokens.map(canonical).filter(Boolean));

  return {
    textLower: resumeText.toLowerCase(),
    tokenSet,
    canonicalTokenSet,
  };
};

const expandSemanticTerms = (term = "") => {
  const normalizedPhrase = normalizePhrase(term);
  if (!normalizedPhrase) return [];
  const key = canonical(normalizedPhrase);
  const equivalents = SEMANTIC_EQUIVALENTS[key] || [];
  return [normalizedPhrase, ...equivalents.map(normalizePhrase)].filter(Boolean);
};

const isGenericNoise = (keyword = "") => {
  const words = normalizePhrase(keyword)
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);

  if (!words.length) return true;
  if (words.length === 1 && GENERIC_NOISE_WORDS.has(words[0])) return true;
  if (words.every((w) => STOP_WORDS.has(w) || GENERIC_NOISE_WORDS.has(w))) return true;
  if (words.length === 1 && words[0].length < 4 && !DOMAIN_SINGLE_WORD_ALLOWLIST.has(words[0])) return true;

  return false;
};

const isMeaningfulKeyword = (keyword = "", exclusionTokenSet = new Set()) => {
  const normalizedPhrase = normalizePhrase(keyword);
  if (!normalizedPhrase) return false;

  if (isGenericNoise(normalizedPhrase)) return false;

  if (/^(about|description|impact|qualifications?|preferred|basic|company|job|id)$/i.test(normalizedPhrase)) {
    return false;
  }

  const words = normalizedPhrase.split(/\s+/).map(normalizeToken).filter(Boolean);
  if (!words.length) return false;

  for (const word of words) {
    if (exclusionTokenSet.has(canonical(word))) {
      return false;
    }
  }

  return true;
};

const dedupeKeywords = (keywords = []) => {
  const seen = new Set();
  const output = [];

  for (const item of keywords) {
    const key = canonical(item.keyword || "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }

  return output;
};

const extractFirstJsonObject = (text = "") => {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === "{") depth += 1;
    if (ch === "}") depth -= 1;

    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }

  return null;
};

const clampWeight = (value) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 5;
  return Math.max(1, Math.min(10, Math.round(numeric)));
};

const fallbackExtractWeightedKeywords = ({ cleanedJd, exclusionTokenSet, limit = 25 }) => {
  const jdLower = cleanedJd.toLowerCase();
  const extracted = [];

  for (const term of CURATED_FALLBACK_TERMS) {
    const pattern = new RegExp(`\\b${escapeRegex(term).replace(/\\ /g, "(?:\\W|_){1,3}")}\\b`, "i");
    if (!pattern.test(jdLower)) continue;

    if (!isMeaningfulKeyword(term, exclusionTokenSet)) continue;

    extracted.push({
      keyword: term,
      weight: term.includes("optimization") || term.includes("performance") ? 8 : 7,
      importance: "required",
      variants: [],
      reason: "Fallback from curated skill dictionary.",
    });
  }

  return dedupeKeywords(extracted).slice(0, limit);
};

const extractWeightedKeywordsWithAI = async ({ cleanedJd, organization, designation, exclusionTokenSet }) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const prompt = [
    "Extract meaningful resume-match keywords from this job description.",
    "Rules:",
    "1) Include only skills, tools, frameworks, methods, engineering concepts, and qualifications that can be matched in resumes.",
    "2) Keep compounds and phrases intact. Never emit fragments like 'end', 'ies', 'best', or section words.",
    "3) Exclude organization names, locations, boilerplate, and application process language.",
    "4) Output compact JSON only.",
    // "5) Max 20 keywords.",
    `Organization context: ${organization || ""}`,
    `Designation context: ${designation || ""}`,
    "JSON schema:",
    '{"keywords":[{"keyword":"string","weight":1-10,"importance":"required|preferred","variants":["string"]}]}' ,
    "Job description:",
    cleanedJd.slice(0, 6000),
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      // max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract strict, relevant ATS keywords only. Return valid compact JSON only.",
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
    throw new Error("OpenAI returned empty content");
  }

  let parsed;
  try {
    const jsonBlock = extractFirstJsonObject(content);
    if (!jsonBlock) {
      throw new Error("No JSON object found in model response");
    }
    parsed = JSON.parse(jsonBlock);
  } catch {
    throw new Error("OpenAI returned non-JSON keyword payload");
  }

  const rawKeywords = Array.isArray(parsed?.keywords) ? parsed.keywords : [];

  const cleaned = rawKeywords
    .map((entry) => {
      const keyword = String(entry?.keyword || "").trim();
      const variants = Array.isArray(entry?.variants)
        ? entry.variants
            .map((v) => String(v || "").trim())
            .filter(Boolean)
            .slice(0, 6)
        : [];

      return {
        keyword,
        weight: clampWeight(entry?.weight),
        importance: entry?.importance === "preferred" ? "preferred" : "required",
        variants,
      };
    })
    .filter((entry) => isMeaningfulKeyword(entry.keyword, exclusionTokenSet))
    .map((entry) => ({
      ...entry,
      variants: entry.variants.filter((variant) => isMeaningfulKeyword(variant, exclusionTokenSet)),
    }))
    .slice(0, 30);

  return {
    keywords: dedupeKeywords(cleaned),
    rawCount: rawKeywords.length,
    cleanedCount: cleaned.length,
  };
};

const phraseRegexFromWords = (words = []) => {
  if (!words.length) return null;
  const pattern = words.map((w) => escapeRegex(w)).join("(?:\\W|_){1,3}");
  return new RegExp(`\\b${pattern}\\b`, "i");
};

const allWordsExist = (words, tokenSet, canonicalTokenSet) =>
  words.every((word) => {
    const normalized = normalizeToken(word);
    if (!normalized) return false;
    if (tokenSet.has(normalized)) return true;

    const wordCanonical = canonical(normalized);
    if (canonicalTokenSet.has(wordCanonical)) return true;

    const semantic = expandSemanticTerms(normalized);
    return semantic.some((candidate) => {
      const cNorm = normalizeToken(candidate);
      if (!cNorm) return false;
      return tokenSet.has(cNorm) || canonicalTokenSet.has(canonical(cNorm));
    });
  });

const findBestMatchForTerm = (term, resumeIndex) => {
  const normalizedPhrase = normalizePhrase(term);
  if (!normalizedPhrase) return { matched: false, confidence: 0 };

  const words = normalizedPhrase.split(/\s+/).map(normalizeToken).filter(Boolean);
  if (!words.length) return { matched: false, confidence: 0 };

  if (words.length === 1 && resumeIndex.tokenSet.has(words[0])) {
    return { matched: true, confidence: 1, mode: "exact" };
  }

  const canonicalTerm = canonical(normalizedPhrase);
  if (canonicalTerm && resumeIndex.canonicalTokenSet.has(canonicalTerm)) {
    return { matched: true, confidence: 0.95, mode: "canonical" };
  }

  const regex = phraseRegexFromWords(words);
  if (regex && regex.test(resumeIndex.textLower)) {
    return { matched: true, confidence: 0.95, mode: "phrase" };
  }

  if (words.length > 1 && allWordsExist(words, resumeIndex.tokenSet, resumeIndex.canonicalTokenSet)) {
    return { matched: true, confidence: 0.85, mode: "word-by-word" };
  }

  const semanticVariants = expandSemanticTerms(normalizedPhrase);
  for (const variant of semanticVariants) {
    const vNorm = normalizePhrase(variant);
    if (!vNorm) continue;

    if (resumeIndex.tokenSet.has(vNorm) || resumeIndex.canonicalTokenSet.has(canonical(vNorm))) {
      return { matched: true, confidence: 0.8, mode: "semantic" };
    }

    const vWords = vNorm.split(/\s+/).map(normalizeToken).filter(Boolean);
    const vRegex = phraseRegexFromWords(vWords);
    if (vRegex && vRegex.test(resumeIndex.textLower)) {
      return { matched: true, confidence: 0.8, mode: "semantic-phrase" };
    }
  }

  return { matched: false, confidence: 0, mode: "none" };
};

const TITLE_SYNONYMS = {
  software: ["developer", "programmer", "engineering"],
  engineer: ["developer", "engineering"],
  developer: ["engineer", "programmer"],
  frontend: ["front-end", "ui", "client-side", "web"],
  backend: ["back-end", "server-side", "api"],
  fullstack: ["full-stack", "full", "stack"],
  manager: ["lead", "head"],
  product: ["pm"],
};

const TITLE_KEYWORDS =
  /\b(software engineer|software developer|frontend developer|frontend engineer|backend developer|backend engineer|full[-\s]?stack developer|full[-\s]?stack engineer|product manager|project manager|qa engineer|data scientist|data analyst|devops engineer|ui\/ux designer|ux designer|ui designer)\b/gi;

const TITLE_LINE_HINT =
  /\b(engineer|developer|manager|designer|analyst|architect|consultant|specialist|lead|officer)\b/i;

const TITLE_MODIFIERS = new Set([
  "senior",
  "jr",
  "junior",
  "lead",
  "principal",
  "associate",
  "staff",
  "head",
  "intern",
]);

const MONTH_MAP = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const SECTION_PATTERNS = {
  summary: /^\s*summary\s*:?\s*$/im,
  skills: /^\s*skills\s*:?\s*$/im,
  experience: /^\s*experience\s*:?\s*$/im,
  education: /^\s*education\s*:?\s*$/im,
  projects: /^\s*projects?\s*:?\s*$/im,
};
const EXPERIENCE_HEADER_PATTERN =
  /^\s*(experience|work\s+experience|professional\s+experience|employment\s+history)\s*:?\s*$/i;
const KNOWN_SECTION_HEADER_PATTERN =
  /^\s*(summary|skills|experience|work\s+experience|professional\s+experience|employment\s+history|projects?|education|certifications?|languages?|language competencies)\s*:?\s*$/i;
const EDUCATION_CONTEXT_PATTERN =
  /\b(education|college|university|school|bachelor|master|phd|degree)\b/i;

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(value)));

const extractTitlesFromResume = (resumeText = "") => {
  const titles = [];
  const seen = new Set();
  const pushTitle = (value = "") => {
    const cleaned = value.replace(/[*|]/g, " ").replace(/\s+/g, " ").trim();
    const key = canonical(cleaned);
    if (!key || seen.has(key)) return;
    seen.add(key);
    titles.push(cleaned);
  };

  let match;
  while ((match = TITLE_KEYWORDS.exec(resumeText)) !== null) {
    pushTitle(match[0]);
  }

  resumeText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line.length < 90 && TITLE_LINE_HINT.test(line))
    .slice(0, 20)
    .forEach((line) => pushTitle(line));

  return titles.slice(0, 10);
};

const titleToTokenSet = (title = "") => {
  const tokens = normalizePhrase(title)
    .split(/\s+/)
    .map((token) => normalizeToken(token))
    .filter(Boolean)
    .filter((token) => !TITLE_MODIFIERS.has(token));
  const expanded = new Set(tokens);
  for (const token of tokens) {
    const variants = TITLE_SYNONYMS[token] || [];
    variants.forEach((item) => expanded.add(normalizeToken(item)));
  }
  return expanded;
};

const computeTitleSimilarity = (titleA = "", titleB = "") => {
  const a = titleToTokenSet(titleA);
  const b = titleToTokenSet(titleB);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
};

const analyzeTitleMatch = (resumeText = "", targetRole = "") => {
  const detectedTitles = extractTitlesFromResume(resumeText);
  const target = String(targetRole || "").trim();
  if (!target) {
    return {
      score: 50,
      targetRole: "",
      matchedTitle: "",
      detectedTitles,
    };
  }
  if (!detectedTitles.length) {
    return {
      score: 20,
      targetRole: target,
      matchedTitle: "",
      detectedTitles: [],
    };
  }

  let bestTitle = "";
  let bestSimilarity = 0;
  detectedTitles.forEach((title) => {
    const similarity = computeTitleSimilarity(target, title);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestTitle = title;
    }
  });

  return {
    score: clampScore(bestSimilarity * 100),
    targetRole: target,
    matchedTitle: bestTitle,
    detectedTitles,
  };
};

const toMonthIndex = (month = "jan") => MONTH_MAP[String(month).toLowerCase().slice(0, 3)] ?? 0;
const toMonthNumber = (year, monthIndex) => year * 12 + monthIndex;

const extractSectionText = (resumeText = "", sectionHeaderPattern = /^$/) => {
  const lines = String(resumeText || "").split("\n");
  const startIndex = lines.findIndex((line) => sectionHeaderPattern.test(line));
  if (startIndex < 0) {
    return {
      found: false,
      text: String(resumeText || ""),
    };
  }

  const collected = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (KNOWN_SECTION_HEADER_PATTERN.test(line)) break;
    collected.push(line);
  }
  const text = collected.join("\n").trim();
  return {
    found: true,
    text: text || String(resumeText || ""),
  };
};

const extractExperienceSectionText = (resumeText = "") => {
  return extractSectionText(resumeText, EXPERIENCE_HEADER_PATTERN);
};

const hasEducationContextNearby = (text = "", matchIndex = 0) => {
  const start = Math.max(0, matchIndex - 140);
  const end = Math.min(text.length, matchIndex + 140);
  return EDUCATION_CONTEXT_PATTERN.test(text.slice(start, end));
};

const parseDurationRanges = (resumeText = "") => {
  const { text: experienceText, found: hasExperienceSection } =
    extractExperienceSectionText(resumeText);
  const ranges = [];
  const pushRange = (startYear, startMonth, endYear, endMonth) => {
    if (!startYear || !endYear) return;
    const start = toMonthNumber(startYear, startMonth ?? 0);
    const end = toMonthNumber(endYear, endMonth ?? 11);
    if (Number.isNaN(start) || Number.isNaN(end) || end < start) return;
    ranges.push([start, end]);
  };

  const monthRangeRegex =
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})\s*[-–]\s*(present|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4}))\b/gi;
  let m;
  while ((m = monthRangeRegex.exec(experienceText)) !== null) {
    const startMonth = toMonthIndex(m[1]);
    const startYear = Number(m[2]);
    if (String(m[3]).toLowerCase() === "present") {
      const now = new Date();
      pushRange(startYear, startMonth, now.getUTCFullYear(), now.getUTCMonth());
    } else {
      const endMonth = toMonthIndex(m[4]);
      const endYear = Number(m[5]);
      pushRange(startYear, startMonth, endYear, endMonth);
    }
  }

  const numericMonthRangeRegex =
    /\b(0?[1-9]|1[0-2])[/-](19\d{2}|20\d{2})\s*[-–]\s*(present|(0?[1-9]|1[0-2])[/-](19\d{2}|20\d{2}))\b/gi;
  let nm;
  while ((nm = numericMonthRangeRegex.exec(experienceText)) !== null) {
    if (!hasExperienceSection && hasEducationContextNearby(experienceText, nm.index)) continue;

    const startMonth = Number(nm[1]) - 1;
    const startYear = Number(nm[2]);
    if (String(nm[3]).toLowerCase() === "present") {
      const now = new Date();
      pushRange(startYear, startMonth, now.getUTCFullYear(), now.getUTCMonth());
    } else {
      const endMonth = Number(nm[4]) - 1;
      const endYear = Number(nm[5]);
      pushRange(startYear, startMonth, endYear, endMonth);
    }
  }

  const yearRangeRegex = /\b(19\d{2}|20\d{2})\s*[-–]\s*(present|19\d{2}|20\d{2})\b/gi;
  let y;
  while ((y = yearRangeRegex.exec(experienceText)) !== null) {
    const charBeforeMatch = experienceText[Math.max(0, y.index - 1)];
    if (charBeforeMatch === "/" || charBeforeMatch === "-") continue;
    if (!hasExperienceSection && hasEducationContextNearby(experienceText, y.index)) continue;

    const startYear = Number(y[1]);
    if (String(y[2]).toLowerCase() === "present") {
      const now = new Date();
      pushRange(startYear, 0, now.getUTCFullYear(), now.getUTCMonth());
    } else {
      pushRange(startYear, 0, Number(y[2]), 11);
    }
  }

  return ranges;
};

const mergeRanges = (ranges = []) => {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const [start, end] = sorted[i];
    const last = merged[merged.length - 1];
    if (start <= last[1] + 1) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
};

const estimateTotalExperienceYears = (resumeText = "") => {
  const mergedRanges = mergeRanges(parseDurationRanges(resumeText));
  const totalMonths = mergedRanges.reduce((sum, [start, end]) => sum + (end - start + 1), 0);
  return Number((totalMonths / 12).toFixed(1));
};

const extractRequiredYearsFromJd = (jd = "") => {
  const text = String(jd || "");
  const patterns = [
    /(\d+)\s*\+?\s*(?:years?|yrs?)\s+(?:of\s+)?experience/gi,
    /minimum\s+of\s+(\d+)\s*(?:\+)?\s*(?:years?|yrs?)/gi,
    /at\s+least\s+(\d+)\s*(?:\+)?\s*(?:years?|yrs?)/gi,
  ];
  const matches = [];
  patterns.forEach((regex) => {
    let m;
    while ((m = regex.exec(text)) !== null) {
      matches.push(Number(m[1]));
    }
  });
  if (!matches.length) return null;
  return Math.max(...matches.filter((n) => !Number.isNaN(n)));
};

const analyzeExperience = (resumeText = "", jdText = "") => {
  const totalYears = estimateTotalExperienceYears(resumeText);
  const requiredYears = extractRequiredYearsFromJd(jdText);
  if (!requiredYears) {
    return {
      score: totalYears > 0 ? 75 : 45,
      totalYears,
      requiredYears: null,
    };
  }
  const ratio = requiredYears === 0 ? 1 : totalYears / requiredYears;
  return {
    score: clampScore(ratio * 100),
    totalYears,
    requiredYears,
  };
};

const analyzeAchievements = (resumeText = "") => {
  const metricRegex =
    /(\d+(?:\.\d+)?\s*%|\$\s?\d+(?:\.\d+)?\s*[kmb]?|\b\d+(?:\.\d+)?\s*(x|times|hours|hrs|days|months|years|users|customers|clients|tickets|requests|transactions|ms|sec|seconds)\b)/i;
  const lines = String(resumeText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const bullets = lines.filter((line) => /^[-*•]\s+/.test(line));
  const candidateLines = bullets.length ? bullets : lines;
  const measurableBullets = candidateLines.filter((line) => metricRegex.test(line)).length;
  const score = measurableBullets === 0 ? 25 : clampScore(35 + measurableBullets * 13);
  return {
    score,
    measurableBullets,
    totalBulletLikeLines: candidateLines.length,
  };
};

const detectSections = (resumeText = "") => {
  const found = {};
  Object.entries(SECTION_PATTERNS).forEach(([section, regex]) => {
    found[section] = regex.test(resumeText);
  });
  const presentCount = Object.values(found).filter(Boolean).length;
  const score = clampScore((presentCount / Object.keys(SECTION_PATTERNS).length) * 100);
  return { score, foundSections: found };
};

const detectFormattingWarnings = (resumeText = "") => {
  const text = String(resumeText || "");
  const warnings = [];

  if (/\|.+\|/.test(text) || /\t/.test(text)) {
    warnings.push("Possible table/column layout detected. ATS parsing may break.");
  }
  if (/[┌┐└┘│─]/.test(text) || /[^\w\s.,:;!?()&/'"%+\-*@#\n]{6,}/.test(text)) {
    warnings.push("Excessive symbols or decorative characters detected.");
  }
  if (/!\[[^\]]*\]\([^)]+\)|\b(image|img|photo|icon|graphic)\b/i.test(text)) {
    warnings.push("Potential image-based content detected; ATS may ignore it.");
  }
  if (/(^|\n)\s{8,}\S+/m.test(text)) {
    warnings.push("Multi-column spacing pattern detected. Use single-column formatting.");
  }

  return warnings;
};

const isSkillLikeKeyword = (keywordObj = {}) => {
  const keyword = normalizePhrase(keywordObj.keyword || "");
  if (!keyword) return false;
  const words = keyword.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 5) return false;
  if (words.some((w) => DOMAIN_SINGLE_WORD_ALLOWLIST.has(w))) return true;
  if (words.some((w) => Object.prototype.hasOwnProperty.call(SEMANTIC_EQUIVALENTS, canonical(w)))) {
    return true;
  }
  return /\b(api|cloud|database|framework|language|testing|automation|frontend|backend|devops|engineering|development)\b/i.test(
    keyword
  );
};

const buildSuggestions = ({
  missingKeywords = [],
  achievementScore = 0,
  sectionAnalysis = { foundSections: {} },
  skillsCoverageScore = 0,
  titleMatchScore = 0,
  experienceScore = 0,
  formattingWarnings = [],
}) => {
  const suggestions = [];
  if (missingKeywords.length) suggestions.push("Add missing keywords from the job description.");
  if (achievementScore < 60) suggestions.push("Include measurable achievements with numbers or percentages.");
  if (!sectionAnalysis?.foundSections?.summary) suggestions.push("Add a professional summary section.");
  if (!sectionAnalysis?.foundSections?.skills) suggestions.push("Improve or add a dedicated skills section.");
  if (skillsCoverageScore < 70) suggestions.push("Improve skills coverage for role-specific tools and technologies.");
  if (titleMatchScore < 70) suggestions.push("Align resume headline/title with the target role.");
  if (experienceScore < 70) suggestions.push("Highlight relevant experience duration for this role.");
  if (formattingWarnings.length) suggestions.push("Simplify formatting to be ATS-friendly (avoid tables/columns/images).");
  return Array.from(new Set(suggestions)).slice(0, 8);
};

const scoreResume = (resumeText, weightedKeywords, { jdText = "", targetRole = "" } = {}) => {
  const resumeIndex = buildResumeIndex(resumeText);

  let totalWeight = 0;
  let matchedWeight = 0;
  const matched = [];
  const missing = [];

  for (const keywordObj of weightedKeywords) {
    const keyword = keywordObj.keyword;
    const variants = Array.isArray(keywordObj.variants) ? keywordObj.variants : [];
    const importanceBoost = keywordObj.importance === "required" ? 1.2 : 1;
    const baseWeight = clampWeight(keywordObj.weight) * importanceBoost;
    totalWeight += baseWeight;

    const termsToTry = [keyword, ...variants].filter(Boolean);
    let best = { matched: false, confidence: 0, mode: "none" };

    for (const term of termsToTry) {
      const result = findBestMatchForTerm(term, resumeIndex);
      if (result.confidence > best.confidence) {
        best = result;
      }
      if (best.confidence >= 0.95) break;
    }

    if (best.matched) {
      matchedWeight += baseWeight * best.confidence;
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  }

  const keywordMatchScore =
    totalWeight === 0 ? 0 : clampScore((matchedWeight / totalWeight) * 100);

  const skillKeywords = weightedKeywords.filter(isSkillLikeKeyword);
  const matchedSkillSet = new Set(matched.map((item) => canonical(item)));
  const skillsMatchedCount = skillKeywords.filter((item) =>
    matchedSkillSet.has(canonical(item.keyword))
  ).length;
  const skillsCoverageScore =
    skillKeywords.length > 0
      ? clampScore((skillsMatchedCount / skillKeywords.length) * 100)
      : keywordMatchScore;

  const titleAnalysis = analyzeTitleMatch(resumeText, targetRole);
  const experienceAnalysis = analyzeExperience(resumeText, jdText);
  const achievementAnalysis = analyzeAchievements(resumeText);
  const sectionAnalysis = detectSections(resumeText);
  const formattingWarnings = detectFormattingWarnings(resumeText);

  const finalScore = clampScore(
    keywordMatchScore * 0.4 +
      skillsCoverageScore * 0.15 +
      titleAnalysis.score * 0.1 +
      experienceAnalysis.score * 0.15 +
      achievementAnalysis.score * 0.1 +
      sectionAnalysis.score * 0.1
  );

  const suggestions = buildSuggestions({
    missingKeywords: missing,
    achievementScore: achievementAnalysis.score,
    sectionAnalysis,
    skillsCoverageScore,
    titleMatchScore: titleAnalysis.score,
    experienceScore: experienceAnalysis.score,
    formattingWarnings,
  });

  return {
    initialScore: finalScore,
    finalAtsScore: finalScore,
    scoreBreakdown: {
      keywordMatch: keywordMatchScore,
      skillsCoverage: skillsCoverageScore,
      titleMatch: titleAnalysis.score,
      experienceRelevance: experienceAnalysis.score,
      achievements: achievementAnalysis.score,
      sectionCompleteness: sectionAnalysis.score,
    },
    titleAnalysis,
    experienceAnalysis,
    achievementAnalysis,
    sectionAnalysis,
    formattingWarnings,
    suggestions,
    matchedKeywords: matched,
    missingKeywords: missing,
    keywordUniverse: weightedKeywords.map((k) => k.keyword),
    weightedKeywords,
  };
};

export async function POST(req) {
  try {
    const {
      resume,
      jd,
      organization,
      designation,
      userId = "",
      skipUsageTracking = false,
    } = await req.json();

    if (!resume || !jd) {
      return NextResponse.json({
        success: false,
        message: "Both resume and job description are required.",
      });
    }

    let activePlan = null;
    let scansUsedThisWeek = 0;
    if (userId) {
      const supabase = getSupabaseAdminClient();
      activePlan = await getPlanForUser(supabase, userId);
      if (!activePlan) {
        return NextResponse.json({
          success: false,
          message: "Please subscribe to a plan to optimize your resume.",
        });
      }

      scansUsedThisWeek = await countWeeklyScans(supabase, userId);
      if (!skipUsageTracking && scansUsedThisWeek >= activePlan.weeklyScanLimit) {
        return NextResponse.json({
          success: false,
          message: `Weekly scan limit reached for ${activePlan.name} plan (${activePlan.weeklyScanLimit}/week).`,
        });
      }
    }

    const cleanedJd = preprocessJobDescription(jd);
    const exclusionTokenSet = extractJdExclusionTokens(jd, organization);
    const keywordCacheKey = buildKeywordCacheKey(cleanedJd, organization, designation);

    let weightedKeywords = [];
    let extractionMode = "ai";
    let extractionStats = { rawCount: 0, cleanedCount: 0 };
    const cachedKeywords = KEYWORD_EXTRACTION_CACHE.get(keywordCacheKey);
    if (cachedKeywords?.weightedKeywords?.length) {
      weightedKeywords = cachedKeywords.weightedKeywords;
      extractionMode = `cache-${cachedKeywords.mode || "ai"}`;
      extractionStats = cachedKeywords.stats || extractionStats;
    } else {
      try {
        const ai = await extractWeightedKeywordsWithAI({
          cleanedJd,
          organization,
          designation,
          exclusionTokenSet,
        });
        weightedKeywords = ai.keywords;
        extractionStats = { rawCount: ai.rawCount, cleanedCount: ai.cleanedCount };
      } catch (aiError) {
        console.error("AI keyword extraction failed, using curated fallback:", aiError);
        extractionMode = "fallback";
        weightedKeywords = fallbackExtractWeightedKeywords({
          cleanedJd,
          exclusionTokenSet,
        });
        extractionStats = {
          rawCount: weightedKeywords.length,
          cleanedCount: weightedKeywords.length,
        };
      }

      if (weightedKeywords.length) {
        if (KEYWORD_EXTRACTION_CACHE.size >= KEYWORD_CACHE_LIMIT) {
          const firstKey = KEYWORD_EXTRACTION_CACHE.keys().next().value;
          if (firstKey) KEYWORD_EXTRACTION_CACHE.delete(firstKey);
        }
        KEYWORD_EXTRACTION_CACHE.set(keywordCacheKey, {
          weightedKeywords,
          mode: extractionMode,
          stats: extractionStats,
          cachedAt: Date.now(),
        });
      }
    }

    if (!weightedKeywords.length) {
      return NextResponse.json({
        success: false,
        message:
          "We could not extract meaningful keywords from the job description. Please provide more details.",
      });
    }

    const results = scoreResume(resume, weightedKeywords, {
      jdText: jd,
      targetRole: designation || "",
    });

    if (userId && activePlan && !skipUsageTracking) {
      const supabase = getSupabaseAdminClient();
      const { error: usageError } = await supabase.from("scan_usage").insert({
        user_id: userId,
        plan_key: activePlan.key,
      });
      if (usageError) {
        console.error("Failed to store scan usage:", usageError);
      } else {
        scansUsedThisWeek += 1;
      }
    }

    return NextResponse.json({
      success: true,
      message: {
        ...results,
        organization: organization || "",
        designation: designation || "",
        extractionMode,
        extractionStats,
        usage: activePlan
          ? {
              planKey: activePlan.key,
              weeklyScanLimit: activePlan.weeklyScanLimit,
              scansUsedThisWeek,
              scansRemainingThisWeek: Math.max(0, activePlan.weeklyScanLimit - scansUsedThisWeek),
            }
          : null,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message });
  }
}
