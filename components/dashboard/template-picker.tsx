"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { RESUME_TEMPLATE_CONFIGS } from "@/components/resume-templates/config";
import type { ResumeTemplateId } from "@/components/resume-templates/types";
import {
  renderResumeFromData,
  type ResumeData,
} from "@/components/resume-templates/render";

// A representative resume used to render authentic template thumbnails — every
// template renders the SAME content, so the only difference the user sees is
// the template's styling. It's long enough to fill the portrait crop.
const SAMPLE_RESUME: ResumeData = {
  contact: {
    email: "alex.morgan@email.com",
    phone: "+1 555 0100",
    location: "San Francisco, CA",
    links: [{ url: "linkedin.com/in/alexmorgan" }],
  },
  summary:
    "Product-focused engineer with 6 years building scalable web applications and leading small teams to ship reliably and fast.",
  skills: [
    "Frontend: React, TypeScript, Next.js",
    "Backend: Node.js, PostgreSQL",
    "Cloud: AWS, Docker, CI/CD",
  ],
  experience: [
    {
      designation: "Senior Software Engineer",
      company: "Acme Corp",
      location: "San Francisco, CA",
      duration: "2021 - Present",
      responsibilities: [
        "Led migration to a modular architecture, cutting build times by 40%.",
        "Mentored 4 engineers and raised code-quality standards across the team.",
        "Shipped a design-system refresh adopted by 6 product squads.",
      ],
    },
    {
      designation: "Software Engineer",
      company: "Beta Inc",
      location: "New York, NY",
      duration: "2018 - 2021",
      responsibilities: [
        "Built customer-facing dashboards used by 10k+ monthly users.",
        "Cut API latency 35% by introducing caching and query tuning.",
      ],
    },
  ],
  projects: [
    {
      name: "Open Scheduler",
      responsibilities: ["Open-source calendar sync tool with 1.2k GitHub stars."],
    },
  ],
  education: [
    {
      qualification: "B.S. Computer Science",
      institution: "State University",
      location: "California",
      duration: "2014 - 2018",
      details: [],
    },
  ],
  certifications: ["AWS Certified Solutions Architect"],
  languages: ["English", "Spanish"],
};

// The templates render against an A4-ish page width; the thumbnail scales it to
// fit whatever width the responsive grid cell gives us.
const PAGE_WIDTH = 794;

const TemplateThumbnail = ({ templateId }: { templateId: ResumeTemplateId }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  const html = useMemo(
    () =>
      renderResumeFromData({
        data: SAMPLE_RESUME,
        templateId,
        candidateName: "Alex Morgan",
        designation: "Senior Software Engineer",
      }),
    [templateId]
  );

  // Scale the fixed-width page to exactly fill the (responsive) cell width.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width || 0;
      if (width) setScale(width / PAGE_WIDTH);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative aspect-[3/4] w-full overflow-hidden bg-white"
      aria-hidden
    >
      <div
        className="absolute left-0 top-0"
        style={{
          width: PAGE_WIDTH,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
          visibility: scale ? "visible" : "hidden",
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {/* Fade the clipped bottom so the cropped page doesn't look cut off. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />
    </div>
  );
};

export const ResumeTemplatePicker = ({
  selected,
  onSelect,
}: {
  selected: ResumeTemplateId;
  onSelect: (id: ResumeTemplateId) => void;
}) => (
  <div className="grid grid-cols-3 gap-3">
    {RESUME_TEMPLATE_CONFIGS.map((template) => {
      const active = selected === template.id;
      return (
        <button
          key={template.id}
          type="button"
          onClick={() => onSelect(template.id)}
          aria-pressed={active}
          className={cn(
            "group relative flex flex-col overflow-hidden rounded-xl border bg-white text-left transition",
            active
              ? "border-slate-900 shadow-md ring-2 ring-slate-900/10"
              : "border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
          )}
        >
          {active ? (
            <span className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-white shadow">
              <Check className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <div className="border-b border-slate-100">
            <TemplateThumbnail templateId={template.id} />
          </div>
          <div className="px-2.5 py-2 text-center">
            <span
              className={cn(
                "text-xs font-semibold",
                active ? "text-slate-900" : "text-slate-700"
              )}
            >
              {template.label}
            </span>
          </div>
        </button>
      );
    })}

    {/* Placeholder tile — more templates are on the way. */}
    <div className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3 text-center">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
        <Sparkles className="h-4 w-4" />
      </span>
      <span className="text-xs font-semibold text-slate-600">More on the way</span>
      <span className="text-[11px] leading-snug text-slate-400">
        New templates coming soon
      </span>
    </div>
  </div>
);
