import type { Faq } from "@/lib/content/faqs";

/**
 * Questions render as <h3> under an <h2>, keeping the outline intact on pages
 * that already use <h2> for their own sections. Answers are always in the HTML
 * — never behind a click — so both readers and crawlers get them.
 */
export function FaqSection({
  items,
  heading = "Frequently asked questions",
  id = "faq",
}: {
  items: Faq[];
  heading?: string;
  id?: string;
}) {
  return (
    <section id={id} className="mt-16">
      <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{heading}</h2>
      <dl className="mt-8 divide-y rounded-xl border bg-background">
        {items.map((item) => (
          <div key={item.question} className="p-6">
            <dt>
              <h3 className="text-lg font-semibold tracking-tight">{item.question}</h3>
            </dt>
            <dd className="mt-2 text-[15px] leading-relaxed text-foreground/80">
              {item.answer}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default FaqSection;
