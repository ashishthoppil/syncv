import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// The support inbox doubles as the admin account. Overridable so staging can
// point at a different mailbox without a code change.
export const SUPPORT_ADMIN_EMAIL = (
  process.env.SUPPORT_ADMIN_EMAIL || "info@syncv.app"
).toLowerCase();

/**
 * Resolves the caller from their Supabase access token, or null if the token is
 * missing, malformed or expired.
 *
 * Deliberately uses the ANON key: `auth.getUser(token)` validates the JWT's
 * signature and expiry against the auth server, which is the whole point. The
 * service-role client used elsewhere in this codebase bypasses RLS and cannot
 * tell you who is calling — so routes must resolve identity here, never from a
 * userId in the request body.
 */
export async function getAuthenticatedUser(request) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase public configuration.");
  }

  const header = request.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

/**
 * Admin check. Must only ever be handed a user from getAuthenticatedUser() —
 * `auth.users.email` is authoritative, whereas `profiles.email` is only written
 * when a user saves the Profile form and can be null or stale.
 */
export const isAdminUser = (user) =>
  Boolean(user?.email) && user.email.toLowerCase() === SUPPORT_ADMIN_EMAIL;
