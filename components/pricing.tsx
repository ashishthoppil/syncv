"use client";

import { SectionHeading } from "@/components/marketing/section-heading";
import { BillingPeriodTabs, PlanPrice } from "@/components/plan-billing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Separator } from "@/components/ui/separator";
import { TapTooltip } from "@/components/ui/tooltip";
import {
  ALL_PLANS,
  DEFAULT_BILLING_PERIOD,
  FREE_PLAN_SCAN_LIMIT,
  formatScanCount,
} from "@/lib/subscription-plans";
import { cn } from "@/lib/utils";
import { CircleCheck, CircleHelp, CircleX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

// Features phrased as "No …" are the ones a plan does not include.
const isUnavailableFeature = (title: string) => title.startsWith("No ");

// Prices and features come from lib/subscription-plans.js, the same config that
// drives checkout; only the homepage's own framing lives here.
const MARKETING_COPY: Record<
  string,
  { description: string; buttonText: string; isPopular?: boolean }
> = {
  free: {
    description: `Try every feature with ${formatScanCount(FREE_PLAN_SCAN_LIMIT, "free")}. No card required.`,
    buttonText: "Start for free",
  },
  smart: {
    description: "Built for fast job applications with essential optimization tools.",
    buttonText: "Choose Smart Plan",
  },
  pro: {
    description:
      "Best value for serious applicants who need faster and fuller workflow support.",
    buttonText: "Choose Pro Plan",
    isPopular: true,
  },
};

const plans = ALL_PLANS.map((plan) => ({ ...plan, ...MARKETING_COPY[plan.key] }));

const Pricing = () => {
  const [billingPeriod, setBillingPeriod] = useState<string>(DEFAULT_BILLING_PERIOD);

  return (
    <section id="pricing" className="w-full px-6 py-16 sm:py-24">
      <SectionHeading
        eyebrow="Pricing"
        title={
          <>
            Start Free. <span className="sm:block">Upgrade When You&apos;re Ready.</span>
          </>
        }
        description={`Every account starts with ${formatScanCount(FREE_PLAN_SCAN_LIMIT, "free")} and no card. Pick a plan when you're applying every week.`}
      />
      <Reveal className="mt-12 flex justify-center sm:mt-10">
        <BillingPeriodTabs value={billingPeriod} onChange={setBillingPeriod} />
      </Reveal>
      <div className="mx-auto mt-12 grid max-w-screen-xl grid-cols-1 items-center gap-8 sm:mt-14 md:grid-cols-2 lg:grid-cols-3">
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
            <PlanPrice plan={plan} billingPeriod={billingPeriod} size="lg" />
            <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
              {plan.description}
            </p>

            <Button
              variant={plan.isPopular ? "default" : "outline"}
              size="lg"
              className="mt-6 h-11 w-full text-base"
              asChild
            >
              <Link
                href={
                  plan.isFree
                    ? "/sign-up"
                    : `/sign-up?plan=${plan.key}&billing=${billingPeriod}`
                }
              >
                {plan.buttonText}
              </Link>
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
