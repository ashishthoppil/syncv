import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";

// PDF generation needs the Node.js runtime (not Edge) and enough time to boot a
// headless Chromium and render the page.
export const runtime = "nodejs";
export const maxDuration = 60;

// On Vercel/serverless there is no system Chrome and the full `puppeteer`
// package's bundled Chromium is not present on the read-only function
// filesystem (this is the "Could not find Chrome" error). Use puppeteer-core
// with @sparticuz/chromium — a Lambda-sized Chromium build — in that
// environment. Locally, fall back to the full `puppeteer` dev dependency, which
// ships its own Chromium. The specifier is computed so the bundler never tries
// to trace/include `puppeteer` in the production build.
const isServerless = Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";

async function launchBrowser() {
  if (isServerless) {
    return puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const devPackage = "puppe" + "teer";
  const { default: puppeteer } = await import(/* webpackIgnore: true */ devPackage);
  return puppeteer.launch({ headless: "new" });
}

export async function POST(req) {
  let browser;
  try {
    const request = await req.json();
    const html = request.html;
    const type = request.type;

    browser = await launchBrowser();
    const page = await browser.newPage();

    // Keep wrapper styling minimal so template inline styles control appearance.
    const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${type || "document"}</title>
                <link href="https://fonts.googleapis.com/css2?family=Geist&display=swap" rel="stylesheet">
                <style>
                    @page {
                        size: A4;
                        margin: 18mm 12mm;
                    }
                    body {
                        font-family: 'Geist', sans-serif;
                        margin: 0;
                        padding: 0;
                        line-height: 1.5;
                        color: #333;
                    }
                    @media print {
                        html, body {
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                    }
                </style>
            </head>
            <body>
                ${html}
            </body>
            </html>

        `;

    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
    });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${type}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return new Response(JSON.stringify({ error: "Failed to generate PDF" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
