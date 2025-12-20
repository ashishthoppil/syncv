import { NextResponse } from "next/server";

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
  // Experience and job description common words
  "years",
  "year",
  "months",
  "month",
  "level",
  "levels",
  "full",
  "time",
  "part",
  "remote",
  "hybrid",
  "office",
  "location",
  "locations",
  "role",
  "roles",
  "position",
  "positions",
  "job",
  "jobs",
  "candidate",
  "candidates",
  "team",
  "teams",
  "company",
  "companies",
  "looking",
  "ideal",
  "must",
  "have",
  "has",
  "had",
]);

// Professional skills keywords across all corporate roles
const PROFESSIONAL_KEYWORDS = new Set([
  // Development & Programming
  "javascript", "typescript", "python", "java", "react", "node", "angular",
  "vue", "sql", "mongodb", "postgresql", "mysql", "oracle", "aws", "azure", 
  "gcp", "docker", "kubernetes", "git", "github", "gitlab", "ci/cd", "api", 
  "rest", "graphql", "microservices", "html", "css", "sass", "tailwind", 
  "bootstrap", "redux", "nextjs", "express", "django", "flask", "spring", 
  "laravel", "php", "ruby", "rails", "go", "rust", "swift", "kotlin", 
  "android", "ios", "flutter", "react-native", "xamarin", "cordova",
  
  // Testing & QA
  "testing", "qa", "quality", "assurance", "test", "automation", "manual",
  "jest", "cypress", "selenium", "appium", "junit", "testng", "pytest",
  "mocha", "chai", "karma", "jasmine", "protractor", "webdriver", "bug",
  "defect", "regression", "performance", "load", "security", "penetration",
  
  // Project Management & Agile
  "agile", "scrum", "kanban", "jira", "confluence", "trello", "asana",
  "project", "management", "pmp", "prince2", "waterfall", "sprint",
  "backlog", "grooming", "retrospective", "standup", "stakeholder",
  "risk", "budget", "timeline", "milestone", "deliverable", "scope",
  
  // HR & Talent Management
  "hr", "human", "resources", "recruitment", "talent", "acquisition",
  "onboarding", "payroll", "hrms", "hris", "ats", "performance", "review",
  "compensation", "benefits", "employee", "engagement", "retention",
  "training", "development", "succession", "planning", "workday", "bamboohr",
  
  // Finance & Accounting
  "accounting", "finance", "bookkeeping", "sap", "oracle", "quickbooks",
  "xero", "tally", "erp", "financial", "reporting", "audit", "tax",
  "gst", "vat", "accounts", "payable", "receivable", "reconciliation",
  "budgeting", "forecasting", "cfo", "cpa", "cma", "acca", "ifrs", "gaap",
  
  // Engineering (Non-Software)
  "mechanical", "civil", "electrical", "electronics", "automotive",
  "aerospace", "chemical", "industrial", "manufacturing", "cad", "cam",
  "solidworks", "autocad", "matlab", "ansys", "plc", "scada", "hmi",
  
  // Data & Analytics
  "data", "analytics", "business", "intelligence", "bi", "tableau",
  "powerbi", "qlik", "looker", "etl", "datawarehouse", "datamining",
  "machine", "learning", "ai", "artificial", "intelligence", "deep",
  "neural", "network", "tensorflow", "pytorch", "keras", "scikit",
  "pandas", "numpy", "spark", "hadoop", "kafka", "elasticsearch",
  
  // DevOps & Infrastructure
  "devops", "linux", "unix", "windows", "server", "administration",
  "networking", "security", "firewall", "vpn", "ldap", "active", "directory",
  "jenkins", "terraform", "ansible", "chef", "puppet", "nagios", "prometheus",
  
  // Design & Creative
  "design", "ui", "ux", "user", "experience", "interface", "figma",
  "sketch", "adobe", "photoshop", "illustrator", "indesign", "xd",
  "prototyping", "wireframing", "usability", "accessibility",
  
  // Sales & Marketing
  "sales", "marketing", "crm", "salesforce", "hubspot", "seo", "sem",
  "ppc", "google", "ads", "facebook", "advertising", "content", "social",
  "media", "email", "campaign", "analytics", "conversion", "lead", "generation",
  
  // Business & Operations
  "operations", "supply", "chain", "logistics", "procurement", "vendor",
  "management", "process", "improvement", "lean", "six", "sigma",
  "kpi", "metrics", "dashboard", "reporting", "excel", "powerpoint",
  
  // Legal & Compliance
  "legal", "compliance", "regulatory", "contract", "negotiation",
  "intellectual", "property", "patent", "trademark", "litigation",
  
  // Customer Service & Support
  "customer", "service", "support", "helpdesk", "ticketing", "zendesk",
  "freshdesk", "sla", "resolution", "satisfaction", "nps"
]);

// Important action verbs and phrases
const IMPORTANT_PHRASES = [
  "required", "must have", "essential", "mandatory", "proficient", "expert",
  "strong experience", "years of experience", "minimum", "preferred",
  "bachelor", "master", "degree", "certification", "certified"
];

const stripHtml = (value = "") => value.replace(/<[^>]*>/g, " ");

const tokenize = (value = "") =>
  stripHtml(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

// Extract important keywords with weights
const extractWeightedKeywords = (text, limit = 50) => {
  const tokens = tokenize(text);
  const freq = new Map();
  const positions = new Map(); // Track where keywords appear (earlier = more important)

  tokens.forEach((token, index) => {
    if (token.length <= 2 || STOP_WORDS.has(token)) {
      return;
    }
    freq.set(token, (freq.get(token) || 0) + 1);
    if (!positions.has(token)) {
      positions.set(token, index);
    }
  });

  // Calculate weights based on:
  // 1. Frequency (more mentions = higher weight)
  // 2. Position (earlier in JD = higher weight)
  // 3. Technical keywords (boost for tech terms)
  // 4. Important phrases context
  const textLower = text.toLowerCase();
  const keywordWeights = [];

  for (const [token, count] of freq.entries()) {
    let weight = count; // Base weight from frequency

    // Position weight (earlier = more important, max 2x boost)
    const position = positions.get(token);
    const positionWeight = Math.max(1, 2 - (position / (tokens.length / 4)));
    weight *= positionWeight;

    // Professional keyword boost (1.5x)
    if (PROFESSIONAL_KEYWORDS.has(token)) {
      weight *= 1.5;
    }

    // Important phrases context boost (1.3x)
    const contextBoost = IMPORTANT_PHRASES.some(phrase => 
      textLower.includes(`${phrase} ${token}`) || 
      textLower.includes(`${token} ${phrase}`)
    );
    if (contextBoost) {
      weight *= 1.3;
    }

    // Length boost (longer technical terms are often more specific)
    if (token.length > 6) {
      weight *= 1.2;
    }

    keywordWeights.push({ keyword: token, weight: Math.round(weight * 100) / 100 });
  }

  // Sort by weight and take top keywords
  return keywordWeights
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit);
};

const scoreResume = (resumeText, weightedKeywords) => {
  const resumeTokens = tokenize(resumeText);
  const resumeTokenSet = new Set(resumeTokens);
  // Create a normalized resume text for phrase matching
  const resumeTextLower = resumeText.toLowerCase();

  let totalWeight = 0;
  let matchedWeight = 0;
  const matched = [];
  const missing = [];

  weightedKeywords.forEach(({ keyword, weight }) => {
    totalWeight += weight;
    
    let isMatched = false;
    
    // 1. Exact token match (most reliable)
    if (resumeTokenSet.has(keyword)) {
      isMatched = true;
    } else {
      // 2. Check for keyword as a complete word (word boundary match)
      // This prevents false matches like "java" matching "javascript"
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const keywordRegex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');
      
      if (keywordRegex.test(resumeTextLower)) {
        isMatched = true;
      } else {
        // 3. For multi-word keywords (space or hyphen separated)
        // Check if all parts exist and appear close together
        if (keyword.includes(' ') || keyword.includes('-')) {
          const parts = keyword.split(/[\s-]+/).filter(p => p.length > 2);
          if (parts.length > 1) {
            // Check if all parts exist as tokens
            const allPartsExist = parts.every(part => resumeTokenSet.has(part));
            
            if (allPartsExist) {
              // Check if they appear close together (within reasonable distance)
              // Create a regex that matches all parts in any order within 100 chars
              const partsEscaped = parts.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
              // Match pattern: part1 ... (up to 100 chars) ... part2
              const proximityPattern = partsEscaped.map((p, i) => {
                if (i === 0) return `(${p})`;
                return `.{0,100}(${p})`;
              }).join('');
              const proximityRegex = new RegExp(proximityPattern, 'i');
              
              if (proximityRegex.test(resumeTextLower)) {
                isMatched = true;
              }
            }
          }
        }
      }
    }

    if (isMatched) {
      matchedWeight += weight;
      matched.push(keyword);
    } else {
      missing.push(keyword);
    }
  });

  const initialScore =
    totalWeight === 0
      ? 0
      : Math.round((matchedWeight / totalWeight) * 100);

  return {
    initialScore,
    matchedKeywords: matched,
    missingKeywords: missing,
    keywordUniverse: weightedKeywords.map(k => k.keyword),
    weightedKeywords: weightedKeywords,
  };
};

export async function POST(req) {
  try {
    const { resume, jd, organization, designation } = await req.json();

    if (!resume || !jd) {
      return NextResponse.json({
        success: false,
        message: "Both resume and job description are required.",
      });
    }

    const weightedKeywords = extractWeightedKeywords(jd);

    if (!weightedKeywords.length) {
      return NextResponse.json({
        success: false,
        message:
          "We could not extract any keywords from the job description. Please provide more details.",
      });
    }

    const results = scoreResume(resume, weightedKeywords);

    // Include organization and designation in response for saving to job tracker
    return NextResponse.json({
      success: true,
      message: {
        ...results,
        organization: organization || "",
        designation: designation || "",
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message });
  }
}
