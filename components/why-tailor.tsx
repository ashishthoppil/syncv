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
    heading: "A generic resume is aimed at the average job",
    body: "No employer is hiring for the average. The broader your experience, the more a one-size resume has to bury — three specialisms compressed into one document means two of them are invisible on any given application.",
  },
  {
    heading: "Screeners read the top third of page one",
    body: "Resume screening is a scan, not a read. Whatever answers this employer's requirements has to be above the fold, not on page two under a role from four years ago.",
  },
  {
    heading: "Matching systems compare your words to theirs",
    body: "Most applicant tracking systems rank applicants by overlap with the posting. Describing the same work in the employer's vocabulary moves you up that ranking — no tool can promise it passes you through.",
  },
  {
    heading: "Nothing about your history changes",
    body: "Tailoring redistributes attention. Same roles, same dates, same achievements — a different decision about which ones lead.",
  },
];

const WhyTailor = () => {
  return (
    <section id="why-tailor" className="w-full px-6 py-12 xs:py-20">
      <div className="mx-auto max-w-screen-lg">
        <h2 className="text-3xl xs:text-4xl sm:text-5xl font-bold tracking-tight text-center">
          Why Tailor Your Resume for Every Job?
        </h2>
        <p className="mx-auto mt-4 max-w-3xl text-center text-lg leading-relaxed text-foreground/80">
          Because the resume that describes your whole career is rarely the one that
          answers a specific posting. Tailoring decides what a reviewer sees first — it
          does not change what you have done.
        </p>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {reasons.map((reason) => (
            <div key={reason.heading} className="rounded-xl border bg-background p-6">
              <h3 className="text-lg font-semibold tracking-tight">{reason.heading}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground/80">
                {reason.body}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-[15px] text-foreground/80">
          More on the method:{" "}
          <Link
            href="/resources/how-to-tailor-your-resume-to-a-job-description"
            className="font-medium underline underline-offset-4"
          >
            how to tailor your resume to a job description
          </Link>{" "}
          and{" "}
          <Link
            href="/resources/should-you-tailor-your-resume-for-every-job"
            className="font-medium underline underline-offset-4"
          >
            whether to tailor for every job
          </Link>
          .
        </p>
      </div>
    </section>
  );
};

export default WhyTailor;
