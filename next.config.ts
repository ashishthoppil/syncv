import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // These load native/binary assets at runtime and must not be bundled by the
  // Next.js server compiler. @sparticuz/chromium ships the Chromium binary that
  // powers serverless PDF generation.
  serverExternalPackages: ["pdf-parse", "puppeteer-core", "@sparticuz/chromium"],
  // Externalizing keeps @sparticuz/chromium out of the webpack bundle, but the
  // Vercel file tracer still won't copy its bin/*.br Chromium packs into the
  // function (nothing require()s them — they're read by path at runtime). Force
  // them into the /api/generate-pdf function so executablePath() can find them.
  outputFileTracingIncludes: {
    "/api/generate-pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
};

export default nextConfig;
