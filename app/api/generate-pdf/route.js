import puppeteer from "puppeteer";

export async function POST(req) {
    try {
        const request = await req.json();
        const html = request.html;
        const type = request.type;
        const browser = await puppeteer.launch({ headless: "new" });
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
            waitUntil: 'networkidle0',
        });
        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            preferCSSPageSize: true,
        });
        await browser.close();

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
    }
}
