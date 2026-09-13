import { FAQ_POOL, type FaqKey } from "@/lib/content/faqs";
import {
  BadgeDollarSign,
  Bot,
  FileCheck2,
  Layers,
  PencilLine,
  Repeat2,
  ScanSearch,
  ShieldCheck,
  Sparkles,
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
  { key: "whatIsAiResumeTailor", icon: Bot },
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
    <div id="faq" className="flex items-center justify-center px-6 py-12 xs:py-20">
      <div className="max-w-screen-lg">
        <h2 className="text-3xl xs:text-4xl md:text-5xl !leading-[1.15] font-bold tracking-tight text-center">
          Frequently Asked Questions
        </h2>
        <p className="text-xl sm:text-2xl font-normal tracking-tight text-center mt-3 text-foreground/80">
          What people ask before they trust a tool with their resume.
        </p>

        <dl className="mt-12 grid md:grid-cols-2 bg-background rounded-xl overflow-hidden outline outline-[1px] outline-border outline-offset-[-1px]">
          {HOMEPAGE_FAQS.map(({ key, icon: Icon }) => {
            const { question, answer } = FAQ_POOL[key];
            return (
              <div key={key} className="border p-6 -mt-px -ml-px">
                <div className="h-8 w-8 xs:h-10 xs:w-10 flex items-center justify-center rounded-full bg-accent">
                  <Icon className="h-4 w-4 xs:h-6 xs:w-6" />
                </div>
                <dt className="mt-3 mb-2 text-lg xs:text-[1.35rem] font-semibold tracking-tight">
                  <h3>{question}</h3>
                </dt>
                <dd className="text-sm xs:text-base text-foreground/80">{answer}</dd>
              </div>
            );
          })}
        </dl>
      </div>
    </div>
  );
};

export default FAQ;
