"use client";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import swal from "sweetalert";

export const SettingsSection = () => {
  const router = useRouter();
  const [resumeLanguage, setResumeLanguage] = useState("English");
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");
  const [savingSettings, setSavingSettings] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [unsubscribing, setUnsubscribing] = useState(false);
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

      const { data, error } = await supabase
        .from("profiles")
        .select("resume_language, date_format, plan")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!error && data) {
        if (data.resume_language) setResumeLanguage(data.resume_language);
        if (data.date_format) setDateFormat(data.date_format);
      }
      setLoading(false);
    };

    loadSettings();
  }, []);

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
      const { error } = await supabase.from("profiles").upsert({
        id: session.user.id,
        plan: null,
      });
      if (error) throw error;
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
        <h2 className="text-lg font-semibold text-slate-900">Plan</h2>
        <div className="flex justify-between items-center ">
          <p className="mt-2 text-sm text-slate-500">
            Current plan: <span className="font-medium text-slate-900">Free</span>
          </p>
          <Button
            variant="outline"
            className="mt-4 rounded-full"
            onClick={handleUnsubscribe}
            disabled={unsubscribing}
          >
            {unsubscribing ? "Unsubscribing..." : "Unsubscribe"}
          </Button>
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
