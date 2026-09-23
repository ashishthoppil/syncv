"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  DashboardSidebar,
  DashboardTabBar,
  DASHBOARD_SECTIONS,
} from "@/components/dashboard/sidebar";
import { ScanSection } from "@/components/dashboard/scan-section";
import { CreateCvSection } from "@/components/dashboard/create-cv-section";
import { JobTrackerSection } from "@/components/dashboard/job-tracker-section";
import { SettingsSection } from "@/components/dashboard/settings-section";
import { BaseResumeSection } from "@/components/dashboard/base-resume-section";
import { HelpCenterSection } from "@/components/dashboard/help-center-section";
import { RemoteJobsSection } from "@/components/dashboard/remote-jobs-section";
import { SCAN_SOURCE_REMOTE_JOBS } from "@/lib/scan-sources";
import { Loader2, LogOut, LayoutDashboard } from "lucide-react";
import { toast } from "react-toastify";
import { Logo } from "@/components/navbar/logo";
import {
  ProductTourProvider,
  TourSectionSignal,
} from "@/components/onboarding/product-tour";
import { describeScanBalance } from "@/lib/subscription-plans";
import { OptimizationMeter } from "@/components/dashboard/optimization-meter";

// "create-cv" and legacy "profile" are kept in the map so their routes still
// resolve, but only the entries in DASHBOARD_SECTIONS appear in the sidebar.
const sectionMap = {
  scan: ScanSection,
  "create-cv": CreateCvSection,
  "base-resume": BaseResumeSection,
  profile: BaseResumeSection,
  "job-tracker": JobTrackerSection,
  "remote-jobs": RemoteJobsSection,
  "help-center": HelpCenterSection,
  settings: SettingsSection,
};

const sectionLabels = {
  scan: "Scan",
  "create-cv": "Create CV from Scratch",
  "base-resume": "Base Resume",
  profile: "Base Resume",
  "job-tracker": "Job Tracker",
  "remote-jobs": "Remote Jobs",
  "help-center": "Help Center",
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
    unlimitedScans: false,
    weeklyScanLimit: 0,
    scansUsedThisWeek: 0,
    scansRemainingThisWeek: 0,
    freeTrialLimit: 0,
    freeTrialUsed: 0,
    freeTrialRemaining: 0,
    canScan: false,
    optimizationUsage: null,
  });
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  // Set when a job is picked in Remote Jobs; the scan form seeds itself from it
  // on mount so the user never has to paste the JD by hand.
  const [scanPrefill, setScanPrefill] = useState(null);
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
          unlimitedScans: Boolean(subscriptionData.unlimitedScans),
          weeklyScanLimit: Number(subscriptionData.weeklyScanLimit || 0),
          scansUsedThisWeek: Number(subscriptionData.scansUsedThisWeek || 0),
          scansRemainingThisWeek: Number(subscriptionData.scansRemainingThisWeek || 0),
          freeTrialLimit: Number(subscriptionData.freeTrialLimit || 0),
          freeTrialUsed: Number(subscriptionData.freeTrialUsed || 0),
          freeTrialRemaining: Number(subscriptionData.freeTrialRemaining || 0),
          canScan: Boolean(subscriptionData.canScan),
          // Paid plan only: the day's optimizations and any break, for the header.
          optimizationUsage: subscriptionData.optimizationUsage || null,
        });
      } else if (!silent) {
        setSubscription({
          hasActivePlan: false,
          planKey: null,
          planName: null,
          status: "none",
          allowsJobTracker: false,
          allowsCoverLetter: false,
          unlimitedScans: false,
          weeklyScanLimit: 0,
          scansUsedThisWeek: 0,
          scansRemainingThisWeek: 0,
          freeTrialLimit: 0,
          freeTrialUsed: 0,
          freeTrialRemaining: 0,
          canScan: false,
          optimizationUsage: null,
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
          unlimitedScans: false,
          weeklyScanLimit: 0,
          scansUsedThisWeek: 0,
          scansRemainingThisWeek: 0,
          freeTrialLimit: 0,
          freeTrialUsed: 0,
          freeTrialRemaining: 0,
          canScan: false,
          optimizationUsage: null,
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

  // Base Resume is only available while the user can still scan — i.e. an active
  // Pro plan, or free-trial scans remaining. Once the trial is over with
  // no plan, it is hidden (like Job Tracker). Kept visible while loading to
  // avoid a flicker.
  const baseResumeLocked = !subscriptionLoading && !subscription.canScan;
  const isBaseResumeSection = (id) => id === "base-resume" || id === "profile";

  // The full Remote Jobs list is a paid capability: an active Pro
  // subscription. Free-trial users are not paid users here — they get the preview.
  // Held false while loading so the list can't flash open then lock.
  const hasRemoteJobsAccess = !subscriptionLoading && subscription.hasActivePlan;

  useEffect(() => {
    const sectionFromQuery = searchParams?.get("section");
    const jobTrackerBlocked =
      sectionFromQuery === "job-tracker" && !subscription.allowsJobTracker;
    const baseResumeBlocked = isBaseResumeSection(sectionFromQuery) && baseResumeLocked;
    if (
      sectionFromQuery &&
      sectionMap[sectionFromQuery] &&
      !jobTrackerBlocked &&
      !baseResumeBlocked
    ) {
      setActiveSection(sectionFromQuery);
    } else if (jobTrackerBlocked || baseResumeBlocked) {
      setActiveSection("settings");
      router.replace("/scan?section=settings");
    }
  }, [searchParams, subscription.allowsJobTracker, baseResumeLocked, router]);

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
    if (
      (sectionId === "job-tracker" && !subscription.allowsJobTracker) ||
      (isBaseResumeSection(sectionId) && baseResumeLocked)
    ) {
      setActiveSection("settings");
      router.replace("/scan?section=settings");
      return;
    }
    setActiveSection(sectionId);
    const query = sectionId === "scan" ? "" : `?section=${sectionId}`;
    router.replace(`/scan${query}`);
  };

  // Remote Jobs hands the selected posting to the existing scanner: it fills the
  // same three fields the user would otherwise type, then switches section. The
  // source rides along so the analysis is recorded as having started here.
  const handleScanRemoteJob = (prefill) => {
    setScanPrefill({ ...prefill, source: SCAN_SOURCE_REMOTE_JOBS });
    handleSectionChange("scan");
  };

  const renderSection = () => {
    // Free-trial users can scan until their allowance is exhausted; paid users
    // until their plan lapses. Only lock once neither path grants access.
    const subscriptionLocked = subscriptionLoading || !subscription.canScan;

    if (activeSection === "scan") {
      return (
        <ScanSection
          subscriptionLocked={subscriptionLocked}
          allowsCoverLetter={subscription.allowsCoverLetter}
          allowsJobTracker={subscription.allowsJobTracker}
          onUsageChange={() => refreshSubscription(user?.id, { silent: true })}
          optimizationUsage={subscription.hasActivePlan ? subscription.optimizationUsage : null}
          prefill={scanPrefill}
          onPrefillConsumed={() => setScanPrefill(null)}
        />
      );
    }
    if (activeSection === "create-cv") {
      return <CreateCvSection />;
    }
    if (isBaseResumeSection(activeSection) && !baseResumeLocked) {
      return <BaseResumeSection user={user} />;
    }
    if (activeSection === "job-tracker") {
      return <JobTrackerSection subscriptionLocked={subscriptionLocked || !subscription.allowsJobTracker} />;
    }
    // Reachable while a user still has a scan to spend — discovering a job is
    // what leads them into the scanner, so the trial keeps browsing. Two gates,
    // not one: without an active Pro plan the list stops after the
    // first few results, and once the free trial is spent it stops entirely,
    // since a job you can't scan is a dead end.
    if (activeSection === "remote-jobs") {
      return (
        <RemoteJobsSection
          userId={user?.id}
          hasFullAccess={hasRemoteJobsAccess}
          locked={subscriptionLocked}
          onScanJob={handleScanRemoteJob}
        />
      );
    }
    // Deliberately not subscription-gated — support has to stay reachable when
    // a plan lapses, which is exactly when people need it.
    if (activeSection === "help-center") {
      return <HelpCenterSection user={user} />;
    }
    if (activeSection === "settings") {
      return <SettingsSection onSubscriptionChange={() => refreshSubscription(user?.id)} />;
    }
    return (
      <ScanSection
        subscriptionLocked={subscriptionLocked}
        allowsCoverLetter={subscription.allowsCoverLetter}
        allowsJobTracker={subscription.allowsJobTracker}
        onUsageChange={() => refreshSubscription(user?.id, { silent: true })}
        optimizationUsage={subscription.hasActivePlan ? subscription.optimizationUsage : null}
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

  const visibleSections = DASHBOARD_SECTIONS.filter((section) => {
    if (section.id === "job-tracker") return subscription.allowsJobTracker;
    if (section.id === "base-resume") return !baseResumeLocked;
    return true;
  });
  // Pro sees "Unlimited scans"; free-trial users see trial scans left.
  const scanBalance = describeScanBalance(subscription);
  const scansRemainingLabel = subscriptionLoading ? "Loading scans" : scanBalance.label;
  // The app bar is title + balance + sign-out on a 360px row, so the badge
  // drops to a short form on phones and keeps the full sentence from `sm` up.
  const scansRemainingShortLabel = subscriptionLoading ? "…" : scanBalance.short;

  const dashboard = (
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

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Mobile: a real app bar — title on the left, balance and sign-out as a
            compact icon on the right. Section switching lives in the tab bar
            below, so the old "Dashboard" button is desktop-only. */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white pt-safe shadow-sm">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="truncate text-base font-semibold text-slate-900 lg:text-lg">
                {sectionLabels[activeSection] || "Dashboard"}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* Paid users: optimizations today and any break timer. Scans
                  are unlimited on the paid plan, so there's no balance to show.
                  Everyone else keeps the scans-left badge. */}
              {!subscriptionLoading &&
              subscription.hasActivePlan &&
              subscription.optimizationUsage ? (
                <OptimizationMeter
                  usage={subscription.optimizationUsage}
                  onExpire={() => refreshSubscription(user?.id, { silent: true })}
                />
              ) : (
                <Badge
                  variant="outline"
                  className="whitespace-nowrap border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700 sm:px-3 sm:text-xs"
                >
                  <span className="sm:hidden">{scansRemainingShortLabel}</span>
                  <span className="hidden sm:inline">{scansRemainingLabel}</span>
                </Badge>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="hidden gap-2 lg:inline-flex"
                onClick={() => handleSectionChange("scan")}
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Log out"
                className="h-9 w-9 rounded-md shadow-md lg:hidden"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="hidden gap-2 rounded-md shadow-md lg:inline-flex"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </header>

        {/* Bottom padding = tab bar height + home indicator, so the last control
            in any section is never trapped underneath the bar. */}
        <main className="flex-1 overflow-y-auto px-4 pt-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:px-10 lg:pb-10">
          {renderSection()}
        </main>
      </div>

      <DashboardTabBar
        activeSection={activeSection}
        onSelect={handleSectionChange}
        sections={visibleSections}
      />
    </div>
  );

  return (
    <ProductTourProvider userId={user?.id}>
      {/* The first-run tour's opening steps are anchored to sections, so it has
          to know which one the user is looking at. */}
      <TourSectionSignal section={activeSection} />
      {dashboard}
    </ProductTourProvider>
  );
};

export default function DashboardPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DashboardPageContent />
    </Suspense>
  );
}
