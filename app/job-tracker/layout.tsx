import { buildMetadata } from "@/lib/seo/metadata";

/** User-generated application data. noindex, crawlable so the directive is read. */
export const metadata = buildMetadata({
  title: "Job Application Tracker",
  description: "Your saved applications, scans and tailored resume versions.",
  path: "/job-tracker",
  noIndex: true,
});

export default function JobTrackerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
