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
  return data.text || "";
}

async function parseDoc(buffer) {
  const doc = await extractor.extract(buffer);
  return doc.getBody();
}

async function parseDocx(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  return value;
}

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