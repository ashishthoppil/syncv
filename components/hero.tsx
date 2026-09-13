"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FREE_PLAN_SCAN_LIMIT } from "@/lib/subscription-plans";
import { BookDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import LogoCloud from "./logo-cloud";

const Hero = () => {
  return (
    <section className="min-h-[calc(100vh-6rem)] px-4 py-10">
      <div className="mx-auto grid max-w-screen-xl gap-10">
        <div className="flex flex-col items-center pt-10">
          <Badge className="rounded-full border-none bg-primary py-1">
            🚀 {FREE_PLAN_SCAN_LIMIT} free scans · No credit card
          </Badge>
          <h1 className="text-center mt-6 max-w-[20ch] text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Your resume should change for every job.
          </h1>
          <h1 className="text-center mt-3 max-w-[20ch] text-2xl font-normal leading-tight tracking-tight sm:text-2xl">
            Your experience shouldn&apos;t.
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
      <LogoCloud className="mx-auto mt-14 max-w-4xl" />
      <div className="mx-auto mt-8 max-w-6xl">
        <Image
          src="/before-after.png"
          alt="A generic resume side by side with the same resume tailored by SynCV for a Frontend Developer role, with relevant keywords and achievements highlighted."
          width={1536}
          height={1024}
          priority
          sizes="(max-width: 1152px) 100vw, 1152px"
          className="h-auto w-full rounded-xl border border-slate-200 shadow-sm"
        />
      </div>
    </section>
  );
};

export default Hero;
