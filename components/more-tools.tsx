import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { SOLUTION_LIST } from "@/lib/content/solutions";
import { ROLE_GUIDES } from "@/lib/content/roles";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

/**
 * The homepage's hub link block.
 *
 * Before this existed, the homepage linked only to /sign-up, /login and
 * in-page anchors — every marketing page would have been an orphan. This is the
 * top of the internal-link graph: homepage → product pages → guides → role
 * pages, with the footer carrying the same links site-wide.
 *
 * Anchor text is the page's actual subject rather than "learn more".
 */
const MoreTools = () => {
  return (
    <section id="tools" className="w-full px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-screen-lg">
        <SectionHeading
          eyebrow="More tools"
          title="More Tools for Your Job Search"
          description="Tailoring is the core of it. These are the parts around it."
        />

        <ul className="mt-12 grid gap-4 sm:mt-16 sm:grid-cols-2">
          {SOLUTION_LIST.map((solution, index) => (
            <Reveal as="li" key={solution.path} delay={(index % 2) * 100}>
              <Link
                href={solution.path}
                className="group block h-full rounded-2xl border border-hairline bg-white p-6 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-neutral-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-lg font-semibold tracking-tight text-ink">
                    {solution.h1}
                  </h3>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400 transition-[color,transform] duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand"
                  />
                </div>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                  {solution.description}
                </p>
              </Link>
            </Reveal>
          ))}
        </ul>

        <Reveal className="mt-8 rounded-2xl border border-hairline bg-neutral-50 p-6 sm:p-8">
          <h3 className="text-lg font-semibold tracking-tight text-ink">
            Tailoring advice by role
          </h3>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
            What reviewers in a specific discipline look for first, and what to lead with.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2">
            {ROLE_GUIDES.map((role) => (
              <li key={role.slug}>
                <Link
                  href={`/resume-for/${role.slug}`}
                  className="inline-flex items-center rounded-full border border-hairline bg-white px-4 py-2 text-sm font-medium text-ink shadow-sm transition-colors hover:border-brand hover:text-ink"
                >
                  {role.role} resumes
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
};

export default MoreTools;
