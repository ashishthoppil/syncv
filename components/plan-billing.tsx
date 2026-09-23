"use client";

import {
  BILLING_PERIODS,
  BILLING_PERIOD_BY_KEY,
  formatInr,
  getPeriodSavingsPercent,
  getPlanPrice,
  getPlanSavingsPercent,
} from "@/lib/subscription-plans";
import { cn } from "@/lib/utils";
import { useRef, type KeyboardEvent } from "react";

/**
 * Plan billing UI shared by the homepage pricing table and the dashboard's
 * Settings → Plans, so the two can't quote a price, or a saving, differently.
 */

type BillingPeriodTabsProps = {
  value: string;
  onChange: (period: string) => void;
  className?: string;
};

const ARROW_STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
};

/**
 * Weekly / Monthly / Quarterly / Yearly switch above a plan grid.
 *
 * A radio group rather than ARIA tabs: it changes the prices in one grid, it
 * doesn't swap panels. Arrow keys move and select, as in a native radio group.
 * The dark pill slides under the selected option; the four columns are equal
 * width, so its offset is just its index. Below `sm` the saving chips sit on
 * the track's top edge — at phone width there is no room beside the label —
 * so give the group some top margin there.
 */
export function BillingPeriodTabs({ value, onChange, className }: BillingPeriodTabsProps) {
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = Math.max(
    0,
    BILLING_PERIODS.findIndex((period) => period.key === value)
  );

  const selectIndex = (index: number) => {
    const count = BILLING_PERIODS.length;
    const next = (index + count) % count;
    onChange(BILLING_PERIODS[next].key);
    optionRefs.current[next]?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key in ARROW_STEPS) {
      event.preventDefault();
      selectIndex(selectedIndex + ARROW_STEPS[event.key]);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      selectIndex(BILLING_PERIODS.length - 1);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Billing period"
      onKeyDown={handleKeyDown}
      className={cn(
        "relative grid w-full max-w-lg grid-cols-4 rounded-full border border-slate-200/80 bg-slate-100 p-1",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-full bg-slate-900 shadow-md shadow-slate-900/20 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ transform: `translateX(${selectedIndex * 100}%)` }}
      />
      {BILLING_PERIODS.map((period, index) => {
        const selected = index === selectedIndex;
        const savings = getPeriodSavingsPercent(period.key);
        return (
          <button
            key={period.key}
            ref={(node) => {
              optionRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(period.key)}
            className={cn(
              "relative z-10 flex h-9 items-center justify-center gap-1.5 rounded-full px-1 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 sm:h-10 sm:px-2 sm:text-sm",
              selected ? "text-white" : "text-slate-600 hover:text-slate-900"
            )}
          >
            {period.label}
            {savings > 0 ? (
              <span
                className={cn(
                  "absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 text-[10px] font-semibold leading-4 transition-colors sm:static sm:translate-x-0",
                  selected
                    ? "bg-brand text-white sm:bg-white/15"
                    : "bg-violet-50 text-brand ring-1 ring-inset ring-violet-200"
                )}
              >
                <span aria-hidden="true">−{savings}%</span>
                <span className="sr-only">, save {savings}%</span>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

type PricedPlan = {
  isFree: boolean;
  prices: Record<string, number> | null;
};

/**
 * A plan's price for one billing period, plus the line under it: the monthly
 * equivalent and saving for the longer periods, or how often it is billed.
 * `lg` is the homepage scale; `md` the dashboard's.
 */
export function PlanPrice({
  plan,
  billingPeriod,
  size = "md",
}: {
  plan: PricedPlan;
  billingPeriod: string;
  size?: "md" | "lg";
}) {
  const period = BILLING_PERIOD_BY_KEY[billingPeriod] || BILLING_PERIOD_BY_KEY.monthly;
  const price = getPlanPrice(plan, period.key) ?? 0;
  const savings = getPlanSavingsPercent(plan, period.key);
  const cadence = period.label.toLowerCase();
  const note = plan.isFree
    ? "Never billed"
    : period.months && period.months > 1
      ? `${formatInr(Math.round(price / period.months))}/mo, billed ${cadence}`
      : `Billed ${cadence}`;
  const isLarge = size === "lg";

  return (
    // Keyed on the period so the figures ease in afresh on every switch. The
    // free plan's never change, so it stays put.
    <div
      key={plan.isFree ? "free" : period.key}
      className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300 motion-reduce:animate-none"
    >
      <p
        className={cn(
          "flex items-baseline gap-1.5 font-bold tracking-tight",
          isLarge ? "mt-3 text-5xl text-ink" : "mt-3 text-3xl text-slate-900"
        )}
      >
        {plan.isFree ? "Free" : formatInr(price)}
        <span
          className={cn(
            "font-normal tracking-normal",
            isLarge ? "text-sm text-ink-soft" : "text-xs font-medium text-slate-500"
          )}
        >
          {plan.isFree ? "to start" : `/${period.unit}`}
        </span>
      </p>
      <p
        className={cn(
          "mt-2 flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1",
          isLarge ? "text-sm text-ink-soft" : "text-xs text-slate-500"
        )}
      >
        <span>{note}</span>
        {savings > 0 ? (
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-semibold text-brand ring-1 ring-inset ring-violet-200">
            Save {savings}%
          </span>
        ) : null}
      </p>
    </div>
  );
}
