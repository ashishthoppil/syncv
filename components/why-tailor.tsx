import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { ListOrdered, ScanEye, ShieldCheck, Target } from "lucide-react";
import Link from "next/link";

/**
 * Answers "why tailor a resume for every job?" directly on the homepage.
 *
 * This section exists because it is a real question people search before they
 * look for a tool, and because a direct, self-contained answer is the unit AI
 * answer engines extract. It is also the homepage's main entry point into the
 * resources hub.
 */
const reasons = [
  {
    icon: Target,
    heading: "A generic resume is aimed at the average job",
    body: "No employer is hiring for the average. The broader your experience, the more a one-size resume has to bury — three specialisms compressed into one document means two of them are invisible on any given application.",
  },
  {
    icon: ScanEye,
    heading: "Screeners read the top third of page one",
    body: "Resume screening is a scan, not a read. Whatever answers this employer's requirements has to be above the fold, not on page two under a role from four years ago.",
  },
  {
    icon: ListOrdered,
    heading: "Matching systems compare your words to theirs",
    body: "Most applicant tracking systems rank applicants by overlap with the posting. Describing the same work in the employer's vocabulary moves you up that ranking — no tool can promise it passes you through.",
  },
  {
    icon: ShieldCheck,
    heading: "Nothing about your history changes",
    body: "Tailoring redistributes attention. Same roles, same dates, same achievements — a different decision about which ones lead.",
  },
];

const WhyTailor = () => {
  return (
    <section id="why-tailor" className="w-full px-6 py-16 sm:py-24">
      <div className="mx-auto max-w-screen-lg">
        <SectionHeading
          eyebrow="Why it matters"
          title="Why Tailor Your Resume for Every Job?"
          description="Because the resume that describes your whole career is rarely the one that answers a specific posting. Tailoring decides what a reviewer sees first — it does not change what you have done."
        />

        <div className="mt-12 grid gap-6 sm:mt-16 sm:grid-cols-2">
          {reasons.map((reason, index) => (
            <Reveal
              key={reason.heading}
              delay={(index % 2) * 100}
              className="flex gap-4 rounded-2xl border border-hairline bg-white p-6 shadow-sm"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-50 text-ink ring-1 ring-inset ring-hairline">
                <reason.icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-ink">
                  {reason.heading}
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{reason.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal as="p" className="mt-10 text-center text-[15px] text-ink-soft">
          More on the method:{" "}
          <Link
            href="/resources/how-to-tailor-your-resume-to-a-job-description"
            className="font-medium text-ink underline decoration-brand/50 decoration-2 underline-offset-4 transition-colors hover:decoration-brand"
          >
            how to tailor your resume to a job description
          </Link>{" "}
          and{" "}
          <Link
            href="/resources/should-you-tailor-your-resume-for-every-job"
            className="font-medium text-ink underline decoration-brand/50 decoration-2 underline-offset-4 transition-colors hover:decoration-brand"
          >
            whether to tailor for every job
          </Link>
          .
        </Reveal>
      </div>
    </section>
  );
};

export default WhyTailor;
