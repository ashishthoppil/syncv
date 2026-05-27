import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get Started",
  description: "Complete your SynCV onboarding to start tailoring your resume.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
