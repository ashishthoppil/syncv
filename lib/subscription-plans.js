const SPEED_PLAN_ID =
  process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_SPEED || process.env.RAZORPAY_PLAN_ID_SPEED;
const PRO_PLAN_ID =
  process.env.NEXT_PUBLIC_RAZORPAY_PLAN_ID_PRO || process.env.RAZORPAY_PLAN_ID_PRO;

const tooltipContent = {
  scans: "Each scan gives role-specific feedback to improve your resume quickly.",
  generation: "Generate targeted resume and cover letter drafts from each job description.",
};

export const SUBSCRIPTION_PLANS = [
  {
    key: "speed",
    name: "Speed",
    priceInr: 699,
    features: [
      { title: "12 resume scans every week", tooltip: tooltipContent.scans },
      { title: "Resume generation", tooltip: tooltipContent.generation },
      { title: "One click analysis and optimization" },
      { title: "No job tracker" },
      { title: "No cover letter generation" },
    ],
    planId: SPEED_PLAN_ID || "plan_ScFynOsGLJcAKU",
    description: "Essential optimization tools for faster applications.",
    // weeklyScanLimit: 12,
    weeklyScanLimit: 999,
    allowsJobTracker: false,
    allowsCoverLetter: false,
  },
  {
    key: "pro",
    name: "Pro",
    priceInr: 749,
    features: [
      { title: "50 resume scans every week", tooltip: tooltipContent.scans },
      { title: "Instant resume generation", tooltip: tooltipContent.generation },
      { title: "Cover letter generation", tooltip: tooltipContent.generation },
      { title: "Job tracking" },
      { title: "One click analysis and optimization" },
      { title: "Premium upgrade coming soon" },
    ],
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
