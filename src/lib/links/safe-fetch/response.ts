import { Buffer } from "node:buffer";
import { SafeFetchError } from "./errors";

export async function readResponseTextWithLimit(
  response: Response,
  maxBytes: number
) {
  const contentLength = Number(response.headers.get("content-length") ?? "");

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new SafeFetchError("SAFE_FETCH_RESPONSE_TOO_LARGE");
  }

  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      receivedBytes += value.byteLength;

      if (receivedBytes > maxBytes) {
        await reader.cancel();
        throw new SafeFetchError("SAFE_FETCH_RESPONSE_TOO_LARGE");
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function readResponseBytesWithLimit(
  response: Response,
  maxBytes: number,
  options: { timeoutMs?: number } = {}
) {
  const contentLength = Number(response.headers.get("content-length") ?? "");

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new SafeFetchError("SAFE_FETCH_RESPONSE_TOO_LARGE");
  }

  if (!response.body) {
    return new Uint8Array();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  const timeoutAt = options.timeoutMs ? Date.now() + options.timeoutMs : null;

  try {
    while (true) {
      const remainingTimeoutMs = timeoutAt ? timeoutAt - Date.now() : null;

      if (remainingTimeoutMs !== null && remainingTimeoutMs <= 0) {
        await reader.cancel();
        throw new SafeFetchError("SAFE_FETCH_BODY_TIMEOUT");
      }

      let timer: ReturnType<typeof setTimeout> | undefined;

      let result: ReadableStreamReadResult<Uint8Array>;

      try {
        result = remainingTimeoutMs
          ? await Promise.race([
              reader.read(),
              new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new SafeFetchError("SAFE_FETCH_BODY_TIMEOUT")), remainingTimeoutMs);
              })
            ]).finally(() => {
              if (timer) {
                clearTimeout(timer);
              }
            })
          : await reader.read();
      } catch (error) {
        if (error instanceof SafeFetchError && error.code === "SAFE_FETCH_BODY_TIMEOUT") {
          await reader.cancel();
        }

        throw error;
      }

      const { done, value } = result;

      if (done) {
        break;
      }

      if (!value) {
        continue;
      }

      receivedBytes += value.byteLength;

      if (receivedBytes > maxBytes) {
        await reader.cancel();
        throw new SafeFetchError("SAFE_FETCH_RESPONSE_TOO_LARGE");
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks);
}
