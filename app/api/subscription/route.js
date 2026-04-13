import { NextResponse } from "next/server";
import {
  countWeeklyScans,
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

    return NextResponse.json({
      data: {
        ...normalized,
        planKey: plan?.key || normalized.planKey || null,
        planName: plan?.name || normalized.planName || null,
        weeklyScanLimit,
        scansUsedThisWeek,
        scansRemainingThisWeek,
        allowsJobTracker: Boolean(plan?.allowsJobTracker),
        allowsCoverLetter: Boolean(plan?.allowsCoverLetter),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch subscription." },
      { status: 500 }
    );
  }
}
