import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These load native/binary assets at runtime and must not be bundled by the
  // Next.js server compiler. @sparticuz/chromium ships the Chromium binary that
  // powers serverless PDF generation.
  serverExternalPackages: ["pdf-parse", "puppeteer-core", "@sparticuz/chromium"],
};

export default nextConfig;
