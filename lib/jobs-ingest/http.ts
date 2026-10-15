/**
 * Upstream requests for the ingest. Unlike the old live search, nothing here
 * goes through Next's fetch cache: the cron reads each source once a day and
 * wants today's answer, and several boards are far over the cache's 2MB limit
 * anyway.
 */

const USER_AGENT = "SynCV job ingest (+https://syncv.app)";
const DEFAULT_TIMEOUT_MS = 20_000;

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type FetchOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Retries after a 429 or 5xx. */
  retries?: number;
  /** Epoch ms; no retry is attempted past it. */
  deadline?: number;
};

/**
 * JSON over HTTP with a timeout, and a polite retry on 429/5xx that honours
 * Retry-After. A 404 is not retried — for an ATS board it means the company
 * moved off that platform.
 */
export const fetchJson = async <T>(url: string, options: FetchOptions = {}): Promise<T> => {
  const { method = "GET", body, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS, retries = 2, deadline } =
    options;
  let attempt = 0;
  for (;;) {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.ok) return (await response.json()) as T;

    const retryable = response.status === 429 || response.status >= 500;
    const retryAfter = Number(response.headers.get("retry-after")) || 0;
    const wait = Math.min(Math.max(retryAfter * 1000, 1500 * (attempt + 1)), 10_000);
    const outOfTime = deadline !== undefined && Date.now() + wait > deadline;
    if (!retryable || attempt >= retries || outOfTime) {
      throw new HttpError(`${new URL(url).host} responded with ${response.status}`, response.status);
    }
    attempt += 1;
    await sleep(wait);
  }
};

/** Runs `task` over `items`, at most `limit` at a time; failures are collected, not thrown. */
export const pooled = async <T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> => {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { status: "fulfilled", value: await task(items[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(workers);
  return results;
};

export const hasTimeLeft = (deadline: number, reserveMs = 0) => Date.now() + reserveMs < deadline;
