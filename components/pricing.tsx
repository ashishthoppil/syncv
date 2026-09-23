"use client";

import { SectionHeading } from "@/components/marketing/section-heading";
import {
  BillingPeriodTabs,
  ExpandableList,
  PlanPrice,
  usePricingRegion,
} from "@/components/plan-billing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Separator } from "@/components/ui/separator";
import { TapTooltip } from "@/components/ui/tooltip";
import {
  ALL_PLANS,
  BILLING_PERIOD_BY_KEY,
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

// How many of the paid plan's features show before its "more" arrow, so its
// card stands about as tall as Free's instead of towering over it.
const PAID_VISIBLE_FEATURES = 4;

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
  pro: {
    description:
      "Everything SynCV does, with unlimited scans.",
    buttonText: "Get Pro",
    isPopular: true,
  },
};

const plans = ALL_PLANS.map((plan) => ({ ...plan, ...MARKETING_COPY[plan.key] }));

const Pricing = () => {
  const [billingPeriod, setBillingPeriod] = useState<string>(DEFAULT_BILLING_PERIOD);
  const { region } = usePricingRegion();
  // The paid card wears the selected period's badge ("Most popular", "Best
  // value"); weekly has none.
  const periodBadge = BILLING_PERIOD_BY_KEY[billingPeriod]?.badge;

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
      <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 items-start gap-8 sm:mt-14 md:grid-cols-2">
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
            {plan.isPopular && periodBadge ? (
              <Badge className="absolute right-1/2 top-0 -translate-y-1/2 translate-x-1/2 rounded-full bg-ink px-3 py-1 text-white shadow-sm hover:bg-ink">
                {periodBadge}
              </Badge>
            ) : null}
            <h3 className="text-lg font-semibold text-ink">{plan.name}</h3>
            <PlanPrice plan={plan} billingPeriod={billingPeriod} region={region} size="lg" />
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
            <ExpandableList
              items={plan.features}
              visibleCount={plan.isFree ? undefined : PAID_VISIBLE_FEATURES}
              listClassName="space-y-3 text-[15px]"
              revealGapClassName="pt-3"
              hiddenFooter={
                "fairUse" in plan && plan.fairUse ? (
                  <p className="pt-5 text-xs leading-relaxed text-ink-soft">{plan.fairUse}</p>
                ) : null
              }
              renderItem={(feature) => {
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
              }}
            />
          </Reveal>
        ))}
      </div>
    </section>
  );
};

export default Pricing;
