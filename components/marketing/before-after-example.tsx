import type { BeforeAfterExample } from "@/lib/content/examples";

/**
 * Renders a tailoring example as plain, crawlable text.
 *
 * The "what changed" note is not decoration — it is the part that makes the
 * example honest, by stating that the after version surfaces existing
 * experience rather than adding any. Every use of this component carries it.
 */
export function BeforeAfterBlock({ example }: { example: BeforeAfterExample }) {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-background">
      <figcaption className="border-b bg-muted/40 px-5 py-3 text-sm">
        <span className="font-semibold">{example.role}</span>
        <span className="text-muted-foreground"> — job description asks: </span>
        <span className="italic">“{example.jobAsk}”</span>
      </figcaption>

      <div className="grid gap-px bg-border sm:grid-cols-2">
        <div className="bg-background p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Before
          </p>
          <p className="mt-2 text-[15px] leading-relaxed">{example.before}</p>
        </div>
        <div className="bg-background p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            After tailoring
          </p>
          <p className="mt-2 text-[15px] font-medium leading-relaxed">{example.after}</p>
        </div>
      </div>

      <div className="border-t px-5 py-4">
        <p className="text-sm leading-relaxed text-foreground/80">
          <span className="font-semibold">Same experience, different emphasis: </span>
          {example.whatChanged}
        </p>
      </div>
    </figure>
  );
}

export default BeforeAfterBlock;
