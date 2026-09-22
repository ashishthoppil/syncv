import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/ui/reveal";
import {
  FileSearch,
  FileText,
  Gauge,
  SquareKanban,
  WandSparkles,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Fast Resume Scans",
    description:
      "Upload your resume and get clear, actionable feedback in minutes so you can apply quickly with confidence.",
  },
  {
    icon: WandSparkles,
    title: "Rapid Resume Improvements",
    description:
      "Improve bullets, summaries, and skills alignment in a few clicks and save hours of manual editing.",
  },
  {
    icon: FileText,
    title: "One-Click Resume & Cover Letter Builder",
    description:
      "Paste a job description and generate a targeted resume and cover letter instantly, ready to download and send.",
  },
  {
    icon: Gauge,
    title: "Smart Match Breakdown",
    description:
      "See match score, keyword coverage, and section-level insights at a glance to fix weak spots faster.",
  },
  {
    icon: SquareKanban,
    title: "Seamless Job Tracking",
    description:
      "Track all your applications in one place and stay on top of interviews, follow-ups, and next steps.",
  },
  {
    icon: FileSearch,
    title: "Quick Job Description Analysis",
    description:
      "Break down any job description in seconds and focus your resume on what each role actually needs.",
  },
];

const Features = () => {
  return (
    <section
      id="features"
      className="w-full border-y border-hairline bg-neutral-50 px-6 py-16 sm:py-24"
    >
      <SectionHeading
        eyebrow="Features"
        title="Tailor. Don't Fabricate."
        description="Every change comes from the resume you already have."
      />
      <div className="mx-auto mt-12 grid w-full max-w-screen-lg gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, index) => (
          <Reveal
            key={feature.title}
            delay={(index % 3) * 100}
            className="group flex flex-col rounded-2xl border border-hairline bg-white p-6 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-neutral-300 hover:shadow-md"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-50 text-ink ring-1 ring-inset ring-hairline transition-colors duration-300 group-hover:bg-ink group-hover:text-brand-light group-hover:ring-ink">
              <feature.icon aria-hidden="true" className="h-5 w-5" />
            </span>
            <h3 className="mt-5 text-lg font-semibold tracking-tight text-ink">
              {feature.title}
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              {feature.description}
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  );
};

export default Features;
