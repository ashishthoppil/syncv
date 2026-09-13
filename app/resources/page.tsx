import JsonLd from "@/components/seo/json-ld";
import Breadcrumbs from "@/components/marketing/breadcrumbs";
import CtaSection from "@/components/marketing/cta-section";
import PageShell, { PageHeader } from "@/components/marketing/page-shell";
import { ARTICLES } from "@/lib/content/articles";
import { ROLE_GUIDES } from "@/lib/content/roles";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbNode, buildGraph, webPageNode } from "@/lib/seo/schema";
import { absoluteUrl } from "@/lib/seo/site";
import Link from "next/link";

const PATH = "/resources";
const TITLE = "Resume Tailoring Guides & Resources";
const DESCRIPTION =
  "Practical guides on tailoring a resume to a job description — what to change per application, how to stay honest about it, and how ATS matching actually works.";

export const metadata = buildMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

const trail = [
  { name: "Home", path: "/" },
  { name: "Resources", path: PATH },
];

export default function ResourcesPage() {
  const url = absoluteUrl(PATH);

  const graph = buildGraph([
    webPageNode({
      path: PATH,
      name: TITLE,
      description: DESCRIPTION,
      breadcrumbs: trail,
    }),
    breadcrumbNode(url, trail),
  ]);

  return (
    <PageShell>
      <JsonLd id="ld-resources" data={graph} />
      <Breadcrumbs trail={trail} />

      <PageHeader
        eyebrow="Resources"
        h1="Guides to tailoring your resume"
        answer="Everything here is about one problem: making a resume you already have read as the right resume for one specific job. No templates, no interview-question lists — just the parts of the process people get wrong, with examples."
      />

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Guides</h2>
        <ul className="mt-6 space-y-4">
          {ARTICLES.map((article) => (
            <li key={article.slug} className="rounded-xl border bg-background p-6">
              <h3 className="text-lg font-semibold tracking-tight">
                <Link
                  href={`/resources/${article.slug}`}
                  className="hover:underline"
                >
                  {article.title}
                </Link>
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground/80">
                {article.description}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                {article.readingMinutes} min read
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Tailoring advice by role
        </h2>
        <p className="mt-4 text-[17px] leading-relaxed text-foreground/80">
          What screeners look for, and what to lead with, in specific disciplines.
        </p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {ROLE_GUIDES.map((role) => (
            <li key={role.slug}>
              <Link
                href={`/resume-for/${role.slug}`}
                className="block rounded-xl border bg-background p-5 hover:border-foreground/30"
              >
                <span className="font-semibold">{role.role}</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {role.primaryKeyword}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <CtaSection
        heading="Stop rewriting your resume by hand"
        body="Upload it once, paste a job description, and get a version aimed at that posting — built from the experience already on your resume."
        action="Tailor your resume free"
      />
    </PageShell>
  );
}
