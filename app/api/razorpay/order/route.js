import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { PLAN_BY_PLAN_ID, PLAN_BY_KEY } from "@/lib/subscription-plans";
import { getSupabaseAdminClient } from "@/lib/server/subscriptions";

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

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: "Missing Razorpay keys." }, { status: 500 });
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

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

    // Only reuse a pending checkout when it was created for the exact same plan id.
    // Matching on plan_key alone would resurrect subscriptions created against a
    // stale (e.g. test-mode) plan id after the configured plan ids change.
    if (
      existingSubscription?.status === "pending" &&
      existingSubscription?.razorpay_subscription_id &&
      existingSubscription?.plan_id === selectedPlan.planId
    ) {
      let existingRazorpay = null;
      try {
        existingRazorpay = await razorpay.subscriptions.fetch(
          existingSubscription.razorpay_subscription_id,
        );
      } catch {
        // Unknown to the current Razorpay account/mode — fall through and create a new one.
      }

      if (
        existingRazorpay?.short_url &&
        existingRazorpay?.plan_id === selectedPlan.planId &&
        existingRazorpay?.status === "created"
      ) {
        return NextResponse.json({
          subscription_id: existingRazorpay.id,
          url: existingRazorpay.short_url,
        });
      }
    }

    const created = await razorpay.subscriptions.create({
      plan_id: selectedPlan.planId,
      total_count: 12,
      customer_notify: 0,
    });

    console.log('existingSubscription', created);


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
