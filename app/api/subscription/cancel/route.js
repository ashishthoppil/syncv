import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { cancelDodoSubscription } from "@/lib/server/dodo-payments";
import {
  getActiveSubscriptionForUser,
  getLatestSubscriptionForUser,
  getSupabaseAdminClient,
} from "@/lib/server/subscriptions";

/**
 * Cancels the caller's subscription at the end of the period they have paid
 * for, as the terms promise. The plan stays active until then; Dodo sends
 * subscription.cancelled when it ends, and app/api/dodo/webhook records it.
 */
export async function POST(request) {
  try {
    // From the access token, never the body: otherwise anyone could cancel
    // anyone's subscription by posting their user id.
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "Please log in again." },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdminClient();
    const activeSubscription = await getActiveSubscriptionForUser(supabase, user.id);
    const latestSubscription =
      activeSubscription || (await getLatestSubscriptionForUser(supabase, user.id));

    if (!latestSubscription) {
      return NextResponse.json(
        { success: false, message: "No subscription found to cancel." },
        { status: 404 }
      );
    }

    if (!latestSubscription.dodo_subscription_id) {
      // Bought through Razorpay, before the move to Dodo. It can only be
      // stopped from the Razorpay dashboard, so marking it cancelled here would
      // leave it charging.
      if (activeSubscription) {
        return NextResponse.json(
          {
            success: false,
            message:
              "This subscription was set up with our previous payment provider. Contact us from the Help Center and we'll cancel it for you.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ success: true });
    }

    await cancelDodoSubscription(latestSubscription.dodo_subscription_id, { atPeriodEnd: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to cancel subscription.",
      },
      { status: 500 }
    );
  }
}
