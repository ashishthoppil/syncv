import Breadcrumbs from "@/components/marketing/breadcrumbs";
import CtaSection from "@/components/marketing/cta-section";
import PageShell, { PageHeader } from "@/components/marketing/page-shell";
import JsonLd from "@/components/seo/json-ld";
import { ROLE_GUIDES } from "@/lib/content/roles";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbNode, buildGraph, webPageNode } from "@/lib/seo/schema";
import { absoluteUrl } from "@/lib/seo/site";
import Link from "next/link";

const PATH = "/resume-for";
const TITLE = "Resume Tailoring Guides by Job Role";
const DESCRIPTION =
  "Role-specific guides to tailoring a resume: what screeners look for, which bullets carry weight, and what to lead with for each discipline.";

export const metadata = buildMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
});

const trail = [
  { name: "Home", path: "/" },
  { name: "Resume by role", path: PATH },
];

export default function ResumeForHub() {
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
      <JsonLd id="ld-resume-for" data={graph} />
      <Breadcrumbs trail={trail} />

      <PageHeader
        eyebrow="By role"
        h1="Resume tailoring guides by role"
        answer="Screening criteria are not universal. A backend posting and a data analyst posting reward different bullets, different vocabulary and a different ordering of the same career. These guides cover what each discipline's reviewers look for first."
      />

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Available guides</h2>
        <ul className="mt-6 space-y-4">
          {ROLE_GUIDES.map((role) => (
            <li key={role.slug} className="rounded-xl border bg-background p-6">
              <h3 className="text-lg font-semibold tracking-tight">
                <Link href={`/resume-for/${role.slug}`} className="hover:underline">
                  {role.title}
                </Link>
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground/80">
                {role.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Why these are written one at a time
        </h2>
        <p className="mt-4 text-[17px] leading-relaxed text-foreground/80">
          Advice for a project manager and advice for a software engineer are not the same
          sentences with a job title swapped. Each guide here is written from scratch, which
          is why there are a handful rather than a thousand. If your role is not covered
          yet, the{" "}
          <Link href="/resources/how-to-tailor-your-resume-to-a-job-description" className="font-medium underline underline-offset-4">
            general method for tailoring a resume to a job description
          </Link>{" "}
          applies to any discipline.
        </p>
      </section>

      <CtaSection
        heading="Tailor your resume for the role you are applying to"
        body="SynCV reads your resume and the posting together, then brings the relevant experience forward. It works from what you have actually done."
        action="Tailor your resume free"
      />
    </PageShell>
  );
}
