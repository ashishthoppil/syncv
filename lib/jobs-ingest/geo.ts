/**
 * Turns whatever a source prints as a location ("Remote - US | Canada",
 * "Bengaluru, Karnataka", "EMEA", "Anywhere") into ISO country codes and region
 * slugs, which is what the Location filter matches on.
 *
 * A token that can't be placed is simply dropped. That leaves the job out of
 * country searches rather than guessing — the same rule as before: a job that
 * says only "Remote" may well be restricted to somewhere we can't see.
 */

const REGION_PATTERNS: [RegExp, string][] = [
  [/\b(anywhere|worldwide|global|globally|work from anywhere|international|all countries)\b/i, "worldwide"],
  [/\b(europe|european|eu|eea|cet|cest)\b/i, "europe"],
  [/\bemea\b/i, "emea"],
  [/\b(apac|asia[\s-]?pac(ific)?|asia pacific)\b/i, "apac"],
  [/\basia\b/i, "asia"],
  [/\b(americas)\b/i, "americas"],
  [/\b(north america|namer|noram)\b/i, "north-america"],
  [/\b(latam|latin america|south america|central america)\b/i, "latam"],
  [/\b(africa)\b/i, "africa"],
  [/\b(middle east|mena|gcc)\b/i, "middle-east"],
  [/\b(oceania|anz)\b/i, "oceania"],
];

/** Which eligibility regions a country falls inside. */
const REGION_MEMBERS: Record<string, string[]> = {
  europe: [
    "AD", "AL", "AT", "BA", "BE", "BG", "BY", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
    "FR", "GB", "GR", "HR", "HU", "IE", "IS", "IT", "LI", "LT", "LU", "LV", "MC", "MD", "ME",
    "MK", "MT", "NL", "NO", "PL", "PT", "RO", "RS", "SE", "SI", "SK", "SM", "UA", "XK",
  ],
  "middle-east": ["AE", "BH", "IL", "IQ", "IR", "JO", "KW", "LB", "OM", "PS", "QA", "SA", "SY", "TR", "YE", "EG"],
  africa: [
    "DZ", "AO", "BJ", "BW", "BF", "BI", "CM", "CV", "CF", "TD", "KM", "CD", "CG", "CI", "DJ",
    "EG", "GQ", "ER", "SZ", "ET", "GA", "GM", "GH", "GN", "GW", "KE", "LS", "LR", "LY", "MG",
    "MW", "ML", "MR", "MU", "MA", "MZ", "NA", "NE", "NG", "RW", "ST", "SN", "SC", "SL", "SO",
    "ZA", "SS", "SD", "TZ", "TG", "TN", "UG", "ZM", "ZW",
  ],
  asia: [
    "AF", "AM", "AZ", "BD", "BN", "BT", "CN", "GE", "HK", "ID", "IN", "JP", "KG", "KH", "KR",
    "KZ", "LA", "LK", "MM", "MN", "MO", "MV", "MY", "NP", "PH", "PK", "SG", "TH", "TJ", "TL",
    "TM", "TW", "UZ", "VN", "AE", "SA", "QA", "IL",
  ],
  oceania: ["AU", "NZ", "FJ", "PG", "WS", "TO", "VU", "SB"],
  "north-america": ["US", "CA", "MX"],
  latam: [
    "AR", "BO", "BR", "CL", "CO", "CR", "CU", "DO", "EC", "GT", "HN", "MX", "NI", "PA", "PE",
    "PR", "PY", "SV", "UY", "VE", "JM", "TT", "BS", "BB", "BZ", "HT",
  ],
};
REGION_MEMBERS.apac = [
  ...REGION_MEMBERS.asia.filter((code) => !["AE", "SA", "QA", "IL", "AF", "AM", "AZ", "GE"].includes(code)),
  ...REGION_MEMBERS.oceania,
];
REGION_MEMBERS.emea = [...REGION_MEMBERS.europe, ...REGION_MEMBERS["middle-east"], ...REGION_MEMBERS.africa];
REGION_MEMBERS.americas = [...new Set([...REGION_MEMBERS["north-america"], ...REGION_MEMBERS.latam])];

/** Every region a country belongs to, plus "worldwide". */
export const regionsForCountry = (code: string): string[] => [
  ...Object.entries(REGION_MEMBERS)
    .filter(([, members]) => members.includes(code))
    .map(([region]) => region),
  "worldwide",
];

/** Spellings people use that the standard English names don't cover. */
const COUNTRY_ALIASES: Record<string, string> = {
  usa: "US",
  "u.s.": "US",
  "u.s.a.": "US",
  "u.s": "US",
  "united states of america": "US",
  america: "US",
  "united states": "US",
  uk: "GB",
  "u.k.": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  britain: "GB",
  "great britain": "GB",
  uae: "AE",
  emirates: "AE",
  dubai: "AE",
  "abu dhabi": "AE",
  "south korea": "KR",
  korea: "KR",
  "czech republic": "CZ",
  czechia: "CZ",
  holland: "NL",
  "the netherlands": "NL",
  russia: "RU",
  vietnam: "VN",
  turkey: "TR",
  türkiye: "TR",
  "hong kong": "HK",
  taiwan: "TW",
  "ivory coast": "CI",
  deutschland: "DE",
  österreich: "AT",
  schweiz: "CH",
  suisse: "CH",
  españa: "ES",
  italia: "IT",
  polska: "PL",
  nederland: "NL",
  brasil: "BR",
  méxico: "MX",
  "puerto rico": "PR",
  macau: "MO",
  "bosnia": "BA",
  "north macedonia": "MK",
  kosovo: "XK",
};

/** Cities and states that sources print without a country. */
const PLACE_COUNTRIES: Record<string, string> = {
  // India
  bangalore: "IN", bengaluru: "IN", mumbai: "IN", delhi: "IN", "new delhi": "IN", "delhi ncr": "IN",
  ncr: "IN", gurgaon: "IN", gurugram: "IN", noida: "IN", hyderabad: "IN", chennai: "IN",
  pune: "IN", kolkata: "IN", ahmedabad: "IN", kochi: "IN", cochin: "IN", jaipur: "IN",
  chandigarh: "IN", indore: "IN", coimbatore: "IN", trivandrum: "IN", thiruvananthapuram: "IN",
  karnataka: "IN", maharashtra: "IN", telangana: "IN", "tamil nadu": "IN", haryana: "IN",
  "uttar pradesh": "IN", kerala: "IN", gujarat: "IN", "west bengal": "IN",
  // United States
  "new york": "US", nyc: "US", "san francisco": "US", "bay area": "US", "sf bay area": "US",
  seattle: "US", austin: "US", boston: "US", chicago: "US", "los angeles": "US", denver: "US",
  atlanta: "US", miami: "US", dallas: "US", houston: "US", "washington dc": "US",
  "washington, d.c.": "US", "san jose": "US", "palo alto": "US", "mountain view": "US",
  "menlo park": "US", "san diego": "US", portland: "US", philadelphia: "US", phoenix: "US",
  "salt lake city": "US", minneapolis: "US", detroit: "US", pittsburgh: "US", raleigh: "US",
  nashville: "US", california: "US", texas: "US", florida: "US", massachusetts: "US",
  illinois: "US", colorado: "US", georgia: "US", virginia: "US", "north carolina": "US",
  ohio: "US", michigan: "US", pennsylvania: "US", arizona: "US", oregon: "US",
  "new jersey": "US", utah: "US", tennessee: "US", minnesota: "US", maryland: "US",
  // Canada
  toronto: "CA", vancouver: "CA", montreal: "CA", montréal: "CA", ottawa: "CA", calgary: "CA",
  waterloo: "CA", ontario: "CA", "british columbia": "CA", quebec: "CA", québec: "CA", alberta: "CA",
  // Europe
  london: "GB", manchester: "GB", edinburgh: "GB", bristol: "GB", cambridge: "GB", oxford: "GB",
  birmingham: "GB", leeds: "GB", glasgow: "GB", belfast: "GB",
  dublin: "IE", cork: "IE",
  berlin: "DE", munich: "DE", münchen: "DE", hamburg: "DE", frankfurt: "DE",
  "frankfurt am main": "DE", cologne: "DE", köln: "DE", stuttgart: "DE", düsseldorf: "DE",
  dusseldorf: "DE", leipzig: "DE", dresden: "DE", hannover: "DE", hanover: "DE",
  nuremberg: "DE", nürnberg: "DE", bremen: "DE", essen: "DE", dortmund: "DE", bonn: "DE",
  mannheim: "DE", karlsruhe: "DE", bavaria: "DE", bayern: "DE", heidelberg: "DE", bielefeld: "DE",
  münster: "DE", augsburg: "DE", wiesbaden: "DE", mainz: "DE", freiburg: "DE", potsdam: "DE",
  kiel: "DE", aachen: "DE", regensburg: "DE", darmstadt: "DE", würzburg: "DE", ulm: "DE",
  ingolstadt: "DE", erlangen: "DE", jena: "DE", rostock: "DE", magdeburg: "DE",
  braunschweig: "DE", göttingen: "DE", osnabrück: "DE", saarbrücken: "DE", heilbronn: "DE",
  wolfsburg: "DE", lübeck: "DE", konstanz: "DE", paderborn: "DE", oldenburg: "DE",
  duisburg: "DE", bochum: "DE", wuppertal: "DE", chemnitz: "DE", erfurt: "DE", kassel: "DE",
  salzburg: "AT", innsbruck: "AT", zug: "CH", lucerne: "CH", luzern: "CH", "st. gallen": "CH",
  winterthur: "CH",
  vienna: "AT", wien: "AT", graz: "AT", linz: "AT",
  zurich: "CH", zürich: "CH", geneva: "CH", basel: "CH", bern: "CH", lausanne: "CH",
  amsterdam: "NL", rotterdam: "NL", utrecht: "NL", "the hague": "NL", eindhoven: "NL",
  paris: "FR", lyon: "FR", marseille: "FR", toulouse: "FR", lille: "FR", nantes: "FR",
  madrid: "ES", barcelona: "ES", valencia: "ES", seville: "ES", malaga: "ES", málaga: "ES",
  lisbon: "PT", lisboa: "PT", porto: "PT",
  milan: "IT", milano: "IT", rome: "IT", roma: "IT", turin: "IT", bologna: "IT",
  warsaw: "PL", krakow: "PL", kraków: "PL", wroclaw: "PL", wrocław: "PL", gdansk: "PL", poznan: "PL",
  prague: "CZ", brno: "CZ", budapest: "HU", bucharest: "RO", cluj: "RO", sofia: "BG",
  stockholm: "SE", gothenburg: "SE", malmö: "SE", copenhagen: "DK", oslo: "NO", helsinki: "FI",
  brussels: "BE", antwerp: "BE", ghent: "BE", luxembourg: "LU",
  tallinn: "EE", riga: "LV", vilnius: "LT", athens: "GR", thessaloniki: "GR",
  belgrade: "RS", zagreb: "HR", ljubljana: "SI", bratislava: "SK", kyiv: "UA", kiev: "UA",
  // Rest of world
  singapore: "SG", sydney: "AU", melbourne: "AU", brisbane: "AU", perth: "AU",
  auckland: "NZ", wellington: "NZ", tokyo: "JP", seoul: "KR", shanghai: "CN", beijing: "CN",
  shenzhen: "CN", taipei: "TW", jakarta: "ID", manila: "PH", "kuala lumpur": "MY",
  bangkok: "TH", "ho chi minh city": "VN", hanoi: "VN", karachi: "PK", lahore: "PK",
  dhaka: "BD", colombo: "LK", "tel aviv": "IL", riyadh: "SA", doha: "QA", cairo: "EG",
  lagos: "NG", nairobi: "KE", "cape town": "ZA", johannesburg: "ZA",
  "são paulo": "BR", "sao paulo": "BR", "rio de janeiro": "BR", "mexico city": "MX",
  "buenos aires": "AR", bogota: "CO", bogotá: "CO", medellin: "CO", medellín: "CO",
  santiago: "CL", lima: "PE", montevideo: "UY",
};

const US_STATE_CODES = new Set(
  "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" ")
);
const CA_PROVINCE_CODES = new Set("AB BC MB NB NL NS NT NU ON PE QC SK YT".split(" "));
const WORKPLACE_WORD = /^(remote|fully remote|hybrid|anywhere|on[\s-]?site|wfh|home[\s-]based)$/i;

/** Region codes Intl names that aren't countries. */
const NOT_COUNTRIES = new Set(["EU", "EZ", "UN", "QO", "ZZ", "XA", "XB"]);

const canonicalRegion = (code: string) => {
  try {
    return Intl.getCanonicalLocales(`und-${code}`)[0]?.split("-")[1] || code;
  } catch {
    return code;
  }
};

let nameIndex: { pattern: RegExp; codes: Map<string, string> } | null = null;

/**
 * English country names from the runtime's ICU data, plus the aliases and
 * places above, compiled into one alternation so each token is scanned once.
 */
const getNameIndex = () => {
  if (nameIndex) return nameIndex;
  const codes = new Map<string, string>();
  const display = new Intl.DisplayNames(["en"], { type: "region" });
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const a of letters) {
    for (const b of letters) {
      const code = `${a}${b}`;
      let name: string | undefined;
      try {
        name = display.of(code);
      } catch {
        name = undefined;
      }
      if (!name || name === code || NOT_COUNTRIES.has(code)) continue;
      // Retired codes resolve to today's names — "DD" (East Germany) comes
      // back as "Germany" — so keep only codes that are still canonical.
      if (canonicalRegion(code) !== code) continue;
      // "Hong Kong SAR China", "Myanmar (Burma)", "Congo - Kinshasa": index the
      // plain form too.
      const plain = name
        .replace(/\s*\(.*?\)\s*/g, " ")
        .replace(/\s+SAR China$/i, "")
        .replace(/\s+-\s+.*$/, "")
        .trim();
      for (const variant of [name, plain]) {
        const key = variant.toLowerCase();
        if (key && !codes.has(key)) codes.set(key, code);
      }
    }
  }
  for (const [name, code] of Object.entries({ ...COUNTRY_ALIASES, ...PLACE_COUNTRIES })) {
    codes.set(name, code);
  }
  // "Georgia" is a country and a US state; as a bare word in a job location it
  // is far more often the state.
  codes.set("georgia", "US");
  const alternation = [...codes.keys()]
    .sort((a, b) => b.length - a.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  nameIndex = {
    pattern: new RegExp(`(?<![\\p{L}\\p{N}])(${alternation})(?![\\p{L}\\p{N}])`, "giu"),
    codes,
  };
  return nameIndex;
};

export type ParsedPlaces = { countries: string[]; regions: string[] };

/**
 * Reads countries and regions out of any number of location strings.
 *
 * Two-letter codes are only trusted in shapes that can't be misread:
 *  - a US state or Canadian province after a city ("Austin, TX"), where "CA"
 *    means California and "IN" means Indiana, not Canada or India;
 *  - a code standing alone, or between separators ("Remote - US", "US | CA");
 *  - the last part of a comma list ("Remote, DE"), when it can't be a state.
 * A code in the middle of "Munich, BY, Germany" is a German state, not Belarus,
 * and is ignored — the country name after it is what counts.
 */
export const parsePlaces = (values: (string | null | undefined)[]): ParsedPlaces => {
  const countries = new Set<string>();
  const regions = new Set<string>();
  const { pattern, codes } = getNameIndex();

  for (const raw of values) {
    const value = (raw || "").trim();
    if (!value) continue;

    for (const [regionPattern, region] of REGION_PATTERNS) {
      if (regionPattern.test(value)) regions.add(region);
    }

    // Two-letter parts of a comma list: "Austin, TX", "Toronto, ON", "Remote, DE".
    const parts = value.split(",").map((part) => part.trim());
    parts.forEach((part, index) => {
      if (index === 0 || !/^[A-Z]{2}$/.test(part)) return;
      const previous = parts[index - 1];
      const next = parts[index + 1];
      const last = index === parts.length - 1;
      // After a real place it's a state or province — unless a different
      // country follows, as in "Perth, WA, Australia". After "Remote" it's a
      // country: "Remote, DE" is Germany, not Delaware.
      const afterPlace = !WORKPLACE_WORD.test(previous);
      if (afterPlace && US_STATE_CODES.has(part) && (last || /^(us|usa|united states)\b/i.test(next))) {
        countries.add("US");
      } else if (afterPlace && CA_PROVINCE_CODES.has(part) && (last || /^canada\b/i.test(next))) {
        countries.add("CA");
      } else if (last && (!afterPlace || (!US_STATE_CODES.has(part) && !CA_PROVINCE_CODES.has(part)))) {
        if (part === "UK") countries.add("GB");
        else if (isIsoCode(part)) countries.add(part);
      }
    });

    // A code standing alone or between separators: "DE", "Remote - US", "US | CA".
    for (const token of value.split(/\s*[;|/•·()]\s*|\s+-\s+/)) {
      const trimmed = token.trim();
      if (!/^[A-Z]{2}$/.test(trimmed)) continue;
      if (trimmed === "UK") countries.add("GB");
      else if (isIsoCode(trimmed)) countries.add(trimmed);
    }

    for (const match of value.matchAll(pattern)) {
      const code = codes.get(match[1].toLowerCase());
      if (code) countries.add(code);
    }
  }

  // Note there is no "us" alias: read from prose ("join us") it would be wrong
  // more often than right. "US" only counts as a standalone token above.
  return { countries: [...countries], regions: [...regions] };
};

let isoCodes: Set<string> | null = null;
const isIsoCode = (code: string) => {
  if (!isoCodes) {
    isoCodes = new Set(getNameIndex().codes.values());
  }
  return isoCodes.has(code);
};

/** "IN" → "India", for display. */
export const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
};
