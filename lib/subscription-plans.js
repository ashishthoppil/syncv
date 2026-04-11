export const SUBSCRIPTION_PLANS = [
  {
    key: "speed",
    name: "Speed",
    priceInr: 699,
    planId: "plan_ScFynOsGLJcAKU",
    description: "Essential optimization tools for faster applications.",
  },
  {
    key: "pro",
    name: "Pro",
    priceInr: 749,
    planId: "plan_ScFz2fB1C9n3Cl",
    description: "Full workflow with resume optimization and job tracking.",
  },
];

export const PLAN_BY_KEY = Object.fromEntries(SUBSCRIPTION_PLANS.map((plan) => [plan.key, plan]));
export const PLAN_BY_PLAN_ID = Object.fromEntries(
  SUBSCRIPTION_PLANS.map((plan) => [plan.planId, plan])
);

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "authenticated"]);

export const isActiveSubscriptionStatus = (status = "") =>
  ACTIVE_SUBSCRIPTION_STATUSES.has(String(status || "").toLowerCase());

