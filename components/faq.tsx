import {
  BadgeDollarSign,
  Route,
  ShieldCheck,
  Truck,
  Undo2,
  UserRoundCheck,
} from "lucide-react";

const faq = [
  {
    icon: Route,
    question: "Where can I find my resume scans?",
    answer:
      "All your resume scans and application history are saved in the Job Tracker section for easy access and reference.",
  },
  {
    icon: Truck,
    question: "Can I edit the optimized resume before downloading?",
    answer:
      "Yes. After optimization, you can edit the resume directly in the preview and re-evaluate the score before downloading.",
  },
  {
    icon: BadgeDollarSign,
    question: "What payment methods do you accept?",
    answer:
      "At the moment, we accept payments through Razorpay only. We will expand to more trusted payment providers soon.",
  },
  {
    icon: ShieldCheck,
    question: "What if something doesn’t work?",
    answer:
      "If you face issues with resume parsing, scoring, or downloads, email us at support@syncv.com and we’ll ensure a fast resolution.",
  },
  {
    icon: UserRoundCheck,
    question: "How can I contact customer support?",
    answer:
      "Email us at support@syncv.com. We usually respond within 24 hours.",
  },
  {
    icon: Undo2,
    question: "Do you offer refunds?",
    answer:
      "We do not offer refunds. However, we're here to assist with any issues or concerns you may have — just reach out to support.",
  },
];

const FAQ = () => {
  return (
    <div
      id="faq"
      className="min-h-screen flex items-center justify-center px-6 py-12 xs:py-20"
    >
      <div className="max-w-screen-lg">
        <h2 className="text-3xl xs:text-4xl md:text-5xl !leading-[1.15] font-bold tracking-tight text-center">
          Frequently Asked Questions
        </h2>
        <p className="mt-3 xs:text-lg text-center text-muted-foreground">
          Quick answers to common questions about our products and services.
        </p>

        <div className="mt-12 grid md:grid-cols-2 bg-background rounded-xl overflow-hidden outline outline-[1px] outline-border outline-offset-[-1px]">
          {faq.map(({ question, answer, icon: Icon }) => (
            <div key={question} className="border p-6 -mt-px -ml-px">
              <div className="h-8 w-8 xs:h-10 xs:w-10 flex items-center justify-center rounded-full bg-accent">
                <Icon className="h-4 w-4 xs:h-6 xs:w-6" />
              </div>
              <div className="mt-3 mb-2 flex items-start gap-2 text-lg xs:text-[1.35rem] font-semibold tracking-tight">
                <span>{question}</span>
              </div>
              <p className="text-sm xs:text-base">{answer}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FAQ;
