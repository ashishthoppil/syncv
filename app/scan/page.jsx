"use client";

import { Button } from "@/components/ui/button";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  DashboardSidebar,
  DASHBOARD_SECTIONS,
} from "@/components/dashboard/sidebar";
import { ScanSection } from "@/components/dashboard/scan-section";
import { JobTrackerSection } from "@/components/dashboard/job-tracker-section";
import { SettingsSection } from "@/components/dashboard/settings-section";
import { ProfileSection } from "@/components/dashboard/profile-section";
import { Loader2, LogOut, LayoutDashboard } from "lucide-react";
import { toast } from "react-toastify";
import { Logo } from "@/components/navbar/logo";

const sectionMap = {
  scan: ScanSection,
  profile: ProfileSection,
  "job-tracker": JobTrackerSection,
  settings: SettingsSection,
};

const sectionLabels = {
  scan: "Scan",
  profile: "Profile",
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
  });
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const router = useRouter();
  const searchParams = useSearchParams();

  const refreshSubscription = async (userId) => {
    if (!userId) return;
    setSubscriptionLoading(true);
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
        });
      } else {
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
        });
      }
    } catch (error) {
      console.error("Failed to fetch subscription status:", error);
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
      });
    } finally {
      setSubscriptionLoading(false);
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
    const subscriptionLocked = subscriptionLoading || !subscription.hasActivePlan;

    if (activeSection === "scan") {
      return (
        <ScanSection
          subscriptionLocked={subscriptionLocked}
          planKey={subscription.planKey}
          allowsCoverLetter={subscription.allowsCoverLetter}
        />
      );
    }
    if (activeSection === "profile") {
      return <ProfileSection user={user} />;
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
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => handleSectionChange("scan")}
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleLogout}>
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
