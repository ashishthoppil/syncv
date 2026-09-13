import BeforeAfter from "@/components/before-after";
import CTABanner from "@/components/cta-banner";
import DemoVideo from "@/components/demo-video";
import FAQ from "@/components/faq";
import Features from "@/components/features";
import Footer from "@/components/footer";
import Hero from "@/components/hero";
import HowItWorks from "@/components/how-it-works";
import MoreTools from "@/components/more-tools";
import { Navbar } from "@/components/navbar";
import Pricing from "@/components/pricing";
import JsonLd from "@/components/seo/json-ld";
import WhyTailor from "@/components/why-tailor";
import { FAQ_POOL } from "@/lib/content/faqs";
import { buildMetadata } from "@/lib/seo/metadata";
import {
  breadcrumbNode,
  buildGraph,
  faqNode,
  softwareApplicationNode,
  videoObjectNode,
  webPageNode,
} from "@/lib/seo/schema";
import { absoluteUrl } from "@/lib/seo/site";

const PATH = "/";
const TITLE = "AI Resume Tailor – Tailor Your Resume to Any Job";
const DESCRIPTION =
  "Tailor your resume to every job in 2 clicks. SynCV uses AI to highlight your relevant experience without inventing skills, experience, or achievements. Try 3 scans free.";

export const metadata = buildMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: PATH,
  // The tagline is the strongest thing SynCV has to say and it survives being
  // read out of context, which is what a shared link is.
  socialTitle:
    "Your resume should change for every job. Your experience shouldn't. | SynCV",
});

/**
 * FAQ markup mirrors exactly the questions components/faq.tsx renders below.
 * If you change one, change the other — markup describing invisible content is
 * a structured-data violation.
 */
const homepageFaqs = [
  FAQ_POOL.whatIsAiResumeTailor,
  FAQ_POOL.doesSyncvInvent,
  FAQ_POOL.multipleJobs,
  FAQ_POOL.tailoringVsRewriting,
  FAQ_POOL.atsHelp,
  FAQ_POOL.canEdit,
  FAQ_POOL.differentCareers,
  FAQ_POOL.freeScans,
  FAQ_POOL.payments,
  FAQ_POOL.refunds,
];

export default function Home() {
  const url = absoluteUrl(PATH);
  const trail = [{ name: "Home", path: PATH }];

  const graph = buildGraph([
    webPageNode({
      path: PATH,
      name: TITLE,
      description: DESCRIPTION,
      breadcrumbs: trail,
      about: "software",
    }),
    softwareApplicationNode(),
    videoObjectNode(),
    breadcrumbNode(url, trail),
    faqNode(url, homepageFaqs),
  ]);

  return (
    <>
      <JsonLd id="ld-home" data={graph} />
      <Navbar isHome={true} />
      <main className="pt-16 xs:pt-20 sm:pt-24">
        <Hero />
        <DemoVideo />
        <BeforeAfter />
        <HowItWorks />
        <WhyTailor />
        <Features />
        <MoreTools />
        <Pricing />
        <FAQ />
        <CTABanner />
        <Footer />
      </main>
    </>
  );
}
