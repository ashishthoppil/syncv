import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/subscriptions";
import { getAuthenticatedUser, isAdminUser } from "@/lib/server/auth";
import {
  sendSupportFeedbackEmail,
  sendSupportTicketCancelledEmail,
  sendSupportTicketRaisedEmail,
  sendTicketStatusChangedEmail,
} from "@/lib/server/email";

const ATTACHMENT_BUCKET = "ticket-attachments";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const MAX_ATTACHMENTS = 5;
const MAX_MESSAGE_LENGTH = 5000;

const TICKET_TYPES = new Set(["query", "complaint"]);
const TICKET_STATUSES = new Set(["open", "in_progress", "resolved", "closed", "cancelled"]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const appUrl = () => process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "";

const fail = (message, status) => NextResponse.json({ success: false, message }, { status });

// Notifications must never take down the request that triggered them — the row
// is the source of truth, the email is a courtesy.
const notify = async (send) => {
  try {
    await send();
  } catch (error) {
    console.error("[support] notification email failed:", error.message);
  }
};

// Attachments are stored as bucket paths so the URL can expire. Signing happens
// server-side under the service role because the admin has to view images that
// belong to other users, which the anon key would refuse.
const withSignedAttachments = async (supabase, tickets) => {
  const paths = tickets.flatMap((ticket) =>
    Array.isArray(ticket.attachments) ? ticket.attachments : []
  );
  if (!paths.length) {
    return tickets.map((ticket) => ({ ...ticket, attachment_urls: [] }));
  }

  const { data } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  const urlByPath = new Map((data || []).map((entry) => [entry.path, entry.signedUrl]));

  return tickets.map((ticket) => ({
    ...ticket,
    attachment_urls: (Array.isArray(ticket.attachments) ? ticket.attachments : [])
      .map((path) => urlByPath.get(path))
      .filter(Boolean),
  }));
};

export async function GET(req) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return fail("Sign in to view your tickets.", 401);

    const admin = isAdminUser(user);
    const { searchParams } = new URL(req.url);
    const wantsAll = searchParams.get("scope") === "all";

    if (wantsAll && !admin) {
      return fail("You are not allowed to view other users' tickets.", 403);
    }

    const supabase = getSupabaseAdminClient();
    let query = supabase
      .from("support_tickets")
      .select("*, notes:support_ticket_notes(id, note, created_at, author_id)")
      .order("created_at", { ascending: false });

    if (wantsAll) {
      // Admin-only filters. Anything unrecognised is ignored rather than
      // erroring, so a stale bookmark still returns a usable list.
      const type = searchParams.get("type");
      const status = searchParams.get("status");
      const email = searchParams.get("email");
      if (type && TICKET_TYPES.has(type)) query = query.eq("type", type);
      if (status && TICKET_STATUSES.has(status)) query = query.eq("status", status);
      if (email) query = query.ilike("contact_email", `%${email}%`);
    } else {
      query = query.eq("user_id", user.id);
    }

    const { data, error } = await query;
    if (error) return fail(error.message, 500);

    const tickets = await withSignedAttachments(supabase, data || []);
    // Notes come back in arbitrary order from the join; the UI renders them as
    // a timeline, so sort oldest-first here rather than in every consumer.
    tickets.forEach((ticket) => {
      if (Array.isArray(ticket.notes)) {
        ticket.notes.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      }
    });

    return NextResponse.json({ success: true, data: tickets, isAdmin: admin });
  } catch (error) {
    return fail(error.message, 500);
  }
}

export async function POST(req) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return fail("Sign in to contact support.", 401);

    const body = await req.json();
    const type = String(body?.type || "").trim();
    const message = String(body?.message || "").trim();
    const contactEmail = String(body?.contactEmail || "").trim();
    const attachments = Array.isArray(body?.attachments) ? body.attachments : [];

    if (!message) return fail("Please describe your request.", 400);
    if (message.length > MAX_MESSAGE_LENGTH) {
      return fail(`Please keep your message under ${MAX_MESSAGE_LENGTH} characters.`, 400);
    }
    if (!EMAIL_PATTERN.test(contactEmail)) {
      return fail("Please enter a valid email address.", 400);
    }
    if (attachments.length > MAX_ATTACHMENTS) {
      return fail(`Please attach no more than ${MAX_ATTACHMENTS} images.`, 400);
    }
    // Uploads land under `${user.id}/...`; rejecting anything else stops a
    // caller attaching another user's files to their own ticket.
    if (attachments.some((path) => typeof path !== "string" || !path.startsWith(`${user.id}/`))) {
      return fail("Invalid attachment reference.", 400);
    }

    // Feedback is a fire-and-forget email — deliberately never persisted, so it
    // stays out of both the user's and the admin's ticket tables.
    if (type === "feedback") {
      await sendSupportFeedbackEmail({ message, contactEmail });
      return NextResponse.json({
        success: true,
        feedback: true,
        message: "Thanks for the feedback — it's on its way to our team.",
      });
    }

    if (!TICKET_TYPES.has(type)) return fail("Choose a valid request type.", 400);
    // Enforced here as well as in the UI: a client-side check alone is bypassable.
    if (type === "complaint" && attachments.length === 0) {
      return fail("Complaints need at least one image so we can see the problem.", 400);
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("support_tickets")
      // user_id comes from the verified token, never from the payload.
      .insert({ user_id: user.id, contact_email: contactEmail, type, message, attachments })
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    await notify(() =>
      sendSupportTicketRaisedEmail({
        ticketNumber: data.ticket_number,
        type,
        message,
        contactEmail,
        attachments,
        appUrl: appUrl(),
      })
    );

    return NextResponse.json({
      success: true,
      data: { ...data, attachment_urls: [], notes: [] },
    });
  } catch (error) {
    return fail(error.message, 500);
  }
}

export async function PATCH(req) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return fail("Sign in to update a ticket.", 401);

    const body = await req.json();
    const ticketId = String(body?.ticketId || "").trim();
    const status = String(body?.status || "").trim();

    if (!ticketId) return fail("Ticket is required.", 400);
    if (!TICKET_STATUSES.has(status)) return fail("Unknown status.", 400);

    const supabase = getSupabaseAdminClient();
    const { data: ticket, error: loadError } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .maybeSingle();

    if (loadError) return fail(loadError.message, 500);
    if (!ticket) return fail("Ticket not found.", 404);

    const admin = isAdminUser(user);
    if (!admin) {
      // Users get exactly one transition: cancelling their own open ticket.
      if (ticket.user_id !== user.id) return fail("This is not your ticket.", 403);
      if (status !== "cancelled") return fail("You can only cancel your own ticket.", 403);
      if (ticket.status === "closed" || ticket.status === "cancelled") {
        return fail("This ticket is already closed.", 400);
      }
    }

    const { data, error } = await supabase
      .from("support_tickets")
      .update({ status })
      .eq("id", ticketId)
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    if (admin) {
      await notify(() =>
        sendTicketStatusChangedEmail({
          to: ticket.contact_email,
          ticketNumber: ticket.ticket_number,
          status,
          appUrl: appUrl(),
        })
      );
    } else {
      await notify(() =>
        sendSupportTicketCancelledEmail({
          ticketNumber: ticket.ticket_number,
          contactEmail: ticket.contact_email,
        })
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return fail(error.message, 500);
  }
}
