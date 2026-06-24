import { NextResponse } from "next/server";

const ensureString = (value) => String(value || "").trim();
const ensureStringArray = (value) =>
  Array.isArray(value) ? value.map(ensureString).filter(Boolean) : [];

const callOpenAI = async ({ apiKey, prompt, system, maxTokens = 600, temperature = 0.3 }) => {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            system ||
            "You are an expert resume writer. Return ONLY a single valid JSON object — no markdown, no commentary.",
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
  if (!content) throw new Error("OpenAI returned empty content.");
  return JSON.parse(content);
};

export async function POST(req) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, message: "OPENAI_API_KEY is not set." });
    }

    const body = await req.json();
    const action = ensureString(body?.action);

    // Categorize a single skill into a concise resume skill-section category.
    if (action === "categorize-skill") {
      const skill = ensureString(body?.skill);
      if (!skill) {
        return NextResponse.json({ success: false, message: "Skill is required." });
      }
      const existing = ensureStringArray(body?.existingCategories);
      const prompt = [
        "Categorize this single resume skill into ONE concise skill-section category (1-2 words).",
        'Return JSON: { "category": "string" }.',
        existing.length
          ? `Reuse one of these existing categories EXACTLY if it fits: ${existing.join(", ")}.`
          : "",
        "Examples: 'React' -> 'Frontend'; 'Node.js' -> 'Backend'; 'PostgreSQL' -> 'Databases'; 'Figma' -> 'Design'; 'AWS' -> 'Cloud'; 'Jira' -> 'Tools'; 'Leadership' -> 'Soft Skills'; 'Python' -> 'Languages'; 'SEO' -> 'Marketing'.",
        `Skill: "${skill}"`,
      ]
        .filter(Boolean)
        .join("\n");
      const out = await callOpenAI({ apiKey, prompt, maxTokens: 60, temperature: 0 });
      const category = ensureString(out?.category) || "Other";
      return NextResponse.json({ success: true, category });
    }

    // Generate a professional summary from the candidate's own details.
    if (action === "generate-summary") {
      const designation = ensureString(body?.designation);
      const experienceYears = ensureString(body?.experienceYears);
      const skills = ensureStringArray(body?.skills);
      const experience = ensureStringArray(body?.experience);
      const prompt = [
        "Write a concise, professional resume summary (2-4 sentences, 40-70 words) for the candidate below.",
        "Rules: truthful and grounded ONLY in the details provided; never invent skills, employers, titles, or metrics; no first-person 'I'; no hollow filler ('results-driven', 'passionate', 'go-getter').",
        'Return JSON: { "summary": "string" }.',
        `Target title: ${designation || "(none)"}`,
        `Years of experience: ${experienceYears || "(not specified)"}`,
        `Skills: ${skills.join(", ") || "(none)"}`,
        `Experience highlights:\n${experience.join("\n") || "(none)"}`,
      ].join("\n");
      const out = await callOpenAI({ apiKey, prompt, maxTokens: 250 });
      return NextResponse.json({ success: true, summary: ensureString(out?.summary) });
    }

    // Rephrase free-text work description into ATS-optimized bullet points.
    if (action === "rephrase-experience") {
      const designation = ensureString(body?.designation);
      const company = ensureString(body?.company);
      const text = ensureString(body?.text);
      if (!text) {
        return NextResponse.json({ success: false, message: "Description is required." });
      }
      const prompt = [
        "Rewrite the work description below into 3-5 ATS-optimized resume bullet points.",
        "Rules:",
        "- Each bullet starts with a strong past-tense action verb (Led, Built, Reduced, Increased, Streamlined, Coordinated, ...).",
        "- Use a measurable metric ONLY when the description actually contains a real number (%, count, amount, time). If a bullet has a real number, use it.",
        "- If the description has no number for a point, write a strong, specific, outcome-focused bullet WITHOUT any metric. NEVER invent a number and NEVER output placeholder/template text such as '[X]%', '[N]+', '$[amount]', 'XX%', or 'by X%'. Brackets and placeholder tokens are forbidden.",
        "- Reflect ONLY what the description says the person did — do not add responsibilities or achievements that are not implied.",
        "- One line per bullet, concise and impactful. No first-person pronouns. No leading dash or bullet glyph.",
        'Return JSON: { "bullets": ["string", ...] }.',
        `Role: ${designation || "(unspecified)"} at ${company || "(unspecified)"}`,
        `Description:\n${text}`,
      ].join("\n");
      const out = await callOpenAI({ apiKey, prompt, maxTokens: 500 });
      // Defensive backstop: strip any placeholder/template tokens the model may
      // still slip in (e.g. "by [X]%", "[N]+", "$[amount]", "by XX%") and tidy
      // the resulting spacing/punctuation.
      const cleanBullet = (bullet) =>
        bullet
          .replace(/^[-*•]\s*/, "")
          .replace(/\b(?:by|of|to|for|with|reaching|over)\s+\[[^\]]*\][%+x]*/gi, "")
          .replace(/\bby\s+x+\s*%/gi, "")
          .replace(/\$?\[[^\]]*\]\+?/g, "")
          .replace(/\s+\+(\s|$)/g, "$1")
          .replace(/\s{2,}/g, " ")
          .replace(/\s+([.,;])/g, "$1")
          .replace(/\s*[,;]\s*$/, "")
          .trim();
      const bullets = ensureStringArray(out?.bullets)
        .map(cleanBullet)
        .filter(Boolean);
      return NextResponse.json({ success: true, bullets });
    }

    return NextResponse.json({ success: false, message: "Unknown action." });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message });
  }
}
