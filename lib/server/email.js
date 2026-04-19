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

export async function sendSubscriptionEmail({ to, appUrl }) {
  const html = `
    <div style="background:#f6f5f2;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#141414;">
      <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid #e6e4df;">
        <p style="font-size:12px;letter-spacing:0.3em;text-transform:uppercase;color:#8b7e6b;margin:0 0 12px;">SynCV</p>
        <h1 style="font-size:24px;margin:0 0 12px;">Payment successful</h1>
        <p style="font-size:14px;line-height:1.6;margin:0 0 20px;color:#4a4a4a;">
          Your subscription is active. You can start optimizing your resume now.
        </p>
        <a href="${appUrl}" style="display:inline-block;background:#141414;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:999px;font-size:14px;font-weight:600;">
          Open SynCV Dashboard
        </a>
        <p style="font-size:12px;color:#9b9488;margin:20px 0 0;">
          If the button does not work, paste this link into your browser: ${appUrl}
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
