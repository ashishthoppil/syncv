import { SOLUTION_LIST } from "@/lib/content/solutions";
import { ROLE_GUIDES } from "@/lib/content/roles";
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
    <section id="tools" className="w-full px-6 py-12 xs:py-20">
      <div className="mx-auto max-w-screen-lg">
        <h2 className="text-3xl xs:text-4xl sm:text-5xl font-bold tracking-tight text-center">
          More Tools for Your Job Search
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-lg leading-relaxed text-foreground/80">
          Tailoring is the core of it. These are the parts around it.
        </p>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2">
          {SOLUTION_LIST.map((solution) => (
            <li key={solution.path}>
              <Link
                href={solution.path}
                className="block h-full rounded-xl border bg-background p-6 transition-colors hover:border-foreground/30"
              >
                <h3 className="text-lg font-semibold tracking-tight">{solution.h1}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-foreground/80">
                  {solution.description}
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-10 rounded-xl border bg-muted/40 p-6">
          <h3 className="text-lg font-semibold tracking-tight">Tailoring advice by role</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-foreground/80">
            What reviewers in a specific discipline look for first, and what to lead with.
          </p>
          <p className="mt-4 text-[15px]">
            {ROLE_GUIDES.map((role, index) => (
              <span key={role.slug}>
                {index > 0 ? " · " : ""}
                <Link
                  href={`/resume-for/${role.slug}`}
                  className="font-medium underline underline-offset-4"
                >
                  {role.role} resumes
                </Link>
              </span>
            ))}
          </p>
        </div>
      </div>
    </section>
  );
};

export default MoreTools;
