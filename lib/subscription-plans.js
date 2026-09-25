// One paid plan, billed weekly, monthly or quarterly, priced in rupees in India
// and in US dollars everywhere else. Each region × period is its own Dodo
// Payments subscription product, because a product fixes its price, currency
// and billing interval — so every id below must bill exactly the amount listed
// against it in PRO_PLAN.prices. ("Plan id" throughout means that product id:
// it is what subscriptions.plan_id stores.)
// Next only inlines `process.env.NEXT_PUBLIC_*` into the client bundle when the
// name is spelled out literally, hence one line per id rather than a loop.
const firstSet = (...values) => values.find(Boolean) || null;

const PLAN_IDS = {
  in: {
    weekly: firstSet(
      process.env.NEXT_PUBLIC_DODO_PRODUCT_ID_IN_WEEKLY,
      process.env.DODO_PRODUCT_ID_IN_WEEKLY
    ),
    monthly: firstSet(
      process.env.NEXT_PUBLIC_DODO_PRODUCT_ID_IN_MONTHLY,
      process.env.DODO_PRODUCT_ID_IN_MONTHLY
    ),
    quarterly: firstSet(
      process.env.NEXT_PUBLIC_DODO_PRODUCT_ID_IN_QUARTERLY,
      process.env.DODO_PRODUCT_ID_IN_QUARTERLY
    ),
  },
  intl: {
    weekly: firstSet(
      process.env.NEXT_PUBLIC_DODO_PRODUCT_ID_INTL_WEEKLY,
      process.env.DODO_PRODUCT_ID_INTL_WEEKLY
    ),
    monthly: firstSet(
      process.env.NEXT_PUBLIC_DODO_PRODUCT_ID_INTL_MONTHLY,
      process.env.DODO_PRODUCT_ID_INTL_MONTHLY
    ),
    quarterly: firstSet(
      process.env.NEXT_PUBLIC_DODO_PRODUCT_ID_INTL_QUARTERLY,
      process.env.DODO_PRODUCT_ID_INTL_QUARTERLY
    ),
  },
};

// Razorpay plans people subscribed to before the move to Dodo, and before there
// was a single plan: the monthly Speed (later "Smart") and Pro plans. They can
// no longer be bought, but subscriptions on them keep renewing in Razorpay and
// their rows must still resolve — to the one plan, with everything included.
const LEGACY_MONTHLY_PLAN_IDS = ["plan_TKzNKlddoZB4Ek", "plan_TKzMdbap4U8ADj"];

const tooltipContent = {
  scans: "Each scan gives role-specific feedback to improve your resume quickly.",
  generation: "Generate targeted resume and cover letter drafts from each job description.",
};

/**
 * Where a visitor is billed from decides the currency. Only India is priced in
 * rupees; every other country pays in US dollars. The server works the region
 * out from the request's country (lib/server/pricing-region.js), and checkout
 * charges that region's plan, so the page asks the server rather than guessing.
 */
export const PRICING_REGIONS = [
  { key: "in", label: "India", currency: "INR", locale: "en-IN", fractionDigits: 0 },
  { key: "intl", label: "International", currency: "USD", locale: "en-US", fractionDigits: 2 },
];

export const DEFAULT_PRICING_REGION = "in";

export const PRICING_REGION_BY_KEY = Object.fromEntries(
  PRICING_REGIONS.map((region) => [region.key, region])
);

/** ISO 3166-1 alpha-2 country code → pricing region; unknown → the default. */
export const pricingRegionForCountry = (country) => {
  const code = String(country || "").trim().toUpperCase();
  if (!code) return DEFAULT_PRICING_REGION;
  return code === "IN" ? "in" : "intl";
};

/**
 * How often the plan is charged. Every period includes everything — the
 * period only changes how often, and how much, you pay.
 *
 * `months` is the length of one cycle: longer cycles are shown as a monthly
 * price "billed as" the cycle total, and compared against paying monthly.
 * `badge` is the short label the billing switch and plan card carry.
 */
export const BILLING_PERIODS = [
  { key: "weekly", label: "Weekly", unit: "week", months: null, badge: null },
  {
    key: "monthly",
    label: "Monthly",
    unit: "month",
    months: 1,
    badge: "Most popular",
  },
  {
    key: "quarterly",
    label: "Quarterly",
    unit: "quarter",
    months: 3,
    badge: "Best value",
  },
];

export const DEFAULT_BILLING_PERIOD = "monthly";

export const BILLING_PERIOD_BY_KEY = Object.fromEntries(
  BILLING_PERIODS.map((period) => [period.key, period])
);

// The free plan is not a subscription: it is the lifetime trial allowance every
// signed-in user gets before they subscribe. It has no Dodo product id and must
// never reach checkout, so it is kept out of SUBSCRIPTION_PLANS (and therefore
// out of PLAN_BY_KEY / PLAN_BY_PLAN_ID, which server code uses to mean "the user
// has an active paid plan"). Use ALL_PLANS to display it alongside paid plans.
export const FREE_PLAN_KEY = "free";
export const FREE_PLAN_SCAN_LIMIT = 1;
// Optimizing is the expensive step, and the free plan includes it, so each free
// scan comes with a few optimizations: enough to retry with different keyword
// picks, not an open tap. Enforced in app/api/tailor-documents.
export const FREE_PLAN_OPTIMIZATIONS_PER_SCAN = 3;

/**
 * "1 free scan", "3 free scans". Copy that quotes the free allowance goes
 * through this so it stays grammatical whatever FREE_PLAN_SCAN_LIMIT is set to.
 */
export const formatScanCount = (count, qualifier = "") =>
  `${count} ${qualifier ? `${qualifier} ` : ""}scan${count === 1 ? "" : "s"}`;

export const FREE_PLAN = {
  key: FREE_PLAN_KEY,
  name: "Free",
  isFree: true,
  prices: null,
  planIds: null,
  features: [
    {
      title: `${formatScanCount(FREE_PLAN_SCAN_LIMIT, "resume")} in total`,
      tooltip: tooltipContent.scans,
    },
    { title: "Resume generation", tooltip: tooltipContent.generation },
    { title: "Cover letter generation", tooltip: tooltipContent.generation },
    { title: "No job tracking (Trial only)" },
    { title: "No weekly scan refill" },
    { title: "No access to remote jobs listing" },
  ],
  description: `Try everything with ${formatScanCount(FREE_PLAN_SCAN_LIMIT, "free")}. No card needed.`,
  // Free-trial scans are a lifetime allowance, not a weekly one.
  weeklyScanLimit: 0,
  allowsJobTracker: true,
  allowsCoverLetter: true,
};

// Pro has no scan or optimization quota, only fair-use limits that stop a
// script from running up the model bill. Paid plan only — the free plan has its
// own allowance above. Scans are enforced in app/api/analyze; optimizations
// (the cover letter comes with one) in app/api/tailor-documents, via
// lib/server/optimization-allowance.js. All quoted on the Pro card.
//
// "A day" is a UTC calendar day (midnight UTC, 5:30 AM IST), the same boundary
// the old weekly scan cap used.
export const FAIR_USE_SCANS_PER_HOUR = 30;
export const FAIR_USE_SCANS_PER_DAY = 200;
// After this many optimizations within an hour, a break starts from the last
// of them and lasts FAIR_USE_OPTIMIZATION_BREAK_MINUTES.
export const FAIR_USE_OPTIMIZATIONS_PER_HOUR = 10;
export const FAIR_USE_OPTIMIZATION_BREAK_MINUTES = 60;
export const FAIR_USE_OPTIMIZATIONS_PER_DAY = 50;

/** The one paid plan. Subscribing, on any billing period, unlocks everything. */
export const PRO_PLAN = {
  key: "pro",
  name: "Pro",
  isFree: false,
  // Amount billed per cycle, in the region's currency.
  prices: {
    in: { weekly: 499, monthly: 1499, quarterly: 3897 },
    intl: { weekly: 12.99, monthly: 26.99, quarterly: 63.99 },
  },
  planIds: PLAN_IDS,
  // Wording is the user's own, verbatim — including "AI", which the rest of
  // the site's positioning avoids. Don't reword it.
  // The "Unlimited" lines carry their fair-use limit in their tooltip, next to
  // the claim, since the full fairUse note sits behind the card's "more" arrow.
  features: [
    {
      title: "Unlimited Resume Scans",
      tooltip: `Scan against as many jobs as you like, within fair use: up to ${FAIR_USE_SCANS_PER_DAY} scans a day, ${FAIR_USE_SCANS_PER_HOUR} scans per hour.`,
    },
    {
      title: "Unlimited Resume Optimizations",
      tooltip: `Tailor as many resumes as you like, within fair use: up to ${FAIR_USE_OPTIMIZATIONS_PER_DAY} a day, and after ${FAIR_USE_OPTIMIZATIONS_PER_HOUR} in an hour, optimizing pauses for an hour.`,
    },
    {
      title: "Unlimited Cover Letters",
      tooltip: "A cover letter comes with each optimization, so the same fair-use limits apply.",
    },
    { title: "Unlimited Resume/Cover Letter Downloads" },
    { title: "Full Remote Jobs Board" },
    { title: "One Click Analysis & Optimization" },
    { title: "Tailored Resume for Every Job" },
    { title: "Create Resume from Scratch" },
    { title: "Keyword Gap Analysis and Matching" },
    { title: "ATS-friendly Resume Templates" },
    { title: "Automated Job Tracker" },
  ],
  // Shown under the list: the limits behind the "Unlimited" lines.
  // Every number names its action: the hourly limits differ (optimizations
  // pause after a burst, scans are only capped), and a bare "10 an hour" next
  // to "30 an hour" reads as a contradiction.
  fairUse: `Fair use: up to ${FAIR_USE_OPTIMIZATIONS_PER_DAY} optimizations a day. After ${FAIR_USE_OPTIMIZATIONS_PER_HOUR} optimizations in an hour, optimizing pauses for an hour. Up to ${FAIR_USE_SCANS_PER_DAY} scans a day, ${FAIR_USE_SCANS_PER_HOUR} scans per hour.`,
  description: "Every feature, with unlimited scans.",
  // null: no weekly cap (see FAIR_USE_SCANS_PER_HOUR). A number caps scans per
  // week, which app/api/analyze still enforces for any plan that sets one.
  weeklyScanLimit: null,
  allowsJobTracker: true,
  allowsCoverLetter: true,
};

export const SUBSCRIPTION_PLANS = [PRO_PLAN];

// Every plan we show on pricing / settings, free plan first.
export const ALL_PLANS = [FREE_PLAN, ...SUBSCRIPTION_PLANS];

/** Amount billed per cycle of `periodKey` in `regionKey`'s currency; 0 for free. */
export const getPlanPrice = (plan, periodKey, regionKey = DEFAULT_PRICING_REGION) =>
  plan.isFree ? 0 : plan.prices?.[regionKey]?.[periodKey] ?? null;

/**
 * What one month costs on `periodKey`, for cycles longer than a month (the
 * "₹1,299 / month, billed as ₹3,897" line); null otherwise. Rounded to the
 * currency's smallest shown unit.
 */
export const getPlanMonthlyEquivalent = (plan, periodKey, regionKey = DEFAULT_PRICING_REGION) => {
  const months = BILLING_PERIOD_BY_KEY[periodKey]?.months;
  const price = getPlanPrice(plan, periodKey, regionKey);
  if (plan.isFree || !months || months <= 1 || !price) return null;
  const scale = 10 ** (PRICING_REGION_BY_KEY[regionKey]?.fractionDigits ?? 0);
  return Math.round((price / months) * scale) / scale;
};

/**
 * Whole percent saved against paying monthly for the same stretch, or 0.
 * Rounded down so a card never claims more of a saving than it gives.
 */
export const getPlanSavingsPercent = (plan, periodKey, regionKey = DEFAULT_PRICING_REGION) => {
  const months = BILLING_PERIOD_BY_KEY[periodKey]?.months;
  const price = getPlanPrice(plan, periodKey, regionKey);
  const monthly = getPlanPrice(plan, "monthly", regionKey);
  if (plan.isFree || !months || months <= 1 || !price || !monthly) return 0;
  return Math.max(0, Math.floor((1 - price / (monthly * months)) * 100));
};

/** "₹1,499", "$26.99" — whole rupees, dollars to the cent. */
export const formatPrice = (amount, regionKey = DEFAULT_PRICING_REGION) => {
  const region = PRICING_REGION_BY_KEY[regionKey] || PRICING_REGION_BY_KEY[DEFAULT_PRICING_REGION];
  return new Intl.NumberFormat(region.locale, {
    style: "currency",
    currency: region.currency,
    minimumFractionDigits: region.fractionDigits,
    maximumFractionDigits: region.fractionDigits,
  }).format(Number(amount));
};

// Stored rows (subscriptions.plan_key, profiles.plan) keep the key a plan had
// when it was bought: "speed" (later "smart") and "pro" were the two paid plans
// before there was one. Every one of them now means the single plan.
const LEGACY_PLAN_KEYS = { speed: PRO_PLAN.key, smart: PRO_PLAN.key };

const planByCurrentKey = Object.fromEntries(SUBSCRIPTION_PLANS.map((plan) => [plan.key, plan]));

export const PLAN_BY_KEY = {
  ...planByCurrentKey,
  ...Object.fromEntries(
    Object.entries(LEGACY_PLAN_KEYS).map(([legacyKey, key]) => [legacyKey, planByCurrentKey[key]])
  ),
};

// Every plan id we recognise — Dodo product ids, and the legacy Razorpay plan
// ids — → the plan, billing period and region it bills. Current ids that are
// not configured are left out, so they can't be bought; legacy ids are
// recognised but never offered at checkout.
export const PLAN_SELECTION_BY_PLAN_ID = {
  ...Object.fromEntries(
    LEGACY_MONTHLY_PLAN_IDS.map((planId) => [
      planId,
      { plan: PRO_PLAN, billingPeriod: "monthly", region: "in", legacy: true },
    ])
  ),
  ...Object.fromEntries(
    SUBSCRIPTION_PLANS.flatMap((plan) =>
      PRICING_REGIONS.flatMap((region) =>
        BILLING_PERIODS.filter((period) => plan.planIds[region.key]?.[period.key]).map(
          (period) => [
            plan.planIds[region.key][period.key],
            { plan, billingPeriod: period.key, region: region.key, legacy: false },
          ]
        )
      )
    )
  ),
};

export const PLAN_BY_PLAN_ID = Object.fromEntries(
  Object.entries(PLAN_SELECTION_BY_PLAN_ID).map(([planId, selection]) => [planId, selection.plan])
);

/**
 * Which plan, billing period and region a stored subscription is on. The plan
 * id is exact; a row whose id is no longer configured (say, a test-mode id)
 * still resolves its plan by key, but its period and region are then unknown.
 */
export const resolvePlanSelection = ({ planId = "", planKey = "" } = {}) => {
  if (planId && Object.hasOwn(PLAN_SELECTION_BY_PLAN_ID, planId)) {
    return PLAN_SELECTION_BY_PLAN_ID[planId];
  }
  const plan = Object.hasOwn(PLAN_BY_KEY, planKey) ? PLAN_BY_KEY[planKey] : null;
  return plan ? { plan, billingPeriod: null, region: null, legacy: false } : null;
};

/**
 * The usage badge, from /api/subscription's data: today's optimizations for
 * the paid plan (its scans are unlimited), the week's balance for a capped
 * plan, the trial balance for everyone else. `short` is the phone-width form.
 * The dashboard header shows the paid state live, with its break timer
 * (components/dashboard/optimization-meter.tsx); this is the static form.
 */
export const describeScanBalance = (data = {}) => {
  if (data.hasActivePlan && data.optimizationUsage) {
    const { usedToday, dailyLimit } = data.optimizationUsage;
    return {
      label: `${usedToday}/${dailyLimit} optimizations today`,
      short: `${usedToday}/${dailyLimit}`,
    };
  }
  if (data.hasActivePlan && data.unlimitedScans) {
    return { label: "Unlimited scans", short: "Unlimited" };
  }
  const remaining = Number(
    (data.hasActivePlan ? data.scansRemainingThisWeek : data.freeTrialRemaining) || 0
  );
  const noun = `${data.hasActivePlan ? "" : "free "}scan${remaining === 1 ? "" : "s"}`;
  return { label: `${remaining} ${noun} left`, short: `${remaining} left` };
};

// Statuses that carry the paid plan. "active" is shared by Dodo and Razorpay;
// "authenticated" is Razorpay's, kept for legacy rows. "past_due" is Dodo's
// grace period after a failed renewal while it retries the charge: the plan
// stays on until Dodo gives up and moves the subscription to on_hold.
export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "authenticated", "past_due"]);

export const isActiveSubscriptionStatus = (status = "") =>
  ACTIVE_SUBSCRIPTION_STATUSES.has(String(status || "").toLowerCase());
