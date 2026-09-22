import { ArrowUpRight, Forward } from "lucide-react";
import { Button } from "./ui/button";
import { AnimatedGridPattern } from "./ui/animated-grid-pattern";
import { Reveal } from "./ui/reveal";
import { cn } from "@/lib/utils";
import Link from "next/link";

/**
 * Closing call to action: a dark card between the light page and the dark
 * footer. The `dark` class switches the design tokens inside it (see the
 * `.dark` block in globals.css), so the buttons invert on their own.
 */
export default function CTABanner() {
  return (
    <div className="px-6">
      <Reveal className="dark relative isolate mx-auto mt-20 w-full max-w-screen-lg overflow-hidden rounded-3xl bg-background px-6 py-12 text-foreground shadow-2xl shadow-neutral-900/20 sm:mt-24 md:px-14 md:py-16">
        {/* One glow in the corner — the accent as light, not as a fill. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-32 -top-40 -z-10 h-[28rem] w-[28rem] bg-[radial-gradient(closest-side,theme(colors.brand.light),transparent)] opacity-45"
        />
        <AnimatedGridPattern
          numSquares={30}
          maxOpacity={0.1}
          duration={3}
          className={cn(
            "-z-10 fill-white/20 stroke-white/10",
            "[mask-image:radial-gradient(400px_circle_at_right,white,rgba(255,255,255,0.6),transparent)]",
            "inset-x-0 inset-y-[-30%] h-[200%] skew-y-12"
          )}
        />
        <div className="relative flex max-w-2xl flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-light">
            Get started
          </p>
          <h2 className="text-balance text-3xl font-bold tracking-tight md:text-5xl">
            Ready to Start Applying Faster?
          </h2>
          <p className="mt-2 text-base text-muted-foreground md:text-lg">
            Turn each job post into a polished, ready-to-send application in minutes.
          </p>
        </div>
        <div className="relative mt-10 flex flex-col gap-4 sm:flex-row">
          <Button size="lg" className="group h-12 px-7 text-base" asChild>
            <Link href="/sign-up">
              Get Started{" "}
              <ArrowUpRight className="!h-5 !w-5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" className="h-12 px-7 text-base" asChild>
            <Link href="#features">
              Learn More <Forward className="!h-5 !w-5" />
            </Link>
          </Button>
        </div>
      </Reveal>
    </div>
  );
}
