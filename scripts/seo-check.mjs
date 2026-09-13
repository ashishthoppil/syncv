#!/usr/bin/env node
/**
 * End-to-end SEO assertions against a running server.
 *
 *   node scripts/seo-check.mjs [baseUrl]        # defaults to http://localhost:3000
 *
 * It deliberately tests rendered HTML rather than the content modules, because
 * the failures that matter are the ones that reach a crawler: a canonical that
 * disagrees with the URL, a sitemap entry that 308s, a second <h1> appearing
 * from a component nobody thought about. Reading the source would miss all
 * three.
 *
 * Exits non-zero on any failure so it can gate a deploy.
 */

const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/+$/, "");

/** Routes that must exist but must never be indexable. */
const PRIVATE_ROUTES = ["/login", "/sign-up", "/scan", "/job-tracker"];

const failures = [];
const warnings = [];
const fail = (where, message) => failures.push(`${where}: ${message}`);
const warn = (where, message) => warnings.push(`${where}: ${message}`);

const get = async (url, options = {}) => {
  const response = await fetch(url, { redirect: "manual", ...options });
  const body = response.status < 400 || response.status === 404 ? await response.text() : "";
  return { status: response.status, location: response.headers.get("location"), body };
};

/** Maps a canonical (production) URL onto the server under test. */
const toLocal = (absoluteUrl) => {
  const { pathname, search } = new URL(absoluteUrl);
  return `${BASE}${pathname}${search}`;
};

const matchAll = (html, regex) => [...html.matchAll(regex)].map((match) => match[1]);

const attr = (html, selector) => {
  const match = html.match(selector);
  return match ? match[1] : null;
};

// ─── robots.txt ──────────────────────────────────────────────────────────────

const checkRobots = async () => {
  const { status, body } = await get(`${BASE}/robots.txt`);
  if (status !== 200) return fail("robots.txt", `expected 200, got ${status}`);

  const sitemapLine = body.match(/^Sitemap:\s*(\S+)/m);
  if (!sitemapLine) return fail("robots.txt", "no Sitemap: directive");

  const sitemapUrl = sitemapLine[1];
  if (/(?<!:)\/\//.test(sitemapUrl.replace(/^https?:\/\//, ""))) {
    fail("robots.txt", `sitemap URL contains a double slash: ${sitemapUrl}`);
  }

  for (const blocked of ["/_next/", "/_next/static", "Disallow: /\n"]) {
    if (body.includes(`Disallow: ${blocked}`)) {
      fail("robots.txt", `blocks rendering-critical path: ${blocked}`);
    }
  }

  const disallowAll = body.match(/User-Agent:\s*\*\s*\n(?:[^\n]*\n)*?Disallow:\s*\/\s*$/im);
  if (disallowAll) fail("robots.txt", "wildcard agent is disallowed from the whole site");

  return sitemapUrl;
};

// ─── sitemap.xml ─────────────────────────────────────────────────────────────

const checkSitemap = async () => {
  const { status, body } = await get(`${BASE}/sitemap.xml`);
  if (status !== 200) {
    fail("sitemap.xml", `expected 200, got ${status}`);
    return [];
  }

  const urls = matchAll(body, /<loc>([^<]+)<\/loc>/g);
  if (urls.length === 0) fail("sitemap.xml", "contains no URLs");

  const seen = new Set();
  for (const url of urls) {
    if (seen.has(url)) fail("sitemap.xml", `duplicate URL: ${url}`);
    seen.add(url);

    const path = new URL(url).pathname;
    if (path.includes("//")) fail("sitemap.xml", `double slash in path: ${url}`);
    if (path !== "/" && path.endsWith("/")) {
      fail("sitemap.xml", `trailing slash disagrees with route convention: ${url}`);
    }
    if (PRIVATE_ROUTES.some((priv) => path === priv || path.startsWith(`${priv}/`))) {
      fail("sitemap.xml", `private route listed: ${url}`);
    }
    if (path.startsWith("/api/")) fail("sitemap.xml", `API route listed: ${url}`);
  }

  return urls;
};

// ─── per-page assertions ─────────────────────────────────────────────────────

const checkPage = async (url, { titles, descriptions, linkTargets }) => {
  const local = toLocal(url);
  const path = new URL(url).pathname;
  const { status, location, body: html } = await get(local);

  if (status !== 200) {
    return fail(path, `expected 200, got ${status}${location ? ` → ${location}` : ""}`);
  }

  // Exactly one <h1>.
  const h1s = matchAll(html, /<h1[^>]*>([\s\S]*?)<\/h1>/g);
  if (h1s.length === 0) fail(path, "no <h1>");
  if (h1s.length > 1) fail(path, `${h1s.length} <h1> elements, expected 1`);

  // Title: present and unique.
  const title = attr(html, /<title>([^<]*)<\/title>/);
  if (!title) fail(path, "no <title>");
  else {
    if (titles.has(title)) fail(path, `duplicate <title> (also on ${titles.get(title)})`);
    else titles.set(title, path);
    if (title.length > 65) warn(path, `title is ${title.length} chars, likely truncated in SERPs`);
  }

  // Description: present and unique.
  const description = attr(html, /<meta name="description" content="([^"]*)"/);
  if (!description) fail(path, "no meta description");
  else {
    if (descriptions.has(description)) {
      fail(path, `duplicate meta description (also on ${descriptions.get(description)})`);
    } else descriptions.set(description, path);
    if (description.length > 170) warn(path, `description is ${description.length} chars`);
    if (description.length < 50) warn(path, `description is only ${description.length} chars`);
  }

  // Canonical: present, absolute, self-referencing.
  const canonical = attr(html, /<link rel="canonical" href="([^"]*)"/);
  if (!canonical) fail(path, "no canonical");
  else {
    if (!/^https?:\/\//.test(canonical)) fail(path, `canonical is not absolute: ${canonical}`);
    else {
      const canonicalPath = new URL(canonical).pathname;
      const expected = path === "/" ? "/" : path;
      if (canonicalPath !== expected) {
        fail(path, `canonical points elsewhere: ${canonicalPath} (expected ${expected})`);
      }
      if (canonicalPath.includes("//")) fail(path, `double slash in canonical: ${canonical}`);
    }
  }

  // Indexable pages must not carry a noindex.
  const robotsMeta = attr(html, /<meta name="robots" content="([^"]*)"/) || "";
  if (/noindex/i.test(robotsMeta)) fail(path, "sitemap URL is noindex");

  // Open Graph completeness.
  for (const property of ["og:title", "og:description", "og:url", "og:type", "og:image", "og:site_name"]) {
    if (!html.includes(`property="${property}"`)) fail(path, `missing ${property}`);
  }
  if (!html.includes('name="twitter:card"')) fail(path, "missing twitter:card");

  const ogUrl = attr(html, /<meta property="og:url" content="([^"]*)"/);
  if (ogUrl && canonical && ogUrl !== canonical) {
    fail(path, `og:url (${ogUrl}) disagrees with canonical (${canonical})`);
  }

  // JSON-LD must be valid JSON.
  const blocks = matchAll(
    html,
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
  );
  if (blocks.length === 0) fail(path, "no JSON-LD");
  for (const [index, block] of blocks.entries()) {
    try {
      const parsed = JSON.parse(block);
      if (!parsed["@context"]) fail(path, `JSON-LD block ${index} has no @context`);
    } catch (error) {
      fail(path, `JSON-LD block ${index} is not valid JSON: ${error.message}`);
    }
  }

  // Images need alt text and explicit dimensions. The capture is the whole tag
  // so that a first-position attribute (no preceding space) still matches.
  for (const tag of matchAll(html, /(<img\s[^>]*>)/g)) {
    if (!/[\s"]alt=/.test(tag)) fail(path, `an <img> has no alt attribute: ${tag.slice(0, 80)}`);
    else if (/alt=""/.test(tag) && !/aria-hidden/.test(tag)) {
      warn(path, "an <img> has an empty alt and is not aria-hidden");
    }
    if (!/[\s"]width=/.test(tag) || !/[\s"]height=/.test(tag)) {
      warn(path, `an <img> has no explicit width/height: ${tag.slice(0, 80)}`);
    }
  }

  // Heading order must not skip a level.
  const levels = matchAll(html, /<(h[1-6])[^>]*>/g).map((tag) => Number(tag[1]));
  for (let i = 1; i < levels.length; i += 1) {
    if (levels[i] - levels[i - 1] > 1) {
      warn(path, `heading level skips h${levels[i - 1]} → h${levels[i]}`);
      break;
    }
  }

  // Collect internal links so we can prove none of them are dead.
  for (const href of matchAll(html, /<a\s[^>]*href="(\/[^"#?]*)"/g)) {
    linkTargets.add(href.replace(/\/$/, "") || "/");
  }
};

// ─── private routes ──────────────────────────────────────────────────────────

const checkPrivateRoutes = async () => {
  for (const path of PRIVATE_ROUTES) {
    let { status, location, body } = await get(`${BASE}${path}`);

    // A private route may redirect an unauthenticated visitor to /login. That is
    // fine, provided the page they land on is itself noindex.
    if (status >= 300 && status < 400 && location) {
      const target = location.startsWith("http") ? toLocal(location) : `${BASE}${location}`;
      ({ status, body } = await get(target));
    }

    if (status !== 200) {
      warn(path, `expected 200 for a noindex check, got ${status}`);
      continue;
    }
    const robotsMeta = attr(body, /<meta name="robots" content="([^"]*)"/) || "";
    if (!/noindex/i.test(robotsMeta)) {
      fail(path, `private route is indexable (robots: "${robotsMeta || "none"}")`);
    }
  }
};

// ─── internal links ──────────────────────────────────────────────────────────

const checkInternalLinks = async (linkTargets) => {
  const skip = (path) => path.startsWith("/api/") || path.startsWith("/_next/");
  for (const path of linkTargets) {
    if (skip(path)) continue;
    const { status, location } = await get(`${BASE}${path}`);
    if (status === 404) fail("internal links", `dead link to ${path}`);
    else if (status >= 300 && status < 400) {
      warn("internal links", `${path} redirects to ${location} (avoid linking through a redirect)`);
    }
  }
};

// ─── run ─────────────────────────────────────────────────────────────────────

const main = async () => {
  console.log(`SEO check against ${BASE}\n`);

  await checkRobots();
  const urls = await checkSitemap();

  const titles = new Map();
  const descriptions = new Map();
  const linkTargets = new Set();

  for (const url of urls) {
    await checkPage(url, { titles, descriptions, linkTargets });
  }

  await checkPrivateRoutes();
  await checkInternalLinks(linkTargets);

  console.log(`Checked ${urls.length} sitemap URLs and ${linkTargets.size} internal link targets.`);

  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const warning of warnings) console.log(`  ⚠ ${warning}`);
  }

  if (failures.length) {
    console.log(`\n${failures.length} failure(s):`);
    for (const failure of failures) console.log(`  ✗ ${failure}`);
    process.exit(1);
  }

  console.log("\n✓ All SEO checks passed.");
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
