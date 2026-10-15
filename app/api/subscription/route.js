import { NextResponse } from "next/server";
import { getOptimizationAllowance } from "@/lib/server/optimization-allowance";
import {
  countWeeklyScans,
  countFreeTrialScans,
  FREE_TRIAL_SCAN_LIMIT,
  getPlanForUser,
  getSupabaseAdminClient,
  getActiveSubscriptionForUser,
  getLatestSubscriptionForUser,
  normalizeSubscriptionView,
} from "@/lib/server/subscriptions";

export async function GET(request) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const supabase = getSupabaseAdminClient();
    const activeSubscription = await getActiveSubscriptionForUser(supabase, userId);
    const latestSubscription =
      activeSubscription || (await getLatestSubscriptionForUser(supabase, userId));
    const normalized = normalizeSubscriptionView(latestSubscription);
    const plan = await getPlanForUser(supabase, userId);
    // Scanning and the rest of the resume tools come only with a plan that
    // includes them (Pro). A Remote Jobs subscriber is on the free trial for
    // those, exactly like a Free account.
    const toolsPlan = plan?.includesResumeTools ? plan : null;
    // Pro has no weekly cap (weeklyScanLimit null), so there is no balance to
    // count; a plan that sets a cap still reports what is left of it.
    const unlimitedScans = Boolean(toolsPlan) && toolsPlan.weeklyScanLimit == null;
    const weeklyScanLimit = toolsPlan && !unlimitedScans ? toolsPlan.weeklyScanLimit : 0;
    const scansUsedThisWeek =
      toolsPlan && !unlimitedScans ? await countWeeklyScans(supabase, userId) : 0;
    const scansRemainingThisWeek = unlimitedScans
      ? null
      : weeklyScanLimit > 0
        ? Math.max(0, weeklyScanLimit - scansUsedThisWeek)
        : 0;

    // Users without the resume tools get a lifetime free-trial allowance
    // before they are asked to upgrade.
    const freeTrialUsed = toolsPlan ? 0 : await countFreeTrialScans(supabase, userId);
    const freeTrialRemaining = toolsPlan
      ? 0
      : Math.max(0, FREE_TRIAL_SCAN_LIMIT - freeTrialUsed);
    const canScan = Boolean(toolsPlan) || freeTrialRemaining > 0;
    // Pro only: the optimization fair-use state the header shows — the day's
    // count and cap, and the break timer.
    const optimizationUsage = toolsPlan ? await getOptimizationAllowance(supabase, userId) : null;

    return NextResponse.json({
      data: {
        ...normalized,
        planKey: plan?.key || normalized.planKey || null,
        planName: plan?.name || normalized.planName || null,
        // `normalized` only describes the subscription row, and the admin
        // account has a plan without one. "Any paid plan" — Settings uses it
        // to mark the current plan. Feature gates read the two flags below.
        hasActivePlan: Boolean(plan) || normalized.hasActivePlan,
        hasResumeTools: Boolean(toolsPlan),
        hasRemoteJobsAccess: Boolean(plan?.includesRemoteJobs),
        unlimitedScans,
        weeklyScanLimit,
        scansUsedThisWeek,
        scansRemainingThisWeek,
        freeTrialLimit: FREE_TRIAL_SCAN_LIMIT,
        freeTrialUsed,
        freeTrialRemaining,
        canScan,
        optimizationUsage,
        // Free-trial users get the full experience (cover letter + job tracker)
        // so the trial showcases every feature; Pro uses its own flags.
        allowsJobTracker: toolsPlan ? Boolean(toolsPlan.allowsJobTracker) : true,
        allowsCoverLetter: toolsPlan ? Boolean(toolsPlan.allowsCoverLetter) : true,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch subscription." },
      { status: 500 }
    );
  }
}
