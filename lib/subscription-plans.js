const SPEED_PLAN_ID =
  process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_SPEED || process.env.RAZORPAY_PLAN_ID_SPEED;
const PRO_PLAN_ID =
  process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_PRO || process.env.RAZORPAY_PLAN_ID_PRO;

export const SUBSCRIPTION_PLANS = [
  {
    key: "speed",
    name: "Speed",
    priceInr: 699,
    planId: SPEED_PLAN_ID || "plan_ScFynOsGLJcAKU",
    description: "Essential optimization tools for faster applications.",
    weeklyScanLimit: 12,
    allowsJobTracker: false,
    allowsCoverLetter: false,
  },
  {
    key: "pro",
    name: "Pro",
    priceInr: 749,
    planId: PRO_PLAN_ID || "plan_ScFz2fB1C9n3Cl",
    description: "Full workflow with resume optimization and job tracking.",
    weeklyScanLimit: 50,
    allowsJobTracker: true,
    allowsCoverLetter: true,
  },
];

export const PLAN_BY_KEY = Object.fromEntries(SUBSCRIPTION_PLANS.map((plan) => [plan.key, plan]));
export const PLAN_BY_PLAN_ID = Object.fromEntries(
  SUBSCRIPTION_PLANS.map((plan) => [plan.planId, plan])
);

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "authenticated"]);

export const isActiveSubscriptionStatus = (status = "") =>
  ACTIVE_SUBSCRIPTION_STATUSES.has(String(status || "").toLowerCase());
