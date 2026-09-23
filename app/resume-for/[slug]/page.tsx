import BeforeAfterBlock from "@/components/marketing/before-after-example";
import Breadcrumbs from "@/components/marketing/breadcrumbs";
import CtaSection from "@/components/marketing/cta-section";
import FaqSection from "@/components/marketing/faq-section";
import PageShell, { PageHeader } from "@/components/marketing/page-shell";
import JsonLd from "@/components/seo/json-ld";
import { getArticle } from "@/lib/content/articles";
import { ROLE_GUIDES, getRoleGuide } from "@/lib/content/roles";
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

export function generateStaticParams() {
  return ROLE_GUIDES.map((role) => ({ slug: role.slug }));
}

export const dynamicParams = false;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const role = getRoleGuide(slug);
  if (!role) return {};

  return buildMetadata({
    title: role.title,
    description: role.description,
    path: `/resume-for/${role.slug}`,
    type: "article",
    publishedTime: role.updated,
    modifiedTime: role.updated,
  });
}

export default async function RolePage({ params }: Props) {
  const { slug } = await params;
  const role = getRoleGuide(slug);
  if (!role) notFound();

  const path = `/resume-for/${role.slug}`;
  const url = absoluteUrl(path);

  const trail = [
    { name: "Home", path: "/" },
    { name: "Resume by role", path: "/resume-for" },
    { name: role.role, path },
  ];

  const graph = buildGraph([
    webPageNode({
      path,
      name: role.title,
      description: role.description,
      breadcrumbs: trail,
    }),
    articleNode({
      path,
      headline: role.h1,
      description: role.description,
      datePublished: role.updated,
      dateModified: role.updated,
    }),
    breadcrumbNode(url, trail),
    faqNode(url, role.faqs),
  ]);

  const relatedArticles = role.relatedArticles
    .map((articleSlug) => getArticle(articleSlug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <PageShell>
      <JsonLd id={`ld-role-${role.slug}`} data={graph} />
      <Breadcrumbs trail={trail} />

      <article>
        <PageHeader eyebrow={role.role} h1={role.h1} answer={role.answer} />

        {role.intro.map((paragraph) => (
          <p key={paragraph} className="mt-4 text-[17px] leading-relaxed text-foreground/80">
            {paragraph}
          </p>
        ))}

        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            What the job actually involves
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-foreground/80">
            Postings vary, but these responsibilities recur across {role.role.toLowerCase()}{" "}
            roles. They are the raw material your bullets should be describing.
          </p>
          <ul className="mt-5 space-y-2">
            {role.responsibilities.map((item) => (
              <li key={item} className="relative pl-6 text-[17px] leading-relaxed text-foreground/80 before:absolute before:left-1 before:top-[0.7em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-foreground/40">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            What reviewers look for first
          </h2>
          <ul className="mt-5 space-y-2">
            {role.recruiterSignals.map((item) => (
              <li key={item} className="relative pl-6 text-[17px] leading-relaxed text-foreground/80 before:absolute before:left-1 before:top-[0.7em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-foreground/40">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            The sections that matter most
          </h2>
          <dl className="mt-6 divide-y rounded-xl border bg-background">
            {role.sectionsThatMatter.map((item) => (
              <div key={item.section} className="p-6">
                <dt>
                  <h3 className="text-lg font-semibold tracking-tight">{item.section}</h3>
                </dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-foreground/80">
                  {item.guidance}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Skills worth naming — when they are yours
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-foreground/80">
            These are the terms {role.role.toLowerCase()} postings tend to name. Use this as a
            prompt for things you have genuinely done and left off your resume — not as a list
            to copy.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {role.skills.map((group) => (
              <div key={group.label} className="rounded-xl border bg-background p-5">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-foreground/80">
                  {group.items.join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Examples of strong bullet points
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-foreground/80">
            Illustrations of the structure, not text to copy. Each names something specific and
            says what changed.
          </p>
          <ul className="mt-5 space-y-3">
            {role.strongBullets.map((bullet) => (
              <li
                key={bullet}
                className="rounded-xl border-l-4 border-foreground/20 bg-muted/40 p-4 text-[15px] leading-relaxed"
              >
                {bullet}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Tailoring examples: before and after
          </h2>
          <p className="mt-4 text-[17px] leading-relaxed text-foreground/80">
            The same experience, described for a specific posting. Nothing in the “after”
            column is new information about the candidate.
          </p>
          {role.examples.map((example) => (
            <BeforeAfterBlock key={example.id} example={example} />
          ))}
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Common mistakes on {role.role.toLowerCase()} resumes
          </h2>
          <dl className="mt-6 space-y-5">
            {role.mistakes.map((item) => (
              <div key={item.mistake} className="rounded-xl border bg-background p-5">
                <dt>
                  <h3 className="text-[17px] font-semibold">{item.mistake}</h3>
                </dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-foreground/80">
                  <span className="font-medium">Instead: </span>
                  {item.instead}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Tailoring a {role.role.toLowerCase()} resume with SynCV
          </h2>
          <ol className="mt-6 space-y-4">
            {role.workflow.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background"
                >
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-[17px] font-semibold">{step.title}</h3>
                  <p className="mt-1 text-[17px] leading-relaxed text-foreground/80">
                    {step.detail}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-[15px] text-foreground/80">
            More on the tool:{" "}
            <Link href="/resume-tailor" className="font-medium underline underline-offset-4">
              job-specific resume tailoring
            </Link>{" "}
            and{" "}
            <Link
              href="/job-description-analyzer"
              className="font-medium underline underline-offset-4"
            >
              job description analysis
            </Link>
            .
          </p>
        </section>

        <FaqSection items={role.faqs} />
      </article>

      <section className="mt-16">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Related guides</h2>
        <ul className="mt-6 space-y-3">
          {relatedArticles.map((item) => (
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
          <li>
            <Link
              href="/resume-for"
              className="block rounded-xl border bg-background p-5 hover:border-foreground/30"
            >
              <span className="font-semibold">All role guides</span>
              <span className="mt-1 block text-sm text-foreground/70">
                Tailoring advice for other disciplines.
              </span>
            </Link>
          </li>
        </ul>
      </section>

      <CtaSection
        heading={`Tailor your ${role.role.toLowerCase()} resume to a real posting`}
        body="Upload your resume once, paste the job description, and review what SynCV brings forward before you send it."
        action="Tailor your resume free"
      />
    </PageShell>
  );
}
