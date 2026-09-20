import {
  NKIS_KEY_ALIASES,
  NKIS_MAP_KEYS
} from "./constants";
import { getFirstString } from "./env";
import {
  NkisPolicyProviderError,
  type NkisPolicyRawResult
} from "./types";

function xmlDecode(value: string) {
  return value
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// The bytes come from the caller: the fetch helper already read them once,
// under a deadline and a byte cap. This service still answers some endpoints in
// EUC-KR, so the charset decision stays here rather than in the reader.
function decodeResponseBytes(response: Response, bytes: Uint8Array) {
  const contentType = response.headers.get("content-type") ?? "";

  if (/euc-kr|ks_c_5601-1987|cp949/i.test(contentType)) {
    return new TextDecoder("euc-kr").decode(bytes);
  }

  return new TextDecoder().decode(bytes);
}

function parseXmlResultRecords(text: string): NkisPolicyRawResult[] {
  const matches = [...text.matchAll(/<result>([\s\S]*?)<\/result>/g)];

  return matches.map((match) => {
    const record: NkisPolicyRawResult = {};
    for (const field of match[1]?.matchAll(/<([^/][^>]*)>([\s\S]*?)<\/\1>/g) ?? []) {
      const key = field[1]?.trim();
      if (key) {
        record[key] = xmlDecode(field[2] ?? "");
      }
    }

    return record;
  }).filter((record) => Object.keys(record).length > 0);
}

function parseNkisScriptMapRecords(text: string): NkisPolicyRawResult[] {
  const payload = text.match(/console\.log\(`([\s\S]*?)`\)/)?.[1] ?? text;
  const trimmed = payload.trim();
  const body = trimmed.startsWith("[") && trimmed.endsWith("]")
    ? trimmed.slice(1, -1)
    : trimmed;
  const recordTexts = body.split(/}\s*,\s*{/).map((record, index, records) => {
    let value = record;
    if (index === 0) value = value.replace(/^\s*{/, "");
    if (index === records.length - 1) value = value.replace(/}\s*$/, "");
    return value;
  });
  const nextKeyPattern = NKIS_MAP_KEYS.join("|");

  return recordTexts.map((recordText) => {
    const record: NkisPolicyRawResult = {};

    for (const key of NKIS_MAP_KEYS) {
      const match = recordText.match(new RegExp(`${key}=([\\s\\S]*?)(?=, (?:${nextKeyPattern})=|$)`));
      const value = match?.[1]?.trim();

      if (value) {
        record[NKIS_KEY_ALIASES[key] ?? key] = value;
      }
    }

    return record;
  }).filter((record) => Object.keys(record).length > 0);
}

function normalizeRows(payload: unknown): NkisPolicyRawResult[] {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload.filter((row): row is NkisPolicyRawResult => Boolean(row && typeof row === "object"));
  }
  if (typeof payload !== "object") {
    return [];
  }

  const root = payload as Record<string, unknown>;
  const rows =
    root.list ??
    root.items ??
    root.data ??
    root.result ??
    root.results ??
    root.row ??
    root.rows;

  if (Array.isArray(rows)) {
    return rows.filter((row): row is NkisPolicyRawResult => Boolean(row && typeof row === "object"));
  }
  if (rows && typeof rows === "object") {
    return [rows as NkisPolicyRawResult];
  }
  if (getFirstString(root, ["OTP_ID", "OTP_HAN_NM", "ORG_LINK"])) {
    return [root as NkisPolicyRawResult];
  }

  return [];
}

export function parseNkisPolicyResponse(response: Response, bytes: Uint8Array) {
  const contentType = response.headers.get("content-type") ?? "";
  const text = decodeResponseBytes(response, bytes);

  if (!text.trim()) {
    return [];
  }
  if (text.includes("console.log(`[")) {
    return parseNkisScriptMapRecords(text);
  }
  if (contentType.includes("json") || text.trimStart().startsWith("{")) {
    try {
      return normalizeRows(JSON.parse(text));
    } catch {
      throw new NkisPolicyProviderError("PARSE_ERROR", "NKIS_POLICY_JSON_PARSE_FAILED");
    }
  }
  if (contentType.includes("xml") || text.trimStart().startsWith("<")) {
    return parseXmlResultRecords(text);
  }

  throw new NkisPolicyProviderError("PARSE_ERROR", "NKIS_POLICY_UNSUPPORTED_RESPONSE");
}
