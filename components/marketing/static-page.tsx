import Breadcrumbs from "@/components/marketing/breadcrumbs";
import ContentSections from "@/components/marketing/content-sections";
import PageShell, { PageHeader } from "@/components/marketing/page-shell";
import JsonLd from "@/components/seo/json-ld";
import type { StaticPage } from "@/lib/content/pages";
import { breadcrumbNode, buildGraph, webPageNode } from "@/lib/seo/schema";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * Renders the trust pages (about, contact, policies).
 *
 * These carry WebPage + BreadcrumbList only — no Article node, because they are
 * standing documents rather than dated posts, and no FAQ markup, because none
 * of them render a Q&A list.
 */
export function StaticContentPage({ page }: { page: StaticPage }) {
  const url = absoluteUrl(page.path);

  const trail = [
    { name: "Home", path: "/" },
    { name: page.h1, path: page.path },
  ];

  const graph = buildGraph([
    webPageNode({
      path: page.path,
      name: page.title,
      description: page.description,
      breadcrumbs: trail,
      about: page.path === "/about" ? "organization" : undefined,
    }),
    breadcrumbNode(url, trail),
  ]);

  return (
    <PageShell>
      <JsonLd id={`ld-page-${page.path.replace(/\//g, "")}`} data={graph} />
      <Breadcrumbs trail={trail} />

      <PageHeader
        h1={page.h1}
        answer={page.answer}
        meta={page.updated ? `Last updated ${page.updated}` : undefined}
      />

      <ContentSections sections={page.sections} />
    </PageShell>
  );
}

export default StaticContentPage;
