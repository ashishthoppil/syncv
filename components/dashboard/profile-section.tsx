"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabaseClient";
import { AlertCircleIcon, BriefcaseBusiness, Building2, CalendarPlusIcon, File, GithubIcon, Globe, Image as ImageIcon, LinkedinIcon, Loader2, Mail, MapIcon, PhoneCall, SaveIcon, User2, User2Icon, UserCircle2Icon } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { toast } from "react-toastify";

type ProfileSectionProps = {
  user: {
    id?: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  } | null;
};

type ParsedProfile = Partial<
  Record<
    | "fullName"
    | "email"
    | "phone"
    | "headline"
    | "behance"
    | "github"
    | "linkedin"
    | "portfolio"
    | "otherLink"
    | "city"
    | "country"
    | "experienceYears",
    string
  >
>;

type ResumeLink = {
  href: string;
  host: string;
  hasExplicitScheme: boolean;
  line: string;
  lineIndex: number;
  pathname: string;
};

type RoleEntry = {
  designation: string;
  organization: string;
  isCurrent: boolean;
  startMonth?: number;
  endMonth?: number;
};

type LocationResult = {
  city?: string;
  country?: string;
};

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const URL_REGEX =
  /\b(?:https?:\/\/|www\.)[^\s<>"']+|\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|net|org|io|dev|app|me|co|in|ai|design|studio|site|xyz|tech|info|online|space|page|link|work|portfolio|blog|codes|cloud|software|digital|website|solutions|pro|live|world|us|uk|ca|au|de|fr|sg|ae|nl|es|it|edu)(?:\/[^\s<>"']*)?/gi;
const SECTION_HEADING_REGEX =
  /^(summary|profile|objective|skills|technical skills|core competencies|experience|professional experience|work experience|employment history|career history|projects|education|certifications|licenses|awards|achievements|publications|languages|volunteer|references)\s*:?\s*$/i;
const EXPERIENCE_HEADING_REGEX =
  /^(experience|professional experience|work experience|employment history|career history|professional background|internships?)\s*:?\s*$/i;
const TITLE_KEYWORD_REGEX =
  /\b(engineer|developer|architect|manager|lead|consultant|analyst|specialist|designer|director|officer|coordinator|administrator|executive|intern|trainee|associate|scientist|researcher|teacher|professor|lecturer|nurse|accountant|auditor|marketer|writer|editor|product|project|program|scrum|qa|tester|sde|sre|devops|frontend|front-end|backend|back-end|fullstack|full-stack|software|data|machine learning|ai|ux|ui)\b/i;
const COMPANY_HINT_REGEX =
  /\b(inc|llc|ltd|limited|pvt|private|corp|corporation|company|co\.|technologies|technology|systems|solutions|services|labs|studio|group|bank|university|school|college|consulting|software|digital|media|global|partners|industries|foundation|agency)\b/i;
const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};
const DATE_TOKEN =
  "(?:(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?\\s+)?(?:19|20)\\d{2}|present|current|now|ongoing|till\\s+date|to\\s+date|date";
const DATE_RANGE_REGEX = new RegExp(
  `(${DATE_TOKEN})\\s*(?:-|\\u2013|\\u2014|to)\\s*(${DATE_TOKEN})`,
  "i"
);
const US_STATE_REGEX =
  /^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY|Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)$/i;
const INDIA_STATE_REGEX =
  /^(AP|AR|AS|BR|CG|GA|GJ|HR|HP|JH|KA|KL|MP|MH|MN|ML|MZ|NL|OD|PB|RJ|SK|TN|TS|TR|UP|UK|WB|Andhra Pradesh|Arunachal Pradesh|Assam|Bihar|Chhattisgarh|Goa|Gujarat|Haryana|Himachal Pradesh|Jharkhand|Karnataka|Kerala|Madhya Pradesh|Maharashtra|Manipur|Meghalaya|Mizoram|Nagaland|Odisha|Punjab|Rajasthan|Sikkim|Tamil Nadu|Telangana|Tripura|Uttar Pradesh|Uttarakhand|West Bengal|Delhi)$/i;
const COUNTRY_ALIASES: Array<[string, string]> = [
  ["usa", "United States"],
  ["u.s.a", "United States"],
  ["u.s.", "United States"],
  ["us", "United States"],
  ["united states", "United States"],
  ["united states of america", "United States"],
  ["uk", "United Kingdom"],
  ["u.k.", "United Kingdom"],
  ["united kingdom", "United Kingdom"],
  ["uae", "United Arab Emirates"],
  ["u.a.e.", "United Arab Emirates"],
  ["united arab emirates", "United Arab Emirates"],
  ["india", "India"],
  ["canada", "Canada"],
  ["australia", "Australia"],
  ["germany", "Germany"],
  ["france", "France"],
  ["singapore", "Singapore"],
  ["ireland", "Ireland"],
  ["netherlands", "Netherlands"],
  ["spain", "Spain"],
  ["italy", "Italy"],
  ["switzerland", "Switzerland"],
  ["sweden", "Sweden"],
  ["norway", "Norway"],
  ["denmark", "Denmark"],
  ["finland", "Finland"],
  ["new zealand", "New Zealand"],
  ["south africa", "South Africa"],
  ["japan", "Japan"],
  ["china", "China"],
  ["hong kong", "Hong Kong"],
  ["malaysia", "Malaysia"],
  ["philippines", "Philippines"],
  ["indonesia", "Indonesia"],
  ["thailand", "Thailand"],
  ["brazil", "Brazil"],
  ["mexico", "Mexico"],
  ["argentina", "Argentina"],
  ["poland", "Poland"],
  ["portugal", "Portugal"],
];
const REGION_CODES =
  "AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB UM US UY UZ VU VE VN VG VI WF EH YE ZM ZW"
    .split(" ");

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const cleanText = (value = "") =>
  value
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:|/\\\-()[\]{}]+|[\s,;:|/\\\-()[\]{}]+$/g, "")
    .trim();

const splitResumeLines = (resumeText: string) =>
  resumeText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

const stripTrailingUrlPunctuation = (value = "") =>
  value.replace(/^[<(]+/g, "").replace(/[)\].,;:!?]+$/g, "");

const normalizeResumeUrl = (value = "") => {
  const trimmed = stripTrailingUrlPunctuation(value.trim());
  if (!trimmed || /\s/.test(trimmed)) return "";
  const hasExplicitScheme = /^(https?:\/\/|www\.)/i.test(trimmed);
  const bareHost = trimmed.split(/[/?#]/)[0] || "";
  if (!hasExplicitScheme && bareHost.split(".")[0]?.length <= 1) return "";

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
};

const extractResumeLinks = (lines: string[]) => {
  const seen = new Set<string>();
  const links: ResumeLink[] = [];

  lines.forEach((line, lineIndex) => {
    URL_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = URL_REGEX.exec(line)) !== null) {
      const matchIndex = match.index ?? 0;
      if (matchIndex > 0 && line[matchIndex - 1] === "@") continue;

      const rawLink = match[0];
      const href = normalizeResumeUrl(rawLink);
      if (!href || seen.has(href)) continue;

      try {
        const parsed = new URL(href);
        const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
        seen.add(href);
        links.push({
          href,
          host,
          hasExplicitScheme: /^(https?:\/\/|www\.)/i.test(rawLink),
          line,
          lineIndex,
          pathname: parsed.pathname.toLowerCase(),
        });
      } catch {
        // Ignore malformed links from noisy PDF text.
      }
    }
    URL_REGEX.lastIndex = 0;
  });

  return links;
};

const hostMatches = (host: string, domain: string) =>
  host === domain || host.endsWith(`.${domain}`);

const findLinkByDomain = (links: ResumeLink[], domains: string[]) =>
  links.find((link) => domains.some((domain) => hostMatches(link.host, domain)))
    ?.href;

const getNameTokens = (fullName = "") =>
  fullName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && !["resume", "curriculum", "vitae"].includes(part));

const scorePortfolioLink = (
  link: ResumeLink,
  fullName: string,
  lines: string[]
) => {
  const blockedSocialDomains = [
    "linkedin.com",
    "github.com",
    "behance.net",
    "dribbble.com",
    "medium.com",
    "gitlab.com",
    "kaggle.com",
    "leetcode.com",
    "hackerrank.com",
    "twitter.com",
    "x.com",
    "facebook.com",
    "instagram.com",
    "youtube.com",
    "calendly.com",
    "zoom.us",
    "teams.microsoft.com",
    "meet.google.com",
    "docs.google.com",
    "drive.google.com",
    "dropbox.com",
  ];
  const knownPortfolioDomains = [
    "about.me",
    "carrd.co",
    "read.cv",
    "webflow.io",
    "wixsite.com",
    "notion.site",
    "framer.website",
  ];

  if (
    blockedSocialDomains.some((domain) => hostMatches(link.host, domain)) &&
    !knownPortfolioDomains.some((domain) => hostMatches(link.host, domain))
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  const nearbyText = [lines[link.lineIndex - 1], link.line, lines[link.lineIndex + 1]]
    .filter(Boolean)
    .join(" ");
  const source = `${link.host}${decodeURIComponent(link.pathname)}`.toLowerCase();
  const explicitPortfolioLabel =
    /\b(portfolio|personal\s+(?:site|website)|website|web\s*site|online\s+portfolio|work\s+samples|case\s+studies)\b/i.test(
      nearbyText
    );
  let score = 0;

  if (explicitPortfolioLabel) score += 9;
  if (/\bportfolio\b/i.test(source)) score += 8;
  if (knownPortfolioDomains.some((domain) => hostMatches(link.host, domain))) {
    score += 7;
  }

  const nameTokens = getNameTokens(fullName);
  const compactName = nameTokens.join("");
  if (compactName && source.replace(/[^a-z0-9]/g, "").includes(compactName)) {
    score += 6;
  }
  nameTokens.forEach((token) => {
    if (source.includes(token)) score += 2;
  });

  const tld = link.host.split(".").pop() || "";
  if (["dev", "io", "me", "app", "design", "studio", "site", "page", "work"].includes(tld)) {
    score += 3;
  }
  if (/\b(resume|cv)\b/i.test(link.pathname) && !explicitPortfolioLabel) {
    score -= 4;
  }

  return score;
};

const choosePortfolioLink = (
  links: ResumeLink[],
  fullName: string,
  lines: string[]
) => {
  const scored = links
    .map((link) => ({ link, score: scorePortfolioLink(link, fullName, lines) }))
    .filter((item) => item.score >= 5)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.link.href;
};

const chooseOtherLink = (links: ResumeLink[], usedLinks: Array<string | undefined>) => {
  const used = new Set(usedLinks.filter(Boolean));
  const professionalDomains = [
    "dribbble.com",
    "medium.com",
    "gitlab.com",
    "kaggle.com",
    "leetcode.com",
    "hackerrank.com",
    "linktr.ee",
    "read.cv",
  ];

  return links.find(
    (link) =>
      !used.has(link.href) &&
      (link.hasExplicitScheme ||
        professionalDomains.some((domain) => hostMatches(link.host, domain)) ||
        /\b(profile|website|portfolio|link)\b/i.test(link.line))
  )?.href;
};

const extractFullName = (lines: string[]) => {
  const contactBlock = lines.slice(0, 8);
  for (const line of contactBlock) {
    const candidate = cleanText(
      line.replace(EMAIL_REGEX, "").replace(PHONE_REGEX, "").replace(URL_REGEX, "")
    );
    const wordCount = candidate.split(/\s+/).filter(Boolean).length;
    const looksLikeName =
      wordCount >= 2 &&
      wordCount <= 5 &&
      !/\d/.test(candidate) &&
      !SECTION_HEADING_REGEX.test(candidate) &&
      !TITLE_KEYWORD_REGEX.test(candidate) &&
      /^[A-Za-z][A-Za-z\s.'-]+$/.test(candidate);

    if (looksLikeName) return candidate;
  }

  return "";
};

const extractPhoneNumber = (lines: string[], resumeText: string) => {
  const firstSectionIndex = lines.findIndex((line) => SECTION_HEADING_REGEX.test(line));
  const contactBlockEnd =
    firstSectionIndex > -1 ? Math.min(firstSectionIndex, 14) : Math.min(lines.length, 14);
  const searchText = lines.slice(0, contactBlockEnd).join("\n") || resumeText;

  PHONE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PHONE_REGEX.exec(searchText)) !== null) {
    const candidate = cleanText(match[0]);
    const digits = candidate.replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) continue;
    if (DATE_RANGE_REGEX.test(candidate)) continue;
    if (/^\d{4}\s*(?:-|\u2013|\u2014|to)\s*\d{4}$/i.test(candidate)) continue;
    PHONE_REGEX.lastIndex = 0;
    return candidate;
  }

  PHONE_REGEX.lastIndex = 0;
  return "";
};

const getCountryAliasMap = () => {
  const map = new Map<string, string>();
  COUNTRY_ALIASES.forEach(([alias, canonical]) => map.set(alias, canonical));

  if (typeof Intl.DisplayNames !== "undefined") {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    REGION_CODES.forEach((region) => {
      const name = displayNames.of(region);
      if (name) map.set(name.toLowerCase(), name);
    });
  }

  return Array.from(map.entries()).sort((a, b) => b[0].length - a[0].length);
};

const findCountry = (value: string) => {
  const normalized = value.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
  for (const [alias, canonical] of getCountryAliasMap()) {
    const aliasPattern = escapeRegExp(alias.replace(/\./g, ""));
    const match = normalized.match(
      new RegExp(`(?:^|[\\s,;|()-])(${aliasPattern})(?:$|[\\s,;|()-])`, "i")
    );
    if (match) {
      return {
        country: canonical,
        index: match.index ?? 0,
        alias: match[1],
      };
    }
  }
  return null;
};

const isRegionOnly = (value: string) =>
  US_STATE_REGEX.test(value) || INDIA_STATE_REGEX.test(value);

const looksLikeCity = (value: string) => {
  const candidate = cleanText(value);
  const wordCount = candidate.split(/\s+/).filter(Boolean).length;
  return (
    candidate.length >= 2 &&
    candidate.length <= 45 &&
    wordCount <= 5 &&
    !/\d/.test(candidate) &&
    !SECTION_HEADING_REGEX.test(candidate) &&
    !isRegionOnly(candidate) &&
    /^[A-Za-z][A-Za-z\s.'-]+$/.test(candidate)
  );
};

const pickNearestCityPart = (parts: string[]) => {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = cleanText(parts[index]);
    if (looksLikeCity(part)) return part;
  }
  return "";
};

const parseLocationCandidate = (rawValue: string): LocationResult | null => {
  const withoutContact = rawValue
    .replace(EMAIL_REGEX, "")
    .replace(PHONE_REGEX, "")
    .replace(URL_REGEX, "");
  const value = cleanText(
    withoutContact.replace(/^(location|address|based in|current location)\s*[:\-]\s*/i, "")
  );

  if (!value || value.length > 100 || /@/.test(value)) return null;

  const commaParts = value.split(",").map(cleanText).filter(Boolean);
  for (let index = 0; index < commaParts.length; index += 1) {
    const country = findCountry(commaParts[index]);
    if (country) {
      const city = pickNearestCityPart(commaParts.slice(0, index));
      return { city: city || undefined, country: country.country };
    }
  }

  const country = findCountry(value);
  if (country) {
    const cityPart = cleanText(value.slice(0, country.index));
    const city = pickNearestCityPart(cityPart.split(/[,|;]+/).map(cleanText));
    return { city: city || undefined, country: country.country };
  }

  const usStateMatch = value.match(/^(.+?),\s*([A-Z]{2}|[A-Za-z\s]+)$/);
  if (usStateMatch && US_STATE_REGEX.test(cleanText(usStateMatch[2]))) {
    const city = pickNearestCityPart(usStateMatch[1].split(",").map(cleanText));
    return city ? { city, country: "United States" } : null;
  }

  const indiaStateMatch = value.match(/^(.+?),\s*([A-Z]{2}|[A-Za-z\s]+)$/);
  if (indiaStateMatch && INDIA_STATE_REGEX.test(cleanText(indiaStateMatch[2]))) {
    const city = pickNearestCityPart(indiaStateMatch[1].split(",").map(cleanText));
    return city ? { city, country: "India" } : null;
  }

  return null;
};

const extractLocation = (lines: string[]) => {
  const firstSectionIndex = lines.findIndex((line) => SECTION_HEADING_REGEX.test(line));
  const contactBlockEnd =
    firstSectionIndex > -1 ? Math.min(firstSectionIndex, 14) : Math.min(lines.length, 14);
  const contactLines = lines.slice(0, contactBlockEnd);
  const labeledLines = lines.filter((line) =>
    /^(location|address|based in|current location)\s*[:\-]/i.test(line)
  );

  for (const line of [...labeledLines, ...contactLines]) {
    const pieces = line.split(/[|;]|\u2022|\u00b7/g).map(cleanText).filter(Boolean);
    for (const piece of pieces) {
      const location = parseLocationCandidate(piece);
      if (location?.city || location?.country) return location;
    }
  }

  return null;
};

const parseResumeDateToken = (token: string, isEnd: boolean) => {
  const normalized = token.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (/^(present|current|now|ongoing|till date|to date|date)$/.test(normalized)) {
    const now = new Date();
    return now.getFullYear() * 12 + now.getMonth();
  }

  const yearMatch = normalized.match(/(?:19|20)\d{2}/);
  if (!yearMatch) return undefined;

  const monthKey = Object.keys(MONTHS).find((month) =>
    new RegExp(`\\b${month}\\b`, "i").test(normalized)
  );
  const month = monthKey ? MONTHS[monthKey] : isEnd ? 11 : 0;
  return Number(yearMatch[0]) * 12 + month;
};

const extractDateRange = (line: string) => {
  const match = line.match(DATE_RANGE_REGEX);
  if (!match) return null;

  const startMonth = parseResumeDateToken(match[1], false);
  const endMonth = parseResumeDateToken(match[2], true);
  if (startMonth === undefined || endMonth === undefined) return null;

  return {
    startMonth,
    endMonth,
    isCurrent: /present|current|now|ongoing|till\s+date|to\s+date/i.test(match[2]),
  };
};

const stripDateRange = (value: string) => value.replace(DATE_RANGE_REGEX, "");

const cleanRoleCandidate = (value = "") =>
  cleanText(
    stripDateRange(value)
      .replace(EMAIL_REGEX, "")
      .replace(PHONE_REGEX, "")
      .replace(URL_REGEX, "")
      .replace(/^(role|title|designation|position|company|organization|employer)\s*[:\-]\s*/i, "")
      .replace(/^[*•\-\u2022\u00b7]+\s*/, "")
  );

const isBadRoleCandidate = (value: string) =>
  !value ||
  value.length > 90 ||
  SECTION_HEADING_REGEX.test(value) ||
  /^(responsibilities|achievements|technologies|environment|tools)\s*:?$/i.test(value) ||
  /@/.test(value) ||
  /\b(gpa|cgpa|grade|degree)\b/i.test(value);

const isLikelyTitle = (value: string) =>
  !isBadRoleCandidate(value) && TITLE_KEYWORD_REGEX.test(value);

const isLikelyCompany = (value: string) => {
  if (isBadRoleCandidate(value) || isLikelyTitle(value) || /\d{4}/.test(value)) return false;
  const wordCount = value.split(/\s+/).filter(Boolean).length;
  return (
    COMPANY_HINT_REGEX.test(value) ||
    (wordCount <= 6 && /^[A-Z0-9][A-Za-z0-9&.,' -]+$/.test(value))
  );
};

const splitRolePieces = (value: string) =>
  value
    .split(/\s+(?:\||\/|\u2022|\u00b7|-)\s+|,\s+(?=[A-Z])/g)
    .map(cleanRoleCandidate)
    .filter(Boolean);

const parseRoleFromPieces = (pieces: string[]) => {
  const designation = pieces.find(isLikelyTitle) || "";
  const organization =
    pieces.find((piece) => piece !== designation && isLikelyCompany(piece)) || "";

  return { designation, organization };
};

const parseRoleFromBlock = (block: string[]) => {
  const cleanedLines = block.map(cleanRoleCandidate).filter(Boolean);

  for (const line of cleanedLines) {
    const atParts = line.split(/\s+@\s+/).map(cleanRoleCandidate).filter(Boolean);
    if (atParts.length >= 2) {
      const parsed = parseRoleFromPieces(atParts);
      if (parsed.designation && parsed.organization) return parsed;
    }

    const pieces = splitRolePieces(line);
    if (pieces.length >= 2) {
      const parsed = parseRoleFromPieces(pieces);
      if (parsed.designation && parsed.organization) return parsed;
    }
  }

  const designationIndex = cleanedLines.findIndex(isLikelyTitle);
  if (designationIndex > -1) {
    const designation = cleanedLines[designationIndex];
    const neighborIndexes = [
      designationIndex - 1,
      designationIndex + 1,
      designationIndex - 2,
      designationIndex + 2,
    ].filter((index) => index >= 0 && index < cleanedLines.length);
    const organization =
      neighborIndexes
        .map((index) => cleanedLines[index])
        .find((line) => line !== designation && isLikelyCompany(line)) || "";

    if (organization) return { designation, organization };
  }

  return { designation: "", organization: "" };
};

const getExperienceSectionLines = (lines: string[]) => {
  const startIndex = lines.findIndex((line) => EXPERIENCE_HEADING_REGEX.test(line));
  if (startIndex === -1) return lines;

  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (SECTION_HEADING_REGEX.test(lines[index])) {
      endIndex = index;
      break;
    }
  }

  return lines.slice(startIndex + 1, endIndex);
};

const extractRoleEntries = (lines: string[]) => {
  const experienceLines = getExperienceSectionLines(lines);
  const dateIndexes = experienceLines
    .map((line, index) => ({ index, range: extractDateRange(line) }))
    .filter((item): item is { index: number; range: NonNullable<ReturnType<typeof extractDateRange>> } =>
      Boolean(item.range)
    );

  const entries: RoleEntry[] = [];

  dateIndexes.forEach(({ index, range }, dateIndex) => {
    const nextDateIndex = dateIndexes[dateIndex + 1]?.index ?? experienceLines.length;
    const blockStart = Math.max(0, index - 3);
    const blockEnd = Math.min(experienceLines.length, Math.max(nextDateIndex, index + 4));
    const role = parseRoleFromBlock(experienceLines.slice(blockStart, blockEnd));

    entries.push({
      designation: role.designation,
      organization: role.organization,
      isCurrent: range.isCurrent,
      startMonth: range.startMonth,
      endMonth: range.endMonth,
    });
  });

  if (!entries.some((entry) => entry.designation && entry.organization)) {
    const role = parseRoleFromBlock(experienceLines.slice(0, 10));
    if (role.designation && role.organization) {
      entries.push({
        designation: role.designation,
        organization: role.organization,
        isCurrent: false,
      });
    }
  }

  return entries;
};

const buildProfessionalHeadline = (entries: RoleEntry[]) => {
  const completeEntries = entries.filter(
    (entry) => entry.designation && entry.organization
  );
  const current = completeEntries.find((entry) => entry.isCurrent);
  const latest =
    current ||
    [...completeEntries].sort(
      (a, b) => (b.endMonth ?? 0) - (a.endMonth ?? 0)
    )[0];

  return latest ? `${latest.designation} @ ${latest.organization}` : "";
};

const extractExplicitExperienceYears = (resumeText: string) => {
  const patterns = [
    /(?:total\s+)?(?:experience|exp)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*\+?\s*(?:years|yrs)/i,
    /(\d+(?:\.\d+)?)\s*\+?\s*(?:years|yrs)(?:\s+of)?\s+(?:professional\s+)?(?:experience|exp)/i,
    /(?:over|more than)\s+(\d+(?:\.\d+)?)\s*\+?\s*(?:years|yrs)/i,
  ];

  for (const pattern of patterns) {
    const match = resumeText.match(pattern);
    if (match) return String(Math.round(Number(match[1])));
  }

  return "";
};

const calculateExperienceYears = (entries: RoleEntry[]) => {
  const ranges = entries
    .filter(
      (entry) =>
        entry.startMonth !== undefined &&
        entry.endMonth !== undefined &&
        entry.endMonth >= entry.startMonth
    )
    .map((entry) => ({
      start: entry.startMonth as number,
      end: entry.endMonth as number,
    }))
    .sort((a, b) => a.start - b.start);

  if (!ranges.length) return "";

  const merged: Array<{ start: number; end: number }> = [];
  ranges.forEach((range) => {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end + 1) {
      merged.push({ ...range });
      return;
    }
    last.end = Math.max(last.end, range.end);
  });

  const totalMonths = merged.reduce(
    (sum, range) => sum + (range.end - range.start + 1),
    0
  );
  if (totalMonths < 6) return "";

  return String(Math.max(1, Math.round(totalMonths / 12)));
};

const parseResumeForProfile = (resumeText: string): ParsedProfile => {
  const result: ParsedProfile = {};
  const lines = splitResumeLines(resumeText);
  const emailMatch = resumeText.match(EMAIL_REGEX);
  if (emailMatch) result.email = emailMatch[0];

  const phone = extractPhoneNumber(lines, resumeText);
  if (phone) result.phone = phone;

  result.fullName = extractFullName(lines);

  const links = extractResumeLinks(lines);
  result.behance = findLinkByDomain(links, ["behance.net"]);
  result.github = findLinkByDomain(links, ["github.com"]);
  result.linkedin = findLinkByDomain(links, ["linkedin.com"]);
  result.portfolio = choosePortfolioLink(links, result.fullName || "", lines);
  result.otherLink = chooseOtherLink(links, [
    result.behance,
    result.github,
    result.linkedin,
    result.portfolio,
  ]);

  const location = extractLocation(lines);
  if (location?.city) result.city = location.city;
  if (location?.country) result.country = location.country;

  const roleEntries = extractRoleEntries(lines);
  const headline = buildProfessionalHeadline(roleEntries);
  if (headline) result.headline = headline;

  result.experienceYears =
    extractExplicitExperienceYears(resumeText) || calculateExperienceYears(roleEntries);

  return result;
};

export const ProfileSection = ({ user }: ProfileSectionProps) => {
  const [email, setEmail] = useState((user?.email as string) || "");
  const [fullName, setFullName] = useState(
    (user?.user_metadata?.full_name as string) || ""
  );
  const [headline, setHeadline] = useState(
    (user?.user_metadata?.headline as string) || ""
  );
  const [phone, setPhone] = useState(
    (user?.user_metadata?.phone as string) || ""
  );
  const [behance, setBehance] = useState(
    (user?.user_metadata?.behance as string) || ""
  );
  const [github, setGithub] = useState(
    (user?.user_metadata?.github as string) || ""
  );
  const [linkedin, setLinkedin] = useState(
    (user?.user_metadata?.linkedin as string) || ""
  );
  const [portfolio, setPortfolio] = useState(
    (user?.user_metadata?.portfolio as string) || ""
  );
  const [otherLink, setOtherLink] = useState(
    (user?.user_metadata?.other_link as string) || ""
  );
  const [city, setCity] = useState((user?.user_metadata?.city as string) || "");
  const [country, setCountry] = useState(
    (user?.user_metadata?.country as string) || ""
  );
  const [experienceYears, setExperienceYears] = useState(
    user?.user_metadata?.experience_years
      ? String(user.user_metadata.experience_years)
      : ""
  );
  const [saving, setSaving] = useState(false);
  const [parsingResume, setParsingResume] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoFileName, setPhotoFileName] = useState("");
  const [photoPreview, setPhotoPreview] = useState(
    (user?.user_metadata?.photo_url as string) || ""
  );
  const [photoStoragePath, setPhotoStoragePath] = useState(
    (user?.user_metadata?.photo_url as string) || ""
  );

  const displayName = fullName || user?.email || "";

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.id) return;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        toast.error("Failed to load profile.");
        return;
      }

      if (data) {
        setFullName(data.full_name || "");
        setEmail(data.email || user.email || "");
        setHeadline(data.headline || "");
        setPhone(data.phone || "");
        setBehance(data.behance || "");
        setGithub(data.github || "");
        setLinkedin(data.linkedin || "");
        setPortfolio(data.portfolio || "");
        setOtherLink(data.other_link || "");
        setCity(data.city || "");
        setCountry(data.country || "");
        setExperienceYears(
          data.experience_years !== null && data.experience_years !== undefined
            ? String(data.experience_years)
            : ""
        );
        if (data.photo_url) {
          setPhotoStoragePath(data.photo_url);
          await refreshPhotoPreview(data.photo_url);
        }
      } else {
        setEmail(user.email || "");
      }
    };

    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const refreshPhotoPreview = async (pathOrUrl: string) => {
    if (!pathOrUrl) return;
    const isUrl = pathOrUrl.startsWith("http");
    if (isUrl) {
      setPhotoPreview(pathOrUrl);
      return;
    }
    const { data, error } = await supabase.storage
      .from("profile-photos")
      .createSignedUrl(pathOrUrl, 60 * 60 * 24);
    if (!error && data?.signedUrl) {
      setPhotoPreview(data.signedUrl);
    }
  };

  const applyParsedProfile = (parsed: ParsedProfile) => {
    if (parsed.fullName) setFullName(parsed.fullName);
    if (parsed.phone) setPhone(parsed.phone);
    if (parsed.headline) setHeadline(parsed.headline);
    if (parsed.behance) setBehance(parsed.behance);
    if (parsed.github) setGithub(parsed.github);
    if (parsed.linkedin) setLinkedin(parsed.linkedin);
    if (parsed.portfolio) setPortfolio(parsed.portfolio);
    if (parsed.otherLink) setOtherLink(parsed.otherLink);
    if (parsed.city) setCity(parsed.city);
    if (parsed.country) setCountry(parsed.country);
    if (parsed.experienceYears) setExperienceYears(parsed.experienceYears);
  };

  const buildProfilePayload = (overrides: Partial<Record<string, unknown>> = {}) => {
    const stableEmail = user?.email || email;
    return {
      email: stableEmail,
      full_name: (overrides.fullName as string) ?? fullName,
      headline: (overrides.headline as string) ?? headline,
      phone: (overrides.phone as string) ?? phone,
      behance: (overrides.behance as string) ?? behance,
      github: (overrides.github as string) ?? github,
      linkedin: (overrides.linkedin as string) ?? linkedin,
      portfolio: (overrides.portfolio as string) ?? portfolio,
      other_link: (overrides.otherLink as string) ?? otherLink,
      city: (overrides.city as string) ?? city,
      country: (overrides.country as string) ?? country,
      experience_years:
        overrides.experienceYears !== undefined
          ? Number(overrides.experienceYears)
          : experienceYears
          ? Number(experienceYears)
          : null,
      photo_url: (overrides.photo_url as string) ?? photoStoragePath,
    };
  };

  const persistProfile = async (overrides: Partial<Record<string, unknown>> = {}) => {
    if (!user?.id) {
      toast.error("No user session. Please log in again.");
      return;
    }
    setSaving(true);

    try {
      let uploadedPhotoUrl = photoPreview;
      let uploadedPhotoPath = photoStoragePath;

      if (photoFile) {
        const fileExt = photoFile.name.split(".").pop();
        const filePath = `${user.id}/avatar-${Date.now()}.${
          fileExt || "jpg"
        }`;
        const { error: uploadError } = await supabase.storage
          .from("profile-photos")
          .upload(filePath, photoFile, { upsert: true });

        if (uploadError) {
          throw uploadError;
        }

        const { data, error } = await supabase.storage
          .from("profile-photos")
          .createSignedUrl(filePath, 60 * 60 * 24);

        if (error) {
          throw error;
        }

        uploadedPhotoPath = filePath;
        uploadedPhotoUrl = data?.signedUrl || "";
        setPhotoStoragePath(filePath);
        setPhotoPreview(uploadedPhotoUrl);
      }

      const profilePayload = buildProfilePayload({
        ...overrides,
        photo_url: uploadedPhotoPath,
      });

      const { error: updateError } = await supabase.auth.updateUser({
        email: profilePayload.email,
        data: {
          full_name: profilePayload.full_name,
          headline: profilePayload.headline,
          phone: profilePayload.phone,
          behance: profilePayload.behance,
          github: profilePayload.github,
          linkedin: profilePayload.linkedin,
          portfolio: profilePayload.portfolio,
          other_link: profilePayload.other_link,
          city: profilePayload.city,
          country: profilePayload.country,
          experience_years: profilePayload.experience_years,
          photo_url: profilePayload.photo_url,
        },
      });

      if (updateError) {
        throw updateError;
      }

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user?.id,
        email: profilePayload.email,
        full_name: profilePayload.full_name,
        headline: profilePayload.headline,
        phone: profilePayload.phone,
        behance: profilePayload.behance,
        github: profilePayload.github,
        linkedin: profilePayload.linkedin,
        portfolio: profilePayload.portfolio,
        other_link: profilePayload.other_link,
        city: profilePayload.city,
        country: profilePayload.country,
        experience_years: profilePayload.experience_years,
        photo_url: profilePayload.photo_url,
      });

      if (profileError) {
        throw profileError;
      }

      toast.success("Your profile has been updated");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save profile.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleProfileSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await persistProfile();
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (photoPreview && photoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(photoPreview);
    }
    const file = event.target.files?.[0];
    setPhotoFileName(file ? file.name : "");
    setPhotoPreview(file ? URL.createObjectURL(file) : "");
    setPhotoFile(file || null);
  };

  const handleResumeUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setParsingResume(true);
    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!data.success || !data.message) {
        toast.error(data.message || "Failed to parse resume.");
        return;
      }

      const parsed = parseResumeForProfile(data.message as string);
      applyParsedProfile(parsed);
      await persistProfile(parsed);
      // toast.success("Resume parsed and profile updated.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to parse and save resume.");
    } finally {
      setParsingResume(false);
      event.target.value = "";
    }
  };

  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="flex gap-1 items-center text-3xl font-semibold text-slate-900"><UserCircle2Icon />Profile</h1>
        <p className="text-sm text-slate-500 font-medium">
          Keep your personal information up to date.
        </p>
      </div>

      <div className="rounded-lg shadow-xl bg-white p-6 shadow-sm">
        <div className="space-y-3">
          <h3 className="flex gap-2 items-center text-xl font-semibold text-slate-900">
            <File /> Upload resume to auto-fill
          </h3>
          <p className="text-sm text-slate-500">
            Upload your resume (PDF, DOC, DOCX). We will extract your details, fill the form, and save to your profile.
          </p>
          <Input
            className="rounded-md"
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleResumeUpload}
            disabled={parsingResume || saving}
          />
          <div className="text-xs text-slate-500 font-medium">
            {parsingResume
              ?
              <div className="flex items-center">
                <Loader2 className="h-4" />
                <span>Parsing your resume and updating your profile</span>
              </div>
              :
              <div className="flex items-center">
                <AlertCircleIcon className="h-4" />
                <span>Max file size depends on your Supabase storage limits.</span>
              </div>}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 text-slate-400">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-semibold">OR</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="rounded-lg shadow-xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {photoPreview ? (
              <AvatarImage src={photoPreview} alt={displayName || "Profile"} />
            ) : null}
            <AvatarFallback className="bg-slate-900 text-white text-lg">
              <User2Icon />
            </AvatarFallback>
          </Avatar>

          <div>
            <p className="text-xs text-slate-500 font-medium">Signed in as</p>
            <p className="text-base font-medium text-slate-900">
              {displayName}
            </p>
          </div>
        </div>

        <form onSubmit={handleProfileSave} className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <User2 className="h-4" /> Full Name
              </label>
              <Input
                className="rounded-lg"
                placeholder="Add your name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <ImageIcon className="h-4" />
                Profile Photo
              </label>
              <Input
                className="rounded-lg"
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
              />
              {photoFileName && (
                <p className="text-xs text-slate-500">{photoFileName}</p>
              )}
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <Mail className="h-4" />
                Email
              </label>
              <Input
                className="rounded-lg"
                type="email"
                placeholder="you@example.com"
                value={email}
                disabled
                readOnly
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <PhoneCall className="h-4" />
                Phone Number
              </label>
              <Input
                className="rounded-lg"
                type="tel"
                placeholder="+1 555 555 5555"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <BriefcaseBusiness className="h-4" />
                Professional Headline
              </label>
              <Input
                className="rounded-lg"
                placeholder="e.g. Frontend Engineer @ SynCV"
                value={headline}
                onChange={(event) => setHeadline(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <Globe className="h-4" />
                Behance
              </label>
              <Input
                className="rounded-lg"
                placeholder="https://www.behance.net/username"
                value={behance}
                onChange={(event) => setBehance(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <GithubIcon className="h-4" />
                GitHub
              </label>
              <Input
                className="rounded-lg"
                placeholder="https://github.com/username"
                value={github}
                onChange={(event) => setGithub(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <LinkedinIcon className="h-4" />
                LinkedIn
              </label>
              <Input
                className="rounded-lg"
                placeholder="https://www.linkedin.com/in/username"
                value={linkedin}
                onChange={(event) => setLinkedin(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <Globe className="h-4" />
                Portfolio
              </label>
              <Input
                className="rounded-lg"
                placeholder="https://portfolio.com"
                value={portfolio}
                onChange={(event) => setPortfolio(event.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <Globe className="h-4" />
                Other link
              </label>
              <Input
                className="rounded-lg"
                placeholder="Any additional link"
                value={otherLink}
                onChange={(event) => setOtherLink(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <Building2 className="h-4" />
                City
              </label>
              <Input
                className="rounded-lg"
                placeholder="e.g. San Francisco"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <MapIcon className="h-4" />
                Country
              </label>
              <Input
                className="rounded-lg"
                placeholder="e.g. United States"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="flex items-center text-sm font-medium text-slate-600">
                <CalendarPlusIcon className="h-4" />
                Experience (years)
              </label>
              <Input
                className="rounded-lg"
                type="text"
                min="0"
                step="0.5"
                placeholder="e.g. 5"
                value={experienceYears}
                onChange={(event) => setExperienceYears(event.target.value)}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="rounded-lg"
            disabled={saving || parsingResume}
          >
            <SaveIcon />
            {saving ? "Saving" : "Save Changes"}
          </Button>
        </form>
      </div>
    </section>
  );
};
