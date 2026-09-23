import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { FREE_PLAN_SCAN_LIMIT, formatScanCount } from "@/lib/subscription-plans";
import { ClipboardPaste, FileDown, Upload } from "lucide-react";
import Link from "next/link";

/**
 * The textual "how it works" for the homepage.
 *
 * The demo video shows the same thing, but a video is invisible to a crawler
 * and to anyone who doesn't press play. These three steps are the plain-text
 * answer to "how does SynCV tailor my resume?" — a question people ask both in
 * search and of answer engines.
 */
const steps = [
  {
    icon: Upload,
    title: "Upload your resume once",
    detail:
      "PDF or Word. SynCV parses it into structured sections — experience, skills, education — and keeps it as your base resume. You never upload it again, and it stays unchanged no matter how many jobs you apply to.",
  },
  {
    icon: ClipboardPaste,
    title: "Paste the job description",
    detail:
      "The full posting. SynCV pulls out the requirements it repeats, the tools it names and the vocabulary the team uses, then compares them against what your resume already says.",
  },
  {
    icon: FileDown,
    title: "Review, edit and export",
    detail:
      "You get a resume aimed at that posting, with a breakdown of which requirements it addresses and which it doesn't. Change any line before you download it — nothing is sent anywhere on your behalf.",
  },
];

const HowItWorks = () => {
  return (
    <section
      id="how-it-works"
      className="w-full border-y border-hairline bg-neutral-50 px-6 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-screen-lg">
        <SectionHeading
          eyebrow="How it works"
          title="How SynCV Works"
          description="One upload, then two clicks per application."
        />

        <ol className="mt-12 grid gap-6 sm:mt-16 md:grid-cols-3">
          {steps.map((step, index) => (
            <Reveal
              as="li"
              key={step.title}
              delay={index * 100}
              className="rounded-2xl border border-hairline bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-50 text-ink ring-1 ring-inset ring-hairline">
                  <step.icon aria-hidden="true" className="h-5 w-5" />
                </span>
                {/* The <ol> already numbers the steps for assistive tech. */}
                <span
                  aria-hidden="true"
                  className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-400"
                >
                  Step {index + 1}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-ink">
                {step.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{step.detail}</p>
            </Reveal>
          ))}
        </ol>

        <Reveal as="p" className="mt-10 text-center text-[15px] text-ink-soft">
          {formatScanCount(FREE_PLAN_SCAN_LIMIT, "free")}, no card required. More detail on{" "}
          <Link
            href="/resume-tailor"
            className="font-medium text-ink underline decoration-brand/50 decoration-2 underline-offset-4 transition-colors hover:decoration-brand"
          >
            how resume tailoring works
          </Link>
          .
        </Reveal>
      </div>
    </section>
  );
};

export default HowItWorks;
