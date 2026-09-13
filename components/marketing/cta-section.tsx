import { Button } from "@/components/ui/button";
import { FREE_PLAN_SCAN_LIMIT } from "@/lib/subscription-plans";
import Link from "next/link";

/**
 * Contextual CTA for marketing pages. The copy is passed in per page so the
 * ask matches what the reader just read, rather than a single generic banner
 * repeated site-wide.
 */
export function CtaSection({
  heading,
  body,
  action = "Tailor your resume free",
  href = "/sign-up",
}: {
  heading: string;
  body: string;
  action?: string;
  href?: string;
}) {
  return (
    <section className="mt-16 rounded-2xl border bg-muted/40 p-8 sm:p-10">
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{heading}</h2>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-foreground/80">{body}</p>
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <Button size="lg" className="rounded-full text-base" asChild>
          <Link href={href}>{action}</Link>
        </Button>
        <span className="text-sm text-muted-foreground">
          {FREE_PLAN_SCAN_LIMIT} free scans · no credit card
        </span>
      </div>
    </section>
  );
}

export default CtaSection;
