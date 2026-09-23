"use client";

import {
  BILLING_PERIODS,
  BILLING_PERIOD_BY_KEY,
  DEFAULT_PRICING_REGION,
  PRICING_REGION_BY_KEY,
  formatPrice,
  getPlanMonthlyEquivalent,
  getPlanPrice,
  getPlanSavingsPercent,
} from "@/lib/subscription-plans";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/**
 * Plan billing UI shared by the homepage pricing table and the dashboard's
 * Settings → Plans, so the two can't quote a price, or a saving, differently.
 */

let regionRequest: Promise<string> | null = null;

/** One request per page load, however many price blocks ask. */
const fetchPricingRegion = () => {
  regionRequest ??= fetch("/api/pricing-region")
    .then((response) => (response.ok ? response.json() : null))
    .then((json) =>
      json && Object.hasOwn(PRICING_REGION_BY_KEY, json.region)
        ? (json.region as string)
        : DEFAULT_PRICING_REGION
    )
    .catch(() => {
      // Let a later mount try again rather than pinning the fallback.
      regionRequest = null;
      return DEFAULT_PRICING_REGION;
    });
  return regionRequest;
};

/**
 * Which currency to price in — rupees in India, US dollars elsewhere — as the
 * server sees the visitor, since checkout charges by the same rule. Starts on
 * the default region (so the server render has prices) with `resolved` false
 * until the server has answered; don't start a checkout before then.
 */
export function usePricingRegion() {
  const [state, setState] = useState({ region: DEFAULT_PRICING_REGION, resolved: false });

  useEffect(() => {
    let live = true;
    fetchPricingRegion().then((region) => {
      if (live) setState({ region, resolved: true });
    });
    return () => {
      live = false;
    };
  }, []);

  return state;
}

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
 * Weekly / Monthly / Quarterly switch above a plan grid.
 *
 * A radio group rather than ARIA tabs: it changes the prices in one grid, it
 * doesn't swap panels. Arrow keys move and select, as in a native radio group.
 * The dark pill slides under the selected option; the columns are equal width,
 * so its offset is just its index. Below `sm` the badges sit on the track's top
 * edge — at phone width there is no room beside the label — so give the group
 * some top margin there.
 */
export function BillingPeriodTabs({ value, onChange, className }: BillingPeriodTabsProps) {
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const count = BILLING_PERIODS.length;
  const selectedIndex = Math.max(
    0,
    BILLING_PERIODS.findIndex((period) => period.key === value)
  );

  const selectIndex = (index: number) => {
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
      selectIndex(count - 1);
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Billing period"
      onKeyDown={handleKeyDown}
      className={cn(
        "relative grid w-full max-w-md rounded-full border border-slate-200/80 bg-slate-100 p-1",
        className
      )}
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-1 left-1 rounded-full bg-slate-900 shadow-md shadow-slate-900/20 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{
          width: `calc((100% - 0.5rem) / ${count})`,
          transform: `translateX(${selectedIndex * 100}%)`,
        }}
      />
      {BILLING_PERIODS.map((period, index) => {
        const selected = index === selectedIndex;
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
            {period.badge ? (
              <span
                className={cn(
                  "absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 text-[10px] font-semibold leading-4 transition-colors sm:static sm:translate-x-0",
                  selected
                    ? "bg-brand text-white sm:bg-white/15"
                    : "bg-violet-50 text-brand ring-1 ring-inset ring-violet-200"
                )}
              >
                <span className="sr-only">, </span>
                {period.badge}
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
  prices: Record<string, Record<string, number>> | null;
};

/**
 * A plan's price for one billing period in the visitor's currency, plus the
 * line under it. Cycles longer than a month lead with what a month costs and
 * say what is actually billed ("₹1,299 /month — billed as ₹3,897 every 3
 * months"), with the saving against paying monthly. `lg` is the homepage
 * scale; `md` the dashboard's.
 */
export function PlanPrice({
  plan,
  billingPeriod,
  region,
  size = "md",
}: {
  plan: PricedPlan;
  billingPeriod: string;
  region: string;
  size?: "md" | "lg";
}) {
  const period = BILLING_PERIOD_BY_KEY[billingPeriod] || BILLING_PERIOD_BY_KEY.monthly;
  const price = getPlanPrice(plan, period.key, region) ?? 0;
  const perMonth = getPlanMonthlyEquivalent(plan, period.key, region);
  const savings = getPlanSavingsPercent(plan, period.key, region);
  const note = plan.isFree
    ? "Never billed"
    : perMonth !== null
      ? `Billed as ${formatPrice(price, region)} every ${period.months} months`
      : `Billed ${period.label.toLowerCase()}`;
  const isLarge = size === "lg";

  return (
    // Keyed on what is priced so the figures ease in afresh on every switch —
    // including the currency settling once the region is known. The free
    // plan's never change, so it stays put.
    <div
      key={plan.isFree ? "free" : `${region}-${period.key}`}
      className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300 motion-reduce:animate-none"
    >
      <p
        className={cn(
          "flex items-baseline gap-1.5 font-bold tracking-tight",
          isLarge ? "mt-3 text-5xl text-ink" : "mt-3 text-3xl text-slate-900"
        )}
      >
        {plan.isFree ? "Free" : formatPrice(perMonth ?? price, region)}
        <span
          className={cn(
            "font-normal tracking-normal",
            isLarge ? "text-sm text-ink-soft" : "text-xs font-medium text-slate-500"
          )}
        >
          {plan.isFree ? "to start" : `/${perMonth !== null ? "month" : period.unit}`}
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

/**
 * A plan's feature list that shows its first `visibleCount` items and tucks
 * the rest behind an arrow, so a long list (Pro's) doesn't make its card tower
 * over a short one (Free's). The hidden items slide open in place — a grid row
 * animating from 0fr to 1fr, which needs no measured height — and are `inert`
 * while closed, so keyboard and screen-reader users skip them as sighted users
 * do. With no `visibleCount`, or nothing to hide, it is a plain list.
 */
export function ExpandableList<T>({
  items,
  visibleCount,
  renderItem,
  listClassName,
  revealGapClassName,
  hiddenFooter,
  itemNoun = "features",
}: {
  items: T[];
  visibleCount?: number;
  renderItem: (item: T) => ReactNode;
  /** The list's own classes (spacing, type size), applied to both parts. */
  listClassName?: string;
  /** Top padding for the hidden part, matching the list's item spacing. */
  revealGapClassName?: string;
  /** Shown after the hidden items, inside the part the arrow reveals. */
  hiddenFooter?: ReactNode;
  itemNoun?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const restId = useId();
  const splitAt =
    visibleCount !== undefined && items.length > visibleCount ? visibleCount : items.length;
  const rest = items.slice(splitAt);

  return (
    <div>
      <ul className={listClassName}>{items.slice(0, splitAt).map(renderItem)}</ul>
      {rest.length ? (
        <>
          <div
            id={restId}
            inert={!expanded}
            className={cn(
              "grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none",
              expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <ul className={cn(listClassName, revealGapClassName)}>{rest.map(renderItem)}</ul>
              {hiddenFooter}
            </div>
          </div>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={restId}
            onClick={() => setExpanded((open) => !open)}
            className="mx-auto mt-5 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          >
            {expanded ? "Show less" : `${rest.length} more ${itemNoun}`}
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "h-4 w-4 transition-transform duration-300 motion-reduce:transition-none",
                expanded && "rotate-180"
              )}
            />
          </button>
        </>
      ) : (
        hiddenFooter
      )}
    </div>
  );
}
