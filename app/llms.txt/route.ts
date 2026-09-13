import { ARTICLES } from "@/lib/content/articles";
import { STATIC_PAGES } from "@/lib/content/pages";
import { ROLE_GUIDES } from "@/lib/content/roles";
import { SOLUTION_LIST } from "@/lib/content/solutions";
import { SITE_NAME, absoluteUrl } from "@/lib/seo/site";

/**
 * /llms.txt — an optional, machine-readable index of the public site.
 *
 * This is NOT a Google ranking factor and nothing here should be described as
 * one. It is a convention some LLM-based tools read to find a site's canonical
 * documentation, and it costs nothing to generate from the same content model
 * the sitemap uses. If it turns out nothing consumes it, deleting this file has
 * no SEO consequence whatsoever.
 *
 * It is generated rather than hand-written so it cannot drift out of sync.
 */
export const dynamic = "force-static";

export function GET() {
  const lines: string[] = [
    `# ${SITE_NAME}`,
    "",
    "> SynCV tailors an existing resume to a specific job description. It reorders, rewrites and re-emphasises the experience already on the resume so the parts relevant to one job appear first. It does not add skills, employers, dates or achievements the candidate has not claimed.",
    "",
    "SynCV does not determine whether a candidate is qualified for a job, does not advise whether to apply, and does not guarantee interviews or applicant tracking system approval.",
    "",
    "## Product",
    "",
    ...SOLUTION_LIST.map(
      (solution) => `- [${solution.h1}](${absoluteUrl(solution.path)}): ${solution.description}`
    ),
    "",
    "## Guides",
    "",
    ...ARTICLES.map(
      (article) => `- [${article.title}](${absoluteUrl(`/resources/${article.slug}`)}): ${article.description}`
    ),
    "",
    "## Resume advice by role",
    "",
    ...ROLE_GUIDES.map(
      (role) => `- [${role.title}](${absoluteUrl(`/resume-for/${role.slug}`)}): ${role.description}`
    ),
    "",
    "## About",
    "",
    ...STATIC_PAGES.map(
      (page) => `- [${page.title}](${absoluteUrl(page.path)}): ${page.description}`
    ),
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
