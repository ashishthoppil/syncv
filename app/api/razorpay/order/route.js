import { NextResponse } from "next/server";
import { PLAN_BY_PLAN_ID, PLAN_BY_KEY } from "@/lib/subscription-plans";
import { getSupabaseAdminClient } from "@/lib/server/subscriptions";

const razorpayBaseUrl = "https://api.razorpay.com/v1";

const getRazorpayAuthHeader = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Missing Razorpay API credentials.");
  }
  const token = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  return `Basic ${token}`;
};

const fetchRazorpaySubscription = async (subscriptionId, authHeader) => {
  const response = await fetch(`${razorpayBaseUrl}/subscriptions/${subscriptionId}`, {
    method: "GET",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Razorpay fetch subscription failed: ${text}`);
  }

  return response.json();
};

export async function POST(request) {
  try {
    const body = await request.json();
    const userId = body?.userId;
    const planKey = body?.planKey;
    const planId = body?.planId;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const selectedPlan = PLAN_BY_PLAN_ID[planId] || PLAN_BY_KEY[planKey];
    if (!selectedPlan) {
      return NextResponse.json({ error: "Invalid plan selected." }, { status: 400 });
    }

    const authHeader = getRazorpayAuthHeader();
    const supabase = getSupabaseAdminClient();

    const { data: existingSubscription, error: existingError } = await supabase
      .from("subscriptions")
      .select("id,status,razorpay_subscription_id,plan_id,plan_key")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) throw existingError;

    if (
      existingSubscription?.status === "active" &&
      (existingSubscription?.plan_id === selectedPlan.planId ||
        existingSubscription?.plan_key === selectedPlan.key)
    ) {
      return NextResponse.json({ error: "Subscription already active." }, { status: 409 });
    }

    if (
      existingSubscription?.status === "pending" &&
      existingSubscription?.razorpay_subscription_id &&
      (existingSubscription?.plan_id === selectedPlan.planId ||
        existingSubscription?.plan_key === selectedPlan.key)
    ) {
      const existingRazorpay = await fetchRazorpaySubscription(
        existingSubscription.razorpay_subscription_id,
        authHeader
      );

      return NextResponse.json({
        subscription_id: existingRazorpay.id,
        url: existingRazorpay.short_url,
      });
    }

    const createResponse = await fetch(`${razorpayBaseUrl}/subscriptions`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plan_id: selectedPlan.planId,
        total_count: 12,
        customer_notify: 0,
      }),
    });

    if (!createResponse.ok) {
      const text = await createResponse.text();
      throw new Error(`Razorpay create subscription failed: ${text}`);
    }

    const created = await createResponse.json();
    if (!created?.id || !created?.short_url) {
      throw new Error("Razorpay did not return required subscription details.");
    }

    const subscriptionPayload = {
      user_id: userId,
      plan_key: selectedPlan.key,
      plan_id: selectedPlan.planId,
      status: "pending",
      razorpay_subscription_id: created.id,
      updated_at: new Date().toISOString(),
    };

    const { error } = existingSubscription?.id
      ? await supabase
          .from("subscriptions")
          .update(subscriptionPayload)
          .eq("id", existingSubscription.id)
      : await supabase.from("subscriptions").insert(subscriptionPayload);

    if (error) throw error;

    return NextResponse.json({
      subscription_id: created.id,
      url: created.short_url,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start subscription." },
      { status: 500 }
    );
  }
}
