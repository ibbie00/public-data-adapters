import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  CONTEXT_PROVIDER_MAX_RESPONSE_BYTES,
  fetchContextProviderJson,
  fetchContextProviderJsonWithRetry
} from "../../src/lib/context-enrichment/providers/fetch-with-retry";

// The context providers' own fetch helper carried the same defect the
// lib/external one did: a timer cleared on headers, then an unbounded body
// read. These pin the deadline, the byte ceiling, and the rule that hitting the
// ceiling is a verdict about the response rather than something to retry.

const PROVIDERS_DIR = path.join(process.cwd(), "src", "lib", "context-enrichment", "providers");
const TEST_ENV = { NODE_ENV: "test" } as NodeJS.ProcessEnv;

class ProviderError extends Error {}

function timeoutError() {
  return new ProviderError("PROVIDER_TIMEOUT");
}

function oversizedResponse(status = 200) {
  return new Response("{}", {
    headers: {
      "content-length": String(CONTEXT_PROVIDER_MAX_RESPONSE_BYTES * 4),
      "content-type": "application/json"
    },
    status
  });
}

function streamedOversizedResponse(bytes: number) {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("z".repeat(bytes)));
        controller.close();
      }
    })
  );
}

async function collectTypeScriptFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectTypeScriptFiles(entryPath)));
      continue;
    }

    if (entry.name.endsWith(".ts")) {
      files.push(entryPath);
    }
  }

  return files;
}

test("the retry helper returns the capped body text and the response", async () => {
  const { response, text } = await fetchContextProviderJsonWithRetry({
    env: TEST_ENV,
    fallbackErrorMessage: "FETCH_FAILED",
    fetchImpl: async () => Response.json({ rows: [1, 2] }),
    headers: {},
    retryCount: 1,
    timeoutError,
    url: new URL("https://example.test/rows")
  });

  assert.equal(response.ok, true);
  assert.deepEqual(JSON.parse(text), { rows: [1, 2] });
});

test("a body past the cap is refused and NOT retried", async () => {
  let calls = 0;

  await assert.rejects(
    fetchContextProviderJsonWithRetry({
      env: TEST_ENV,
      fallbackErrorMessage: "FETCH_FAILED",
      fetchImpl: async () => {
        calls += 1;
        return oversizedResponse();
      },
      headers: {},
      maxResponseBytes: 1024,
      retryCount: 2,
      timeoutError,
      url: new URL("https://example.test/rows")
    }),
    /SAFE_FETCH_RESPONSE_TOO_LARGE/u
  );

  assert.equal(calls, 1, "an oversized body is not a transient fault to retry");
});

test("a streamed body past the cap is cut off mid-read", async () => {
  await assert.rejects(
    fetchContextProviderJsonWithRetry({
      env: TEST_ENV,
      fallbackErrorMessage: "FETCH_FAILED",
      fetchImpl: async () => streamedOversizedResponse(8 * 1024),
      headers: {},
      maxResponseBytes: 1024,
      retryCount: 0,
      timeoutError,
      url: new URL("https://example.test/rows")
    }),
    /SAFE_FETCH_RESPONSE_TOO_LARGE/u
  );
});

test("transient statuses are still retried", async () => {
  let calls = 0;
  const { response } = await fetchContextProviderJsonWithRetry({
    env: TEST_ENV,
    fallbackErrorMessage: "FETCH_FAILED",
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? new Response("upstream busy", { status: 503 })
        : Response.json({ ok: true });
    },
    headers: {},
    retryCount: 1,
    timeoutError,
    url: new URL("https://example.test/rows")
  });

  assert.equal(calls, 2);
  assert.equal(response.status, 200);
});

test("the deadline covers the body, not just the headers", async () => {
  const startedAt = Date.now();

  await assert.rejects(
    fetchContextProviderJsonWithRetry({
      env: { ...TEST_ENV, CONTEXT_PROVIDER_TIMEOUT_MS: "600" } as NodeJS.ProcessEnv,
      fallbackErrorMessage: "FETCH_FAILED",
      fetchImpl: async (_url, init) =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              // Headers land immediately; the body never produces a chunk.
              init?.signal?.addEventListener("abort", () => {
                controller.error(new DOMException("aborted", "AbortError"));
              });
            }
          })
        ),
      headers: {},
      retryCount: 0,
      timeoutError,
      url: new URL("https://example.test/rows")
    }),
    (error: unknown) => error instanceof ProviderError
  );

  assert.ok(Date.now() - startedAt < 5000, "the body read must be bounded by the timeout");
});

test("the non-retrying JSON helper is capped too", async () => {
  await assert.rejects(
    fetchContextProviderJson({
      env: TEST_ENV,
      fallbackError: (error) => new ProviderError(String(error)),
      fetchImpl: async () => streamedOversizedResponse(8 * 1024),
      isProviderError: (error) => error instanceof ProviderError,
      maxResponseBytes: 1024,
      responseError: () => null,
      timeoutError,
      url: new URL("https://example.test/rows")
    }),
    /SAFE_FETCH_RESPONSE_TOO_LARGE/u
  );
});

test("no context provider reads a response body outside the capped helper", async () => {
  const files = await collectTypeScriptFiles(PROVIDERS_DIR);
  const helper = path.join(PROVIDERS_DIR, "fetch-with-retry.ts");
  const offenders: string[] = [];

  for (const file of files) {
    if (file === helper) {
      continue;
    }

    const source = await readFile(file, "utf8");

    if (/\.(?:json|text|arrayBuffer|blob|bytes)\(\)/u.test(source)) {
      offenders.push(path.relative(process.cwd(), file));
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "take the body from the helper's `text`/`bytes` so it carries a deadline and a byte cap"
  );
});
