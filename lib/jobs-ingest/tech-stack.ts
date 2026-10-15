/**
 * Tech stack, read from a posting's title and description by dictionary.
 *
 * No model involved: a fixed list is free, deterministic, and gives the filter
 * canonical names to match on ("Node.js", never "node" in one job and "NodeJS"
 * in the next). It reports what the posting *mentions* — a "nice to have" counts
 * the same as a requirement — which is the right trade for a filter: missing
 * a job is worse than showing one that lists React as a bonus.
 *
 * Words that are also ordinary English ("Go", "Swift", "Rust", "Spring",
 * "Excel") are matched case-sensitively and, where needed, only in a technical
 * shape, so "we move swiftly" or "go-to-market" never tags a job.
 */

type TechEntry = {
  name: string;
  /** Case-insensitive spellings, matched at word boundaries. */
  aliases?: string[];
  /** For ambiguous words: a case-sensitive pattern used instead of aliases. */
  pattern?: RegExp;
};

const TECH: TechEntry[] = [
  // Languages
  { name: "JavaScript", aliases: ["javascript", "ecmascript", "es6"] },
  { name: "TypeScript", aliases: ["typescript"] },
  { name: "Python", aliases: ["python"] },
  { name: "Java", pattern: /\bJava\b(?![-\s]?[Ss]cript)/ },
  { name: "Kotlin", aliases: ["kotlin"] },
  { name: "Scala", aliases: ["scala"] },
  // "Go" is everywhere in English ("go-to-market", "Go and talk to…"), so it
  // counts only in a technical shape: Golang, "Go developer", or listed after
  // "with/in/and/or" or a comma — and not followed by "to", "ahead" and the like.
  {
    name: "Go",
    pattern:
      /\b[Gg]olang\b|\bGo(?=\s+(?:developer|engineer|programming|language|microservices|backend)\b)|(?<=(?:,|\/|\(|\band|\bor|\bin|\bwith|\busing|\blike)\s{0,2})Go(?![\w-])(?!\s+(?:to|ahead|live|beyond|back|through|after|for|get|further|deeper)\b)/,
  },
  { name: "Rust", pattern: /\bRust\b/ },
  { name: "C++", aliases: ["c++", "cpp"] },
  { name: "C#", aliases: ["c#", "csharp"] },
  { name: ".NET", aliases: [".net", "dotnet", ".net core", "asp.net"] },
  { name: "Ruby", pattern: /\bRuby\b(?!\s+on\s+Rails)/ },
  { name: "Ruby on Rails", pattern: /\b(?:Ruby on Rails|Rails|RoR)\b/ },
  { name: "PHP", aliases: ["php"] },
  { name: "Swift", pattern: /\bSwift(?:UI)?\b/ },
  { name: "Objective-C", aliases: ["objective-c", "objective c"] },
  { name: "Dart", pattern: /\bDart\b/ },
  { name: "Elixir", aliases: ["elixir"] },
  { name: "Erlang", aliases: ["erlang"] },
  { name: "Haskell", aliases: ["haskell"] },
  { name: "Clojure", aliases: ["clojure"] },
  { name: "Perl", pattern: /\bPerl\b/ },
  { name: "Solidity", aliases: ["solidity"] },
  { name: "SQL", pattern: /\bSQL\b/ },
  { name: "R", pattern: /(?:^|[\s,(/])R(?=\s*(?:,|\/|and\b|or\b|programming|language))|\bRStudio\b/ },
  { name: "MATLAB", aliases: ["matlab"] },
  { name: "HTML", aliases: ["html", "html5"] },
  { name: "CSS", aliases: ["css", "css3"] },
  // Front end
  // "react" is also a verb ("react quickly to change"), so the capitalised
  // form only.
  { name: "React", pattern: /\bReact(?:\.js|JS)?\b(?![\s-]Native)/ },
  { name: "React Native", aliases: ["react native", "react-native"] },
  { name: "Next.js", aliases: ["next.js", "nextjs"] },
  { name: "Angular", aliases: ["angular", "angularjs", "angular.js"] },
  { name: "Vue", aliases: ["vue", "vue.js", "vuejs"] },
  { name: "Nuxt", aliases: ["nuxt", "nuxt.js"] },
  { name: "Svelte", aliases: ["svelte", "sveltekit"] },
  { name: "Redux", aliases: ["redux"] },
  { name: "Tailwind CSS", aliases: ["tailwind", "tailwindcss", "tailwind css"] },
  { name: "jQuery", aliases: ["jquery"] },
  { name: "Webpack", aliases: ["webpack"] },
  // Back end
  { name: "Node.js", aliases: ["node.js", "nodejs", "node js"] },
  { name: "Express", aliases: ["express.js", "expressjs"] },
  { name: "NestJS", aliases: ["nestjs", "nest.js"] },
  { name: "Django", aliases: ["django"] },
  { name: "Flask", aliases: ["flask"] },
  { name: "FastAPI", aliases: ["fastapi"] },
  { name: "Spring Boot", aliases: ["spring boot", "springboot", "spring framework"] },
  { name: "Laravel", aliases: ["laravel"] },
  { name: "Symfony", aliases: ["symfony"] },
  { name: "GraphQL", aliases: ["graphql"] },
  { name: "REST APIs", pattern: /\b(?:REST(?:ful)?(?:\s+APIs?)?|RESTful)\b/ },
  { name: "gRPC", aliases: ["grpc"] },
  { name: "Kafka", aliases: ["kafka"] },
  { name: "RabbitMQ", aliases: ["rabbitmq"] },
  // Mobile
  { name: "iOS", pattern: /\biOS\b/ },
  { name: "Android", aliases: ["android"] },
  { name: "Flutter", aliases: ["flutter"] },
  // Data stores
  { name: "PostgreSQL", aliases: ["postgresql", "postgres"] },
  { name: "MySQL", aliases: ["mysql"] },
  { name: "MongoDB", aliases: ["mongodb", "mongo"] },
  { name: "Redis", aliases: ["redis"] },
  { name: "Elasticsearch", aliases: ["elasticsearch", "opensearch"] },
  { name: "DynamoDB", aliases: ["dynamodb"] },
  { name: "Cassandra", aliases: ["cassandra"] },
  { name: "SQL Server", aliases: ["sql server", "mssql"] },
  { name: "Oracle", pattern: /\bOracle\b/ },
  { name: "Supabase", aliases: ["supabase"] },
  { name: "Firebase", aliases: ["firebase"] },
  // Data & ML
  { name: "Spark", pattern: /\b(?:Apache Spark|PySpark|Spark)\b/ },
  { name: "Hadoop", aliases: ["hadoop"] },
  { name: "Airflow", aliases: ["airflow"] },
  { name: "dbt", pattern: /\bdbt\b/ },
  { name: "Snowflake", pattern: /\bSnowflake\b/ },
  { name: "BigQuery", aliases: ["bigquery"] },
  { name: "Redshift", aliases: ["redshift"] },
  { name: "Databricks", aliases: ["databricks"] },
  { name: "Pandas", pattern: /\b[Pp]andas\b/ },
  { name: "NumPy", aliases: ["numpy"] },
  { name: "scikit-learn", aliases: ["scikit-learn", "sklearn", "scikit learn"] },
  { name: "PyTorch", aliases: ["pytorch"] },
  { name: "TensorFlow", aliases: ["tensorflow"] },
  { name: "Keras", aliases: ["keras"] },
  { name: "LangChain", aliases: ["langchain"] },
  { name: "Tableau", aliases: ["tableau"] },
  { name: "Power BI", aliases: ["power bi", "powerbi"] },
  { name: "Looker", pattern: /\bLooker\b/ },
  { name: "Excel", pattern: /\b(?:MS |Microsoft )?Excel\b/ },
  // Cloud & DevOps
  { name: "AWS", aliases: ["aws", "amazon web services"] },
  { name: "GCP", aliases: ["gcp", "google cloud", "google cloud platform"] },
  { name: "Azure", aliases: ["azure"] },
  { name: "Kubernetes", aliases: ["kubernetes", "k8s"] },
  { name: "Docker", aliases: ["docker"] },
  { name: "Terraform", aliases: ["terraform"] },
  { name: "Ansible", aliases: ["ansible"] },
  { name: "Helm", pattern: /\bHelm\b/ },
  { name: "Linux", aliases: ["linux"] },
  { name: "CI/CD", aliases: ["ci/cd", "cicd"] },
  { name: "Jenkins", aliases: ["jenkins"] },
  { name: "GitHub Actions", aliases: ["github actions"] },
  { name: "Git", pattern: /\bGit\b/ },
  { name: "Prometheus", aliases: ["prometheus"] },
  { name: "Grafana", aliases: ["grafana"] },
  { name: "Datadog", aliases: ["datadog"] },
  { name: "Nginx", aliases: ["nginx"] },
  // Testing
  { name: "Selenium", aliases: ["selenium"] },
  { name: "Cypress", aliases: ["cypress"] },
  { name: "Playwright", aliases: ["playwright"] },
  { name: "Jest", pattern: /\bJest\b/ },
  // Business platforms & design
  { name: "Salesforce", aliases: ["salesforce"] },
  { name: "SAP", pattern: /\bSAP\b/ },
  { name: "HubSpot", aliases: ["hubspot"] },
  { name: "Workday", pattern: /\bWorkday\b/ },
  { name: "NetSuite", aliases: ["netsuite"] },
  { name: "ServiceNow", aliases: ["servicenow"] },
  { name: "Shopify", aliases: ["shopify"] },
  { name: "WordPress", aliases: ["wordpress"] },
  { name: "Figma", aliases: ["figma"] },
  { name: "Unity", pattern: /\bUnity(?:3D)?\b/ },
  { name: "Unreal Engine", aliases: ["unreal engine"] },
];

/** Most a job carries — past this it's a wall of chips, not a signal. */
const MAX_TECH = 12;

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let aliasMatcher: { pattern: RegExp; names: Map<string, string> } | null = null;

const getAliasMatcher = () => {
  if (aliasMatcher) return aliasMatcher;
  const names = new Map<string, string>();
  for (const entry of TECH) {
    for (const alias of entry.aliases || []) names.set(alias.toLowerCase(), entry.name);
  }
  const alternation = [...names.keys()]
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join("|");
  // Word boundaries that also respect "+", "#" and "." — so "c++" and ".net"
  // match, "asp.net" doesn't double as ".net" twice, and "java" never matches
  // inside "javascript".
  aliasMatcher = {
    pattern: new RegExp(`(?<![\\w.+#/-])(${alternation})(?![\\w+#]|\\.\\w)`, "gi"),
    names,
  };
  return aliasMatcher;
};

const CASE_SENSITIVE = TECH.filter((entry) => entry.pattern);

/**
 * Technologies named in `title` + `text`, in order of first mention, title
 * first. The hiring company's own product is left out — a Grafana Labs
 * posting mentions Grafana on every line.
 */
export const extractTechStack = (title: string, text: string, companyName = ""): string[] => {
  const company = companyName.trim().toLowerCase();
  const found: { name: string; at: number }[] = [];
  const seen = new Set<string>();
  const haystack = `${title}\n${text}`;
  // "Grafana Labs" hiring isn't a Grafana requirement.
  const isEmployer = (name: string) =>
    Boolean(company) && new RegExp(`(?:^|\\W)${escape(name.toLowerCase())}(?:\\W|$)`).test(company);
  const add = (name: string, at: number) => {
    if (seen.has(name) || isEmployer(name)) return;
    seen.add(name);
    found.push({ name, at });
  };

  const { pattern, names } = getAliasMatcher();
  pattern.lastIndex = 0;
  for (const match of haystack.matchAll(pattern)) {
    const name = names.get(match[1].toLowerCase());
    if (name) add(name, match.index ?? 0);
  }
  for (const entry of CASE_SENSITIVE) {
    const match = entry.pattern!.exec(haystack);
    if (match) add(entry.name, match.index);
  }

  return found
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_TECH)
    .map((entry) => entry.name);
};
