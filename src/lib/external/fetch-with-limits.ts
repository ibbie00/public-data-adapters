// Relative import (not the @/ alias): this module is pulled in by the Telegram
// ops-alert path, which also loads under the plain tsx/jiti CLI runtimes where
// @/ is not always resolved.
import { readResponseTextWithLimit } from "../links/safe-fetch/response";

// Shared guardrail for outbound calls to external services (Turnstile, Telegram,
// billing, ATProto, …) whose responses we buffer in origin memory. Two problems
// this solves that a bare `fetch(...).then(r => r.json())` does not:
//
//  1. Timeout that covers the WHOLE exchange. A plain AbortController timer that
//     is cleared once headers arrive leaves the body read unbounded (slowloris).
//     Here the single timer stays armed until the body has been fully read.
//  2. Response-size cap. readResponseTextWithLimit checks content-length then
//     counts streamed bytes, aborting past maxResponseBytes so a hostile/broken
//     endpoint cannot make us buffer an unbounded body.
//
// The body is consumed here, so callers use the returned `text` (e.g. JSON.parse)
// rather than response.json()/response.text().

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 512 * 1024;

export type FetchWithLimitsOptions = {
  fetchImpl?: (input: string | URL, init?: RequestInit) => Promise<Response>;
  init?: RequestInit;
  maxResponseBytes?: number;
  timeoutMs?: number;
};

export async function fetchTextWithLimits(
  url: string | URL,
  options: FetchWithLimitsOptions = {}
): Promise<{ response: Response; text: string }> {
  const {
    fetchImpl = fetch,
    init,
    maxResponseBytes = DEFAULT_MAX_RESPONSE_BYTES,
    timeoutMs = DEFAULT_TIMEOUT_MS
  } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    const text = await readResponseTextWithLimit(response, maxResponseBytes);
    return { response, text };
  } finally {
    clearTimeout(timer);
  }
}

// The public-data adapters under lib/external (AniList, Annict, Jikan, GRAC,
// NEC) build a URL object and hand it to an injectable fetch, so they take this
// URL-shaped entry point rather than the string|URL one above. maxResponseBytes
// is required, not defaulted: what a search page may legitimately weigh differs
// per API, and each adapter should have to say what it expects.
export type ExternalUrlFetchLike = (input: URL, init?: RequestInit) => Promise<Response>;

export async function fetchExternalTextWithLimits(input: {
  fetchImpl: ExternalUrlFetchLike;
  init?: RequestInit;
  maxResponseBytes: number;
  timeoutMs: number;
  url: URL;
}) {
  return fetchTextWithLimits(input.url, {
    fetchImpl: (target, init) => input.fetchImpl(new URL(String(target)), init),
    init: input.init,
    maxResponseBytes: input.maxResponseBytes,
    timeoutMs: input.timeoutMs
  });
}
