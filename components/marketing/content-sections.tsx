import BeforeAfterBlock from "@/components/marketing/before-after-example";
import type { ArticleSection } from "@/lib/content/articles";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Content strings may carry contextual links as `[anchor text](/path)`. Only
 * site-relative paths are linked, so a stray bracket pair in prose can never
 * turn into an outbound link. Everything else renders as plain text.
 */
const INLINE_LINK = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;

export function InlineText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_LINK)) {
    const [whole, label, href] = match;
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(
      <Link key={start} href={href} className="font-medium text-foreground underline underline-offset-4 hover:no-underline">
        {label}
      </Link>
    );
    last = start + whole.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

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
              <InlineText text={paragraph} />
            </p>
          ))}

          {section.bullets?.length ? (
            <ul className="mt-5 space-y-2">
              {section.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="relative pl-6 text-[17px] leading-relaxed text-foreground/80 before:absolute before:left-1 before:top-[0.7em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-foreground/40"
                >
                  <InlineText text={bullet} />
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
                      <InlineText text={step.detail} />
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}

          {section.table ? (
            // The table scrolls inside its own box on narrow screens so the
            // page itself never scrolls sideways.
            <div className="mt-6 overflow-x-auto rounded-xl border bg-background">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <caption className="px-4 pt-4 text-left text-sm text-muted-foreground">
                  {section.table.caption}
                </caption>
                <thead>
                  <tr className="border-b">
                    {section.table.columns.map((column) => (
                      <th key={column} scope="col" className="px-4 py-3 font-semibold">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.table.rows.map((row) => (
                    <tr key={row.join("|")} className="border-b last:border-b-0 align-top">
                      {row.map((cell, index) => (
                        <td key={index} className="px-4 py-3 leading-relaxed text-foreground/80">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {section.example ? <BeforeAfterBlock example={section.example} /> : null}

          {section.callout ? (
            <p className="mt-6 rounded-xl border-l-4 border-foreground/80 bg-muted/50 p-5 text-[17px] leading-relaxed">
              <InlineText text={section.callout} />
            </p>
          ) : null}
        </section>
      ))}
    </>
  );
}

export default ContentSections;
