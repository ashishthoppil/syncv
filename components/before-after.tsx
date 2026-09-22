import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { ArrowRight } from "lucide-react";
import Image from "next/image";

/**
 * Two portrait panels rather than one wide image.
 *
 * The before/after comparison used to be a single landscape PNG holding both
 * resumes. At any phone width it scaled down to the point where none of it
 * could be read. Split in two, each panel gets the full column on a phone and
 * they sit side by side from `lg` up, with the step between them called out.
 *
 * Both files carry their own "Before" / "After" headings and callouts, so the
 * markup deliberately adds no captions of its own — only alt text, since text
 * baked into an image reaches neither a screen reader nor a crawler.
 */
const PANEL =
  "overflow-hidden rounded-2xl border border-hairline bg-white p-2 shadow-lg shadow-neutral-900/5";

const BeforeAfter = () => {
  return (
    <div id="before-after" className="w-full px-6 py-16 sm:py-24">
      <SectionHeading
        eyebrow="The result"
        title="See the Difference: Before and After"
        description="Same experience. Different resume — here is what changes when you tailor for the role."
      />

      <div className="mx-auto mt-12 grid max-w-6xl items-center gap-6 sm:mt-16 lg:grid-cols-[1fr_auto_1fr] lg:gap-8">
        <Reveal className={PANEL}>
          <Image
            src="/before.png"
            alt="Before: a generic resume for Pooja Sharma. The summary and bullet points describe the same software engineering work for any job, and the skills are one undifferentiated line."
            width={1145}
            height={1374}
            sizes="(max-width: 1024px) 100vw, 540px"
            className="h-auto w-full rounded-xl"
          />
        </Reveal>

        <Reveal delay={100} className="flex justify-center">
          <div className="flex flex-col items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/30">
              {/* Points down the stack on phones, across the pair on desktop. */}
              <ArrowRight aria-hidden="true" className="h-6 w-6 rotate-90 lg:rotate-0" />
            </span>
            <span className="whitespace-nowrap rounded-full border border-hairline bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft shadow-sm">
              2 clicks
            </span>
          </div>
        </Reveal>

        <Reveal delay={200} className={PANEL}>
          <Image
            src="/after.png"
            alt="After: the same resume tailored for a Frontend Developer role. The summary leads with frontend work, the bullet points name React, Figma and measurable results, and the skills are broken out as tags."
            width={1145}
            height={1374}
            sizes="(max-width: 1024px) 100vw, 540px"
            className="h-auto w-full rounded-xl"
          />
        </Reveal>
      </div>
    </div>
  );
};

export default BeforeAfter;
