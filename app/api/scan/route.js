import { NextResponse } from "next/server";
import PdfParse from "pdf-parse";
import mammoth from "mammoth";
import WordExtractor from "word-extractor";

const extractor = new WordExtractor();
const SUPPORTED_FORMATS = ["pdf", "doc", "docx"];
const PROFILE_LINK_DOMAINS = {
  behance: ["behance.net"],
  github: ["github.com"],
  linkedin: ["linkedin.com"],
};
const NON_PORTFOLIO_DOMAINS = [
  "linkedin.com",
  "github.com",
  "behance.net",
  "dribbble.com",
  "medium.com",
  "gitlab.com",
  "kaggle.com",
  "leetcode.com",
  "hackerrank.com",
  "calendly.com",
  "zoom.us",
  "teams.microsoft.com",
  "meet.google.com",
  "docs.google.com",
  "drive.google.com",
  "dropbox.com",
];

const normalizeText = (value = "") =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

const ensureString = (value = "") =>
  typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";

// Some PDFs encode the name header with no real spaces between words (tight
// kerning / glyph-positioned text). When extraction yields a glued, camelCase
// run like "AleenaMariamBenny", restore the word boundaries defensively.
const restoreNameSpacing = (value = "") => {
  const name = ensureString(value);
  if (!name || /\s/.test(name)) return name;
  if (!/[a-z][A-Z]/.test(name)) return name;
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
};

const extractFirstJsonObject = (text = "") => {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;

    if (depth === 0) {
      return text.slice(start, index + 1);
    }
  }

  return null;
};

const stripTrailingUrlPunctuation = (value = "") =>
  value.replace(/^[<(]+/g, "").replace(/[)\].,;:!?]+$/g, "");

const normalizeProfileUrl = (value = "") => {
  const trimmed = stripTrailingUrlPunctuation(ensureString(value));
  if (!trimmed || /\s/.test(trimmed)) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : /^www\./i.test(trimmed)
    ? `https://${trimmed}`
    : trimmed.includes(".")
    ? `https://${trimmed}`
    : "";

  if (!withProtocol) return "";

  try {
    const parsed = new URL(withProtocol);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
};

const hostMatches = (host = "", domain = "") =>
  host === domain || host.endsWith(`.${domain}`);

const urlMatchesDomains = (url = "", domains = []) => {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return domains.some((domain) => hostMatches(host, domain));
  } catch {
    return false;
  }
};

const normalizeDomainUrl = (value = "", domains = []) => {
  const url = normalizeProfileUrl(value);
  return url && urlMatchesDomains(url, domains) ? url : "";
};

const normalizePortfolioUrl = (value = "") => {
  const url = normalizeProfileUrl(value);
  if (!url) return "";
  if (urlMatchesDomains(url, NON_PORTFOLIO_DOMAINS)) return "";
  const path = decodeURIComponent(new URL(url).pathname).toLowerCase();
  if (/(^|\/)(resume|cv)(\/|$)|(?:resume|cv)\.pdf$/i.test(path)) return "";
  return url;
};

const normalizeExperienceYears = (value) => {
  const rawValue = ensureString(value);
  const numeric = Number(rawValue) || Number(rawValue.match(/\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(numeric) || numeric < 0) return "";
  return String(Math.round(numeric));
};

const sanitizeProfile = (profile = {}) => {
  const currentDesignation = ensureString(profile.currentDesignation);
  const currentOrganization = ensureString(profile.currentOrganization);
  const modelHeadline = ensureString(profile.headline);
  const headline =
    currentDesignation && currentOrganization
      ? `${currentDesignation} @ ${currentOrganization}`
      : modelHeadline.includes("@")
      ? modelHeadline
      : "";

  return {
    fullName: restoreNameSpacing(profile.fullName),
    email: ensureString(profile.email),
    phone: ensureString(profile.phone),
    headline,
    behance: normalizeDomainUrl(profile.behance, PROFILE_LINK_DOMAINS.behance),
    github: normalizeDomainUrl(profile.github, PROFILE_LINK_DOMAINS.github),
    linkedin: normalizeDomainUrl(profile.linkedin, PROFILE_LINK_DOMAINS.linkedin),
    portfolio: normalizePortfolioUrl(profile.portfolio),
    otherLink: normalizeProfileUrl(profile.otherLink),
    city: ensureString(profile.city),
    country: ensureString(profile.country),
    experienceYears: normalizeExperienceYears(
      profile.experienceYears ?? profile.experience_years
    ),
  };
};

const extractProfileWithAI = async (resumeText = "") => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  const prompt = [
    "Extract structured profile data from this resume.",
    "",
    "Rules:",
    "1) Use only facts explicitly present in the resume. Never invent values.",
    "2) Return empty strings for absent or uncertain fields.",
    '3) Professional headline must be exactly "Designation @ Organization". Use the current role when a role has Present/Current/Ongoing/Now/To Date. If no current role exists, use the latest dated role.',
    "4) currentDesignation and currentOrganization should be the same role used to build headline.",
    "5) Portfolio must be the exact portfolio/personal website/work-sample link from the resume. It may be a personal domain containing part of the candidate name.",
    "6) Do not put LinkedIn, GitHub, Behance, Medium, Calendly, meeting, cloud document, or resume-file links in portfolio.",
    "7) City and country must be the candidate location from contact/address/location text, not an employer or education location.",
    "8) experienceYears must be total professional experience as a whole-number string. Prefer explicit total-years text; otherwise calculate from dated work history. Leave empty if unknown.",
    "9) Preserve exact URL strings, adding https:// only when the resume omits a protocol.",
    "",
    "Return compact JSON only with this schema:",
    JSON.stringify({
      fullName: "string",
      email: "string",
      phone: "string",
      currentDesignation: "string",
      currentOrganization: "string",
      headline: "Designation @ Organization",
      behance: "string",
      github: "string",
      linkedin: "string",
      portfolio: "string",
      otherLink: "string",
      city: "string",
      country: "string",
      experienceYears: "string",
    }),
    "",
    "Resume text:",
    resumeText.slice(0, 12000),
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract resume profile data with high precision. Return valid compact JSON only.",
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
    throw new Error("OpenAI returned empty profile extraction.");
  }

  const jsonBlock = extractFirstJsonObject(content);
  if (!jsonBlock) {
    throw new Error("OpenAI returned non-JSON profile extraction.");
  }

  return sanitizeProfile(JSON.parse(jsonBlock));
};

// pdf-parse's default page renderer concatenates adjacent text items with no
// separator. Many PDFs encode each word (or glyph run) as a separate item with
// no trailing space and rely on positioning for spacing, so the default output
// loses ALL spaces ("Work Experience" -> "WorkExperience"). That breaks section
// detection, name/contact parsing, and degrades the AI optimization input.
//
// This custom renderer reconstructs spacing from glyph positions: it inserts a
// space when there's a horizontal gap between items, and a newline when the
// vertical baseline changes.
function renderPageWithSpacing(pageData) {
  return pageData
    .getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
    .then((textContent) => {
      let text = "";
      let prevEndX = null;
      let prevY = null;
      let prevFontHeight = 10;

      for (const item of textContent.items) {
        const str = item.str;
        if (!str) continue;

        const x = item.transform[4];
        const y = item.transform[5];
        const width = typeof item.width === "number" ? item.width : 0;
        const fontHeight =
          (typeof item.height === "number" && item.height) ||
          Math.abs(item.transform[3]) ||
          prevFontHeight;

        if (prevY !== null && Math.abs(y - prevY) > fontHeight * 0.5) {
          // Baseline moved -> new line.
          if (!text.endsWith("\n")) text += "\n";
        } else if (prevEndX !== null) {
          // Same line: insert a space if there's a meaningful horizontal gap.
          // A word space is roughly 0.2-0.3x the font height; use a conservative
          // threshold and never produce double spaces.
          const gap = x - prevEndX;
          if (gap > fontHeight * 0.2 && !text.endsWith(" ") && !text.endsWith("\n")) {
            text += " ";
          }
        }

        text += str;
        prevEndX = x + width;
        prevY = y;
        prevFontHeight = fontHeight;
      }

      return text;
    });
}

async function parsePdf(buffer) {
  let text = "";
  try {
    const data = await PdfParse(buffer, { pagerender: renderPageWithSpacing });
    text = data.text || "";
  } catch {
    // Fall back to the default renderer if the position-aware pass fails.
    const data = await PdfParse(buffer);
    text = data.text || "";
  }
  const discoveredLinks = extractPdfLinks(buffer);
  if (!discoveredLinks.length) return text;
  return `${text}\n\nProfile Links: ${discoveredLinks.join(" | ")}`;
}

async function parseDoc(buffer) {
  const doc = await extractor.extract(buffer);
  return doc.getBody();
}

async function parseDocx(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

const decodePdfLiteral = (value = "") =>
  value
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\([0-7]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));

const decodePdfHexString = (value = "") => {
  const cleaned = value.replace(/\s+/g, "");
  if (!cleaned || cleaned.length % 2 !== 0) return "";
  const bytes = [];
  for (let i = 0; i < cleaned.length; i += 2) {
    const byte = Number.parseInt(cleaned.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) return "";
    bytes.push(byte);
  }
  return Buffer.from(bytes).toString("utf8");
};

const normalizeExtractedUrl = (value = "") => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
  if (
    /^(linkedin\.com|github\.com|behance\.net|gitlab\.com|medium\.com|dribbble\.com|portfolio\.)/i.test(
      trimmed
    )
  ) {
    return `https://${trimmed}`;
  }
  return "";
};

const extractPdfLinks = (buffer) => {
  const raw = buffer.toString("latin1");
  const links = new Set();

  const literalUriRegex = /\/URI\s*\(([^)]+)\)/g;
  let literalMatch;
  while ((literalMatch = literalUriRegex.exec(raw)) !== null) {
    const decoded = decodePdfLiteral(literalMatch[1] || "");
    const normalized = normalizeExtractedUrl(decoded);
    if (normalized) links.add(normalized);
  }

  const hexUriRegex = /\/URI\s*<([0-9A-Fa-f\s]+)>/g;
  let hexMatch;
  while ((hexMatch = hexUriRegex.exec(raw)) !== null) {
    const decoded = decodePdfHexString(hexMatch[1] || "");
    const normalized = normalizeExtractedUrl(decoded);
    if (normalized) links.add(normalized);
  }

  return Array.from(links);
};

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const shouldExtractProfile = formData.get("extractProfile") === "true";

    if (!file) {
      return NextResponse.json({
        success: false,
        message: "No file received.",
      });
    }

    const extension = file.name?.split(".").pop()?.toLowerCase();

    if (!extension || !SUPPORTED_FORMATS.includes(extension)) {
      return NextResponse.json({
        success: false,
        message: "Unsupported file type. Upload PDF, DOC or DOCX files.",
      });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extracted = "";

    if (extension === "pdf") {
      extracted = await parsePdf(buffer);
    } else if (extension === "docx") {
      extracted = await parseDocx(buffer);
    } else {
      extracted = await parseDoc(buffer);
    }

    const cleaned = normalizeText(extracted);

    if (!cleaned) {
      return NextResponse.json({
        success: false,
        message: "We could not extract any readable text from this file.",
      });
    }

    if (!shouldExtractProfile) {
      return NextResponse.json({ success: true, message: cleaned });
    }

    const profile = await extractProfileWithAI(cleaned);

    return NextResponse.json({ success: true, message: cleaned, profile });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message });
  }
}
