import { buildMetadata } from "@/lib/seo/metadata";
import { FREE_PLAN_SCAN_LIMIT } from "@/lib/subscription-plans";

/**
 * noindex, for the same reason as /login: it is a form, not a page anyone
 * should land on from a search result. The marketing pages are what rank, and
 * they all link here.
 */
export const metadata = buildMetadata({
  title: "Create Your Free Account",
  description: `Create a free SynCV account and get ${FREE_PLAN_SCAN_LIMIT} resume scans, no card required.`,
  path: "/sign-up",
  noIndex: true,
});

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
