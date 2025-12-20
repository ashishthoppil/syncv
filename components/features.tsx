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
    title: "Instant ATS Scoring",
    description:
      "Get real-time feedback on your resume’s compatibility with job descriptions. Instantly see what recruiters and ATS systems will think and how to improve it.",
  },
  {
    icon: Blocks,
    title: "AI-Powered Resume Suggestions",
    description:
      "Leverage AI to rewrite bullet points, summarize experience, and match keywords, all aligned with the job you're targeting. Save hours of editing.",
  },
  {
    icon: Bot,
    title: "One-Click Resume & Cover Letter Generation",
    description:
      "Paste a job description and let our AI craft a tailored resume and cover letter that stands out. Download them instantly in clean, ATS-friendly formats.",
  },
  {
    icon: Film,
    title: "Smart Match Analytics",
    description:
      "Visualize your resume’s performance with match scores, keyword coverage, and section-wise feedback. Make data-driven improvements easily.",
  },
  {
    icon: ChartPie,
    title: "Seamless Job Tracking",
    description:
      "Organize and track all your job applications in one place. Monitor application status, interview stages, and follow-ups effortlessly, no spreadsheets needed.",
  },
  {
    icon: MessageCircle,
    title: "Job Description Analyzer",
    description:
      "Paste any job description and let the AI break it down, highlighting must-have keywords, skills, and qualifications so you know exactly what to tailor in your resume.",
  },
];

const Features = () => {
  return (
    <div id="features" className="w-full py-12 xs:py-20 px-6">
      <h2 className="text-3xl xs:text-4xl sm:text-5xl font-bold tracking-tight text-center">
        Land Jobs Faster with Smarter Resumes
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
