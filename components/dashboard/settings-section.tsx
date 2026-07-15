"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import swal from "sweetalert";
import {
  AlertOctagonIcon,
  CalendarDays,
  CircleCheck,
  CircleHelp,
  CircleX,
  CreditCard,
  Database,
  Languages,
  Loader2,
  PlusCircleIcon,
  SaveIcon,
  Settings,
  Trash2Icon,
  // UserMinus,
} from "lucide-react";

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

type PlanFeature = {
  title: string;
  tooltip?: string;
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
  // const [unsubscribing, setUnsubscribing] = useState(false);
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
  const isUnavailableFeature = (feature: PlanFeature) =>
    feature.title === "No job tracker" || feature.title === "No cover letter generation";

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

  // const handleUnsubscribe = async () => {
  //   const {
  //     data: { session },
  //   } = await supabase.auth.getSession();
  //   if (!session?.user) {
  //     toast.error("Please log in again.");
  //     return;
  //   }

  //   const confirmed = await swal({
  //     title: "Unsubscribe?",
  //     text: "This will cancel your current plan.",
  //     icon: "warning",
  //     buttons: ["Cancel", "Unsubscribe"],
  //     dangerMode: true,
  //   });
  //   if (!confirmed) return;

  //   // setUnsubscribing(true);
  //   try {
  //     const response = await fetch("/api/subscription/cancel", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ userId: session.user.id }),
  //     });
  //     const result = await response.json();
  //     if (!result.success) {
  //       throw new Error(result.message || "Failed to cancel subscription.");
  //     }
  //     await loadSubscriptionStatus(session.user.id);
  //     await onSubscriptionChange?.();
  //     toast.success("You have been unsubscribed.");
  //   } catch (error: unknown) {
  //     const message =
  //       error instanceof Error ? error.message : "Failed to unsubscribe.";
  //     toast.error(message);
  //   } finally {
  //     // setUnsubscribing(false);
  //     console.log('Nothing to see here')
  //   }
  // };

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
    <section className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
          <Settings className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500">Control your preferences and privacy options.</p>
        </div>
      </div>

      {/* Preferences */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900/5 text-slate-700">
            <Settings className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-slate-900">Preferences</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <Languages className="h-3.5 w-3.5" /> Resume language
            </label>
            <div className="relative">
              <select
                className="w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-3 py-2 pr-16 text-sm text-slate-500 outline-none"
                value={resumeLanguage}
                onChange={(e) => setResumeLanguage(e.target.value)}
                disabled={true}
              >
                {languageOptions.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-7 top-1/2 -translate-y-1/2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Soon
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <CalendarDays className="h-3.5 w-3.5" /> Date format
            </label>
            <select
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
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
        </div>

        <div className="mt-4">
          <Button className="rounded-md" onClick={handleSaveSettings} disabled={savingSettings}>
            {savingSettings ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <SaveIcon className="mr-2 h-4 w-4" />
            )}
            {savingSettings ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </div>

      {/* Data controls */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900/5 text-slate-700">
            <Database className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Data controls</h2>
            <p className="text-sm text-slate-500">
              Remove your saved scan history from the job tracker.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="shrink-0 rounded-md"
          onClick={handleClearHistory}
          disabled={clearingHistory}
        >
          {clearingHistory ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2Icon className="mr-2 h-4 w-4" />
          )}
          {clearingHistory ? "Deleting…" : "Delete all scan history"}
        </Button>
      </div>

      {/* Plans */}
      <div
        id="dashboard-pricing"
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900/5 text-slate-700">
              <CreditCard className="h-4 w-4" />
            </span>
            <h2 className="text-sm font-semibold text-slate-900">Plans</h2>
          </div>
          <p className="text-sm text-slate-500">
            Current plan:{" "}
            <span className="font-semibold text-slate-900">
              {subscriptionLoading
                ? "Loading…"
                : subscription.hasActivePlan
                ? subscription.planName
                : "Free"}
            </span>
            {!subscriptionLoading && subscription.status !== "none" ? (
              <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                {subscription.status}
              </span>
            ) : null}
          </p>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrent = subscription.planKey === plan.key && subscription.hasActivePlan;
            let cta = `Choose ${plan.name} plan`;
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
                  "relative rounded-xl border bg-white p-5 transition",
                  isCurrent
                    ? "border-slate-900 ring-1 ring-slate-900/10"
                    : "border-slate-200 hover:border-slate-300"
                )}
              >
                {isCurrent ? (
                  <span className="absolute right-4 top-4 rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Current
                  </span>
                ) : null}
                <h3 className="text-base font-semibold text-slate-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-slate-900">₹{plan.priceInr}</span>
                  <span className="text-xs font-medium text-slate-500">/ month</span>
                </div>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {plan.features.map((feature: PlanFeature) => {
                    const isUnavailable = isUnavailableFeature(feature);

                    return (
                      <li key={feature.title} className="flex items-start gap-2">
                        {isUnavailable ? (
                          <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                        ) : (
                          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        )}
                        <span
                          className={cn(
                            "leading-5",
                            isUnavailable ? "text-slate-400" : "text-slate-700"
                          )}
                        >
                          {feature.title}
                        </span>
                        {feature.tooltip ? (
                          <Tooltip>
                            <TooltipTrigger className="mt-0.5 cursor-help">
                              <CircleHelp className="h-4 w-4 text-slate-400" />
                            </TooltipTrigger>
                            <TooltipContent>{feature.tooltip}</TooltipContent>
                          </Tooltip>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                <Button
                  className="mt-5 w-full rounded-md"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || planActionLoading === plan.key}
                  onClick={() => handleSelectPlan(plan.key)}
                >
                  {planActionLoading === plan.key ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlusCircleIcon className="mr-2 h-4 w-4" />
                  )}
                  {planActionLoading === plan.key ? "Processing…" : cta}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Danger zone */}
      <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-100 text-rose-700">
            <AlertOctagonIcon className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-rose-900">Danger zone</h2>
            <p className="text-sm text-rose-700">
              Delete your account and all associated data. This action cannot be undone.
            </p>
          </div>
        </div>
        <Button
          variant="destructive"
          className="shrink-0 rounded-md"
          onClick={handleDeleteAccount}
          disabled={deletingAccount}
        >
          {deletingAccount ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2Icon className="mr-2 h-4 w-4" />
          )}
          {deletingAccount ? "Deleting…" : "Delete account"}
        </Button>
      </div>
    </section>
  );
};
