"use client";

import { cn } from "@/lib/utils";
import {
  ScanLine,
  BriefcaseBusiness,
  Settings2,
  UserRound,
} from "lucide-react";

export const DASHBOARD_SECTIONS = [
  { id: "scan", label: "Scan", icon: ScanLine },
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "job-tracker", label: "Job Tracker", icon: BriefcaseBusiness },
  { id: "settings", label: "Settings", icon: Settings2 },
];

export const DashboardSidebar = ({
  activeSection,
  onSelect,
}: {
  activeSection: string;
  onSelect: (section: string) => void;
}) => {
  return (
    <nav className="flex flex-1 flex-col gap-2 mt-6">
      {DASHBOARD_SECTIONS.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onSelect(section.id)}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
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
