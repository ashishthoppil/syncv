import { SUPPORT_ADMIN_EMAIL } from "./auth";

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from || !to) {
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend error: ${errorText}`);
  }
}

// `plan` is the plan just bought. One without the resume tools (Remote Jobs)
// gets copy and a link about the jobs board, not about optimizing a resume.
export async function sendSubscriptionEmail({ to, appUrl, plan }) {
  const jobsOnly = plan ? !plan.includesResumeTools : false;
  const body = jobsOnly
    ? `Your ${escapeHtml(plan.name)} plan is active. The full jobs board is open to you now.`
    : "Your subscription is active. You can start optimizing your resume now.";
  const link = jobsOnly ? `${appUrl}?section=remote-jobs` : appUrl;
  const html = `
    <div style="background:#f6f5f2;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#141414;">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid #e6e4df;">
        <p style="font-size:12px;letter-spacing:0.3em;text-transform:uppercase;color:#8b7e6b;margin:0 0 12px;">SynCV</p>
        <h1 style="font-size:24px;margin:0 0 12px;">Payment successful</h1>
        <p style="font-size:14px;line-height:1.6;margin:0 0 20px;color:#4a4a4a;">
          ${body}
        </p>
        <a href="${link}" style="display:inline-block;background:#141414;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-size:14px;font-weight:600;">
          ${jobsOnly ? "Browse Remote Jobs" : "Open SynCV Dashboard"}
        </a>
        <p style="font-size:12px;color:#9b9488;margin:20px 0 0;">
          If the button does not work, paste this link into your browser: ${link}
        </p>
      </div>
    </div>
  `;

  await sendEmail({
    to,
    subject: "Your SynCV subscription is active!",
    html,
  });
}

export async function sendWelcomeEmail({ to, appUrl }) {
  const html = `
    <div style="background:#f6f5f2;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#141414;">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid #e6e4df;">
        <h1 style="font-size:24px;margin:0 0 12px;">Hi there,</h1>
        <p style="font-size:14px;line-height:1.6;margin:0 0 20px;color:#4a4a4a;">
          Welcome to SynCV — we’re excited to have you here! 🎉
<br/><br/>
You’re now one step closer to creating resumes that stand out, pass ATS filters, and get more interviews.

With SynCV, you can:
<br/><br/>
✅ Instantly analyze your resume against any job description
<br/>✅ Optimize your resume to improve ATS scores
<br/>✅ Generate tailored resumes and cover letters in one click
<br/>✅ Track your job applications in one place
<br/><br/>
Getting started takes less than a minute.
<br/><br/>
Click below to complete your setup and start tailoring your resume for your next opportunity.
        </p>
        <div style="display:flex;justify-content:center;">
            <a href="${appUrl}" style="display:inline-block;background:#141414;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-size:14px;font-weight:600;">
          Complete Your Setup
        </a>
        </div>
        <div style="display:flex;justify-content:center;">
        <p style="font-size:12px;color:#9b9488;margin:20px 0 0;">
          If the button does not work, paste this link into your browser: ${appUrl}
        </p>
        </div>
      </div>
    </div>
  `;

  await sendEmail({
    to,
    subject: "Welcome to SynCV — Let’s Land Your Next Job 🚀",
    html,
  });
}

/* ---------------------------------------------------------------------------
 * Help Center / support tickets
 * ------------------------------------------------------------------------- */

// Ticket text is user-supplied and goes straight into an HTML body, so it has
// to be escaped — otherwise a message containing markup breaks the email (or
// worse, smuggles a link into what looks like our own copy).
const escapeHtml = (value = "") =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Preserves the user's line breaks after escaping.
const escapeMultiline = (value = "") => escapeHtml(value).replace(/\n/g, "<br/>");

const STATUS_LABELS = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
  cancelled: "Cancelled",
};

export const statusLabel = (status) => STATUS_LABELS[status] || status || "Unknown";

// Shared shell so all five support emails match the existing card style.
const supportCard = ({ heading, intro, rows = [], body = "", cta, eyebrow = "SynCV Support" }) => {
  const rowsHtml = rows
    .filter((row) => row && row.value)
    .map(
      (row) => `
        <tr>
          <td style="padding:4px 12px 4px 0;font-size:12px;color:#8b7e6b;text-transform:uppercase;letter-spacing:0.08em;white-space:nowrap;vertical-align:top;">${escapeHtml(
            row.label
          )}</td>
          <td style="padding:4px 0;font-size:14px;color:#141414;">${escapeHtml(row.value)}</td>
        </tr>`
    )
    .join("");

  return `
    <div style="background:#f6f5f2;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#141414;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid #e6e4df;">
        <p style="font-size:12px;letter-spacing:0.3em;text-transform:uppercase;color:#8b7e6b;margin:0 0 12px;">${escapeHtml(
          eyebrow
        )}</p>
        <h1 style="font-size:22px;margin:0 0 12px;">${escapeHtml(heading)}</h1>
        ${
          intro
            ? `<p style="font-size:14px;line-height:1.6;margin:0 0 18px;color:#4a4a4a;">${escapeHtml(
                intro
              )}</p>`
            : ""
        }
        ${rowsHtml ? `<table style="border-collapse:collapse;margin:0 0 18px;">${rowsHtml}</table>` : ""}
        ${
          body
            ? `<div style="background:#f6f5f2;border-radius:12px;padding:16px;font-size:14px;line-height:1.6;color:#141414;margin:0 0 18px;white-space:pre-wrap;">${body}</div>`
            : ""
        }
        ${
          cta
            ? `<a href="${cta.url}" style="display:inline-block;background:#141414;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-size:14px;font-weight:600;">${escapeHtml(
                cta.label
              )}</a>`
            : ""
        }
      </div>
    </div>
  `;
};

const attachmentSummary = (attachments = []) =>
  attachments.length
    ? `${attachments.length} image${attachments.length === 1 ? "" : "s"} attached (view in the dashboard)`
    : "";

export async function sendSupportTicketRaisedEmail({
  ticketNumber,
  type,
  message,
  contactEmail,
  attachments = [],
  appUrl,
}) {
  const typeLabel = type === "complaint" ? "Complaint" : "Query";
  await sendEmail({
    to: SUPPORT_ADMIN_EMAIL,
    subject: `[${ticketNumber}] New ${typeLabel.toLowerCase()} from ${contactEmail}`,
    html: supportCard({
      heading: `New ${typeLabel.toLowerCase()} raised`,
      intro: `${ticketNumber} is waiting in the Help Center.`,
      rows: [
        { label: "Ticket", value: ticketNumber },
        { label: "Type", value: typeLabel },
        { label: "From", value: contactEmail },
        { label: "Attachments", value: attachmentSummary(attachments) },
      ],
      body: escapeMultiline(message),
      cta: appUrl ? { url: `${appUrl}/scan?section=help-center`, label: "Open Help Center" } : null,
    }),
  });
}

export async function sendSupportFeedbackEmail({ message, contactEmail }) {
  await sendEmail({
    to: SUPPORT_ADMIN_EMAIL,
    subject: `New feedback from ${contactEmail}`,
    html: supportCard({
      heading: "New feedback",
      intro: "Someone left feedback through the Help Center.",
      rows: [{ label: "From", value: contactEmail }],
      body: escapeMultiline(message),
    }),
  });
}

export async function sendSupportTicketCancelledEmail({ ticketNumber, contactEmail }) {
  await sendEmail({
    to: SUPPORT_ADMIN_EMAIL,
    subject: `[${ticketNumber}] Cancelled by the user`,
    html: supportCard({
      heading: "Ticket cancelled",
      intro: `${ticketNumber} was cancelled by the person who raised it. No action needed.`,
      rows: [
        { label: "Ticket", value: ticketNumber },
        { label: "From", value: contactEmail },
      ],
    }),
  });
}

export async function sendTicketStatusChangedEmail({ to, ticketNumber, status, appUrl }) {
  await sendEmail({
    to,
    subject: `[${ticketNumber}] Status changed to ${statusLabel(status)}`,
    html: supportCard({
      heading: "There has been a status change",
      intro: `Your ticket ${ticketNumber} is now marked "${statusLabel(status)}".`,
      rows: [
        { label: "Ticket", value: ticketNumber },
        { label: "Status", value: statusLabel(status) },
      ],
      cta: appUrl ? { url: `${appUrl}/scan?section=help-center`, label: "View ticket" } : null,
    }),
  });
}

export async function sendTicketNoteAddedEmail({ to, ticketNumber, note, appUrl }) {
  await sendEmail({
    to,
    subject: `[${ticketNumber}] Support left a note`,
    html: supportCard({
      heading: "Support has left a note on your ticket",
      intro: `A note was added to ${ticketNumber}.`,
      rows: [{ label: "Ticket", value: ticketNumber }],
      body: escapeMultiline(note),
      cta: appUrl ? { url: `${appUrl}/scan?section=help-center`, label: "View ticket" } : null,
    }),
  });
}

/* ---------------------------------------------------------------------------
 * Internal notifications
 * ------------------------------------------------------------------------- */

const PROVIDER_LABELS = {
  email: "Email + password",
  google: "Google",
};

// Fired once per user, the first time they register. Goes to the support inbox,
// never to the user.
export async function sendNewUserAdminEmail({ email, userId, provider, registeredAt }) {
  const registered = registeredAt ? new Date(registeredAt) : null;

  await sendEmail({
    to: SUPPORT_ADMIN_EMAIL,
    subject: `New SynCV signup: ${email}`,
    html: supportCard({
      eyebrow: "SynCV",
      heading: "A new user just registered",
      intro: `${email} created a SynCV account.`,
      rows: [
        { label: "Email", value: email },
        { label: "Signed up with", value: PROVIDER_LABELS[provider] || provider },
        {
          label: "Registered",
          value:
            registered && !Number.isNaN(registered.valueOf())
              ? `${registered.toUTCString()}`
              : "",
        },
        { label: "User ID", value: userId },
      ],
    }),
  });
}

/* -------------------------------------------------------------------------
 * Remote Jobs daily ingest report
 * ------------------------------------------------------------------------- */

const JOB_REPORT_EMAIL = process.env.JOB_REPORT_EMAIL || "info@syncv.app";

const INGEST_STATUS_LABELS = {
  ok: "OK",
  partial: "Partial",
  failed: "Failed",
  skipped: "Skipped",
  running: "Did not finish",
  missing: "Did not run",
};

const cell = (value, { align = "left", bold = false, color = "#141414" } = {}) =>
  `<td style="padding:8px 10px;border-bottom:1px solid #e6e4df;font-size:14px;text-align:${align};color:${color};${
    bold ? "font-weight:700;" : ""
  }">${escapeHtml(value)}</td>`;

const headCell = (value, align = "left") =>
  `<th style="padding:8px 10px;border-bottom:2px solid #141414;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;color:#8b7e6b;text-align:${align};">${escapeHtml(
    value
  )}</th>`;

// One row per source: how many jobs it yielded, how many were new, and whether
// it ran cleanly. Partial and failed sources get their reason listed below the
// table, since that is what someone reading this needs to act on.
export async function sendJobIngestReportEmail({ sources, totals, ranAt }) {
  const statusColor = { ok: "#1f7a3a", partial: "#a15c00", failed: "#b42318" };
  const rowsHtml = sources
    .map(
      (source) =>
        `<tr>${cell(source.name)}${cell(source.fetched.toLocaleString("en-US"), { align: "right" })}${cell(
          source.newJobs.toLocaleString("en-US"),
          { align: "right" }
        )}${cell(INGEST_STATUS_LABELS[source.status] || source.status, {
          color: statusColor[source.status] || "#4a4a4a",
        })}</tr>`
    )
    .join("");
  const totalRow = `<tr>${cell("Total", { bold: true })}${cell(totals.fetched.toLocaleString("en-US"), {
    align: "right",
    bold: true,
  })}${cell(totals.newJobs.toLocaleString("en-US"), { align: "right", bold: true })}${cell("")}</tr>`;
  const table = `<table style="border-collapse:collapse;width:100%;"><thead><tr>${headCell("Source")}${headCell(
    "Jobs pulled",
    "right"
  )}${headCell("New", "right")}${headCell("Status")}</tr></thead><tbody>${rowsHtml}${totalRow}</tbody></table>`;

  const issues = sources
    .filter((source) => source.note && source.status !== "ok")
    .map((source) => `<li>${escapeHtml(source.name)}: ${escapeHtml(source.note)}</li>`)
    .join("");
  const issuesHtml = issues
    ? `<p style="margin:16px 0 6px;font-size:13px;font-weight:700;">Notes</p><ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6;color:#4a4a4a;">${issues}</ul>`
    : "";

  const date = new Date(ranAt).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  await sendEmail({
    to: JOB_REPORT_EMAIL,
    subject: `Jobs ingest ${date}: ${totals.fetched.toLocaleString("en-US")} pulled, ${totals.newJobs.toLocaleString(
      "en-US"
    )} new`,
    html: supportCard({
      eyebrow: "SynCV Remote Jobs",
      heading: `Daily jobs ingest — ${date}`,
      intro: `"Jobs pulled" counts the remote and hybrid jobs each source returned from the last ${
        totals.retentionDays
      } days; "New" counts the ones we hadn't stored before.`,
      body: `${table}${issuesHtml}`.replace(/\n/g, ""),
      rows: [
        { label: "Jobs live now", value: totals.jobsLive == null ? "" : totals.jobsLive.toLocaleString("en-US") },
        { label: "Taken down", value: totals.removed.toLocaleString("en-US") },
        { label: "Expired", value: totals.expired.toLocaleString("en-US") },
        { label: "Companies classified", value: totals.companiesEnriched.toLocaleString("en-US") },
      ],
    }),
  });
}
