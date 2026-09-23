import type { ArticleSection } from "./articles";
import { FAQ_POOL } from "./faqs";
import {
  FAIR_USE_OPTIMIZATION_BREAK_MINUTES,
  FAIR_USE_OPTIMIZATIONS_PER_DAY,
  FAIR_USE_OPTIMIZATIONS_PER_HOUR,
  FAIR_USE_SCANS_PER_DAY,
  FAIR_USE_SCANS_PER_HOUR,
  FREE_PLAN_SCAN_LIMIT,
  formatScanCount,
} from "@/lib/subscription-plans";
import { SUPPORT_EMAIL } from "@/lib/seo/site";

/**
 * Trust / E-E-A-T pages.
 *
 * ══════════════════════════════════════════════════════════════════════════
 * BEFORE PUBLISHING /privacy AND /terms
 *
 * Everything below is factually derived from this codebase — the processors we
 * actually call (Supabase, OpenAI, Dodo Payments, Resend, Vercel), what the account
 * deletion endpoint actually removes, and what the product actually does. What
 * it deliberately does NOT contain, because the information is not in the repo
 * and inventing it would be worse than omitting it:
 *
 *   • the registered legal entity name and address
 *   • governing law and jurisdiction
 *   • a concrete data-retention period for inactive accounts
 *   • a formal sub-processor list / DPA reference
 *   • any GDPR/CCPA representations
 *
 * These need the owner's input and, for the last two, a lawyer's. Treat both
 * documents as accurate drafts, not as reviewed legal text.
 * ══════════════════════════════════════════════════════════════════════════
 */

export type StaticPage = {
  path: string;
  title: string;
  h1: string;
  description: string;
  answer: string;
  sections: ArticleSection[];
  /** Rendered under the content as a plain-language last-updated line. */
  updated?: string;
};

export const ABOUT: StaticPage = {
  path: "/about",
  title: "About SynCV",
  h1: "About SynCV",
  description:
    "What SynCV does, how it uses AI, what it deliberately refuses to do with your resume, and what it does not promise.",
  answer:
    "SynCV is a resume tailoring tool. It takes a resume you already have and a job description you are applying to, and produces a version of that resume aimed at that job — reordered, re-emphasised and rephrased around what the posting asks for. The single rule the product is built around is that it works only from experience you have actually claimed.",
  sections: [
    {
      heading: "The problem we built it for",
      body: [
        "Almost everyone applies with one resume. It is a reasonable thing to do — tailoring by hand takes half an hour per application and it is hard to tell whether it made any difference.",
        "The cost is invisible. A single resume has to represent your whole career to every employer at once, so the parts that matter for any particular job compete with the parts that don't. People with the broadest experience lose the most to this.",
      ],
    },
    {
      heading: "Tailor. Don't fabricate.",
      body: [
        "There is an easy version of this product and we do not build it. Ask a language model to make a resume match a job description and it will write whatever is missing — a framework you have never used, a team you never led, a number nobody measured. The output matches perfectly and belongs to somebody who does not exist.",
        "SynCV is bounded by your uploaded resume. It can reorder, promote, combine and rephrase what is there. It cannot introduce a skill, employer, date or achievement you have not claimed. If you ever see output naming something unfamiliar, that is a bug and we want to hear about it.",
      ],
    },
    {
      heading: "How AI is used",
      body: [
        "When you run a scan, the text of your resume and the job description you pasted are sent to OpenAI's API for analysis and rewriting. SynCV uses OpenAI's GPT-6 Luna model for this. The output is returned to you in an editor — you review and change anything before exporting.",
        "AI is used for comparison and rewriting. It is not used to judge you: SynCV does not assess whether you are qualified for a role, does not score you as a candidate, and does not recommend whether to apply.",
      ],
    },
    {
      heading: "What we don't claim",
      body: [
        "A lot of this category sells outcomes it cannot control. To be explicit about ours:",
      ],
      bullets: [
        "We do not guarantee interviews. Tailoring changes how clearly your experience reads, which is one input into a hiring decision among many.",
        "We do not guarantee that any applicant tracking system will pass your resume through. Vendors score differently and employers configure them differently.",
        "We do not publish user counts, interview rates or success rates, because we have no way to verify them.",
        "We do not tell you whether you are qualified for a job. That judgement stays with you.",
      ],
    },
    {
      heading: "Contact",
      body: [
        `SynCV is a small team. Support, bug reports, and anything about how your data is handled all go to ${SUPPORT_EMAIL}, and we usually reply within 24 hours.`,
      ],
    },
  ],
};

export const CONTACT: StaticPage = {
  path: "/contact",
  title: "Contact SynCV",
  h1: "Contact SynCV",
  description:
    "How to reach the SynCV team about support, billing, bug reports, or how your resume data is handled.",
  answer: `Email ${SUPPORT_EMAIL}. It reaches the whole team and we usually reply within 24 hours. There is no phone line and no chatbot in between.`,
  sections: [
    {
      heading: "What to include",
      body: [
        "Support questions are resolved much faster with a little context. For anything involving a scan, the job title and company help us find the run.",
      ],
      bullets: [
        "Resume parsing problems: the file you uploaded, and what came out wrong",
        "Scoring or tailoring problems: the job description you used, and what you expected",
        "Billing: the email on the account and the plan you are on",
        "Data requests: the account email, and what you want done",
      ],
    },
    {
      heading: "Signed-in support",
      body: [
        "If you already have an account, the Help Centre inside the dashboard opens a support ticket linked to your account, which saves us asking for details we already have.",
      ],
    },
    {
      heading: "Security and privacy reports",
      body: [
        `Send anything security-related to ${SUPPORT_EMAIL} with "security" in the subject line so it gets triaged first. If you believe you have found a vulnerability, please give us a chance to fix it before disclosing it publicly.`,
      ],
    },
  ],
};

export const PRIVACY: StaticPage = {
  path: "/privacy",
  title: "Privacy Policy",
  h1: "Privacy policy",
  description:
    "What SynCV collects, where your resume goes when you run a scan, which third parties process it, and how to delete everything.",
  answer:
    "SynCV stores your account details, the base resume you upload, and the scans and applications you create. When you run a scan, your resume text and the job description are sent to OpenAI for processing. Deleting your account removes your resumes, scans and application history from our database.",
  updated: "14 September 2026",
  sections: [
    {
      heading: "What we collect",
      body: ["Only what the product needs to work:"],
      bullets: [
        "Account details: your email address and authentication record",
        "Your base resume: the file you upload and the structured version parsed from it (employment history, education, skills, contact details you included)",
        "Job descriptions you paste, and the tailored resumes and cover letters generated from them",
        "Your job tracker entries and their status",
        "Scan usage counts, used to enforce plan limits",
        "Subscription records, if you buy a plan",
        "Support tickets you open, and our replies",
      ],
    },
    {
      heading: "Where your resume goes",
      body: [
        "This is the part worth reading carefully, because it involves a third party.",
        "When you run a scan, the text of your resume and the job description you pasted are sent to OpenAI's API for analysis and rewriting, and the result is returned to you. Your resume is not sent anywhere else, is not shown to other users, and is not sold or shared with recruiters, employers or advertisers.",
      ],
    },
    {
      heading: "Service providers we use",
      body: ["Each of these processes some of your data in order to run part of the service."],
      bullets: [
        "Supabase — authentication and database storage for your account, resumes, scans and applications",
        "OpenAI — processes resume and job description text to produce analysis and tailored output",
        "Dodo Payments — our merchant of record for subscriptions: it takes payment, issues invoices and handles sales tax, and receives your email address and billing details to do so. Card details go to Dodo Payments directly; SynCV never sees or stores them",
        "Resend — transactional email, such as account and welcome messages",
        "Vercel — application hosting, and privacy-friendly traffic analytics that do not build a profile of you",
      ],
    },
    {
      heading: "Deleting your data",
      body: [
        "You can delete your account from the account settings in the dashboard. Doing so removes your profile, your base resume, your scan history, your job tracker entries and your subscription records from our database.",
        `If you would rather we did it, email ${SUPPORT_EMAIL} from the address on the account.`,
      ],
      callout:
        "Deletion does not reach backups instantly, and records we are required to keep for accounting — payment records held by our payment processor — are retained under their own terms.",
    },
    {
      heading: "Cookies",
      body: [
        "SynCV sets the cookies needed to keep you signed in. It does not run advertising or cross-site tracking cookies, and does not embed third-party ad trackers.",
        "The homepage embeds a product demo hosted on YouTube's no-cookie domain, which avoids setting YouTube's tracking cookies unless you play the video.",
      ],
    },
    {
      heading: "Your choices",
      body: ["At any point you can:"],
      bullets: [
        "Export any tailored resume or cover letter you have generated",
        "Delete individual scans and job tracker entries",
        "Delete your account, and everything attached to it, from account settings",
        `Ask us what we hold about you by emailing ${SUPPORT_EMAIL}`,
      ],
    },
    {
      heading: "Changes to this policy",
      body: [
        "If we change how data is handled in a way that affects you, we will update this page and the date at the top of it. Material changes will be emailed to account holders.",
      ],
    },
  ],
};

export const TERMS: StaticPage = {
  path: "/terms",
  title: "Terms of Service",
  h1: "Terms of service",
  description:
    "The terms covering your SynCV account: what the service does, what you are responsible for, billing, and the limits of what we promise.",
  answer:
    "By creating a SynCV account you agree to these terms. In short: you keep ownership of your resume, you are responsible for the accuracy of what you submit to employers, subscriptions renew until cancelled, and SynCV makes no promise about the outcome of any job application.",
  updated: "14 September 2026",
  sections: [
    {
      heading: "The service",
      body: [
        "SynCV tailors a resume you upload to a job description you provide, reports how well the two match, and can generate a cover letter and track your applications. Features available to you depend on your plan.",
      ],
    },
    {
      heading: "Your account",
      body: [
        "You need an account to use SynCV. You are responsible for keeping your login credentials secure and for activity on your account. Accounts are for individual use — do not share them.",
        "You must be legally able to enter into this agreement in your jurisdiction.",
      ],
    },
    {
      heading: "Your content",
      body: [
        "Your resume remains yours. We claim no ownership of it, and we do not license it to anyone.",
        "You grant SynCV permission to process your resume and the job descriptions you submit for the purpose of providing the service — including sending that text to the third-party AI provider described in the privacy policy. That permission exists only to run the product.",
      ],
    },
    {
      heading: "Accuracy is your responsibility",
      body: [
        "SynCV produces a draft from the information you provide. You review it and you send it. Anything you submit to an employer is your representation, not ours.",
        "SynCV is designed not to add experience you have not claimed. You are still responsible for reading the output and confirming it is accurate before using it.",
      ],
    },
    {
      heading: "Acceptable use",
      body: ["You agree not to:"],
      bullets: [
        "Submit resumes or personal data belonging to someone else without their permission",
        "Use the service to create deliberately false employment claims",
        "Attempt to access other users' data, or to disrupt or reverse-engineer the service",
        "Resell or redistribute output as your own product",
        "Automate access in a way that circumvents plan limits",
      ],
    },
    {
      heading: "Plans, billing and cancellation",
      body: [
        "Free accounts include a fixed allowance of scans. Pro is billed weekly, monthly or quarterly through Dodo Payments, our merchant of record, depending on the billing period you choose, and renews automatically until cancelled. Prices are in Indian rupees in India and in US dollars everywhere else.",
        `Pro's unlimited scans and optimizations are subject to fair use, per account: up to ${FAIR_USE_SCANS_PER_HOUR} scans an hour and ${FAIR_USE_SCANS_PER_DAY} a day, and up to ${FAIR_USE_OPTIMIZATIONS_PER_DAY} optimizations a day, with a ${FAIR_USE_OPTIMIZATION_BREAK_MINUTES}-minute break after ${FAIR_USE_OPTIMIZATIONS_PER_HOUR} optimizations in an hour. Days run from midnight UTC. These limits exist to stop automated use and reset on their own; your dashboard shows where you stand.`,
        "You can cancel at any time from account settings. Cancellation stops future renewals; your plan stays active until the end of the period you have paid for.",
        `Payments are non-refundable — see the refund policy. Prices can change, and we will give notice before a change affects an existing subscription.`,
      ],
    },
    {
      heading: "What we don't promise",
      body: [
        "SynCV is provided as-is. We work to keep it accurate and available, but we do not warrant that it will be uninterrupted or error-free, and specifically:",
      ],
      bullets: [
        "We do not guarantee interviews, job offers or any hiring outcome",
        "We do not guarantee that any applicant tracking system will accept or rank your resume",
        "We do not assess whether you are qualified for any role",
        "Match scores are our own estimate of how closely two documents overlap, not an employer's assessment",
      ],
    },
    {
      heading: "Suspension",
      body: [
        "We may suspend or close an account that breaches these terms, or where required by law. Where we reasonably can, we will tell you why.",
      ],
    },
    {
      heading: "Changes",
      body: [
        "These terms may change as the product does. The date at the top of this page reflects the current version, and we will notify account holders of material changes.",
      ],
    },
  ],
};

export const REFUND_POLICY: StaticPage = {
  path: "/refund-policy",
  title: "Refund Policy",
  h1: "Refund policy",
  description:
    "SynCV does not offer refunds. Here is why, what the free allowance is for, and what we will do if something genuinely does not work.",
  answer:
    `SynCV does not issue refunds on subscription payments. Every account includes ${formatScanCount(FREE_PLAN_SCAN_LIMIT, "free")} before any payment is taken, so you can judge the output on your own resume before subscribing. You can cancel at any time to stop future renewals.`,
  updated: "14 September 2026",
  sections: [
    {
      heading: "Try it before you pay",
      body: [
        FAQ_POOL.freeScans.answer,
        "The free allowance exists precisely so that the decision to subscribe is made after you have seen SynCV run on your own resume and a real job description — not before.",
      ],
    },
    {
      heading: "Cancelling",
      body: [
        "Cancel from account settings at any time. Cancelling stops the subscription renewing; your plan remains active for the rest of the period you have already paid for, and you keep access to everything you generated during it.",
      ],
    },
    {
      heading: "If something doesn't work",
      body: [
        `A refund is not the only remedy, and usually not the fastest one. If your resume will not parse, a scan fails, or a download is broken, email ${SUPPORT_EMAIL} with the details and we will fix it or credit scans back to your account.`,
        "We would much rather resolve the problem than take your money for something that did not work.",
      ],
    },
    {
      heading: "Unauthorised charges",
      body: [
        `If you see a SynCV charge you did not authorise, email ${SUPPORT_EMAIL} straight away and we will investigate it with our payment processor.`,
      ],
    },
  ],
};

export const STATIC_PAGES: StaticPage[] = [ABOUT, CONTACT, PRIVACY, TERMS, REFUND_POLICY];
