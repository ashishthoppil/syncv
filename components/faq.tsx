import { SectionHeading } from "@/components/marketing/section-heading";
import { Reveal } from "@/components/ui/reveal";
import { FAQ_POOL, type FaqKey } from "@/lib/content/faqs";
import {
  BadgeDollarSign,
  FileCheck2,
  Layers,
  PencilLine,
  Repeat2,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Target,
  Undo2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Homepage FAQ.
 *
 * These used to be support trivia — where scans are saved, which payment
 * processor we use. They are now the questions people actually search before
 * choosing a tool, answered from the shared pool in lib/content/faqs.ts so the
 * same question never gets two different answers across the site.
 *
 * Answers are plain text in the HTML rather than behind an accordion, because
 * an answer a crawler cannot reach is an answer that only exists for clicks.
 */
const HOMEPAGE_FAQS: { key: FaqKey; icon: LucideIcon }[] = [
  { key: "whatIsJobSpecificTailor", icon: Target },
  { key: "doesSyncvInvent", icon: ShieldCheck },
  { key: "multipleJobs", icon: Repeat2 },
  { key: "tailoringVsRewriting", icon: Layers },
  { key: "atsHelp", icon: ScanSearch },
  { key: "canEdit", icon: PencilLine },
  { key: "differentCareers", icon: Sparkles },
  { key: "freeScans", icon: FileCheck2 },
  { key: "payments", icon: BadgeDollarSign },
  { key: "refunds", icon: Undo2 },
];

const FAQ = () => {
  return (
    <section
      id="faq"
      className="w-full border-y border-hairline bg-neutral-50 px-6 py-16 sm:py-24"
    >
      <div className="mx-auto max-w-screen-lg">
        <SectionHeading
          eyebrow="FAQ"
          title="Frequently Asked Questions"
          description="What people ask before they trust a tool with their resume."
        />

        <dl className="mt-12 grid gap-4 sm:mt-16 md:grid-cols-2">
          {HOMEPAGE_FAQS.map(({ key, icon: Icon }, index) => {
            const { question, answer } = FAQ_POOL[key];
            return (
              <Reveal
                key={key}
                delay={(index % 2) * 100}
                className="rounded-2xl border border-hairline bg-white p-6 shadow-sm"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-50 text-ink ring-1 ring-inset ring-hairline">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <dt className="mt-4 text-lg font-semibold tracking-tight text-ink">
                  <h3>{question}</h3>
                </dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-ink-soft">{answer}</dd>
              </Reveal>
            );
          })}
        </dl>
      </div>
    </section>
  );
};

export default FAQ;
