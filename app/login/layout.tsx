import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log In",
  description:
    "Log in to SynCV to access your resume scans, tailored CVs, job tracker, and account settings.",
  alternates: { canonical: "/login" },
  openGraph: {
    title: "Log In | SynCV",
    description:
      "Log in to SynCV to access your resume scans, tailored CVs, job tracker, and account settings.",
    url: "/login",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
