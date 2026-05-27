import CTABanner from "@/components/cta-banner";
import FAQ from "@/components/faq";
import Features from "@/components/features";
import Footer from "@/components/footer";
import Hero from "@/components/hero";
import { Navbar } from "@/components/navbar";
import Pricing from "@/components/pricing";
import Testimonials from "@/components/testimonials";
import type { Metadata } from "next";
import Script from "next/script";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://syncv.app";

export const metadata: Metadata = {
  title: "AI Resume Optimizer & ATS Score Checker",
  description:
    "Beat applicant tracking systems with SynCV. Upload your resume, paste a job description, and instantly get an ATS score, missing keywords, a tailored CV, and a custom cover letter.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "AI Resume Optimizer & ATS Score Checker | SynCV",
    description:
      "Beat applicant tracking systems with SynCV. Get an instant ATS score, fix missing keywords, and download a tailored resume and cover letter.",
    url: SITE_URL,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Resume Optimizer & ATS Score Checker | SynCV",
    description:
      "Upload your resume, paste a job description, and get a tailored CV with an ATS score in seconds.",
  },
};

const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "SynCV",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description:
    "AI-powered resume optimizer and ATS score checker. Tailor your CV to any job description and generate a matching cover letter in seconds.",
  offers: [
    {
      "@type": "Offer",
      name: "Speed",
      price: "699",
      priceCurrency: "INR",
      url: `${SITE_URL}/scan?section=settings#dashboard-pricing`,
    },
    {
      "@type": "Offer",
      name: "Pro",
      price: "749",
      priceCurrency: "INR",
      url: `${SITE_URL}/scan?section=settings#dashboard-pricing`,
    },
  ],
  featureList: [
    "ATS resume scoring",
    "AI keyword matching",
    "Tailored resume generation",
    "AI cover letter generator",
    "Job application tracker",
    "Resume template designer",
  ],
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    reviewCount: "120",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Where can I find my resume scans?",
      acceptedAnswer: {
        "@type": "Answer",
        text:
          "All your resume scans and application history are saved in the Job Tracker section for easy access and reference.",
      },
    },
    {
      "@type": "Question",
      name: "Can I edit the optimized resume before downloading?",
      acceptedAnswer: {
        "@type": "Answer",
        text:
          "Yes. After optimization, you can edit the resume directly in the preview and re-evaluate the score before downloading.",
      },
    },
    {
      "@type": "Question",
      name: "What payment methods do you accept?",
      acceptedAnswer: {
        "@type": "Answer",
        text:
          "At the moment we accept payments through Razorpay. We will expand to more trusted payment providers soon.",
      },
    },
    {
      "@type": "Question",
      name: "How can I contact customer support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Email us at info@syncv.app. We usually respond within 24 hours.",
      },
    },
    {
      "@type": "Question",
      name: "Do you offer refunds?",
      acceptedAnswer: {
        "@type": "Answer",
        text:
          "We do not offer refunds. However, we're here to assist with any issues or concerns - just reach out to support.",
      },
    },
  ],
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: SITE_URL,
    },
  ],
};

export default function Home() {
  return (
    <>
      <Script
        id="ld-software-application"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
      />
      <Script
        id="ld-faq"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Script
        id="ld-breadcrumb"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Navbar isHome={true} />
      <main className="pt-16 xs:pt-20 sm:pt-24">
        <Hero />
        <Features />
        <Pricing />
        <FAQ />
        <Testimonials />
        <CTABanner />
        <Footer />
      </main>
    </>
  );
}
