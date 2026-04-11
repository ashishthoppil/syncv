import { createClient } from "@supabase/supabase-js";
import {
  PLAN_BY_PLAN_ID,
  PLAN_BY_KEY,
  isActiveSubscriptionStatus,
} from "@/lib/subscription-plans";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const getSupabaseAdminClient = () => {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase service role configuration.");
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export const mapPlanDetails = ({ planId = "", planKey = "" } = {}) => {
  return PLAN_BY_PLAN_ID[planId] || PLAN_BY_KEY[planKey] || null;
};

export const getLatestSubscriptionForUser = async (supabase, userId) => {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

export const getActiveSubscriptionForUser = async (supabase, userId) => {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["active", "authenticated"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
};

export const normalizeSubscriptionView = (subscription) => {
  if (!subscription) {
    return {
      hasActivePlan: false,
      planKey: null,
      planName: null,
      planId: null,
      status: "none",
      subscriptionId: null,
      currentPeriodEnd: null,
      canceledAt: null,
      createdAt: null,
      updatedAt: null,
    };
  }

  const plan = mapPlanDetails({
    planId: subscription.plan_id,
    planKey: subscription.plan_key,
  });
  const status = String(subscription.status || "").toLowerCase();

  return {
    hasActivePlan: isActiveSubscriptionStatus(status),
    planKey: plan?.key || subscription.plan_key || null,
    planName: plan?.name || subscription.plan_key || null,
    planId: subscription.plan_id || null,
    status: status || "none",
    subscriptionId: subscription.razorpay_subscription_id || null,
    currentPeriodEnd: subscription.current_period_end || null,
    canceledAt: subscription.canceled_at || null,
    createdAt: subscription.created_at || null,
    updatedAt: subscription.updated_at || null,
  };
};

