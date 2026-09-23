// Razorpay plan ids, one per paid plan × billing period. A Razorpay plan carries
// its own amount and period, so each id here must bill exactly the price listed
// against it in SUBSCRIPTION_PLANS below. Monthly keeps the ids — and, as a
// fallback, the env names — the site launched with, from when "Smart" was called
// "Speed". Next only inlines `process.env.NEXT_PUBLIC_*` into the client bundle
// when the name is spelled out literally, hence one line per id rather than a loop.
const firstSet = (...values) => values.find(Boolean) || null;

const PLAN_IDS = {
  smart: {
    weekly: firstSet(
      process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_SMART_WEEKLY,
      process.env.RAZORPAY_PLAN_ID_SMART_WEEKLY
    ),
    monthly: firstSet(
      process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_SMART_MONTHLY,
      process.env.RAZORPAY_PLAN_ID_SMART_MONTHLY,
      process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_SPEED,
      process.env.RAZORPAY_PLAN_ID_SPEED,
      "plan_TKzNKlddoZB4Ek"
    ),
    quarterly: firstSet(
      process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_SMART_QUARTERLY,
      process.env.RAZORPAY_PLAN_ID_SMART_QUARTERLY
    ),
    yearly: firstSet(
      process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_SMART_YEARLY,
      process.env.RAZORPAY_PLAN_ID_SMART_YEARLY
    ),
  },
  pro: {
    weekly: firstSet(
      process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_PRO_WEEKLY,
      process.env.RAZORPAY_PLAN_ID_PRO_WEEKLY
    ),
    monthly: firstSet(
      process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_PRO_MONTHLY,
      process.env.RAZORPAY_PLAN_ID_PRO_MONTHLY,
      process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_PRO,
      process.env.RAZORPAY_PLAN_ID_PRO,
      "plan_TKzMdbap4U8ADj"
    ),
    quarterly: firstSet(
      process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_PRO_QUARTERLY,
      process.env.RAZORPAY_PLAN_ID_PRO_QUARTERLY
    ),
    yearly: firstSet(
      process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_PRO_YEARLY,
      process.env.RAZORPAY_PLAN_ID_PRO_YEARLY
    ),
  },
};

const tooltipContent = {
  scans: "Each scan gives role-specific feedback to improve your resume quickly.",
  generation: "Generate targeted resume and cover letter drafts from each job description.",
};

/**
 * How often a paid plan is charged. Scan allowances refill weekly whatever the
 * billing period — the period only changes how often, and how much, you pay.
 *
 * `months` is the length of one cycle, used to compare against paying monthly;
 * weekly has none because it is never a saving. `totalCount` is the number of
 * cycles Razorpay bills before the subscription completes: a year for the
 * shorter periods, matching the 12 monthly cycles the site launched with, and
 * several years for yearly so it actually renews.
 */
export const BILLING_PERIODS = [
  { key: "weekly", label: "Weekly", unit: "week", months: null, totalCount: 52 },
  { key: "monthly", label: "Monthly", unit: "month", months: 1, totalCount: 12 },
  { key: "quarterly", label: "Quarterly", unit: "quarter", months: 3, totalCount: 4 },
  { key: "yearly", label: "Yearly", unit: "year", months: 12, totalCount: 5 },
];

export const DEFAULT_BILLING_PERIOD = "monthly";

export const BILLING_PERIOD_BY_KEY = Object.fromEntries(
  BILLING_PERIODS.map((period) => [period.key, period])
);

// The free plan is not a subscription: it is the lifetime trial allowance every
// signed-in user gets before they subscribe. It has no Razorpay plan id and must
// never reach checkout, so it is kept out of SUBSCRIPTION_PLANS (and therefore
// out of PLAN_BY_KEY / PLAN_BY_PLAN_ID, which server code uses to mean "the user
// has an active paid plan"). Use ALL_PLANS to display it alongside paid plans.
export const FREE_PLAN_KEY = "free";
export const FREE_PLAN_SCAN_LIMIT = 1;

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

export const SUBSCRIPTION_PLANS = [
  {
    key: "smart",
    name: "Smart",
    isFree: false,
    // Rupees per billing cycle, keyed by BILLING_PERIODS key.
    prices: { weekly: 249, monthly: 849, quarterly: 2289, yearly: 7999 },
    planIds: PLAN_IDS.smart,
    features: [
      { title: "12 resume scans every week", tooltip: tooltipContent.scans },
      { title: "Resume generation", tooltip: tooltipContent.generation },
      { title: "One click analysis and optimization" },
      { title: "Apply to remote jobs" },
      { title: "No job tracker" },
      { title: "No cover letter generation" },
    ],
    description: "Essential optimization tools for faster applications.",
    weeklyScanLimit: 12,
    allowsJobTracker: false,
    allowsCoverLetter: false,
  },
  {
    key: "pro",
    name: "Pro",
    isFree: false,
    prices: { weekly: 299, monthly: 999, quarterly: 2689, yearly: 9499 },
    planIds: PLAN_IDS.pro,
    features: [
      { title: "50 resume scans every week", tooltip: tooltipContent.scans },
      { title: "Instant resume generation", tooltip: tooltipContent.generation },
      { title: "Cover letter generation", tooltip: tooltipContent.generation },
      { title: "Job tracking" },
      { title: "One click analysis and optimization" },
      { title: "Apply to remote jobs" },
    ],
    description: "Full workflow with resume optimization and job tracking.",
    weeklyScanLimit: 50,
    allowsJobTracker: true,
    allowsCoverLetter: true,
  },
];

// Every plan we show on pricing / settings, free plan first.
export const ALL_PLANS = [FREE_PLAN, ...SUBSCRIPTION_PLANS];

/** Rupees per cycle of `periodKey`; 0 for the free plan, null if unpriced. */
export const getPlanPrice = (plan, periodKey) =>
  plan.isFree ? 0 : plan.prices?.[periodKey] ?? null;

/**
 * Whole percent saved against paying monthly for the same stretch, or 0.
 * Rounded down so a card never claims more of a saving than it gives.
 */
export const getPlanSavingsPercent = (plan, periodKey) => {
  const months = BILLING_PERIOD_BY_KEY[periodKey]?.months;
  const price = getPlanPrice(plan, periodKey);
  const monthly = getPlanPrice(plan, "monthly");
  if (plan.isFree || !months || months <= 1 || !price || !monthly) return 0;
  return Math.max(0, Math.floor((1 - price / (monthly * months)) * 100));
};

/**
 * The saving every paid plan gets on `periodKey` — the smallest one — so a
 * single "Save N%" on the billing tab is true whichever plan is picked.
 */
export const getPeriodSavingsPercent = (periodKey) =>
  Math.min(...SUBSCRIPTION_PLANS.map((plan) => getPlanSavingsPercent(plan, periodKey)));

export const formatInr = (amount) => `₹${Number(amount).toLocaleString("en-IN")}`;

// Stored rows (subscriptions.plan_key, profiles.plan) keep the key a plan had
// when it was bought. "Smart" was launched as "Speed", so "speed" still has to
// resolve to it.
const LEGACY_PLAN_KEYS = { speed: "smart" };

const planByCurrentKey = Object.fromEntries(SUBSCRIPTION_PLANS.map((plan) => [plan.key, plan]));

export const PLAN_BY_KEY = {
  ...planByCurrentKey,
  ...Object.fromEntries(
    Object.entries(LEGACY_PLAN_KEYS).map(([legacyKey, key]) => [legacyKey, planByCurrentKey[key]])
  ),
};

// Every configured Razorpay plan id → the plan and billing period it bills.
// Periods whose id is not configured are left out, so they can't be bought.
export const PLAN_SELECTION_BY_PLAN_ID = Object.fromEntries(
  SUBSCRIPTION_PLANS.flatMap((plan) =>
    BILLING_PERIODS.filter((period) => plan.planIds[period.key]).map((period) => [
      plan.planIds[period.key],
      { plan, billingPeriod: period.key },
    ])
  )
);

export const PLAN_BY_PLAN_ID = Object.fromEntries(
  Object.entries(PLAN_SELECTION_BY_PLAN_ID).map(([planId, selection]) => [planId, selection.plan])
);

/**
 * Which plan, and which billing period, a stored subscription is on. The plan
 * id is exact; a row whose id is no longer configured (say, a test-mode id)
 * still resolves its plan by key, but its period is then unknown (null).
 */
export const resolvePlanSelection = ({ planId = "", planKey = "" } = {}) => {
  if (planId && PLAN_SELECTION_BY_PLAN_ID[planId]) return PLAN_SELECTION_BY_PLAN_ID[planId];
  const plan = PLAN_BY_KEY[planKey];
  return plan ? { plan, billingPeriod: null } : null;
};

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "authenticated"]);

export const isActiveSubscriptionStatus = (status = "") =>
  ACTIVE_SUBSCRIPTION_STATUSES.has(String(status || "").toLowerCase());
