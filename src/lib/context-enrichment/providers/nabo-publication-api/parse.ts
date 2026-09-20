import type {
  NaboPublicationProviderStatus,
  NaboPublicationRawResult
} from "./types";

export function clean(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

export function getFirstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = clean(record[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

export function normalizeRows(payload: unknown): NaboPublicationRawResult[] {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload.filter((row): row is NaboPublicationRawResult => Boolean(row && typeof row === "object"));
  }
  if (typeof payload !== "object") {
    return [];
  }

  const root = payload as Record<string, unknown>;
  const rows =
    root.list ??
    root.lists ??
    root.items ??
    root.data ??
    root.result ??
    root.results ??
    root.row ??
    root.rows;

  if (Array.isArray(rows)) {
    return rows.filter((row): row is NaboPublicationRawResult => Boolean(row && typeof row === "object"));
  }
  if (rows && typeof rows === "object") {
    return [rows as NaboPublicationRawResult];
  }
  if (getFirstString(root, ["subj", "title", "detailUrl"])) {
    return [root as NaboPublicationRawResult];
  }

  return [];
}

export function getStatusFromPayload(
  payload: unknown,
  results: NaboPublicationRawResult[]
): NaboPublicationProviderStatus {
  if (results.length > 0) {
    return "OK";
  }
  if (payload && typeof payload === "object") {
    const root = payload as Record<string, unknown>;
    const code = clean(root.errorCode ?? root.code ?? root.RESULT ?? root.status);

    if (code) {
      return /INVALID_KEY|NOT_APPROVED|NOT_YET_VALID|EXPIRED/i.test(code) ? "EXTERNAL_API_ERROR" : "NOT_FOUND";
    }
  }

  return "NOT_FOUND";
}
