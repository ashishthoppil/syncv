import PageShell, { PageHeader } from "@/components/marketing/page-shell";
import { SOLUTION_LIST } from "@/lib/content/solutions";
import type { Metadata } from "next";
import Link from "next/link";

/**
 * Custom 404.
 *
 * Next.js serves this with a real 404 status, which is what matters — the
 * default was an unstyled dead end with no way back into the site. It is
 * noindex (a 404 should never be indexed) but follow, so the links below still
 * pass crawlers back to real pages.
 */
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="404"
        h1="That page doesn't exist"
        answer="The link may be out of date, or the address may have a typo in it. Everything below is a real page."
      />

      <section className="mt-12">
        <h2 className="text-2xl font-bold tracking-tight">Try one of these</h2>
        <ul className="mt-6 space-y-3">
          <li>
            <Link
              href="/"
              className="block rounded-xl border bg-background p-5 hover:border-foreground/30"
            >
              <span className="font-semibold">SynCV home</span>
              <span className="mt-1 block text-sm text-foreground/70">
                Tailor your resume to any job description in two clicks.
              </span>
            </Link>
          </li>
          {SOLUTION_LIST.map((solution) => (
            <li key={solution.path}>
              <Link
                href={solution.path}
                className="block rounded-xl border bg-background p-5 hover:border-foreground/30"
              >
                <span className="font-semibold">{solution.h1}</span>
                <span className="mt-1 block text-sm text-foreground/70">
                  {solution.description}
                </span>
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/resources"
              className="block rounded-xl border bg-background p-5 hover:border-foreground/30"
            >
              <span className="font-semibold">Resume tailoring guides</span>
              <span className="mt-1 block text-sm text-foreground/70">
                How to tailor a resume to a job description, and how to stay honest doing it.
              </span>
            </Link>
          </li>
        </ul>
      </section>
    </PageShell>
  );
}
