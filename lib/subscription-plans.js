const SPEED_PLAN_ID =
  process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_SPEED || process.env.RAZORPAY_PLAN_ID_SPEED;
const PRO_PLAN_ID =
  process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_PRO || process.env.RAZORPAY_PLAN_ID_PRO;

const tooltipContent = {
  scans: "Each scan gives role-specific feedback to improve your resume quickly.",
  generation: "Generate targeted resume and cover letter drafts from each job description.",
};

// The free plan is not a subscription: it is the lifetime trial allowance every
// signed-in user gets before they subscribe. It has no Razorpay plan id and must
// never reach checkout, so it is kept out of SUBSCRIPTION_PLANS (and therefore
// out of PLAN_BY_KEY / PLAN_BY_PLAN_ID, which server code uses to mean "the user
// has an active paid plan"). Use ALL_PLANS to display it alongside paid plans.
export const FREE_PLAN_KEY = "free";
export const FREE_PLAN_SCAN_LIMIT = 3;

export const FREE_PLAN = {
  key: FREE_PLAN_KEY,
  name: "Free",
  priceInr: 0,
  isFree: true,
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
  planId: null,
  description: `Try everything with ${FREE_PLAN_SCAN_LIMIT} free scans. No card needed.`,
  // Free-trial scans are a lifetime allowance, not a weekly one.
  weeklyScanLimit: 0,
  allowsJobTracker: true,
  allowsCoverLetter: true,
};

export const SUBSCRIPTION_PLANS = [
  {
    key: "speed",
    name: "Speed",
    priceInr: 849,
    isFree: false,
    features: [
      { title: "12 resume scans every week", tooltip: tooltipContent.scans },
      { title: "Resume generation", tooltip: tooltipContent.generation },
      { title: "One click analysis and optimization" },
      { title: "Apply to remote jobs" },
      { title: "No job tracker" },
      { title: "No cover letter generation" },
    ],
    planId: SPEED_PLAN_ID || "plan_TKzNKlddoZB4Ek",
    description: "Essential optimization tools for faster applications.",
    weeklyScanLimit: 12,
    allowsJobTracker: false,
    allowsCoverLetter: false,
  },
  {
    key: "pro",
    name: "Pro",
    priceInr: 999,
    isFree: false,
    features: [
      { title: "50 resume scans every week", tooltip: tooltipContent.scans },
      { title: "Instant resume generation", tooltip: tooltipContent.generation },
      { title: "Cover letter generation", tooltip: tooltipContent.generation },
      { title: "Job tracking" },
      { title: "One click analysis and optimization" },
      { title: "Apply to remote jobs" },
    ],
    planId: PRO_PLAN_ID || "plan_TKzMdbap4U8ADj",
    description: "Full workflow with resume optimization and job tracking.",
    weeklyScanLimit: 50,
    allowsJobTracker: true,
    allowsCoverLetter: true,
  },
];

// Every plan we show on pricing / settings, free plan first.
export const ALL_PLANS = [FREE_PLAN, ...SUBSCRIPTION_PLANS];

export const PLAN_BY_KEY = Object.fromEntries(SUBSCRIPTION_PLANS.map((plan) => [plan.key, plan]));
export const PLAN_BY_PLAN_ID = Object.fromEntries(
  SUBSCRIPTION_PLANS.map((plan) => [plan.planId, plan])
);

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "authenticated"]);

export const isActiveSubscriptionStatus = (status = "") =>
  ACTIVE_SUBSCRIPTION_STATUSES.has(String(status || "").toLowerCase());
