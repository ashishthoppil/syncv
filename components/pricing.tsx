"use client";

import { SectionHeading } from "@/components/marketing/section-heading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Separator } from "@/components/ui/separator";
import { TapTooltip } from "@/components/ui/tooltip";
import { FREE_PLAN_SCAN_LIMIT } from "@/lib/subscription-plans";
import { cn } from "@/lib/utils";
import { CircleCheck, CircleHelp, CircleX } from "lucide-react";
import Link from "next/link";

// Features phrased as "No …" are the ones a plan does not include.
const isUnavailableFeature = (title: string) => title.startsWith("No ");

const tooltipContent = {
  scans: "Each scan gives role-specific feedback to improve your resume quickly.",
  generation: "Generate targeted resume and cover letter drafts from each job description.",
}; 

const plans = [
  {
    name: "Free",
    price: 0,
    description:
      "Try every feature with a handful of free scans. No card required.",
    features: [
      {
        title: `${FREE_PLAN_SCAN_LIMIT} resume scans in total`,
        tooltip: tooltipContent.scans,
      },
      { title: "Resume generation", tooltip: tooltipContent.generation },
      { title: "Cover letter generation", tooltip: tooltipContent.generation },
      { title: "No job tracking (Trial only)" },
      { title: "No weekly scan refill" },
      { title: "No access to remote jobs listing" },
    ],
    buttonText: "Start for free",
    href: "/sign-up",
  },
  {
    name: "Speed",
    price: 849,
    description:
      "Built for fast job applications with essential optimization tools.",
    features: [
      { title: "12 resume scans every week", tooltip: tooltipContent.scans },
      { title: "Resume generation", tooltip: tooltipContent.generation },
      { title: "One click analysis and optimization" },
      { title: "Apply to remote jobs" },
      { title: "No job tracker" },
      { title: "No cover letter generation" },
    ],
    buttonText: "Choose Speed Plan",
    href: "/sign-up?plan=speed",
  },
  {
    name: "Pro",
    price: 999,
    isRecommended: true,
    description:
      "Best value for serious applicants who need faster and fuller workflow support.",
    features: [
      { title: "50 resume scans every week", tooltip: tooltipContent.scans },
      { title: "Instant resume generation", tooltip: tooltipContent.generation },
      { title: "Cover letter generation", tooltip: tooltipContent.generation },
      { title: "Job tracking" },
      { title: "One click analysis and optimization" },
      { title: "Apply to remote jobs" },
    ],
    buttonText: "Choose Pro Plan",
    href: "/sign-up?plan=pro",
    isPopular: true,
  },
];

const Pricing = () => {
  return (
    <section id="pricing" className="w-full px-6 py-16 sm:py-24">
      <SectionHeading
        eyebrow="Pricing"
        title={
          <>
            Start Free. <span className="sm:block">Upgrade When You&apos;re Ready.</span>
          </>
        }
        description={`Every account starts with ${FREE_PLAN_SCAN_LIMIT} free scans and no card. Pick a plan when you're applying every week.`}
      />
      {/* <Tabs
        value={selectedBillingPeriod}
        onValueChange={setSelectedBillingPeriod}
        className="mt-8"
      >
        <TabsList className="h-11 px-1.5 rounded-full bg-primary/5">
          <TabsTrigger value="monthly" className="py-1.5 rounded-full">
            Monthly
          </TabsTrigger>
          <TabsTrigger value="yearly" className="py-1.5 rounded-full">
            Yearly (Save {YEARLY_DISCOUNT}%)
          </TabsTrigger>
        </TabsList>
      </Tabs> */}
      <div className="mx-auto mt-12 grid max-w-screen-xl grid-cols-1 items-center gap-8 sm:mt-16 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan, index) => (
          <Reveal
            key={plan.name}
            delay={index * 100}
            className={cn(
              "relative rounded-2xl border border-hairline bg-white p-6 shadow-sm sm:p-8",
              {
                "border-2 border-brand py-10 shadow-xl shadow-neutral-900/10 sm:py-10":
                  plan.isPopular,
              }
            )}
          >
            {plan.isPopular && (
              <Badge className="absolute right-1/2 top-0 -translate-y-1/2 translate-x-1/2 rounded-full bg-ink px-3 py-1 text-white shadow-sm hover:bg-ink">
                Most Popular
              </Badge>
            )}
            <h3 className="text-lg font-semibold text-ink">{plan.name}</h3>
            <p className="mt-3 text-5xl font-bold tracking-tight text-ink">
              {plan.price === 0 ? "Free" : `₹${plan.price}`}
              <span className="ml-1.5 text-sm font-normal tracking-normal text-ink-soft">
                {plan.price === 0 ? "to start" : "/month"}
              </span>
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              {plan.description}
            </p>

            <Button
              variant={plan.isPopular ? "default" : "outline"}
              size="lg"
              className="mt-6 h-11 w-full text-base"
              asChild
            >
              <Link href={plan.href}>{plan.buttonText}</Link>
            </Button>
            <Separator className="my-8" />
            <ul className="space-y-3 text-[15px]">
              {plan.features.map((feature) => {
                const unavailable = isUnavailableFeature(feature.title);
                return (
                  <li
                    key={feature.title}
                    className={cn("flex items-start gap-2", unavailable ? "text-neutral-400" : "text-ink")}
                  >
                    {unavailable ? (
                      <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-neutral-300" />
                    ) : (
                      <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
                    )}
                    {feature.title}
                    {feature.tooltip && (
                      <TapTooltip content={feature.tooltip} className="mt-0.5 cursor-help">
                        <CircleHelp className="h-4 w-4 text-neutral-400" />
                      </TapTooltip>
                    )}
                  </li>
                );
              })}
            </ul>
          </Reveal>
        ))}
      </div>
    </section>
  );
};

export default Pricing;
