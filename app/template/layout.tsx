import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Resume Template Designer",
  description:
    "Customize a professional, ATS-friendly resume template with colors, fonts, and layouts that suit your style.",
  alternates: { canonical: "/template" },
  robots: {
    index: false,
    follow: true,
  },
};

export default function TemplateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
