import type {
  KosisProviderStatus,
  KosisRawResult
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

export function normalizeRows(payload: unknown): KosisRawResult[] {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload.filter((row): row is KosisRawResult => Boolean(row && typeof row === "object"));
  }
  if (typeof payload !== "object") {
    return [];
  }

  const root = payload as Record<string, unknown>;
  const rows = root.row ?? root.rows ?? root.data;

  if (Array.isArray(rows)) {
    return rows.filter((row): row is KosisRawResult => Boolean(row && typeof row === "object"));
  }

  return [];
}

export function getStatusFromPayload(payload: unknown, results: KosisRawResult[]): KosisProviderStatus {
  if (results.length > 0) {
    return "OK";
  }
  if (payload && typeof payload === "object") {
    const root = payload as Record<string, unknown>;
    const err = clean(root.err ?? root.error ?? root.message ?? root.MSG ?? root.RESULT);

    if (err) {
      return /no data|not found|nodata|\uc790\ub8cc\s*\uc5c6|INFO-200/i.test(err) ? "NOT_FOUND" : "EXTERNAL_API_ERROR";
    }
  }

  return "NOT_FOUND";
}
