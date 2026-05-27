import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Job Application Tracker",
  description:
    "Track every job application, resume version, and ATS score in one place with SynCV's job tracker.",
  alternates: { canonical: "/job-tracker" },
  robots: {
    index: false,
    follow: true,
  },
};

export default function JobTrackerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
