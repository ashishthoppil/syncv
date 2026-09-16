"use client";

import { cn } from "@/lib/utils";
import {
  ScanLine,
  BriefcaseBusiness,
  UserRound,
  SettingsIcon,
  LifeBuoy,
} from "lucide-react";

// "Create CV from Scratch" is intentionally omitted from the sidebar — the base
// resume replaces it as the single source of truth. The component and its
// ?section=create-cv route are kept in case it needs to return.
//
// `shortLabel` is what the mobile tab bar shows: five tabs share a 360px row,
// so each caption has to survive at ~64px wide without wrapping or truncating.
export const DASHBOARD_SECTIONS = [
  { id: "scan", label: "Scan Resume", shortLabel: "Scan", icon: ScanLine },
  { id: "base-resume", label: "Base Resume", shortLabel: "Resume", icon: UserRound },
  { id: "job-tracker", label: "Job Tracker", shortLabel: "Jobs", icon: BriefcaseBusiness },
  { id: "help-center", label: "Help Center", shortLabel: "Help", icon: LifeBuoy },
  { id: "settings", label: "Settings", shortLabel: "Settings", icon: SettingsIcon },
];

export const DashboardSidebar = ({
  activeSection,
  onSelect,
  sections = DASHBOARD_SECTIONS,
}: {
  activeSection: string;
  onSelect: (section: string) => void;
  sections?: typeof DASHBOARD_SECTIONS;
}) => {
  return (
    <nav className="flex flex-1 flex-col gap-2 mt-6">
      {sections.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            className={cn(
              "flex items-center gap-3 rounded-md px-4 py-3 text-sm font-medium transition-colors",
              isActive
                ? "bg-slate-900 text-white shadow-lg"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <Icon className="h-4 w-4" />
            {section.label}
          </button>
        );
      })}
    </nav>
  );
};

/**
 * The phone counterpart to DashboardSidebar: a fixed bottom tab bar, the
 * navigation pattern every native app on the device already uses. It replaces
 * the old wrapped row of pills, which pushed the actual content down the page
 * and scrolled away the moment you started reading.
 *
 * Rendered as a sibling of the scroll container (not inside it) so it stays put
 * while content moves, and hidden at `lg` where the sidebar takes over.
 */
export const DashboardTabBar = ({
  activeSection,
  onSelect,
  sections = DASHBOARD_SECTIONS,
}: {
  activeSection: string;
  onSelect: (section: string) => void;
  sections?: typeof DASHBOARD_SECTIONS;
}) => {
  return (
    <nav
      aria-label="Dashboard sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-safe lg:hidden"
    >
      <div className="flex items-stretch">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSelect(section.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-1 select-none flex-col items-center justify-center gap-1 px-1 pb-2 pt-2.5 text-[10px] font-medium transition-colors active:bg-slate-100",
                isActive ? "text-slate-900" : "text-slate-500"
              )}
            >
              <Icon
                className={cn("h-5 w-5 shrink-0", isActive ? "stroke-[2.25]" : "stroke-2")}
              />
              <span className="w-full truncate text-center leading-none">
                {section.shortLabel}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
