import {
  Blocks,
  Bot,
  ChartPie,
  Film,
  MessageCircle,
  Settings2,
} from "lucide-react";
import React from "react";

const features = [
  {
    icon: Settings2,
    title: "Fast Resume Scans",
    description:
      "Upload your resume and get clear, actionable feedback in minutes so you can apply quickly with confidence.",
  },
  {
    icon: Blocks,
    title: "Rapid Resume Improvements",
    description:
      "Improve bullets, summaries, and skills alignment in a few clicks and save hours of manual editing.",
  },
  {
    icon: Bot,
    title: "One-Click Resume & Cover Letter Builder",
    description:
      "Paste a job description and generate a targeted resume and cover letter instantly, ready to download and send.",
  },
  {
    icon: Film,
    title: "Smart Match Breakdown",
    description:
      "See match score, keyword coverage, and section-level insights at a glance to fix weak spots faster.",
  },
  {
    icon: ChartPie,
    title: "Seamless Job Tracking",
    description:
      "Track all your applications in one place and stay on top of interviews, follow-ups, and next steps.",
  },
  {
    icon: MessageCircle,
    title: "Quick Job Description Analysis",
    description:
      "Break down any job description in seconds and focus your resume on what each role actually needs.",
  },
];

const Features = () => {
  return (
    <div id="features" className="w-full py-12 xs:py-20 px-6">
      <h2 className="text-3xl xs:text-4xl sm:text-5xl font-bold tracking-tight text-center">
        Apply Faster. Get Better Results.
      </h2>
      <div className="w-full max-w-screen-lg mx-auto mt-10 sm:mt-16 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="flex flex-col bg-background border rounded-xl py-6 px-5"
          >
            <div className="mb-3 h-10 w-10 flex items-center justify-center bg-muted rounded-full">
              <feature.icon className="h-6 w-6" />
            </div>
            <span className="text-lg font-semibold">{feature.title}</span>
            <p className="mt-1 text-foreground/80 text-[15px]">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Features;
