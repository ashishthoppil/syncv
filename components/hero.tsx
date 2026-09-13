import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FREE_PLAN_SCAN_LIMIT } from "@/lib/subscription-plans";
import { BookDown } from "lucide-react";
import Link from "next/link";

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
    <section className="px-4 pb-16 pt-10 sm:pb-24">
      <div className="mx-auto max-w-screen-xl">
        <div className="flex flex-col items-center gap-5 mt-10">
          <Badge className="rounded-full border-none bg-primary py-1">
            🚀 {FREE_PLAN_SCAN_LIMIT} free scans · No credit card
          </Badge>
          <h1 className="mt-6 max-w-[24ch] text-center text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Your resume should change for every job.
            <span className="mt-3 block text-2xl font-normal sm:text-2xl">
              Your experience shouldn&apos;t.
            </span>
          </h1>
          <p className="text-center mt-6 max-w-[70ch] text-base text-slate-700 sm:text-lg">
            Tailor your resume to any job description in 2 clicks, using the experience and skills you already have.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" className="w-full  md:w-auto  rounded-full text-base" asChild>
              <Link href="/sign-up">
                Try for free
                <BookDown className="h-5 w-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="w-full md:w-auto rounded-full text-base" asChild>
              <Link href="#pricing">View Plans</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
