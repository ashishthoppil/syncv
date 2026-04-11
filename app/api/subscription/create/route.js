import { NextResponse } from "next/server";
import { PLAN_BY_PLAN_ID, PLAN_BY_KEY } from "@/lib/subscription-plans";
import {
  getActiveSubscriptionForUser,
  getSupabaseAdminClient,
  mapPlanDetails,
} from "@/lib/server/subscriptions";

const razorpayBaseUrl = "https://api.razorpay.com/v1";

const getRazorpayAuthHeader = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Missing Razorpay API credentials.");
  }
  const token = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  return { keyId, authHeader: `Basic ${token}` };
};

const cancelRazorpaySubscription = async (subscriptionId, authHeader) => {
  const response = await fetch(`${razorpayBaseUrl}/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ cancel_at_cycle_end: 0 }),
  });

  if (response.ok) return;

  const text = await response.text();
  if (response.status === 400 && /already cancelled|already completed|not active/i.test(text)) {
    return;
  }
  throw new Error(`Razorpay cancel failed: ${text}`);
};

export async function POST(request) {
  try {
    const { userId, planKey, planId } = await request.json();
    if (!userId) {
      return NextResponse.json(
        { success: false, message: "userId is required." },
        { status: 400 }
      );
    }

    const selectedPlan = PLAN_BY_PLAN_ID[planId] || PLAN_BY_KEY[planKey];
    if (!selectedPlan) {
      return NextResponse.json(
        { success: false, message: "Invalid plan selected." },
        { status: 400 }
      );
    }

    const { keyId, authHeader } = getRazorpayAuthHeader();
    const supabase = getSupabaseAdminClient();

    const activeSubscription = await getActiveSubscriptionForUser(supabase, userId);
    const currentPlan = activeSubscription
      ? mapPlanDetails({
          planId: activeSubscription.plan_id,
          planKey: activeSubscription.plan_key,
        })
      : null;

    if (activeSubscription && currentPlan?.key === selectedPlan.key) {
      return NextResponse.json(
        { success: false, message: `You are already on the ${selectedPlan.name} plan.` },
        { status: 409 }
      );
    }

    if (activeSubscription?.razorpay_subscription_id) {
      await cancelRazorpaySubscription(activeSubscription.razorpay_subscription_id, authHeader);
      await supabase
        .from("subscriptions")
        .update({
          status: "cancelled",
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", activeSubscription.id);
    }

    const createPayload = {
      plan_id: selectedPlan.planId,
      total_count: 12,
      customer_notify: 1,
      quantity: 1,
      notes: {
        user_id: userId,
        plan_key: selectedPlan.key,
      },
    };

    const createResponse = await fetch(`${razorpayBaseUrl}/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createPayload),
    });

    if (!createResponse.ok) {
      const text = await createResponse.text();
      throw new Error(`Razorpay create subscription failed: ${text}`);
    }

    const created = await createResponse.json();
    const razorpaySubscriptionId = created?.id;
    if (!razorpaySubscriptionId) {
      throw new Error("Razorpay did not return a subscription id.");
    }

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError) throw userError;

    const now = new Date().toISOString();
    const row = {
      user_id: userId,
      plan_key: selectedPlan.key,
      plan_id: selectedPlan.planId,
      status: String(created.status || "created").toLowerCase(),
      razorpay_subscription_id: razorpaySubscriptionId,
      current_period_end: null,
      updated_at: now,
    };

    const { error: upsertError } = await supabase
      .from("subscriptions")
      .upsert(row, { onConflict: "razorpay_subscription_id" });
    if (upsertError) throw upsertError;

    await supabase.from("profiles").upsert({
      id: userId,
      plan: selectedPlan.key,
      updated_at: now,
    });

    return NextResponse.json({
      success: true,
      data: {
        keyId,
        subscriptionId: razorpaySubscriptionId,
        plan: selectedPlan,
        prefill: {
          email: userData?.user?.email || "",
          name:
            userData?.user?.user_metadata?.full_name ||
            userData?.user?.user_metadata?.name ||
            "",
          contact: userData?.user?.user_metadata?.phone || "",
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to create subscription.",
      },
      { status: 500 }
    );
  }
}

