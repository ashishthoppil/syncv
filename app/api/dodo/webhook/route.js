import { NextResponse } from "next/server";
import { isActiveSubscriptionStatus, resolvePlanSelection } from "@/lib/subscription-plans";
import { retrieveSubscription, verifyDodoWebhook } from "@/lib/server/dodo-payments";
import { sendSubscriptionEmail } from "@/lib/server/email";
import {
  getActiveSubscriptionForUser,
  getSupabaseAdminClient,
  mapPlanDetails,
} from "@/lib/server/subscriptions";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Every subscription.* event, plus payment.succeeded, which is the only place
// a charge's payment id shows up. Everything else Dodo sends is acknowledged
// and ignored.
const isSubscriptionEvent = (type) =>
  type.startsWith("subscription.") || type === "payment.succeeded";

/**
 * The user a subscription belongs to, from the metadata checkout put on it.
 * Null when there is none, or the account has been deleted since.
 */
const findSubscriber = async (supabase, subscription) => {
  const userId = subscription.metadata?.user_id;
  if (typeof userId !== "string" || !UUID_PATTERN.test(userId)) return null;

  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error?.status === 404) return null;
  if (error) throw error;
  return data?.user || null;
};

/**
 * Brings the subscriptions row for `subscription` (as Dodo has it now) up to
 * date, creating it the first time Dodo reports it: one row per Dodo
 * subscription.
 */
const syncSubscription = async ({ supabase, subscription, paymentId, appUrl }) => {
  const subscriptionId = subscription.subscription_id;

  const { data: existing, error: existingError } = await supabase
    .from("subscriptions")
    .select("id,user_id,status")
    .eq("dodo_subscription_id", subscriptionId)
    .maybeSingle();
  if (existingError) throw existingError;

  let userId = existing?.user_id || null;
  let email = null;
  if (!existing) {
    const subscriber = await findSubscriber(supabase, subscription);
    if (!subscriber) {
      console.warn("[dodo/webhook] no SynCV account for subscription; ignoring", {
        subscriptionId,
      });
      return;
    }
    userId = subscriber.id;
    email = subscriber.email;
  }

  // The product says which plan and period; the metadata's plan key covers a
  // product id this deployment doesn't have configured.
  const selection = resolvePlanSelection({
    planId: subscription.product_id,
    planKey: subscription.metadata?.plan_key,
  });
  if (!existing && !selection) {
    console.warn("[dodo/webhook] subscription is for a product SynCV doesn't sell; ignoring", {
      subscriptionId,
      productId: subscription.product_id,
    });
    return;
  }

  const now = new Date().toISOString();
  const status = String(subscription.status || "").toLowerCase();
  const row = {
    user_id: userId,
    plan_id: subscription.product_id,
    status,
    dodo_subscription_id: subscriptionId,
    dodo_customer_id: subscription.customer?.customer_id || null,
    current_period_end: subscription.next_billing_date || null,
    canceled_at: subscription.cancelled_at || null,
    updated_at: now,
    ...(selection ? { plan_key: selection.plan.key } : {}),
    ...(paymentId ? { dodo_payment_id: paymentId } : {}),
  };

  if (existing) {
    const { error } = await supabase.from("subscriptions").update(row).eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("subscriptions").insert(row);
    // Two deliveries for a new subscription can race to insert it; the one
    // that loses updates the row the other made.
    if (error?.code === "23505") {
      const { error: retryError } = await supabase
        .from("subscriptions")
        .update(row)
        .eq("dodo_subscription_id", subscriptionId);
      if (retryError) throw retryError;
    } else if (error) {
      throw error;
    }
  }

  // profiles.plan mirrors whichever subscription is active, if any: this one
  // ending doesn't take the plan away while another is still running.
  const activeSubscription = await getActiveSubscriptionForUser(supabase, userId);
  const activePlan = activeSubscription
    ? mapPlanDetails({ planId: activeSubscription.plan_id, planKey: activeSubscription.plan_key })
    : null;
  const { error: profileError } = await supabase.from("profiles").upsert({
    id: userId,
    plan: activePlan?.key || null,
    updated_at: now,
  });
  if (profileError) {
    console.warn("[dodo/webhook] failed to update profile plan", profileError);
  }

  if (isActiveSubscriptionStatus(status) && !isActiveSubscriptionStatus(existing?.status)) {
    if (!email) {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      email = userData?.user?.email || null;
    }
    try {
      await sendSubscriptionEmail({ to: email, appUrl: `${appUrl}/scan` });
    } catch (emailError) {
      console.warn("[dodo/webhook] failed to send subscription email", emailError);
    }
  }
};

export async function POST(request) {
  const secret = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  if (!secret) {
    console.error("[dodo/webhook] DODO_PAYMENTS_WEBHOOK_KEY is not set");
    return NextResponse.json({ error: "Missing webhook secret." }, { status: 500 });
  }

  const rawBody = await request.text();
  if (!verifyDodoWebhook(rawBody, request.headers, secret)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const type = String(event?.type || "");
  const subscriptionId = event?.data?.subscription_id;
  if (!isSubscriptionEvent(type) || !subscriptionId) {
    return NextResponse.json({ received: true });
  }

  try {
    // The event only says the subscription changed; what it is now comes from
    // Dodo. Syncing from that makes deliveries order-independent: a retried
    // subscription.active arriving after subscription.cancelled can't bring a
    // cancelled plan back.
    const subscription = await retrieveSubscription(subscriptionId);
    const supabase = getSupabaseAdminClient();
    const appUrl =
      process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || new URL(request.url).origin;

    await syncSubscription({
      supabase,
      subscription,
      paymentId: type === "payment.succeeded" ? event.data.payment_id : null,
      appUrl,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[dodo/webhook] failed to handle event", {
      type,
      subscriptionId,
      status: error?.status,
      code: error?.code,
      message: error?.message,
    });
    // Anything but a 2xx makes Dodo deliver the event again later.
    return NextResponse.json({ error: "Webhook handling failed." }, { status: 500 });
  }
}
