import { XMLParser } from "fast-xml-parser";

import { RealEstateProviderError, type RealEstateProviderStatus } from "./types";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true
});

export function clean(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

export function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function getPath(value: unknown, path: string[]) {
  let cursor: unknown = value;
  for (const key of path) {
    const object = asObject(cursor);
    if (!object) {
      return undefined;
    }
    cursor = object[key];
  }
  return cursor;
}

export function toArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => Boolean(asObject(item)));
  }
  const object = asObject(value);

  return object ? [object] : [];
}

export function parseMolitPayload(rawText: string) {
  const text = rawText.trim();
  if (!text) {
    throw new RealEstateProviderError("PARSE_ERROR", "MOLIT_EMPTY_RESPONSE");
  }
  if (text.startsWith("<!DOCTYPE") || text.startsWith("<HTML")) {
    throw new RealEstateProviderError("EXTERNAL_API_ERROR", "MOLIT_HTML_ERROR_RESPONSE");
  }

  return xmlParser.parse(text) as unknown;
}

export function getMolitHeaderError(payload: unknown): RealEstateProviderStatus | null {
  const code = clean(getPath(payload, ["response", "header", "resultCode"]));
  const message = clean(getPath(payload, ["response", "header", "resultMsg"]));

  if (!code || code === "000" || code === "00") {
    return null;
  }
  if (code === "30" || message.includes("SERVICE_KEY") || message.includes("인증")) {
    return "INVALID_CREDENTIALS";
  }
  if (code === "03" || message.includes("NODATA") || message.includes("데이터")) {
    return "NOT_FOUND";
  }

  return "EXTERNAL_API_ERROR";
}
