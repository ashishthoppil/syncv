import Breadcrumbs from "@/components/marketing/breadcrumbs";
import ContentSections from "@/components/marketing/content-sections";
import CtaSection from "@/components/marketing/cta-section";
import FaqSection from "@/components/marketing/faq-section";
import PageShell, { PageHeader } from "@/components/marketing/page-shell";
import JsonLd from "@/components/seo/json-ld";
import type { Solution } from "@/lib/content/solutions";
import {
  breadcrumbNode,
  buildGraph,
  faqNode,
  softwareApplicationNode,
  webPageNode,
} from "@/lib/seo/schema";
import { absoluteUrl } from "@/lib/seo/site";
import Link from "next/link";

/**
 * Renders a product/intent landing page from its content entry.
 *
 * The SoftwareApplication node is emitted only on the page flagged as the
 * primary product page. Other pages reference the same entity by @id through
 * the graph instead of redeclaring it, which keeps one canonical description of
 * the product rather than five competing ones.
 */
export function SolutionPage({ solution }: { solution: Solution }) {
  const url = absoluteUrl(solution.path);

  const trail = [
    { name: "Home", path: "/" },
    { name: solution.h1, path: solution.path },
  ];

  const graph = buildGraph([
    webPageNode({
      path: solution.path,
      name: solution.title,
      description: solution.description,
      breadcrumbs: trail,
      about: "software",
    }),
    ...(solution.isPrimaryProductPage ? [softwareApplicationNode()] : []),
    breadcrumbNode(url, trail),
    faqNode(url, solution.faqs),
  ]);

  return (
    <PageShell>
      <JsonLd id={`ld-solution-${solution.path.replace(/\//g, "")}`} data={graph} />
      <Breadcrumbs trail={trail} />

      <PageHeader h1={solution.h1} answer={solution.answer} />

      <ContentSections sections={solution.sections} />

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          What it doesn&apos;t do
        </h2>
        <p className="mt-4 text-[17px] leading-relaxed text-foreground/80">
          Worth stating plainly, because several of these are things similar tools imply
          they can do.
        </p>
        <ul className="mt-5 space-y-3">
          {solution.limits.map((limit) => (
            <li
              key={limit}
              className="rounded-xl border bg-background p-4 text-[15px] leading-relaxed text-foreground/80"
            >
              {limit}
            </li>
          ))}
        </ul>
      </section>

      <FaqSection items={solution.faqs} />

      <section className="mt-16">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Related</h2>
        <ul className="mt-6 space-y-2">
          {solution.internalLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-[17px] font-medium underline underline-offset-4 hover:no-underline"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <CtaSection
        heading={solution.cta.heading}
        body={solution.cta.body}
        action={solution.cta.action}
      />
    </PageShell>
  );
}

export default SolutionPage;
