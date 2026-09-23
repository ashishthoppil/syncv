import { NextResponse } from "next/server";
import {
  BILLING_PERIOD_BY_KEY,
  DEFAULT_BILLING_PERIOD,
  PLAN_BY_KEY,
  PRICING_REGION_BY_KEY,
  resolvePlanSelection,
} from "@/lib/subscription-plans";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { createCheckoutSession, DodoApiError } from "@/lib/server/dodo-payments";
import { getPricingRegionForRequest } from "@/lib/server/pricing-region";
import { getActiveSubscriptionForUser, getSupabaseAdminClient } from "@/lib/server/subscriptions";

/**
 * Starts a Dodo Payments checkout for the paid plan. Nothing is written here:
 * Dodo creates the subscription only once the checkout is paid, and
 * app/api/dodo/webhook records it then, finding the user through the metadata
 * set below.
 */
export async function POST(request) {
  try {
    // The caller comes from their access token, never the body: the user id
    // in the metadata decides whose account the payment unlocks.
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Please log in again." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const planKey = body?.planKey;
    const billingPeriod = body?.billingPeriod || DEFAULT_BILLING_PERIOD;

    // Own keys only: these come straight from the request body.
    const selectedPlan = Object.hasOwn(PLAN_BY_KEY, planKey) ? PLAN_BY_KEY[planKey] : null;
    const selectedPeriod = Object.hasOwn(BILLING_PERIOD_BY_KEY, billingPeriod)
      ? BILLING_PERIOD_BY_KEY[billingPeriod]
      : null;
    if (!selectedPlan || !selectedPeriod) {
      return NextResponse.json({ error: "Invalid plan selected." }, { status: 400 });
    }

    // The currency comes from where the request is made, not from the client.
    // The page sends the region it priced in; if the two disagree (a VPN
    // switched on after the page loaded, say) the user was shown a different
    // currency from the one they would be charged, so stop and let them reload.
    const region = getPricingRegionForRequest(request);
    const shownRegion = body?.region;
    if (shownRegion && shownRegion !== region) {
      return NextResponse.json(
        {
          error: `Prices for your location are in ${PRICING_REGION_BY_KEY[region].currency}. Refresh the page to see them, then choose again.`,
          region,
        },
        { status: 409 }
      );
    }

    // The Dodo product is looked up here, never taken from the client: the id
    // is what sets the amount and currency charged.
    const productId = selectedPlan.planIds[region]?.[selectedPeriod.key];
    if (!productId) {
      console.error("[subscription/create] no Dodo product id configured", {
        planKey: selectedPlan.key,
        billingPeriod: selectedPeriod.key,
        region,
      });
      return NextResponse.json(
        {
          error: `${selectedPeriod.label} billing for ${selectedPlan.name} isn't available yet. Please pick another billing period.`,
        },
        { status: 503 }
      );
    }

    const supabase = getSupabaseAdminClient();
    const activeSubscription = await getActiveSubscriptionForUser(supabase, user.id);
    if (activeSubscription) {
      // A row whose period can't be told (a plan id no longer configured)
      // matches any period rather than risk a second charge.
      const activeSelection = resolvePlanSelection({
        planId: activeSubscription.plan_id,
        planKey: activeSubscription.plan_key,
      });
      const activePeriod = activeSelection?.billingPeriod;
      if (!activePeriod || activePeriod === selectedPeriod.key) {
        return NextResponse.json({ error: "Subscription already active." }, { status: 409 });
      }
      // Another period would be a second subscription, billed alongside the
      // first, so switching goes through support for now.
      return NextResponse.json(
        {
          error: `You're already on ${selectedPlan.name}, billed ${BILLING_PERIOD_BY_KEY[
            activePeriod
          ].label.toLowerCase()}. To switch to ${selectedPeriod.label.toLowerCase()} billing, contact us from the Help Center and we'll move your subscription over.`,
        },
        { status: 409 }
      );
    }

    const name = user.user_metadata?.full_name || user.user_metadata?.name;
    const session = await createCheckoutSession({
      product_cart: [{ product_id: productId, quantity: 1 }],
      ...(user.email ? { customer: { email: user.email, ...(name ? { name } : {}) } } : {}),
      // Back to the plans card once paid; the settings tab that opened the
      // checkout is already polling for the activation.
      return_url: `${new URL(request.url).origin}/scan?section=settings&scrollTo=dashboard-pricing`,
      // Dodo copies this onto the subscription, which is how the webhook
      // knows whose it is.
      metadata: {
        user_id: user.id,
        plan_key: selectedPlan.key,
        billing_period: selectedPeriod.key,
        region,
      },
    });

    if (!session?.checkout_url) {
      throw new Error("Dodo Payments did not return a checkout link.");
    }

    return NextResponse.json({
      session_id: session.session_id,
      url: session.checkout_url,
    });
  } catch (error) {
    console.error("[subscription/create] checkout creation failed", {
      status: error?.status,
      // Dodo's error code, or Supabase/Postgrest's.
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });

    // Dodo's own status isn't passed on: its 401 means our key is wrong, not
    // that the user is signed out.
    return NextResponse.json(
      { error: error?.message || "Unable to start subscription." },
      { status: error instanceof DodoApiError ? 502 : 500 }
    );
  }
}
