import type {
  OpenAssemblyBillRawResult,
  OpenAssemblyProviderStatus
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

export function normalizeRows(payload: unknown, serviceId: string): OpenAssemblyBillRawResult[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const root = payload as Record<string, unknown>;
  const service = root[serviceId] ?? root.ALLBILL ?? root.RESULT;
  const containers = Array.isArray(service) ? service : [service ?? root];
  const rows: unknown[] = [];

  for (const container of containers) {
    if (!container || typeof container !== "object") {
      continue;
    }
    const record = container as Record<string, unknown>;
    const row = record.row ?? record.rows;

    if (Array.isArray(row)) {
      rows.push(...row);
    } else if (row && typeof row === "object") {
      rows.push(row);
    }
  }

  return rows.filter((row): row is OpenAssemblyBillRawResult => Boolean(row && typeof row === "object"));
}

export function getStatusFromPayload(
  payload: unknown,
  results: OpenAssemblyBillRawResult[]
): OpenAssemblyProviderStatus {
  if (results.length > 0) {
    return "OK";
  }
  if (payload && typeof payload === "object") {
    const root = payload as Record<string, unknown>;
    const result = root.RESULT && typeof root.RESULT === "object" ? root.RESULT as Record<string, unknown> : null;
    const code = clean(result?.CODE ?? root.CODE);

    if (code && code !== "INFO-000") {
      return code.includes("200") || code.includes("NODATA") ? "NOT_FOUND" : "EXTERNAL_API_ERROR";
    }
  }

  return "NOT_FOUND";
}
