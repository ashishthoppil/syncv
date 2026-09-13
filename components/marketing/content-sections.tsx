import BeforeAfterBlock from "@/components/marketing/before-after-example";
import type { ArticleSection } from "@/lib/content/articles";

/**
 * Renders the body of an article or landing page from structured content.
 *
 * Headings are <h2> and the page's single <h1> lives in PageHeader, so the
 * outline stays h1 → h2 → h3 no matter how many sections a page has.
 */
export function ContentSections({ sections }: { sections: ArticleSection[] }) {
  return (
    <>
      {sections.map((section) => (
        <section key={section.heading} className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {section.heading}
          </h2>

          {section.body.map((paragraph) => (
            <p key={paragraph} className="mt-4 text-[17px] leading-relaxed text-foreground/80">
              {paragraph}
            </p>
          ))}

          {section.bullets?.length ? (
            <ul className="mt-5 space-y-2">
              {section.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="relative pl-6 text-[17px] leading-relaxed text-foreground/80 before:absolute before:left-1 before:top-[0.7em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-foreground/40"
                >
                  {bullet}
                </li>
              ))}
            </ul>
          ) : null}

          {section.steps?.length ? (
            <ol className="mt-6 space-y-4">
              {section.steps.map((step, index) => (
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
          ) : null}

          {section.example ? <BeforeAfterBlock example={section.example} /> : null}

          {section.callout ? (
            <p className="mt-6 rounded-xl border-l-4 border-foreground/80 bg-muted/50 p-5 text-[17px] leading-relaxed">
              {section.callout}
            </p>
          ) : null}
        </section>
      ))}
    </>
  );
}

export default ContentSections;
