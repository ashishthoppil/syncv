import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cancelDodoSubscription, DODO_ENDED_STATUSES } from "@/lib/server/dodo-payments";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const getAdminClient = () => {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export async function POST(req) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({
        success: false,
        message: "User ID is required.",
      });
    }

    const supabase = getAdminClient();

    // Stop billing first: once the rows are gone, nothing points at the Dodo
    // subscriptions and they would keep charging a deleted account. A failure
    // stops the deletion, so it can be retried.
    const { data: dodoSubscriptions, error: dodoLookupError } = await supabase
      .from("subscriptions")
      .select("dodo_subscription_id,status")
      .eq("user_id", userId)
      .not("dodo_subscription_id", "is", null);
    if (dodoLookupError) {
      throw dodoLookupError;
    }
    for (const row of dodoSubscriptions || []) {
      if (!DODO_ENDED_STATUSES.has(row.status)) {
        await cancelDodoSubscription(row.dodo_subscription_id);
      }
    }

    // Delete subscription records
    const { error: subscriptionError } = await supabase
      .from("subscriptions")
      .delete()
      .eq("user_id", userId);
    if (subscriptionError) {
      throw subscriptionError;
    }

    // Delete job tracker entries
    const { error: jobError } = await supabase
      .from("job_tracker")
      .delete()
      .eq("user_id", userId);
    if (jobError) {
      throw jobError;
    }

    // Delete profile record
    const { error: profileError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);
    if (profileError) {
      throw profileError;
    }

    // Delete auth user
    const { error: authError } = await supabase.auth.admin.deleteUser(userId);
    if (authError) {
      throw authError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error.message,
    });
  }
}
