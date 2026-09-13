import { buildMetadata } from "@/lib/seo/metadata";

/**
 * The product application. noindex, but deliberately NOT blocked in robots.txt:
 * it is linked from the public navbar and footer, so a crawler has to be able
 * to fetch it in order to read this directive. See lib/seo/routes.ts.
 */
export const metadata = buildMetadata({
  title: "Scan & Tailor Your Resume",
  description:
    "Upload your resume, paste a job description, and review the tailored result.",
  path: "/scan",
  noIndex: true,
});

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return children;
}
