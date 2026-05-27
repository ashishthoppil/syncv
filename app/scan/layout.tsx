import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scan & Optimize Your Resume",
  description:
    "Upload your resume, paste a job description, and get an instant ATS score with a tailored CV and cover letter. Track every application in one dashboard.",
  alternates: { canonical: "/scan" },
  openGraph: {
    title: "Scan & Optimize Your Resume | SynCV",
    description:
      "Upload your resume and paste a job description to get an instant ATS score and a tailored CV.",
    url: "/scan",
    type: "website",
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return children;
}
