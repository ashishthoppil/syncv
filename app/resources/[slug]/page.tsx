import Breadcrumbs from "@/components/marketing/breadcrumbs";
import ContentSections from "@/components/marketing/content-sections";
import CtaSection from "@/components/marketing/cta-section";
import FaqSection from "@/components/marketing/faq-section";
import PageShell, { PageHeader } from "@/components/marketing/page-shell";
import JsonLd from "@/components/seo/json-ld";
import { ARTICLES, getArticle } from "@/lib/content/articles";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  articleNode,
  breadcrumbNode,
  buildGraph,
  faqNode,
  webPageNode,
} from "@/lib/seo/schema";
import { absoluteUrl } from "@/lib/seo/site";
import Link from "next/link";
import { notFound } from "next/navigation";

/**
 * Statically generated from the article collection, so every URL in the sitemap
 * is prerendered HTML with its title, canonical, headings and structured data
 * already in the initial response — no client-side execution required to see
 * the content.
 */
export function generateStaticParams() {
  return ARTICLES.map((article) => ({ slug: article.slug }));
}

/** Any slug outside the collection 404s rather than rendering an empty shell. */
export const dynamicParams = false;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return {};

  return buildMetadata({
    title: article.title,
    description: article.description,
    path: `/resources/${article.slug}`,
    type: "article",
    publishedTime: article.published,
    modifiedTime: article.updated,
  });
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const path = `/resources/${article.slug}`;
  const url = absoluteUrl(path);

  const trail = [
    { name: "Home", path: "/" },
    { name: "Resources", path: "/resources" },
    { name: article.title, path },
  ];

  const graph = buildGraph([
    webPageNode({
      path,
      name: article.title,
      description: article.description,
      breadcrumbs: trail,
    }),
    articleNode({
      path,
      headline: article.h1,
      description: article.description,
      datePublished: article.published,
      dateModified: article.updated,
    }),
    breadcrumbNode(url, trail),
    faqNode(url, article.faqs),
  ]);

  const related = article.related
    .map((relatedSlug) => getArticle(relatedSlug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <PageShell>
      <JsonLd id={`ld-article-${article.slug}`} data={graph} />
      <Breadcrumbs trail={trail} />

      <article>
        <PageHeader
          h1={article.h1}
          answer={article.answer}
          meta={`${article.readingMinutes} min read · Updated ${formatDate(article.updated)}`}
        />

        <ContentSections sections={article.sections} />

        <FaqSection items={article.faqs} />
      </article>

      <section className="mt-16">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Keep reading</h2>
        <ul className="mt-6 space-y-3">
          {related.map((item) => (
            <li key={item.slug}>
              <Link
                href={`/resources/${item.slug}`}
                className="block rounded-xl border bg-background p-5 hover:border-foreground/30"
              >
                <span className="font-semibold">{item.title}</span>
                <span className="mt-1 block text-sm text-foreground/70">
                  {item.description}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-[15px] text-foreground/80">
          In SynCV:{" "}
          {article.productLinks.map((link, index) => (
            <span key={link.href}>
              {index > 0 ? ", " : ""}
              <Link href={link.href} className="font-medium underline underline-offset-4">
                {link.label}
              </Link>
            </span>
          ))}
          .
        </p>
      </section>

      <CtaSection
        heading="Try it on the job you are applying to next"
        body="Upload your resume once, paste the job description, and see which of your experience SynCV brings forward — and what it leaves alone."
        action="Tailor your resume free"
      />
    </PageShell>
  );
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
