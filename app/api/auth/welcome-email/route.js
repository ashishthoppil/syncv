import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWelcomeEmail } from "@/lib/server/email";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = body?.userId;

    if (!userId) {
      return NextResponse.json({ error: "Missing user id." }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Missing Supabase service role key." }, { status: 500 });
    }

    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError) {
      throw userError;
    }

    const user = userData?.user;
    const email = user?.email;
    const appMetadata = user?.app_metadata || {};

    if (!email) {
      return NextResponse.json({ skipped: true });
    }

    if (appMetadata.welcome_email_sent_at) {
      return NextResponse.json({ skipped: true });
    }

    const appUrl =
      process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || new URL(request.url).origin;
    const welcomeEmailSentAt = new Date().toISOString();
    let emailSent = false;
    let metadataUpdated = false;
    let warning = null;

    try {
      await sendWelcomeEmail({
        to: email,
        appUrl: `${appUrl.replace(/\/$/, "")}/onboarding`,
      });
      emailSent = true;
    } catch (emailError) {
      warning =
        emailError instanceof Error ? emailError.message : "Failed to send welcome email.";
      console.warn("Welcome email send failed.", {
        userId,
        email,
        error: warning,
      });
    }

    if (emailSent) {
      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        app_metadata: {
          ...appMetadata,
          welcome_email_sent_at: welcomeEmailSentAt,
        },
      });

      if (updateError) {
        warning =
          updateError instanceof Error
            ? updateError.message
            : "Failed to update welcome email metadata.";
        console.warn("Welcome email metadata update failed.", {
          userId,
          email,
          error: warning,
        });
      } else {
        metadataUpdated = true;
      }
    }

    return NextResponse.json({
      sent: emailSent,
      metadataUpdated,
      ...(warning ? { warning } : {}),
    });
  } catch (error) {
    console.error("Welcome email route failed.", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send welcome email." },
      { status: 500 }
    );
  }
}
