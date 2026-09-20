import * as cheerio from "cheerio";

/**
 * Job descriptions arrive as third-party HTML. It is rendered with
 * dangerouslySetInnerHTML in the detail view, so it has to be reduced to an
 * allow-list first — and always on the server, so the browser never holds the
 * raw markup. Anything not on the list is unwrapped (its text is kept) rather
 * than dropped, because boards wrap real content in arbitrary containers.
 */
const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "a",
  "code",
  "pre",
  "hr",
]);

/** Tags whose *contents* are markup or code, not prose — removed entirely. */
const STRIPPED_TAGS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "svg",
  "link",
  "meta",
  "noscript",
];

const isSafeHref = (href: string) => /^https?:\/\//i.test(href.trim());

export const sanitizeJobHtml = (html: string): string => {
  if (!html) return "";
  const $ = cheerio.load(html, null, false);

  $(STRIPPED_TAGS.join(",")).remove();
  $("*").each((_, element) => {
    if (element.type !== "tag") return;
    const node = $(element);
    const tag = element.tagName?.toLowerCase() || "";

    if (!ALLOWED_TAGS.has(tag)) {
      node.replaceWith(node.contents());
      return;
    }

    // Drop every attribute, then re-add only a vetted href. This kills
    // on*= handlers, style, and javascript:/data: URLs in one pass.
    const href = tag === "a" ? node.attr("href") || "" : "";
    Object.keys(element.attribs || {}).forEach((name) => node.removeAttr(name));
    if (tag === "a") {
      if (isSafeHref(href)) {
        node.attr("href", href.trim());
        node.attr("target", "_blank");
        node.attr("rel", "noopener noreferrer nofollow");
      } else {
        node.replaceWith(node.contents());
      }
    }
  });

  return $.html().trim();
};

/**
 * Boards hand back entity-encoded plain text ("Zone &#038; Co"), which React
 * would render literally. Decode it once, here, for the short fields.
 */
export const decodeEntities = (text: string): string => {
  if (!text || !text.includes("&")) return text;
  return cheerio.load(text, null, false).text();
};

/**
 * The plain-text form the existing scanner consumes. Block elements become line
 * breaks and list items keep a bullet, so the JD still reads as a structured
 * document to the keyword extractor.
 */
export const htmlToPlainText = (html: string): string => {
  if (!html) return "";
  const $ = cheerio.load(html, null, false);
  $(STRIPPED_TAGS.join(",")).remove();
  $("br").replaceWith("\n");
  $("li").each((_, element) => {
    const node = $(element);
    node.replaceWith(`\n- ${node.text().trim()}`);
  });
  $("p,div,h1,h2,h3,h4,h5,h6,tr,section,article").each((_, element) => {
    const node = $(element);
    node.replaceWith(`\n${node.text()}\n`);
  });

  return $.text()
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};
