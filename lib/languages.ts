// Shared human-language vocabulary + helpers. Used by the resume optimizer
// (server) and the keyword-picker UI (client) so language-fluency keywords are
// handled consistently: they belong in the LANGUAGES section, never in Skills.

// The LANGUAGES resume section means HUMAN languages. Sidebar templates often
// reuse "Languages" as a SKILLS sub-heading for programming languages (HTML,
// CSS, Python…), so every language entry is gated on naming a real human tongue.
export const HUMAN_LANGUAGES = new Set<string>([
  "english", "spanish", "french", "german", "italian", "portuguese", "dutch",
  "russian", "polish", "ukrainian", "czech", "slovak", "romanian", "hungarian",
  "bulgarian", "greek", "turkish", "arabic", "hebrew", "persian", "farsi",
  "urdu", "hindi", "bengali", "punjabi", "gujarati", "marathi", "tamil",
  "telugu", "kannada", "malayalam", "odia", "oriya", "assamese", "sinhala",
  "sinhalese", "nepali", "chinese", "mandarin", "cantonese", "japanese",
  "korean", "vietnamese", "thai", "indonesian", "malay", "tagalog", "filipino",
  "swahili", "amharic", "yoruba", "igbo", "hausa", "zulu", "xhosa",
  "afrikaans", "swedish", "norwegian", "danish", "finnish", "icelandic",
  "estonian", "latvian", "lithuanian", "serbian", "croatian", "bosnian",
  "slovenian", "macedonian", "albanian", "armenian", "georgian", "azerbaijani",
  "kazakh", "uzbek", "mongolian", "burmese", "khmer", "lao", "pashto", "dari",
  "kurdish", "somali", "tigrinya", "wolof", "twi", "luganda", "kinyarwanda",
  "creole", "catalan", "basque", "galician", "welsh", "irish", "gaelic",
  "maltese", "luxembourgish", "javanese", "sundanese", "cebuano", "hmong",
  "quechua", "guarani", "haitian", "samoan", "tongan", "fijian", "maori",
  "esperanto", "latin", "sanskrit", "yiddish", "bhojpuri", "maithili",
  "konkani", "kashmiri", "sindhi", "dogri", "manipuri", "bodo", "santali",
  "tulu", "rajasthani", "haryanvi", "chhattisgarhi", "magahi", "awadhi",
]);

const toWords = (entry = "") =>
  String(entry)
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

// The human-language words named in an entry (e.g. "English (Native)" -> ["english"]).
export const languageWordsIn = (entry = ""): string[] =>
  toWords(entry).filter((word) => HUMAN_LANGUAGES.has(word));

export const isHumanLanguageEntry = (entry = ""): boolean =>
  languageWordsIn(entry).length > 0;

// Fluency phrasing that signals a language requirement even without (or beside)
// a named language.
const FLUENCY_PATTERN =
  /\b(bi|multi|tri)lingual\b|\blanguage\s+(fluency|proficiency|proficient|skills?|competenc(?:y|ies))\b|\bfluen(?:t|cy)\s+in\b|\bnative\s+speaker\b|\bmother\s+tongue\b/i;

// True when a JD keyword is about language ability — a named human language or
// fluency phrasing. These must go to the LANGUAGES section, never Skills.
export const isLanguageKeyword = (keyword = ""): boolean =>
  isHumanLanguageEntry(keyword) || FLUENCY_PATTERN.test(keyword);

const capitalize = (word: string) =>
  word ? word.charAt(0).toUpperCase() + word.slice(1) : word;

// Extract the display-ready, de-duplicated language names from a list of
// keywords (e.g. ["Fluent in Spanish", "German", "bilingual"] -> ["Spanish", "German"]).
// Keywords with no named language (e.g. bare "bilingual") yield nothing to add.
export const languageNamesFromKeywords = (keywords: string[] = []): string[] => {
  const seen = new Set<string>();
  const names: string[] = [];
  keywords.forEach((keyword) => {
    languageWordsIn(keyword).forEach((word) => {
      if (!seen.has(word)) {
        seen.add(word);
        names.push(capitalize(word));
      }
    });
  });
  return names;
};

// Do two language entries name the same tongue? (e.g. "Spanish (Fluent)" vs "spanish")
export const sharesLanguage = (a = "", b = ""): boolean => {
  const wordsB = new Set(languageWordsIn(b));
  return languageWordsIn(a).some((word) => wordsB.has(word));
};
