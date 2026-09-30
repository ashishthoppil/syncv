// Which English the mock interview transcribes answers in. The browser's
// recognizer has a separate model per regional English, and the one matching
// the speaker's accent is far more accurate: an Indian English speaker read
// as US English came out as "front and heavy full strike" for "frontend-heavy
// full stack". So the accent follows the visitor's location, and the lobby
// lets them change it.
//
// `countries` are ISO 3166-1 alpha-2 codes, as the hosting edge reports them
// (see lib/server/pricing-region.js). `timeZones` are the fallback when there
// is no country header, as on a local `next dev`; an entry ending in "/"
// matches every zone under it. Anywhere not listed gets US English.

export const DEFAULT_SPEECH_LOCALE = "en-US";

export const SPEECH_LOCALES = [
  {
    code: "en-IN",
    label: "English (India)",
    // Bangladesh, Sri Lanka and Nepal have no English model of their own;
    // Indian English is by far the closest accent.
    countries: ["IN", "BD", "LK", "NP"],
    timeZones: ["Asia/Kolkata", "Asia/Calcutta", "Asia/Dhaka", "Asia/Dacca", "Asia/Colombo", "Asia/Kathmandu", "Asia/Katmandu"],
  },
  { code: "en-US", label: "English (United States)", countries: ["US"], timeZones: [] },
  {
    code: "en-GB",
    label: "English (United Kingdom)",
    countries: ["GB"],
    timeZones: ["Europe/London", "Europe/Belfast", "GB"],
  },
  { code: "en-IE", label: "English (Ireland)", countries: ["IE"], timeZones: ["Europe/Dublin", "Eire"] },
  {
    code: "en-CA",
    label: "English (Canada)",
    countries: ["CA"],
    timeZones: [
      "Canada/",
      "America/Toronto",
      "America/Montreal",
      "America/Vancouver",
      "America/Edmonton",
      "America/Calgary",
      "America/Winnipeg",
      "America/Regina",
      "America/Halifax",
      "America/Moncton",
      "America/St_Johns",
      "America/Whitehorse",
      "America/Yellowknife",
    ],
  },
  { code: "en-AU", label: "English (Australia)", countries: ["AU"], timeZones: ["Australia/"] },
  {
    code: "en-NZ",
    label: "English (New Zealand)",
    countries: ["NZ"],
    timeZones: ["Pacific/Auckland", "Pacific/Chatham", "NZ"],
  },
  { code: "en-ZA", label: "English (South Africa)", countries: ["ZA"], timeZones: ["Africa/Johannesburg"] },
  { code: "en-SG", label: "English (Singapore)", countries: ["SG"], timeZones: ["Asia/Singapore", "Singapore"] },
  { code: "en-PH", label: "English (Philippines)", countries: ["PH"], timeZones: ["Asia/Manila"] },
  { code: "en-PK", label: "English (Pakistan)", countries: ["PK"], timeZones: ["Asia/Karachi"] },
  { code: "en-NG", label: "English (Nigeria)", countries: ["NG"], timeZones: ["Africa/Lagos"] },
  { code: "en-KE", label: "English (Kenya)", countries: ["KE"], timeZones: ["Africa/Nairobi"] },
  { code: "en-GH", label: "English (Ghana)", countries: ["GH"], timeZones: ["Africa/Accra"] },
  { code: "en-TZ", label: "English (Tanzania)", countries: ["TZ"], timeZones: ["Africa/Dar_es_Salaam"] },
  { code: "en-HK", label: "English (Hong Kong)", countries: ["HK"], timeZones: ["Asia/Hong_Kong", "Hongkong"] },
];

const BY_CODE = Object.fromEntries(SPEECH_LOCALES.map((locale) => [locale.code, locale]));

export const isSpeechLocale = (code) => Object.hasOwn(BY_CODE, String(code || ""));

export const speechLocaleLabel = (code) => BY_CODE[code]?.label || BY_CODE[DEFAULT_SPEECH_LOCALE].label;

/**
 * The accent for a visitor: their country if the edge reported one, else
 * their device's time zone, else US English.
 */
export const speechLocaleFor = ({ country, timeZone } = {}) => {
  const code = String(country || "").trim().toUpperCase();
  if (code) {
    const match = SPEECH_LOCALES.find((locale) => locale.countries.includes(code));
    return match ? match.code : DEFAULT_SPEECH_LOCALE;
  }
  const zone = String(timeZone || "");
  if (zone) {
    const match = SPEECH_LOCALES.find((locale) =>
      locale.timeZones.some((entry) => (entry.endsWith("/") ? zone.startsWith(entry) : zone === entry))
    );
    if (match) return match.code;
  }
  return DEFAULT_SPEECH_LOCALE;
};
