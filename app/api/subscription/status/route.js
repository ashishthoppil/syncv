import { NextResponse } from "next/server";
import {
  getActiveSubscriptionForUser,
  getLatestSubscriptionForUser,
  getSupabaseAdminClient,
  normalizeSubscriptionView,
} from "@/lib/server/subscriptions";

export async function GET(request) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "userId is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    const activeSubscription = await getActiveSubscriptionForUser(supabase, userId);
    const latestSubscription =
      activeSubscription || (await getLatestSubscriptionForUser(supabase, userId));
    const subscription = normalizeSubscriptionView(latestSubscription);

    return NextResponse.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to fetch subscription status.",
      },
      { status: 500 }
    );
  }
}
