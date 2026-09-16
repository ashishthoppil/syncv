import Footer from "@/components/footer";
import { Navbar } from "@/components/navbar";
import type { ReactNode } from "react";

/**
 * Shared chrome for every public marketing page.
 *
 * The navbar is fixed, hence the top padding on <main>. Keeping this in one
 * component is what guarantees every landing page, article and role guide
 * inherits the same footer — which is where most of the site's internal linking
 * lives, and therefore the reason none of these pages end up orphaned.
 */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      {/* The inset term matches the one on the navbar's `top`, so the clearance
          stays correct when the bar is pushed below a notch. */}
      <main className="pt-[calc(6rem+env(safe-area-inset-top))] sm:pt-[calc(7rem+env(safe-area-inset-top))]">
        <div className="mx-auto w-full max-w-3xl px-4 pb-10 sm:px-6">{children}</div>
        <Footer />
      </main>
    </>
  );
}

/**
 * The single <h1> for a page, plus the standfirst under it.
 *
 * `answer` is rendered as a lead paragraph immediately after the heading: a
 * direct, self-contained answer to the question the page title poses. That
 * position is deliberate — it is what a reader scans and what an answer engine
 * is most likely to quote.
 */
export function PageHeader({
  eyebrow,
  h1,
  answer,
  meta,
}: {
  eyebrow?: string;
  h1: string;
  answer: string;
  meta?: string;
}) {
  return (
    <header>
      {eyebrow ? (
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-2 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
        {h1}
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-foreground/80">{answer}</p>
      {meta ? <p className="mt-4 text-sm text-muted-foreground">{meta}</p> : null}
    </header>
  );
}

export default PageShell;
