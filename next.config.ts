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
  // https://syncv.app is the only canonical host. The www → apex redirect is
  // owned by the Vercel domain settings, which answer before the app runs, so
  // this rule is a backstop: it only takes effect if www.syncv.app is ever
  // pointed straight at the deployment. Permanent (308), path and query kept.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.syncv.app" }],
        destination: "https://syncv.app/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
