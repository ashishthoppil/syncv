import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import {
  BILLING_PERIOD_BY_KEY,
  DEFAULT_BILLING_PERIOD,
  PLAN_BY_KEY,
  resolvePlanSelection,
} from "@/lib/subscription-plans";
import { getSupabaseAdminClient } from "@/lib/server/subscriptions";

export async function POST(request) {
  try {
    const body = await request.json();
    const userId = body?.userId;
    const planKey = body?.planKey;
    const billingPeriod = body?.billingPeriod || DEFAULT_BILLING_PERIOD;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // Own keys only: these come straight from the request body.
    const selectedPlan = Object.hasOwn(PLAN_BY_KEY, planKey) ? PLAN_BY_KEY[planKey] : null;
    const selectedPeriod = Object.hasOwn(BILLING_PERIOD_BY_KEY, billingPeriod)
      ? BILLING_PERIOD_BY_KEY[billingPeriod]
      : null;
    if (!selectedPlan || !selectedPeriod) {
      return NextResponse.json({ error: "Invalid plan selected." }, { status: 400 });
    }

    // The Razorpay plan is looked up here, never taken from the client: the id
    // is what sets the amount charged.
    const selectedPlanId = selectedPlan.planIds[selectedPeriod.key];
    if (!selectedPlanId) {
      console.error("[razorpay/order] no Razorpay plan id configured", {
        planKey: selectedPlan.key,
        billingPeriod: selectedPeriod.key,
      });
      return NextResponse.json(
        {
          error: `${selectedPeriod.label} billing for ${selectedPlan.name} isn't available yet. Please pick another billing period.`,
        },
        { status: 503 }
      );
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

    // Same plan on a different billing period is a switch, not a duplicate. A
    // row whose period can't be told (a plan id no longer configured) is
    // treated as a duplicate of any period rather than risk a second charge.
    const existingSelection = resolvePlanSelection({
      planId: existingSubscription?.plan_id,
      planKey: existingSubscription?.plan_key,
    });
    if (
      existingSubscription?.status === "active" &&
      existingSelection?.plan.key === selectedPlan.key &&
      (!existingSelection.billingPeriod || existingSelection.billingPeriod === selectedPeriod.key)
    ) {
      return NextResponse.json({ error: "Subscription already active." }, { status: 409 });
    }

    // Only reuse a pending checkout when it was created for the exact same plan id.
    // Matching on plan_key alone would resurrect subscriptions created against a
    // stale (e.g. test-mode) plan id after the configured plan ids change.
    if (
      existingSubscription?.status === "pending" &&
      existingSubscription?.razorpay_subscription_id &&
      existingSubscription?.plan_id === selectedPlanId
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
        existingRazorpay?.plan_id === selectedPlanId &&
        existingRazorpay?.status === "created"
      ) {
        return NextResponse.json({
          subscription_id: existingRazorpay.id,
          url: existingRazorpay.short_url,
        });
      }
    }

    const created = await razorpay.subscriptions.create({
      plan_id: selectedPlanId,
      total_count: selectedPeriod.totalCount,
      customer_notify: 0,
    });

    console.log('existingSubscription', created);


    if (!created?.id || !created?.short_url) {
      throw new Error("Razorpay did not return required subscription details.");
    }

    const subscriptionPayload = {
      user_id: userId,
      plan_key: selectedPlan.key,
      plan_id: selectedPlanId,
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
    // The Razorpay SDK rejects with a plain object ({ statusCode, error: { code, description } }),
    // not an Error, so `instanceof Error` alone would mask every API failure behind a generic message.
    const razorpayDescription = error?.error?.description;
    const message = razorpayDescription || error?.message || "Unable to start subscription.";

    console.error("[razorpay/order] subscription creation failed", {
      statusCode: error?.statusCode,
      // Razorpay nests its code; Supabase/Postgrest puts it at the top level.
      code: error?.error?.code || error?.code,
      description: razorpayDescription,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });

    return NextResponse.json({ error: message }, { status: error?.statusCode || 500 });
  }
}
