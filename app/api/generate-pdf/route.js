import puppeteer from "puppeteer";

export async function POST(req) {
    try {
        const request = await req.json();
        const html = request.html;
        const type = request.type;
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();

        // await page.setContent(html);

        // HTML Template for the PDF
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Resume - Ashish B Thoppil</title>
                <link href="https://fonts.googleapis.com/css2?family=Geist&display=swap" rel="stylesheet">
                <style>
                    @page {
                        size: A4;
                        padding: 3rem;
                    }
                    body {
                        font-family: 'Geist', sans-serif;
                        margin: 40px;
                        padding: 0rem;
                        line-height: 1.5;
                        color: #333;
                    }
                    .head-section h1 {
                        font-size: 32px;
                        font-weight: 800;
                        text-align: left;
                    }
                    .contact-info {
                        text-align: center;
                        font-size: 14px;
                    }
                    .contact-info a {
                        color: #007bff;
                        text-decoration: none;
                    }
                    .contact-info a:hover {
                        text-decoration: underline;
                    }
                    h2 {
                        font-size: 18px;
                        margin-bottom: 10px;
                    }
                    h3 {
                        font-size: 16px;
                        margin-top: 20px;
                        color: #444;
                    }
                    .section-title {
                        font-weight: bold;
                        color: #007bff;
                        text-transform: uppercase;
                        margin-bottom: 5px;
                    }
                    .skills, .work-experience {
                        margin-top: 20px;
                    }
                    ul {
                        padding-left: 20px;
                    }
                    li {
                        margin-bottom: 8px;
                    }
                    .job-title {
                        font-weight: bold;
                    }
                    .company {
                        font-style: italic;
                    }
                    .date {
                        float: right;
                        font-size: 14px;
                        color: #555;
                    }

                    @media print {
                body {
                    font-family: Arial, sans-serif;
                    margin: 40px;
                    padding: 0rem;
                    line-height: 1.6;
                    color: #333;
                }
                h1, h2, h3 {
                    page-break-after: avoid; /* Prevent breaking headings between pages */
                }
                .contact-info, .skills, .work-experience {
                    page-break-inside: avoid; /* Prevent cutting sections mid-page */
                }
                ul {
                    page-break-inside: avoid; /* Keep list items together */
                }
                li {
                    page-break-inside: avoid; /* Ensure each list item is fully displayed */
                }
                .work-experience > p {
                    page-break-before: auto; /* Start new jobs on a fresh page if needed */
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
        const pdfBuffer = await page.pdf({ format: "A4" });
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