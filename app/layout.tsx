import { JsonLd } from "@/components/seo/json-ld";
import { ToastProvider } from "@/components/toast-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { buildGraph, organizationNode, websiteNode } from "@/lib/seo/schema";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
} from "@/lib/seo/site";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  display: "swap",
});

const DEFAULT_TITLE = "Job-Specific Resume Tailoring – Match Any Job Description | SynCV";
const DEFAULT_DESCRIPTION =
  "SynCV tailors your existing resume to a specific job description in two clicks — highlighting the experience you already have, without inventing skills or achievements.";

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  // Deliberately still zoomable (pinch-zoom is an accessibility requirement).
  // iOS auto-zoom on focused inputs is prevented in globals.css by keeping form
  // controls at 16px on small screens, not by locking the scale here.
  maximumScale: 5,
  colorScheme: "light",
  // Lets the app paint under the notch / home indicator so the fixed app bar
  // and bottom tab bar can pad themselves with env(safe-area-inset-*).
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: DEFAULT_TITLE,
    template: "%s | SynCV",
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  referrer: "origin-when-cross-origin",
  // No `keywords`: Google has ignored the meta keywords tag for two decades and
  // a 20-term list reads as keyword stuffing to anyone auditing the page.
  authors: [{ name: SITE_NAME, url: absoluteUrl("/") }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "Career Tools",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: { canonical: absoluteUrl("/") },
  // Most visitors are on mobile, and a good share add SynCV to the home screen.
  // `capable` drops the Safari chrome so the dashboard's own app bar / tab bar
  // become the whole UI; the translucent status bar pairs with viewportFit.
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "default",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: absoluteUrl("/"),
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [{ ...DEFAULT_OG_IMAGE, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE.url],
    // No `creator`: SynCV has no X account, and @syncv belongs to someone else.
  },
  icons: [
    { rel: "icon", url: "/favicon.ico" },
    { rel: "apple-touch-icon", url: "/apple-touch-icon.png", sizes: "180x180" },
    { rel: "icon", type: "image/png", url: "/favicon-32x32.png", sizes: "32x32" },
    { rel: "icon", type: "image/png", url: "/favicon-16x16.png", sizes: "16x16" },
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
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  manifest: "/site.webmanifest",
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION }
      : undefined,
  },
};

/**
 * The site-wide half of the structured data graph: who SynCV is, and what this
 * website is. Individual pages add their own WebPage / BreadcrumbList / Article
 * nodes that reference these by @id.
 */
const siteGraph = buildGraph([organizationNode(), websiteNode()]);

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${geistSans.className} antialiased`}>
        <JsonLd id="ld-site" data={siteGraph} />
        <TooltipProvider>{children}</TooltipProvider>
        <ToastProvider />
        <Analytics />
      </body>
    </html>
  );
}
