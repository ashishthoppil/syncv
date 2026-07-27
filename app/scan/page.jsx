"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  DashboardSidebar,
  DASHBOARD_SECTIONS,
} from "@/components/dashboard/sidebar";
import { ScanSection } from "@/components/dashboard/scan-section";
import { CreateCvSection } from "@/components/dashboard/create-cv-section";
import { JobTrackerSection } from "@/components/dashboard/job-tracker-section";
import { SettingsSection } from "@/components/dashboard/settings-section";
import { BaseResumeSection } from "@/components/dashboard/base-resume-section";
import { Loader2, LogOut, LayoutDashboard } from "lucide-react";
import { toast } from "react-toastify";
import { Logo } from "@/components/navbar/logo";

// "create-cv" and legacy "profile" are kept in the map so their routes still
// resolve, but only the entries in DASHBOARD_SECTIONS appear in the sidebar.
const sectionMap = {
  scan: ScanSection,
  "create-cv": CreateCvSection,
  "base-resume": BaseResumeSection,
  profile: BaseResumeSection,
  "job-tracker": JobTrackerSection,
  settings: SettingsSection,
};

const sectionLabels = {
  scan: "Scan",
  "create-cv": "Create CV from Scratch",
  "base-resume": "Base Resume",
  profile: "Base Resume",
  "job-tracker": "Job Tracker",
  settings: "Settings",
};

const Loading = () => (
  <div className="flex min-h-screen items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
  </div>
);

const DashboardPageContent = () => {
  const [activeSection, setActiveSection] = useState("scan");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState({
    hasActivePlan: false,
    planKey: null,
    planName: null,
    status: "none",
    allowsJobTracker: false,
    allowsCoverLetter: false,
    weeklyScanLimit: 0,
    scansUsedThisWeek: 0,
    scansRemainingThisWeek: 0,
    freeTrialLimit: 0,
    freeTrialUsed: 0,
    freeTrialRemaining: 0,
    canScan: false,
  });
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  // silent: refresh in the background without flipping the loading flag, so
  // the header badge and subscription-locked UI don't flicker mid-session.
  const refreshSubscription = async (userId, { silent = false } = {}) => {
    if (!userId) return;
    if (!silent) setSubscriptionLoading(true);
    try {
      const response = await fetch(`/api/subscription/status?userId=${userId}`);
      const json = await response.json();
      if (response.ok) {
        const subscriptionData = json?.data || {};
        setSubscription({
          hasActivePlan: Boolean(subscriptionData.hasActivePlan),
          planKey: subscriptionData.planKey || null,
          planName: subscriptionData.planName || null,
          status: String(subscriptionData.status || "none"),
          allowsJobTracker: Boolean(subscriptionData.allowsJobTracker),
          allowsCoverLetter: Boolean(subscriptionData.allowsCoverLetter),
          weeklyScanLimit: Number(subscriptionData.weeklyScanLimit || 0),
          scansUsedThisWeek: Number(subscriptionData.scansUsedThisWeek || 0),
          scansRemainingThisWeek: Number(subscriptionData.scansRemainingThisWeek || 0),
          freeTrialLimit: Number(subscriptionData.freeTrialLimit || 0),
          freeTrialUsed: Number(subscriptionData.freeTrialUsed || 0),
          freeTrialRemaining: Number(subscriptionData.freeTrialRemaining || 0),
          canScan: Boolean(subscriptionData.canScan),
        });
      } else if (!silent) {
        setSubscription({
          hasActivePlan: false,
          planKey: null,
          planName: null,
          status: "none",
          allowsJobTracker: false,
          allowsCoverLetter: false,
          weeklyScanLimit: 0,
          scansUsedThisWeek: 0,
          scansRemainingThisWeek: 0,
          freeTrialLimit: 0,
          freeTrialUsed: 0,
          freeTrialRemaining: 0,
          canScan: false,
        });
      }
    } catch (error) {
      console.error("Failed to fetch subscription status:", error);
      // A failed silent refresh keeps the last known subscription state.
      if (!silent) {
        setSubscription({
          hasActivePlan: false,
          planKey: null,
          planName: null,
          status: "none",
          allowsJobTracker: false,
          allowsCoverLetter: false,
          weeklyScanLimit: 0,
          scansUsedThisWeek: 0,
          scansRemainingThisWeek: 0,
          freeTrialLimit: 0,
          freeTrialUsed: 0,
          freeTrialRemaining: 0,
          canScan: false,
        });
      }
    } finally {
      if (!silent) setSubscriptionLoading(false);
    }
  };

  useEffect(() => {
    const ensureSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      setUser(session.user);
      await refreshSubscription(session.user.id);
      setLoading(false);
    };

    ensureSession();
  }, [router]);

  useEffect(() => {
    const sectionFromQuery = searchParams?.get("section");
    if (
      sectionFromQuery &&
      sectionMap[sectionFromQuery] &&
      (sectionFromQuery !== "job-tracker" || subscription.allowsJobTracker)
    ) {
      setActiveSection(sectionFromQuery);
    } else if (sectionFromQuery === "job-tracker" && !subscription.allowsJobTracker) {
      setActiveSection("settings");
      router.replace("/scan?section=settings");
    }
  }, [searchParams, subscription.allowsJobTracker, router]);

  useEffect(() => {
    const scrollTarget = searchParams?.get("scrollTo");
    if (!scrollTarget || activeSection !== "settings") return;

    window.requestAnimationFrame(() => {
      document.getElementById(scrollTarget)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [activeSection, searchParams]);

  const handleSectionChange = (sectionId) => {
    if (sectionId === "job-tracker" && !subscription.allowsJobTracker) {
      setActiveSection("settings");
      router.replace("/scan?section=settings");
      return;
    }
    setActiveSection(sectionId);
    const query = sectionId === "scan" ? "" : `?section=${sectionId}`;
    router.replace(`/scan${query}`);
  };

  const renderSection = () => {
    // Free-trial users can scan until their allowance is exhausted; paid users
    // until their plan lapses. Only lock once neither path grants access.
    const subscriptionLocked = subscriptionLoading || !subscription.canScan;

    if (activeSection === "scan") {
      return (
        <ScanSection
          subscriptionLocked={subscriptionLocked}
          planKey={subscription.planKey}
          allowsCoverLetter={subscription.allowsCoverLetter}
          onUsageChange={() => refreshSubscription(user?.id, { silent: true })}
        />
      );
    }
    if (activeSection === "create-cv") {
      return <CreateCvSection />;
    }
    if (activeSection === "base-resume" || activeSection === "profile") {
      return <BaseResumeSection user={user} />;
    }
    if (activeSection === "job-tracker") {
      return <JobTrackerSection subscriptionLocked={subscriptionLocked || !subscription.allowsJobTracker} />;
    }
    if (activeSection === "settings") {
      return <SettingsSection onSubscriptionChange={() => refreshSubscription(user?.id)} />;
    }
    return (
      <ScanSection
        subscriptionLocked={subscriptionLocked}
        planKey={subscription.planKey}
        allowsCoverLetter={subscription.allowsCoverLetter}
        onUsageChange={() => refreshSubscription(user?.id, { silent: true })}
      />
    );
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Unable to log you out. Please try again.");
      return;
    }
    toast.info("Logged out.");
    router.push("/");
  };

  if (loading) {
    return <Loading />;
  }

  const visibleSections = DASHBOARD_SECTIONS.filter(
    (section) => section.id !== "job-tracker" || subscription.allowsJobTracker
  );
  // Paid users see their weekly balance; free-trial users see trial scans left.
  const scansRemaining = subscription.hasActivePlan
    ? Number(subscription.scansRemainingThisWeek || 0)
    : Number(subscription.freeTrialRemaining || 0);
  const scansRemainingLabel = subscriptionLoading
    ? "Loading scans"
    : subscription.hasActivePlan
    ? `${scansRemaining} scan${scansRemaining === 1 ? "" : "s"} left`
    : `${scansRemaining} free scan${scansRemaining === 1 ? "" : "s"} left`;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden lg:flex lg:w-64 flex-col border-r border-slate-200 bg-white/90 px-4 py-6 backdrop-blur sticky top-0 h-screen">
        <div className="flex items-center gap-2 px-2">
          <Logo />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 px-2">
          Dashboard
        </p>
        <DashboardSidebar
          activeSection={activeSection}
          onSelect={handleSectionChange}
          sections={visibleSections}
        />
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold text-slate-900">
              {sectionLabels[activeSection] || "Dashboard"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="hidden sm:inline-flex whitespace-nowrap border-slate-200 bg-slate-50 px-3 py-1 text-slate-700"
            >
              {scansRemainingLabel}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => handleSectionChange("scan")}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
            <Button variant="outline" size="sm" className="gap-2 rounded-md shadow-md" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-10 pt-6 lg:px-10">
          <div className="mb-6 space-y-3 lg:hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Sections
            </p>
            <div className="flex flex-wrap gap-2">
              {visibleSections.map((section) => (
                <Button
                  key={section.id}
                  variant={activeSection === section.id ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => handleSectionChange(section.id)}
                >
                  {section.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="mt-4">{renderSection()}</div>
        </main>
      </div>
    </div>
  );
};

export default function DashboardPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DashboardPageContent />
    </Suspense>
  );
}
