import type {
  EcosParsedQuery,
  EcosProviderStatus,
  EcosRawResult
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

function getEcosRoot(payload: unknown, key: "KeyStatisticList" | "StatisticSearch") {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const root = payload as Record<string, unknown>;
  const container = root[key];

  return container && typeof container === "object" ? container as Record<string, unknown> : root;
}

export function normalizeRows(payload: unknown, mode: EcosParsedQuery["mode"]): EcosRawResult[] {
  const root = getEcosRoot(payload, mode === "key-statistics" ? "KeyStatisticList" : "StatisticSearch");
  const rows = root?.row ?? root?.rows ?? root?.data;

  if (Array.isArray(rows)) {
    return rows.filter((row): row is EcosRawResult => Boolean(row && typeof row === "object"));
  }
  if (rows && typeof rows === "object") {
    return [rows as EcosRawResult];
  }

  return [];
}

export function getStatusFromPayload(
  payload: unknown,
  results: EcosRawResult[],
  mode: EcosParsedQuery["mode"]
): EcosProviderStatus {
  if (results.length > 0) {
    return "OK";
  }

  const root = getEcosRoot(payload, mode === "key-statistics" ? "KeyStatisticList" : "StatisticSearch");
  const result = root?.RESULT && typeof root.RESULT === "object" ? root.RESULT as Record<string, unknown> : null;
  const code = clean(result?.CODE ?? root?.CODE);

  if (code) {
    return code.includes("200") || /NODATA|INFO-200/i.test(code) ? "NOT_FOUND" : "EXTERNAL_API_ERROR";
  }

  return "NOT_FOUND";
}
