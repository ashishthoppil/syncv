import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import {
  getActiveSubscriptionForUser,
  getLatestSubscriptionForUser,
  getSupabaseAdminClient,
} from "@/lib/server/subscriptions";

const getRazorpayClient = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Missing Razorpay API credentials.");
  }
  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

const cancelRazorpaySubscription = async (subscriptionId, razorpay) => {
  try {
    await razorpay.subscriptions.cancel(subscriptionId, { cancel_at_cycle_end: 0 });
    return;
  } catch (error) {
    const description =
      error?.error?.description || error?.description || error?.message || String(error);
    if (/already cancelled|already completed|not active/i.test(description)) {
      return;
    }
    throw new Error(`Razorpay cancel failed: ${description}`);
  }
};

export async function POST(request) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "userId is required." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    const activeSubscription = await getActiveSubscriptionForUser(supabase, userId);
    const latestSubscription = activeSubscription || (await getLatestSubscriptionForUser(supabase, userId));

    if (!latestSubscription) {
      return NextResponse.json(
        { success: false, message: "No subscription found to cancel." },
        { status: 404 }
      );
    }

    if (latestSubscription.razorpay_subscription_id) {
      const razorpay = getRazorpayClient();
      await cancelRazorpaySubscription(latestSubscription.razorpay_subscription_id, razorpay);
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        status: "cancelled",
        canceled_at: now,
        updated_at: now,
      })
      .eq("id", latestSubscription.id);
    if (updateError) throw updateError;

    await supabase.from("profiles").upsert({
      id: userId,
      plan: null,
      updated_at: now,
    });

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
