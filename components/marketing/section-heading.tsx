import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Heading block for homepage sections: a small eyebrow label, the section's
 * <h2>, and an optional supporting line.
 *
 * One component so every section shares the same scale and rhythm — they had
 * drifted apart (sm: vs md: breakpoints, subtitles anywhere from text-lg to
 * text-2xl). The eyebrow is a plain <p>, so the document outline is unchanged.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <Reveal className={cn("mx-auto max-w-3xl text-center", className)}>
      {/*
        The accent is the dot, not the text: #FF6B35 is ~2.8:1 on white, too
        faint for 14px type, so the label itself stays in the secondary grey.
      */}
      <p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-ink-soft">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-brand" />
        {eyebrow}
      </p>
      <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-ink xs:text-4xl sm:text-5xl sm:leading-[1.1]">
        {title}
      </h2>
      {description ? (
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-lg leading-relaxed text-ink-soft">
          {description}
        </p>
      ) : null}
    </Reveal>
  );
}
