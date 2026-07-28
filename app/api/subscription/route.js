import { NextResponse } from "next/server";
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
    const scansUsedThisWeek = plan ? await countWeeklyScans(supabase, userId) : 0;
    const weeklyScanLimit = plan?.weeklyScanLimit || 0;
    const scansRemainingThisWeek =
      weeklyScanLimit > 0 ? Math.max(0, weeklyScanLimit - scansUsedThisWeek) : 0;

    // Users without an active plan get a lifetime free-trial allowance before
    // they are asked to subscribe.
    const freeTrialUsed = plan ? 0 : await countFreeTrialScans(supabase, userId);
    const freeTrialRemaining = plan
      ? 0
      : Math.max(0, FREE_TRIAL_SCAN_LIMIT - freeTrialUsed);
    const canScan = Boolean(plan) || freeTrialRemaining > 0;

    return NextResponse.json({
      data: {
        ...normalized,
        planKey: plan?.key || normalized.planKey || null,
        planName: plan?.name || normalized.planName || null,
        weeklyScanLimit,
        scansUsedThisWeek,
        scansRemainingThisWeek,
        freeTrialLimit: FREE_TRIAL_SCAN_LIMIT,
        freeTrialUsed,
        freeTrialRemaining,
        canScan,
        // Free-trial users get the full experience (cover letter + job tracker)
        // so the trial showcases every feature; paid plans use their own flags.
        allowsJobTracker: plan ? Boolean(plan.allowsJobTracker) : true,
        allowsCoverLetter: plan ? Boolean(plan.allowsCoverLetter) : true,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch subscription." },
      { status: 500 }
    );
  }
}
