"use client";

import { Button } from "@/components/ui/button";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import swal from "sweetalert";

type SubscriptionView = {
  hasActivePlan: boolean;
  planKey: string | null;
  planName: string | null;
  status: string;
  subscriptionId: string | null;
};

type SubscriptionRecord = {
  status?: string | null;
  plan_key?: string | null;
  plan_id?: string | null;
  razorpay_subscription_id?: string | null;
  hasActivePlan?: boolean;
  planKey?: string | null;
  planId?: string | null;
  planName?: string | null;
  subscriptionId?: string | null;
};

const initialSubscription: SubscriptionView = {
  hasActivePlan: false,
  planKey: null,
  planName: null,
  status: "none",
  subscriptionId: null,
};

type SettingsSectionProps = {
  onSubscriptionChange?: () => Promise<void> | void;
};

export const SettingsSection = ({ onSubscriptionChange }: SettingsSectionProps = {}) => {
  const router = useRouter();
  const [resumeLanguage, setResumeLanguage] = useState("English");
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");
  const [savingSettings, setSavingSettings] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [planActionLoading, setPlanActionLoading] = useState<string | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionView>(initialSubscription);
  const [paymentPollingPlanName, setPaymentPollingPlanName] = useState<string | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);

  const languageOptions = [
    "English",
    "Spanish",
    "French",
    "German",
    "Italian",
    "Portuguese",
    "Dutch",
    "Swedish",
    "Norwegian",
    "Danish",
    "Finnish",
    "Polish",
    "Russian",
    "Turkish",
    "Arabic",
    "Hindi",
    "Bengali",
    "Chinese (Simplified)",
    "Chinese (Traditional)",
    "Japanese",
    "Korean",
    "Vietnamese",
    "Thai",
    "Indonesian",
    "Malay",
    "Greek",
    "Hebrew",
    "Latin",
  ];

  const dateFormats = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD", "DD Mon YYYY"];
  const mapSubscriptionView = (record: SubscriptionRecord | null): SubscriptionView => {
    if (!record) return initialSubscription;

    const matchedPlan =
      SUBSCRIPTION_PLANS.find((plan) => plan.planId === (record.plan_id || record.planId)) ||
      SUBSCRIPTION_PLANS.find((plan) => plan.key === (record.plan_key || record.planKey));
    const normalizedStatus = String(record.status || "none").toLowerCase();
    const hasActivePlan =
      typeof record.hasActivePlan === "boolean"
        ? record.hasActivePlan
        : normalizedStatus === "active" || normalizedStatus === "authenticated";

    return {
      hasActivePlan,
      planKey: matchedPlan?.key || record.plan_key || record.planKey || null,
      planName: matchedPlan?.name || record.planName || null,
      status: normalizedStatus,
      subscriptionId: record.razorpay_subscription_id || record.subscriptionId || null,
    };
  };

  const loadSubscriptionStatus = useCallback(async (userId: string) => {
    setSubscriptionLoading(true);
    try {
      const response = await fetch(`/api/subscription?userId=${userId}`);
      const json = await response.json();
      if (response.ok) {
        setSubscription(mapSubscriptionView(json.data || null));
      }
    } catch (error) {
      console.error("Failed to load subscription status:", error);
    } finally {
      setSubscriptionLoading(false);
    }
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }

      setCurrentUserId(session.user.id);

      const { data, error } = await supabase
        .from("profiles")
        .select("resume_language, date_format")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!error && data) {
        if (data.resume_language) setResumeLanguage(data.resume_language);
        if (data.date_format) setDateFormat(data.date_format);
      }

      await loadSubscriptionStatus(session.user.id);
      setLoading(false);
    };

    loadSettings();
  }, [loadSubscriptionStatus]);

  const handleSaveSettings = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error("Please log in again.");
      return;
    }
    setSavingSettings(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: session.user.id,
        resume_language: resumeLanguage,
        date_format: dateFormat,
      });
      if (error) throw error;
      toast.success("Settings saved.");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save settings.";
      toast.error(message);
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    if (!paymentPollingPlanName || !currentUserId) return;

    let attempts = 0;
    const maxAttempts = 150;

    const stopPolling = () => {
      if (pollingIntervalRef.current) {
        window.clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setPaymentPollingPlanName(null);
      setPlanActionLoading(null);
    };

    const pollSubscription = async () => {
      try {
        attempts += 1;
        const response = await fetch(`/api/subscription?userId=${currentUserId}`);
        const json = await response.json();
        if (response.ok) {
          setSubscription(mapSubscriptionView(json.data || null));
          if (json.data?.status === "active") {
            stopPolling();
            toast.success(`${paymentPollingPlanName} plan activated.`);
            await onSubscriptionChange?.();
            return;
          }
        }

        if (attempts >= maxAttempts) {
          stopPolling();
          toast.info("Payment is still pending. Refresh after completing payment.");
        }
      } catch (error) {
        console.error("Failed to poll subscription status:", error);
      }
    };

    pollSubscription();
    pollingIntervalRef.current = window.setInterval(pollSubscription, 4000);

    return () => {
      if (pollingIntervalRef.current) {
        window.clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [currentUserId, onSubscriptionChange, paymentPollingPlanName]);

  const handleSelectPlan = async (planKey: string) => {
    const plan = SUBSCRIPTION_PLANS.find((item) => item.key === planKey);
    if (!plan) {
      toast.error("Invalid plan selected.");
      return;
    }
    if (!currentUserId) {
      toast.error("Please log in again.");
      return;
    }

    setPlanActionLoading(plan.key);
    let startedPolling = false;
    try {
      const response = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          planKey: plan.key,
          planId: plan.planId,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        toast(json.error || "Unable to start payment.");
        return;
      } else {
        window.open(json.url);
      }

      startedPolling = true;
      setPaymentPollingPlanName(plan.name);
      toast.info("Complete payment in Razorpay. We'll activate your plan automatically.");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unable to start subscription.";
      toast.error(message);
    } finally {
      if (!startedPolling) {
        setPlanActionLoading(null);
      }
    }
  };

  const handleClearHistory = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error("Please log in again.");
      return;
    }
    const confirmed = await swal({
      title: "Delete all scan history?",
      text: "This cannot be undone.",
      icon: "warning",
      buttons: ["Cancel", "Delete"],
      dangerMode: true,
    });
    if (!confirmed) return;
    setClearingHistory(true);
    try {
      const response = await fetch(
        `/api/job-tracker?userId=${session.user.id}&all=true`,
        { method: "DELETE" }
      );
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "Failed to delete history.");
      }
      toast.success("Scan history deleted.");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to delete history.";
      toast.error(message);
    } finally {
      setClearingHistory(false);
    }
  };

  const handleUnsubscribe = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error("Please log in again.");
      return;
    }

    const confirmed = await swal({
      title: "Unsubscribe?",
      text: "This will cancel your current plan.",
      icon: "warning",
      buttons: ["Cancel", "Unsubscribe"],
      dangerMode: true,
    });
    if (!confirmed) return;

    setUnsubscribing(true);
    try {
      const response = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "Failed to cancel subscription.");
      }
      await loadSubscriptionStatus(session.user.id);
      await onSubscriptionChange?.();
      toast.success("You have been unsubscribed.");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to unsubscribe.";
      toast.error(message);
    } finally {
      setUnsubscribing(false);
    }
  };

  const handleDeleteAccount = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error("Please log in again.");
      return;
    }
    const confirmed = await swal({
      title: "Delete account?",
      text: "This will delete your account and all associated data.",
      icon: "warning",
      buttons: ["Cancel", "Delete"],
      dangerMode: true,
    });
    if (!confirmed) return;

    setDeletingAccount(true);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || "Failed to delete account.");
      }
      await supabase.auth.signOut();
      toast.success("Account deleted.");
      router.push("/");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to delete account.";
      toast.error(message);
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">
          Control your preferences and privacy options.
        </p>
      </div>

      <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-600">
            Resume language
          </label>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            value={resumeLanguage}
            onChange={(e) => setResumeLanguage(e.target.value)}
            disabled={loading}
          >
            {languageOptions.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-600">
            Date format
          </label>
          <select
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value)}
            disabled={loading}
          >
            {dateFormats.map((fmt) => (
              <option key={fmt} value={fmt}>
                {fmt}
              </option>
            ))}
          </select>
        </div>

        <Button
          className="rounded-full"
          onClick={handleSaveSettings}
          disabled={savingSettings}
        >
          {savingSettings ? "Saving..." : "Save settings"}
        </Button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Data controls</h2>
        <p className="mt-2 text-sm text-slate-500">
          Remove your saved scan history from the job tracker.
        </p>
        <Button
          variant="outline"
          className="mt-4 rounded-full"
          onClick={handleClearHistory}
          disabled={clearingHistory}
        >
          {clearingHistory ? "Deleting..." : "Delete all scan history"}
        </Button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Plans</h2>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="mt-2 text-sm text-slate-500">
            Current plan:{" "}
            <span className="font-medium text-slate-900">
              {subscriptionLoading
                ? "Loading..."
                : subscription.hasActivePlan
                ? subscription.planName
                : "Free"}
            </span>
            {!subscriptionLoading && subscription.status !== "none" ? (
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                {subscription.status}
              </span>
            ) : null}
          </p>
          {subscription.hasActivePlan ? (
            <Button
              variant="outline"
              className="rounded-full"
              onClick={handleUnsubscribe}
              disabled={unsubscribing}
            >
              {unsubscribing ? "Unsubscribing..." : "Unsubscribe"}
            </Button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrent = subscription.planKey === plan.key && subscription.hasActivePlan;
            let cta = `Choose ${plan.name}`;
            if (isCurrent) {
              cta = "Current plan";
            } else if (subscription.planKey === "speed" && plan.key === "pro") {
              cta = "Upgrade to Pro";
            } else if (subscription.planKey === "pro" && plan.key === "speed") {
              cta = "Switch to Speed";
            }

            return (
              <div
                key={plan.key}
                className={cn(
                  "rounded-2xl border border-slate-200 p-4",
                  isCurrent && "border-slate-900 bg-slate-50"
                )}
              >
                <h3 className="text-base font-semibold text-slate-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">₹{plan.priceInr}</p>
                <p className="text-xs text-slate-500">per month</p>
                <Button
                  className="mt-4 w-full rounded-full"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || planActionLoading === plan.key}
                  onClick={() => handleSelectPlan(plan.key)}
                >
                  {planActionLoading === plan.key ? "Processing..." : cta}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-3xl border border-red-100 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-900">Danger zone</h2>
        <p className="mt-2 text-sm text-red-700">
          Delete your account and all associated data. This action cannot be
          undone.
        </p>
        <Button
          variant="destructive"
          className="mt-4 rounded-full"
          onClick={handleDeleteAccount}
          disabled={deletingAccount}
        >
          {deletingAccount ? "Deleting..." : "Delete account"}
        </Button>
      </div>
    </section>
  );
};
