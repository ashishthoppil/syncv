"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import LogoCloud from "./logo-cloud";
import { ScanSection } from "./dashboard/scan-section";

const Hero = () => {
  return (
    <section className="min-h-[calc(100vh-6rem)] px-4 py-10">
      <div className="mx-auto grid max-w-screen-xl gap-10 xl:grid-cols-[1fr,1.15fr]">
        <div className="pt-10">
          <Badge className="rounded-full border-none bg-primary py-1">
            Get a free scan - Try now!
          </Badge>
          <h1 className="mt-6 max-w-[18ch] text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Turn Your Resume Into an Interview-Winning Machine
          </h1>
          <p className="mt-6 max-w-[60ch] text-base text-slate-700 sm:text-lg">
            Build targeted resumes and cover letters quickly, apply faster, and win more
            interview calls.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" className="rounded-full text-base" asChild>
              <Link href="/sign-up">
                Start Free Now <ArrowUpRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="rounded-full text-base" asChild>
              <Link href="#pricing">View Plans</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-slate-500">
            You can run one guest scan and one guest optimization. To continue after that,
            registration is required.
          </p>
        </div>

        <div className="xl:pt-2">
          <ScanSection guestTrial hideTopHeading className="space-y-0" />
        </div>
      </div>
      <LogoCloud className="mx-auto mt-14 max-w-4xl" />
    </section>
  );
};

export default Hero;
