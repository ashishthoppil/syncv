import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Your Free Account",
  description:
    "Sign up free to scan unlimited resumes against job descriptions, fix missing keywords, and download tailored CVs and cover letters with SynCV.",
  alternates: { canonical: "/sign-up" },
  openGraph: {
    title: "Create Your Free Account | SynCV",
    description:
      "Sign up free to scan resumes, fix missing keywords, and download tailored CVs and cover letters.",
    url: "/sign-up",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function SignUpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
