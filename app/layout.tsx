import { TooltipProvider } from "@/components/ui/tooltip";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ToastContainer } from 'react-toastify';

const geistSans = Geist({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SynCV - Tailored CVs & Cover Letters in Seconds",
  description:
    "SynCV crafts ATS-friendly resumes and cover letters fast—upload, optimize, and track your applications in one place.",
  keywords: [
    "SynCV",
    "ATS resume",
    "cover letter generator",
    "resume scoring",
    "job tracker",
    "resume optimizer",
    "career tools",
    "Ashish B Thoppil",
  ],
  openGraph: {
    type: "website",
    siteName: "SynCV",
    locale: "en_US",
    url: "https://syncv.app",
    title: "SynCV - Tailored CVs & Cover Letters in Seconds",
    description:
      "SynCV crafts ATS-friendly resumes and cover letters fast—upload, optimize, and track your applications in one place.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "SynCV Preview",
      },
    ],
  },
  authors: [
    {
      name: "Ashish B Thoppil",
      url: "https://syncv.app",
    },
  ],
  creator: "Ashish B Thoppil",
  icons: [
    {
      rel: "icon",
      url: "/favicon.ico",
    },
    {
      rel: "apple-touch-icon",
      url: "/apple-touch-icon.png",
    },
    {
      rel: "icon",
      type: "image/png",
      url: "/favicon-32x32.png",
      sizes: "32x32",
    },
    {
      rel: "icon",
      type: "image/png",
      url: "/favicon-16x16.png",
      sizes: "16x16",
    },
    {
      rel: "icon",
      type: "image/png",
      url: "/android-chrome-192x192.png",
      sizes: "192x192",
    },
    {
      rel: "icon",
      type: "image/png",
      url: "/android-chrome-512x512.png",
      sizes: "512x512",
    },
  ],
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <TooltipProvider>{children}</TooltipProvider>
        <ToastContainer hideProgressBar />
      </body>
    </html>
  );
}
