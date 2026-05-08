"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookDown } from "lucide-react";
import Link from "next/link";
import LogoCloud from "./logo-cloud";

const Hero = () => {
  return (
    <section className="min-h-[calc(100vh-6rem)] px-4 py-10">
      <div className="mx-auto grid max-w-screen-xl gap-10">
        <div className="flex flex-col items-center pt-10">
          <Badge className="rounded-full border-none bg-primary py-1">
            🚀 Get a free scan - Try now!
          </Badge>
          <h1 className="text-center mt-6 max-w-[20ch] text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            Turn Your Resume Into an Interview-Winning Machine
          </h1>
          <p className="text-center mt-6 max-w-[70ch] text-base text-slate-700 sm:text-lg">
            Build targeted resumes and cover letters quickly, apply faster, and win more
            interview calls.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" className="w-full  md:w-auto  rounded-full text-base" asChild>
              <Link href="#guest-scan">
                Try 1 Free Scan 
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
    </section>
  );
};

export default Hero;
