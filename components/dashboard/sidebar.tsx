"use client";

import { cn } from "@/lib/utils";
import {
  ScanLine,
  BriefcaseBusiness,
  UserRound,
  SettingsIcon,
} from "lucide-react";

// "Create CV from Scratch" is intentionally omitted from the sidebar — the base
// resume replaces it as the single source of truth. The component and its
// ?section=create-cv route are kept in case it needs to return.
export const DASHBOARD_SECTIONS = [
  { id: "scan", label: "Scan Resume", icon: ScanLine },
  { id: "base-resume", label: "Base Resume", icon: UserRound },
  { id: "job-tracker", label: "Job Tracker", icon: BriefcaseBusiness },
  { id: "settings", label: "Settings", icon: SettingsIcon },
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
