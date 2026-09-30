// Shared keyword-priority vocabulary. Used by the analyzer and the optimizer
// (server) and by every keyword list in the scan UI (client), so a keyword is
// ranked, scored, placed, and labelled by the same three tiers everywhere.

export type KeywordPriority = "high" | "medium" | "low";

export type WeightedKeywordLike = {
  keyword: string;
  weight?: number;
  importance?: "required" | "preferred";
  variants?: string[];
};

// The extractor scores each keyword 1-10: 8-10 for must-have hard skills, 5-7
// for important supporting skills, 1-4 for nice-to-have. The tiers follow it.
export const HIGH_PRIORITY_MIN_WEIGHT = 8;
export const MEDIUM_PRIORITY_MIN_WEIGHT = 5;
// A keyword with no usable weight is treated as a mid-tier one.
export const DEFAULT_KEYWORD_WEIGHT = 5;

// A must-have keyword earns its full weight only when the resume backs it up in
// two places (say, the skills list and the bullet where it was used). Mentioned
// once, it earns this share. The optimizer places must-haves twice to match.
export const REINFORCED_MENTIONS = 2;
export const SINGLE_MENTION_CREDIT = 0.8;
// Mentions are counted by the lines a keyword appears on. Below this many lines
// the text has no structure to count places in (a PDF extracted as one block),
// so the rule is skipped rather than guessed at.
export const MIN_LINES_FOR_MENTION_COUNT = 8;

export const KEYWORD_PRIORITIES: readonly KeywordPriority[] = ["high", "medium", "low"];

export const KEYWORD_PRIORITY_LABELS: Record<KeywordPriority, string> = {
  high: "Must-have",
  medium: "Important",
  low: "Nice to have",
};

export const clampKeywordWeight = (value: unknown): number => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return DEFAULT_KEYWORD_WEIGHT;
  return Math.max(1, Math.min(10, Math.round(numeric)));
};

export const keywordPriority = (weight: unknown): KeywordPriority => {
  const clamped = clampKeywordWeight(weight);
  if (clamped >= HIGH_PRIORITY_MIN_WEIGHT) return "high";
  if (clamped >= MEDIUM_PRIORITY_MIN_WEIGHT) return "medium";
  return "low";
};

const keywordKey = (keyword = "") => String(keyword).trim().toLowerCase();

// keyword -> weight, for looking up the plain keyword strings the analyzer and
// optimizer hand around.
export const buildKeywordWeightMap = (
  weighted: readonly WeightedKeywordLike[] = []
): Map<string, number> => {
  const map = new Map<string, number>();
  (Array.isArray(weighted) ? weighted : []).forEach((entry) => {
    const key = keywordKey(entry?.keyword);
    if (key && !map.has(key)) map.set(key, clampKeywordWeight(entry?.weight));
  });
  return map;
};

export const keywordWeightOf = (keyword: string, weights: Map<string, number>): number =>
  weights.get(keywordKey(keyword)) ?? DEFAULT_KEYWORD_WEIGHT;

// Highest weight first; keywords of equal weight keep their original order.
export const sortKeywordsByWeight = (
  keywords: readonly string[] = [],
  weights: Map<string, number>
): string[] =>
  keywords
    .map((keyword, index) => ({ keyword, index, weight: keywordWeightOf(keyword, weights) }))
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .map((entry) => entry.keyword);

export type KeywordPriorityGroup = {
  /** null when the scan carries no weights, so the list can't be ranked. */
  priority: KeywordPriority | null;
  label: string;
  keywords: string[];
};

// Split a keyword list into its non-empty tiers, must-have first. Without any
// weights (a scan restored from before they were kept) it comes back as one
// unlabelled group, in its original order.
export const groupKeywordsByPriority = (
  keywords: readonly string[] = [],
  weighted: readonly WeightedKeywordLike[] = []
): KeywordPriorityGroup[] => {
  const list = (keywords || []).filter(Boolean);
  if (!list.length) return [];
  const weights = buildKeywordWeightMap(weighted);
  if (!weights.size) return [{ priority: null, label: "", keywords: list }];

  const sorted = sortKeywordsByWeight(list, weights);
  return KEYWORD_PRIORITIES.map((priority) => ({
    priority,
    label: KEYWORD_PRIORITY_LABELS[priority],
    keywords: sorted.filter(
      (keyword) => keywordPriority(keywordWeightOf(keyword, weights)) === priority
    ),
  })).filter((group) => group.keywords.length);
};
