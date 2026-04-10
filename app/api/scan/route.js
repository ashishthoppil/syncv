import { NextResponse } from "next/server";
import PdfParse from "pdf-parse";
import mammoth from "mammoth";
import WordExtractor from "word-extractor";

const extractor = new WordExtractor();
const SUPPORTED_FORMATS = ["pdf", "doc", "docx"];

const normalizeText = (value = "") =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

async function parsePdf(buffer) {
  const data = await PdfParse(buffer);
  const text = data.text || "";
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

    return NextResponse.json({ success: true, message: cleaned });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message });
  }
}
