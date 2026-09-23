import { supabase } from "@/lib/supabaseClient";

/**
 * fetch() with the signed-in user's Supabase access token attached.
 *
 * Routes that act for a user resolve who is calling from this token (see
 * lib/server/auth.js), never from a userId in the payload, so any call to one
 * of them has to go through here. A string body is sent as JSON; FormData is
 * left alone so the browser can set its multipart boundary.
 */
export const authedFetch = async (url: string, options: RequestInit = {}) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return fetch(url, {
    ...options,
    headers: {
      ...(typeof options.body === "string" ? { "Content-Type": "application/json" } : {}),
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(options.headers || {}),
    },
  });
};
