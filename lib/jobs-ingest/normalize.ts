import { decodeEntities } from "@/lib/remote-jobs/sanitize";
import { dedupeLabels } from "@/lib/remote-jobs/types";
import { parsePlaces } from "./geo";
import { extractTechStack } from "./tech-stack";
import type { CompanyRow, JobRow, SourceJob } from "./types";

/**
 * Everything every source needs done the same way: dates, workplace type,
 * employment type, seniority, salary, location, tech stack, and the keys used
 * for de-duplication and search. A source adapter only maps its own fields.
 */

/** Descriptions past this are cut. Real postings are 2–10k characters. */
const MAX_DESCRIPTION_CHARS = 60_000;

/**
 * Cheap tag-stripping for matching (tech stack, hybrid hints) — not for
 * display. Running cheerio over 3,000 descriptions a day would cost more CPU
 * than the rest of the ingest; display text is produced properly, per job, when
 * someone opens it.
 */
export const roughText = (html: string) =>
  (html || "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&#x27;|&apos;|&rsquo;/gi, "'")
    .replace(/[ \t]+/g, " ");

const cleanLine = (value: string | null | undefined) =>
  decodeEntities((value || "").replace(/\s+/g, " ").trim());

// ---------------------------------------------------------------------------
// Workplace
// ---------------------------------------------------------------------------

/** Read from a short field — a location or a title. */
export const REMOTE_HINT = /\b(remote|anywhere|distributed|work from home|wfh|telecommut\w*)\b/i;
export const HYBRID_HINT = /\bhybrid\b/i;

/**
 * Read from a description, so it has to be specific: "hybrid" alone also
 * means hybrid cloud, hybrid apps and hybrid vehicles.
 */
const HYBRID_IN_PROSE =
  /\bhybrid[\s-]+(?:work(?:ing)?|model|role|position|arrangement|set[\s-]?up|schedule|policy|environment|office|remote|working model)\b|\b\d\s*(?:-\s*\d\s*)?days?\s+(?:a|per|each)\s+week\s+(?:in|at|from)\s+(?:the|our)?\s*office\b/i;

/** Hybrid when a short field or the description says so plainly. */
export const looksHybrid = (shortFields: string, description = "") =>
  HYBRID_HINT.test(shortFields) || HYBRID_IN_PROSE.test(description);

// ---------------------------------------------------------------------------
// Employment type and seniority
// ---------------------------------------------------------------------------

export const normalizeEmploymentType = (raw: string | null | undefined): string | null => {
  const value = (raw || "").toLowerCase();
  if (!value) return null;
  if (/intern|trainee|apprentice|werkstudent|working student/.test(value)) return "internship";
  if (/part[\s_-]?time/.test(value)) return "part-time";
  if (/contract|freelance|temporary|\btemp\b|fixed[\s-]?term|consult|contractor/.test(value)) {
    return "contract";
  }
  if (/full[\s_-]?time|permanent|fulltime|regular|employee/.test(value)) return "full-time";
  return null;
};

const SENIORITY_FROM_TITLE: [RegExp, string][] = [
  [/\b(chief|c[etfo]o|vp|vice president|head of|director|svp|evp)\b/i, "executive"],
  [/\b(principal|staff|lead|architect|manager)\b/i, "lead"],
  [/\b(senior|sr\.?)\b/i, "senior"],
  [/\b(intern|internship|junior|jr\.?|graduate|entry[\s-]level|trainee|apprentice|new grad)\b/i, "entry"],
  [/\b(mid[\s-]level|intermediate)\b/i, "mid"],
];

const SENIORITY_FROM_SOURCE: [RegExp, string][] = [
  // "Mid-Senior level" (LinkedIn's scale, used by Workable and
  // SmartRecruiters) spans both; it mostly means "not junior", so mid.
  [/mid[\s_-]?senior/i, "mid"],
  [/director|executive|vp|vice president|c[\s-]?level|chief/i, "executive"],
  [/manager|lead|principal|staff/i, "lead"],
  [/senior|experienced|expert/i, "senior"],
  [/mid|intermediate|midweight|associate_?level|mid_senior/i, "mid"],
  [/intern|entry|junior|graduate|student|trainee|associate|beginner/i, "entry"],
];

/**
 * The title is the most reliable signal ("Senior Data Engineer"); "Manager"
 * only counts there when it isn't the job family itself — a Product Manager
 * is not a people lead. The source's own field fills in when the title is
 * silent. Neither → null, which every seniority filter lets through.
 */
export const normalizeSeniority = (
  raw: string | null | undefined,
  title: string
): string | null => {
  const productish = /\b(product|project|program|account|marketing|community|office|success)\s+manager\b/i;
  for (const [pattern, level] of SENIORITY_FROM_TITLE) {
    if (!pattern.test(title)) continue;
    if (level === "lead" && productish.test(title) && !/\b(principal|staff|lead|architect)\b/i.test(title)) {
      continue;
    }
    return level;
  }
  const value = (raw || "").trim();
  if (!value || /^(any|not[\s_]applicable|none|n\/a)$/i.test(value)) return null;
  for (const [pattern, level] of SENIORITY_FROM_SOURCE) {
    if (pattern.test(value)) return level;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Salary
// ---------------------------------------------------------------------------

const PERIOD_ALIASES: [RegExp, string][] = [
  [/hour|hr\b|hourly/i, "hour"],
  [/day|daily/i, "day"],
  [/week|weekly/i, "week"],
  [/fortnight/i, "fortnight"],
  [/month|monthly|mo\b/i, "month"],
  [/year|annual|annum|yr\b|1 year/i, "year"],
];

const PER_YEAR: Record<string, number> = {
  hour: 2080,
  day: 260,
  week: 52,
  fortnight: 26,
  month: 12,
  year: 1,
};

/**
 * Rough USD value of one unit of each currency, for the minimum-salary filter
 * only. A filter that separates "about $50k" from "about $150k" doesn't need
 * live rates; refresh these if a currency moves a long way.
 */
const USD_PER_UNIT: Record<string, number> = {
  USD: 1, EUR: 1.08, GBP: 1.27, INR: 0.012, CAD: 0.73, AUD: 0.66, NZD: 0.6, SGD: 0.75,
  CHF: 1.13, SEK: 0.095, NOK: 0.093, DKK: 0.145, PLN: 0.25, CZK: 0.043, HUF: 0.0027,
  RON: 0.22, BGN: 0.55, BRL: 0.18, MXN: 0.055, COP: 0.00025, CLP: 0.00105, ARS: 0.001,
  ZAR: 0.055, AED: 0.27, SAR: 0.27, ILS: 0.27, TRY: 0.03, UAH: 0.024, JPY: 0.0067,
  CNY: 0.14, HKD: 0.128, KRW: 0.00073, TWD: 0.031, PHP: 0.0175, IDR: 0.000063, MYR: 0.22,
  THB: 0.029, VND: 0.00004, PKR: 0.0036, BDT: 0.0083, LKR: 0.0033, NGN: 0.00065,
  KES: 0.0078, EGP: 0.02,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  $: "USD", "€": "EUR", "£": "GBP", "₹": "INR", "¥": "JPY", "₩": "KRW", "₱": "PHP", "R$": "BRL",
  "C$": "CAD", "A$": "AUD", "CA$": "CAD", "AU$": "AUD", "S$": "SGD",
};

const normalizePeriod = (raw: string | null | undefined): string | null => {
  const value = (raw || "").trim();
  if (!value) return null;
  for (const [pattern, period] of PERIOD_ALIASES) {
    if (pattern.test(value)) return period;
  }
  return null;
};

/**
 * Reads a printed salary: "USD 100,000 – 150,000 per year", "$120K – $160K",
 * "€55k-65k / year", "₹12,00,000 - ₹18,00,000 per annum".
 */
export const parseSalaryText = (text: string) => {
  const value = text.replace(/\s+/g, " ").trim();
  const currencyCode = value.match(/\b([A-Z]{3})\b/)?.[1];
  const symbol = value.match(/(CA\$|AU\$|C\$|A\$|S\$|R\$|[$€£₹¥₩₱])/)?.[1];
  const currency =
    (currencyCode && USD_PER_UNIT[currencyCode] ? currencyCode : null) ||
    (symbol ? CURRENCY_SYMBOLS[symbol] : null);
  const amounts = [...value.matchAll(/(\d[\d,.]*)\s*([kKmM])?\b/g)]
    .map(([, digits, suffix]) => {
      const number = Number(digits.replace(/,/g, ""));
      if (!Number.isFinite(number)) return null;
      const multiplier = /k/i.test(suffix || "") ? 1_000 : /m/i.test(suffix || "") ? 1_000_000 : 1;
      return number * multiplier;
    })
    .filter((amount): amount is number => amount !== null && amount > 0);
  if (!amounts.length) return null;
  return {
    min: amounts[0],
    max: amounts.length > 1 ? amounts[1] : null,
    currency,
    period: normalizePeriod(value),
  };
};

const formatAmount = (value: number) =>
  value >= 1000 ? Math.round(value).toLocaleString("en-US") : String(Math.round(value * 100) / 100);

const buildSalary = (salary: SourceJob["salary"]) => {
  const empty = {
    salary_text: "",
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    salary_period: null,
    salary_usd_annual: null,
  };
  if (!salary) return empty;

  let min = Number(salary.min) || null;
  let max = Number(salary.max) || null;
  let currency = (salary.currency || "").trim().toUpperCase() || null;
  let period = normalizePeriod(salary.period);
  const text = cleanLine(salary.text);

  if (!min && !max && text) {
    const parsed = parseSalaryText(text);
    if (parsed) {
      min = parsed.min;
      max = parsed.max;
      currency = currency || parsed.currency;
      period = period || parsed.period;
    }
  }
  if (!min && !max) return text ? { ...empty, salary_text: text } : empty;
  if (min && max && min > max) [min, max] = [max, min];

  // No stated period: a five-figure-plus number is an annual salary.
  const effectivePeriod = period || ((min || max || 0) >= 15_000 ? "year" : null);
  const rate = currency ? USD_PER_UNIT[currency] : undefined;
  let usdAnnual =
    rate && effectivePeriod ? (min || max || 0) * PER_YEAR[effectivePeriod] * rate : null;
  // Outside this range the numbers are almost certainly mislabelled (an hourly
  // rate marked annual, cents sent as units) — keep the text, skip the filter.
  if (usdAnnual !== null && (usdAnnual < 1_000 || usdAnnual > 2_000_000)) usdAnnual = null;

  const range = min && max && min !== max
    ? `${formatAmount(min)} – ${formatAmount(max)}`
    : formatAmount((min || max) as number);
  const formatted = [currency, range].filter(Boolean).join(" ") +
    (effectivePeriod ? ` / ${effectivePeriod}` : "");

  return {
    salary_text: formatted || text,
    salary_min: min,
    salary_max: max,
    salary_currency: currency,
    salary_period: effectivePeriod,
    salary_usd_annual: usdAnnual === null ? null : Math.round(usdAnnual),
  };
};

// ---------------------------------------------------------------------------
// Industry
// ---------------------------------------------------------------------------

const INDUSTRY_PATTERNS: [RegExp, string][] = [
  [/artificial intelligence|machine learning|\bai\b/i, "ai"],
  [/security|cyber/i, "security"],
  [/crypto|blockchain|web3/i, "crypto"],
  [/bank|financ|insurance|fintech|payment|accounting|investment|capital market/i, "fintech"],
  [/health|medical|hospital|pharma|biotech|life science|clinical|wellness/i, "healthcare"],
  [/education|e-?learning|edtech|school|academ/i, "education"],
  [/gaming|video game|computer games/i, "gaming"],
  [/media|entertainment|publishing|broadcast|music|film|news/i, "media"],
  [/marketing|advertising|public relations/i, "marketing"],
  [/staffing|recruit|human resources/i, "hr"],
  [/retail|e-?commerce|apparel|fashion|luxury|consumer electronics/i, "ecommerce"],
  [/travel|hospitality|leisure|hotel|airline|restaurant/i, "travel"],
  [/logistic|transport|automotive|mobility|supply chain|aviation|aerospace/i, "logistics"],
  [/manufactur|industrial|mechanical|electrical|machinery|chemical|semiconductor/i, "manufacturing"],
  [/energy|oil|renewable|utilit|climate|environment/i, "energy"],
  [/real estate|construction|architecture|property/i, "real-estate"],
  [/telecom|wireless/i, "telecom"],
  [/food|beverage|consumer goods|cpg|fmcg/i, "consumer"],
  [/government|non-?profit|public sector|military|defen[cs]e/i, "public"],
  [/consult|it services|information technology|outsourcing|professional services/i, "consulting"],
  [/developer tools|cloud|infrastructure/i, "devtools"],
  [/software|saas|internet|computer|technology/i, "software"],
];

/** Maps a source's own industry wording onto INDUSTRIES. */
export const mapIndustry = (raw: string | null | undefined): string | null => {
  const value = (raw || "").trim();
  if (!value) return null;
  for (const [pattern, industry] of INDUSTRY_PATTERNS) {
    if (pattern.test(value)) return industry;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Keys and dates
// ---------------------------------------------------------------------------

const LEGAL_SUFFIXES =
  /\b(inc|incorporated|llc|ltd|limited|gmbh|ag|sa|sas|sarl|bv|nv|plc|pvt|private|corp|corporation|co|company|oy|ab|as|aps|srl|spa|pty|llp|lp|kg|se)\b\.?/g;

/** "Hugging Face, Inc." and "hugging face" are the same company. */
export const companyKey = (name: string) => {
  const folded = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const stripped = folded.replace(LEGAL_SUFFIXES, " ").replace(/[^a-z0-9]+/g, "");
  return stripped || folded.replace(/[^a-z0-9]+/g, "") || "unknown";
};

const dedupeKey = (title: string, company: string) =>
  `${title}|${company}`.toLowerCase().replace(/[^a-z0-9|]+/g, "");

/** Unix seconds, unix ms, ISO strings and Dates → ISO, or null. */
export const toIsoDate = (value: SourceJob["postedAt"]): string | null => {
  if (value === null || value === undefined || value === "") return null;
  let date: Date;
  if (value instanceof Date) date = value;
  else if (typeof value === "number" || /^\d+$/.test(String(value))) {
    const number = Number(value);
    date = new Date(number < 1e12 ? number * 1000 : number);
  } else date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

// ---------------------------------------------------------------------------
// The row
// ---------------------------------------------------------------------------

export const buildJobId = (source: string, job: Pick<SourceJob, "board" | "externalId">) =>
  `${source}:${job.board ? `${job.board}~` : ""}${job.externalId}`;

/**
 * One source job → one `jobs` row, or null when it doesn't belong: on-site,
 * workplace unknown, undated, or posted before the retention window.
 */
export const toJobRow = (
  source: string,
  job: SourceJob,
  { now, windowStart }: { now: Date; windowStart: Date }
): JobRow | null => {
  const externalId = String(job.externalId || "").trim();
  const title = cleanLine(job.title).slice(0, 300);
  const companyName = cleanLine(job.companyName).slice(0, 200);
  if (!externalId || !title || !companyName || !job.sourceUrl) return null;
  if (job.workplaceType !== "remote" && job.workplaceType !== "hybrid") return null;

  const postedIso = toIsoDate(job.postedAt);
  if (!postedIso) return null;
  const posted = new Date(postedIso);
  if (posted < windowStart) return null;
  // A date in the future is a source glitch; treat it as "today".
  const postedAt = posted > now ? now.toISOString() : postedIso;

  const expiresAt = toIsoDate(job.expiresAt ?? null);
  if (expiresAt && new Date(expiresAt) < now) return null;

  const location = cleanLine(job.location).slice(0, 300);
  const places = parsePlaces([location, ...(job.places || [])]);
  // A hybrid job is tied to its office, so it is never "worldwide" even if the
  // source's location mentions a region. (Whether a remote job with no stated
  // area is open to everyone depends on the source — adapters whose API means
  // "unrestricted" by an empty location pass "Anywhere" in `places`.)
  if (job.workplaceType === "hybrid") {
    places.regions = places.regions.filter((region) => region !== "worldwide");
  }

  const descriptionHtml =
    job.descriptionHtml === undefined ? undefined : job.descriptionHtml.slice(0, MAX_DESCRIPTION_CHARS);
  const plain = descriptionHtml ? roughText(descriptionHtml) : "";
  const categories = dedupeLabels((job.categories || []).map((value) => cleanLine(value))).slice(0, 8);
  const techStack = extractTechStack(title, plain, companyName);

  const row: JobRow = {
    id: buildJobId(source, { board: job.board, externalId }),
    source,
    external_id: externalId,
    board: job.board || null,
    source_url: job.sourceUrl,
    application_url: job.applicationUrl || job.sourceUrl,
    title,
    company_name: companyName,
    company_key: companyKey(companyName),
    company_logo: job.companyLogo || "",
    location,
    countries: places.countries,
    regions: places.regions,
    workplace_type: job.workplaceType,
    employment_type: normalizeEmploymentType(job.employmentType),
    seniority: normalizeSeniority(job.seniority, title),
    ...buildSalary(job.salary),
    tech_stack: techStack,
    categories,
    source_industry: mapIndustry(job.industry),
    source_is_startup: job.isStartup === true ? true : null,
    posted_at: postedAt,
    expires_at: expiresAt,
    dedupe_key: dedupeKey(title, companyName),
    search_text: [title, companyName, ...categories, ...techStack].join(" ").toLowerCase(),
    last_seen_at: now.toISOString(),
  };
  if (descriptionHtml !== undefined) row.description_html = descriptionHtml;
  return row;
};

export const toCompanyRow = (job: SourceJob, row: JobRow): CompanyRow => ({
  key: row.company_key,
  name: row.company_name,
  website: job.companyWebsite || null,
});
