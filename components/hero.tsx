import { Button } from "@/components/ui/button";
import { FREE_PLAN_SCAN_LIMIT } from "@/lib/subscription-plans";
import { ArrowRight, CircleCheck } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

const HERO_FEATURES = [
  "Job-Specific Resume Tailoring",
  "ATS & Job Match Analysis",
  "Automated Job Tracking",
  "Find Remote Jobs",
  "No Fabricated Experience",
];

/**
 * Entrance for the above-the-fold content: the same `reveal-up` motion the
 * sections below use, but as a plain CSS animation that starts on first paint
 * rather than a scroll-triggered <Reveal> that waits for hydration. The
 * headline (the likely LCP element) is never held invisible behind
 * JavaScript, and the delays stay short for the same reason.
 */
const ENTER = "animate-reveal-up motion-reduce:animate-none";
const after = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/**
 * Texture behind the hero: a hairline grid that fades out towards the edges,
 * and a single faint warm glow behind the headline. Mostly black and white on
 * purpose — the accent is a hint of warmth here, not a coloured background.
 * It reaches up behind the floating navbar and fades to white at the bottom,
 * so the section has no hard edge against the demo video below.
 */
const HeroBackdrop = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-x-0 -top-40 bottom-0 -z-10 overflow-hidden"
  >
    <div className="absolute inset-0 bg-[linear-gradient(to_right,theme(colors.hairline)_1px,transparent_1px),linear-gradient(to_bottom,theme(colors.hairline)_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-70 [mask-image:radial-gradient(ellipse_60%_55%_at_50%_35%,black,transparent)]" />
    <div className="absolute left-1/2 top-40 h-[26rem] w-[52rem] -translate-x-1/2 bg-[radial-gradient(closest-side,theme(colors.brand.light),transparent)] opacity-40" />
    <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-white" />
  </div>
);

/**
 * The page's single <h1>. The second line used to be a second <h1> and the
 * logo cloud below carried a third — the homepage shipped four in total, which
 * left crawlers no primary heading to weight.
 *
 * The tagline is now one <h1> with a <span> line break, so it reads and renders
 * identically while giving the document one top-level heading.
 */
const Hero = () => {
  // No min-height. This section used to be pinned to a full viewport
  // (`min-h-[calc(100vh-6rem)]`) because the logo cloud sat at the bottom of
  // it; with that gone, the min-height was just reserving a screen of blank
  // space above the next section. It now sizes to its content.
  return (
    <section className="relative isolate px-4 pb-6 pt-10 sm:pb-10">
      <HeroBackdrop />
      <div className="mx-auto max-w-screen-xl">
        <div className="mt-6 flex flex-col items-center sm:mt-10">
          <p
            className={`inline-flex items-center gap-2 rounded-full border border-hairline bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-ink-soft shadow-sm backdrop-blur sm:text-sm ${ENTER}`}
          >
            <span aria-hidden="true" className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
            </span>
            Scan for Free · No Credit Card
          </p>
          <h1
            className={`mt-7 text-balance text-center text-[2.5rem] font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl lg:text-7xl ${ENTER}`}
            style={after(80)}
          >
            Land your{" "}
            <span className="text-brand">next job.</span>
            <span className="block">Without the guesswork.</span>
          </h1>
          <p
            className={`mt-6 max-w-2xl text-pretty text-center text-lg leading-relaxed text-ink-soft sm:text-xl ${ENTER}`}
            style={after(160)}
          >
            Tailor your resume to every job in 2 clicks — using the experience and skills you already have.
          </p>
          {/*
            One column on phones, two on tablets, then a centred 3 + 2 row on
            desktop. The max width is what forces the 3 + 2 split: all five on
            one line runs far wider than the headline, and letting them wrap
            freely leaves a lone item on the second row at some widths.
          */}
          <ul className="mt-8 grid w-fit gap-x-8 gap-y-3 text-base text-ink sm:grid-cols-2 lg:flex lg:max-w-[52rem] lg:flex-wrap lg:justify-center lg:gap-x-6">
            {HERO_FEATURES.map((feature, index) => (
              <li
                key={feature}
                className={`flex items-center gap-2 ${ENTER}`}
                style={after(240 + index * 60)}
              >
                <CircleCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-brand" />
                {feature}
              </li>
            ))}
          </ul>
          <div
            className={`mt-10 flex w-full flex-col items-center gap-3 sm:w-auto ${ENTER}`}
            style={after(600)}
          >
            <Button
              size="lg"
              className="group h-12 w-full rounded-full px-8 text-base shadow-lg shadow-neutral-900/15 sm:w-auto"
              asChild
            >
              <Link href="/sign-up">
                Try for free
                <ArrowRight className="transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-brand" />
              </Link>
            </Button>
            {/* <Button variant="outline" size="lg" className="w-full md:w-auto rounded-full text-base" asChild>
              <Link href="#pricing">View Plans</Link>
            </Button> */}
            <p className="text-sm text-ink-soft">
              {FREE_PLAN_SCAN_LIMIT} free scans · PDF or Word resumes
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
