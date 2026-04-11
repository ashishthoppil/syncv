import crypto from "crypto";
import { NextResponse } from "next/server";
import { mapPlanDetails, getSupabaseAdminClient } from "@/lib/server/subscriptions";

export async function POST(request) {
  try {
    const {
      razorpay_payment_id: paymentId,
      razorpay_subscription_id: subscriptionId,
      razorpay_signature: signature,
    } = await request.json();

    if (!paymentId || !subscriptionId || !signature) {
      return NextResponse.json(
        { success: false, message: "Missing Razorpay verification fields." },
        { status: 400 }
      );
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return NextResponse.json(
        { success: false, message: "Missing Razorpay secret." },
        { status: 500 }
      );
    }

    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${paymentId}|${subscriptionId}`)
      .digest("hex");

    if (generatedSignature !== signature) {
      return NextResponse.json(
        { success: false, message: "Invalid Razorpay signature." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdminClient();
    const { data: subscriptionRecord, error: readError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("razorpay_subscription_id", subscriptionId)
      .maybeSingle();
    if (readError) throw readError;
    if (!subscriptionRecord) {
      return NextResponse.json(
        { success: false, message: "Subscription record not found." },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        status: "active",
        razorpay_payment_id: paymentId,
        updated_at: now,
      })
      .eq("razorpay_subscription_id", subscriptionId);
    if (updateError) throw updateError;

    const mappedPlan = mapPlanDetails({
      planId: subscriptionRecord.plan_id,
      planKey: subscriptionRecord.plan_key,
    });

    await supabase.from("profiles").upsert({
      id: subscriptionRecord.user_id,
      plan: mappedPlan?.key || subscriptionRecord.plan_key || null,
      updated_at: now,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to verify subscription.",
      },
      { status: 500 }
    );
  }
}

