import { SafeFetchError } from "../../links/safe-fetch/errors";
import {
  readResponseBytesWithLimit,
  readResponseTextWithLimit
} from "../../links/safe-fetch/response";
import { getContextProviderTimeoutMs } from "../guards";

// Outbound helper for the context-enrichment providers (kosis, ecos, national
// law, NEC, …). Two guardrails every call here gets:
//
//  1. One deadline that covers the WHOLE exchange. A timer cleared once headers
//     arrive leaves the body read unbounded, which is the part a slow endpoint
//     can stretch indefinitely. The timer here stays armed until the body has
//     been read.
//  2. A streamed byte ceiling, so a runaway or hostile response cannot be
//     buffered without end in origin memory.
//
// Both come from readResponseTextWithLimit, the same reader lib/external and
// the link-preview path use. The body is consumed here, so callers work from
// the returned `text` rather than calling response.json()/response.text().

export type ProviderFetchLike = (input: URL, init?: RequestInit) => Promise<Response>;

export const CONTEXT_PROVIDER_TRANSIENT_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

// These APIs return search pages of short records: statistics rows, bill
// summaries, law article text. 1 MiB is well past the widest page any of them
// serves, and callers can narrow it per request.
export const CONTEXT_PROVIDER_MAX_RESPONSE_BYTES = 1024 * 1024;

type ContextProviderBodyRequest<T> = {
  env: NodeJS.ProcessEnv;
  fallbackError: (error: unknown) => Error;
  fetchImpl: ProviderFetchLike;
  headers?: HeadersInit;
  init?: RequestInit;
  isProviderError: (error: unknown) => boolean;
  maxResponseBytes?: number;
  readBody: (text: string) => T;
  responseError: (response: Response) => Error | null;
  timeoutError: () => Error;
  timeoutMs?: number;
  url: URL;
};

type DefaultHttpStatusLabels<Status extends string> = {
  externalApiError: Status;
  invalidCredentials: Status;
  notFound: Status;
  rateLimited: Status;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

// A body that blew the size ceiling is a verdict about this response, not a
// transient network fault. Retrying would ask for the same oversized body again.
function isResponseTooLargeError(error: unknown) {
  return error instanceof SafeFetchError && error.code === "SAFE_FETCH_RESPONSE_TOO_LARGE";
}

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) {
    return {};
  }
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return headers;
}

function mergeHeaders(base: HeadersInit | undefined, override: HeadersInit | undefined) {
  return {
    ...normalizeHeaders(base),
    ...normalizeHeaders(override)
  };
}

async function fetchContextProviderBody<T>(input: ContextProviderBodyRequest<T>) {
  try {
    const { response, text } = await fetchContextProviderCappedText({
      env: input.env,
      fetchImpl: input.fetchImpl,
      headers: input.headers,
      init: input.init,
      maxResponseBytes: input.maxResponseBytes,
      timeoutError: input.timeoutError,
      timeoutMs: input.timeoutMs,
      url: input.url
    });
    const responseError = input.responseError(response);
    if (responseError) {
      throw responseError;
    }

    return input.readBody(text);
  } catch (error) {
    if (input.isProviderError(error)) {
      throw error;
    }

    throw input.fallbackError(error);
  }
}

export function isProviderRetryDisabled(env: NodeJS.ProcessEnv) {
  const value = env.CONTEXT_PROVIDER_RETRY_DISABLED;
  return value === "1" || value?.toLowerCase() === "true";
}

export function getContextProviderFetchImpl(fetchImpl?: ProviderFetchLike): ProviderFetchLike {
  if (fetchImpl) {
    return fetchImpl;
  }

  // Default outbound path for context providers: a plain direct fetch. Callers
  // that need a proxy, a custom dispatcher, or instrumentation inject their own
  // fetchImpl (per provider options or per search call).
  return ((url: URL, init?: RequestInit) => fetch(url, init)) as ProviderFetchLike;
}

export function getDefaultContextProviderHttpStatus<Status extends string>(
  response: Response,
  labels: DefaultHttpStatusLabels<Status>
) {
  if (response.ok) {
    return null;
  }
  if (response.status === 401 || response.status === 403) {
    return labels.invalidCredentials;
  }
  if (response.status === 404) {
    return labels.notFound;
  }
  if (response.status === 429) {
    return labels.rateLimited;
  }

  return labels.externalApiError;
}

export async function fetchContextProviderCappedText(input: {
  env: NodeJS.ProcessEnv;
  fetchImpl: ProviderFetchLike;
  headers?: HeadersInit;
  init?: RequestInit;
  maxResponseBytes?: number;
  timeoutError: () => Error;
  timeoutMs?: number;
  url: URL;
}): Promise<{ response: Response; text: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? getContextProviderTimeoutMs(input.env)
  );

  try {
    const response = await input.fetchImpl(input.url, {
      ...input.init,
      headers: mergeHeaders(input.headers, input.init?.headers),
      signal: controller.signal
    });
    const text = await readResponseTextWithLimit(
      response,
      input.maxResponseBytes ?? CONTEXT_PROVIDER_MAX_RESPONSE_BYTES
    );

    return { response, text };
  } catch (error) {
    if (isAbortError(error)) {
      throw input.timeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchContextProviderJson(input: Omit<ContextProviderBodyRequest<unknown>, "readBody">) {
  return fetchContextProviderBody({
    ...input,
    readBody: (text) => JSON.parse(text) as unknown
  });
}

export async function fetchContextProviderText(input: Omit<ContextProviderBodyRequest<string>, "readBody">) {
  return fetchContextProviderBody({
    ...input,
    readBody: (text) => text
  });
}

export async function fetchContextProviderJsonWithRetry(input: {
  env: NodeJS.ProcessEnv;
  fallbackErrorMessage: string;
  fetchImpl: ProviderFetchLike;
  headers: HeadersInit;
  maxResponseBytes?: number;
  retryCount: number;
  timeoutError: () => Error;
  url: URL;
}): Promise<{ bytes: Uint8Array; response: Response; text: string }> {
  const retryCount = Math.max(0, input.retryCount);
  let lastError: unknown;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getContextProviderTimeoutMs(input.env));

    try {
      const response = await input.fetchImpl(input.url, {
        headers: input.headers,
        signal: controller.signal
      });

      if (!CONTEXT_PROVIDER_TRANSIENT_STATUS_CODES.has(response.status) || attempt === retryCount) {
        // Bytes, not text: one of these services (NKIS) still answers in EUC-KR
        // and has to decode by the declared charset. Reading once and handing
        // back both views keeps the single capped read.
        const bytes = await readResponseBytesWithLimit(
          response,
          input.maxResponseBytes ?? CONTEXT_PROVIDER_MAX_RESPONSE_BYTES
        );

        return { bytes, response, text: new TextDecoder().decode(bytes) };
      }

      // Giving up on this attempt: drop the body rather than leaving a
      // half-read response behind while the next attempt opens.
      try {
        await response.body?.cancel();
      } catch {
        // The retry does not depend on the discard succeeding.
      }
    } catch (error) {
      lastError = error;
      if (isAbortError(error)) {
        throw input.timeoutError();
      }
      if (isResponseTooLargeError(error) || attempt === retryCount) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }

    await sleep(80 * (attempt + 1));
  }

  throw lastError instanceof Error ? lastError : new Error(input.fallbackErrorMessage);
}
