import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/subscriptions";
import { getAuthenticatedUser, isAdminUser } from "@/lib/server/auth";
import { sendTicketNoteAddedEmail } from "@/lib/server/email";

const MAX_NOTE_LENGTH = 2000;

const fail = (message, status) => NextResponse.json({ success: false, message }, { status });

export async function POST(req) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return fail("Sign in to add a note.", 401);
    if (!isAdminUser(user)) return fail("Only support staff can add notes.", 403);

    const body = await req.json();
    const ticketId = String(body?.ticketId || "").trim();
    const note = String(body?.note || "").trim();

    if (!ticketId) return fail("Ticket is required.", 400);
    if (!note) return fail("Note cannot be empty.", 400);
    if (note.length > MAX_NOTE_LENGTH) {
      return fail(`Please keep notes under ${MAX_NOTE_LENGTH} characters.`, 400);
    }

    const supabase = getSupabaseAdminClient();
    const { data: ticket, error: loadError } = await supabase
      .from("support_tickets")
      .select("id, ticket_number, contact_email")
      .eq("id", ticketId)
      .maybeSingle();

    if (loadError) return fail(loadError.message, 500);
    if (!ticket) return fail("Ticket not found.", 404);

    const { data, error } = await supabase
      .from("support_ticket_notes")
      .insert({ ticket_id: ticketId, author_id: user.id, note })
      .select("id, note, created_at, author_id")
      .single();

    if (error) return fail(error.message, 500);

    // The reporter sees these notes in their dashboard, so tell them one landed.
    // Failure here must not roll back the note itself.
    try {
      await sendTicketNoteAddedEmail({
        to: ticket.contact_email,
        ticketNumber: ticket.ticket_number,
        note,
        appUrl: process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "",
      });
    } catch (emailError) {
      console.error("[support] note email failed:", emailError.message);
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return fail(error.message, 500);
  }
}
