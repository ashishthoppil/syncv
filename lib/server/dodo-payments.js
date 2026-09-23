import crypto from "crypto";

// Dodo Payments, called over its REST API: the four calls below don't need the
// SDK. https://docs.dodopayments.com/api-reference
const BASE_URLS = {
  test_mode: "https://test.dodopayments.com",
  live_mode: "https://live.dodopayments.com",
};

/**
 * Test mode unless DODO_PAYMENTS_ENVIRONMENT is "live_mode". Forgetting the
 * setting in production then fails loudly (a live key is rejected by the test
 * API) instead of a local checkout charging a real card.
 */
const getBaseUrl = () =>
  BASE_URLS[process.env.DODO_PAYMENTS_ENVIRONMENT] || BASE_URLS.test_mode;

/** Statuses after which a Dodo subscription never bills again. */
export const DODO_ENDED_STATUSES = new Set(["cancelled", "expired", "failed"]);

export class DodoApiError extends Error {
  constructor(message, { status, code } = {}) {
    super(message);
    this.name = "DodoApiError";
    this.status = status;
    this.code = code;
  }
}

const dodoRequest = async (method, path, body) => {
  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  if (!apiKey) {
    throw new DodoApiError("Missing Dodo Payments API key.", { status: 500 });
  }

  const response = await fetch(`${getBaseUrl()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // Not JSON (a gateway error page, say); the status and text say enough.
  }

  if (!response.ok) {
    throw new DodoApiError(
      json?.message || json?.error || `Dodo Payments request failed (${response.status}).`,
      { status: response.status, code: json?.code }
    );
  }
  return json;
};

/** A hosted checkout page. Returns { session_id, checkout_url }. */
export const createCheckoutSession = (params) => dodoRequest("POST", "/checkouts", params);

export const retrieveSubscription = (subscriptionId) =>
  dodoRequest("GET", `/subscriptions/${encodeURIComponent(subscriptionId)}`);

const updateSubscription = (subscriptionId, params) =>
  dodoRequest("PATCH", `/subscriptions/${encodeURIComponent(subscriptionId)}`, params);

/**
 * Stops a subscription billing. `atPeriodEnd` lets it run to the end of the
 * period already paid for, and Dodo sends subscription.cancelled then;
 * otherwise it ends now. One that has already ended counts as cancelled.
 */
export const cancelDodoSubscription = async (subscriptionId, { atPeriodEnd = false } = {}) => {
  try {
    await updateSubscription(
      subscriptionId,
      atPeriodEnd ? { cancel_at_next_billing_date: true } : { status: "cancelled" }
    );
  } catch (error) {
    const current = await retrieveSubscription(subscriptionId).catch(() => null);
    if (current && DODO_ENDED_STATUSES.has(current.status)) return;
    throw error;
  }
};

// The Standard Webhooks default: a delivery signed longer ago than this is
// refused, so a captured request can't be replayed later. Dodo signs every
// retry afresh.
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

/**
 * Whether a webhook really came from Dodo. Dodo signs per Standard Webhooks
 * (https://www.standardwebhooks.com): an HMAC-SHA256 of
 * "<webhook-id>.<webhook-timestamp>.<raw body>", keyed with the base64 part of
 * the "whsec_…" secret, sent base64-encoded as "v1,<signature>" — several of
 * them, space-separated, while a secret is being rotated.
 */
export const verifyDodoWebhook = (rawBody, headers, secret) => {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatureHeader = headers.get("webhook-signature");
  if (!secret || !id || !timestamp || !signatureHeader) return false;

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() / 1000 - sentAt) > WEBHOOK_TOLERANCE_SECONDS) {
    return false;
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto
    .createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest();

  return signatureHeader.split(" ").some((entry) => {
    const [version, signature] = entry.split(",");
    if (version !== "v1" || !signature) return false;
    const received = Buffer.from(signature, "base64");
    return received.length === expected.length && crypto.timingSafeEqual(received, expected);
  });
};
