import { FREE_PLAN_SCAN_LIMIT } from "@/lib/subscription-plans";
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
    title: "Upload your resume once",
    detail:
      "PDF or Word. SynCV parses it into structured sections — experience, skills, education — and keeps it as your base resume. You never upload it again, and it stays unchanged no matter how many jobs you apply to.",
  },
  {
    title: "Paste the job description",
    detail:
      "The full posting. SynCV pulls out the requirements it repeats, the tools it names and the vocabulary the team uses, then compares them against what your resume already says.",
  },
  {
    title: "Review, edit and export",
    detail:
      "You get a resume aimed at that posting, with a breakdown of which requirements it addresses and which it doesn't. Change any line before you download it — nothing is sent anywhere on your behalf.",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="w-full px-6 py-12 xs:py-20">
      <div className="mx-auto max-w-screen-lg">
        <h2 className="text-3xl xs:text-4xl sm:text-5xl font-bold tracking-tight text-center">
          How SynCV Works
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-lg leading-relaxed text-foreground/80">
          One upload, then two clicks per application.
        </p>

        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-xl border bg-background p-6">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background"
              >
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground/80">
                {step.detail}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-center text-[15px] text-foreground/80">
          {FREE_PLAN_SCAN_LIMIT} free scans, no card required. More detail on{" "}
          <Link href="/resume-tailor" className="font-medium underline underline-offset-4">
            how resume tailoring works
          </Link>
          .
        </p>
      </div>
    </section>
  );
};

export default HowItWorks;
