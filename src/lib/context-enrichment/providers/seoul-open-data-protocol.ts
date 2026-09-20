import type {
  SeoulOpenDataProviderStatus,
  SeoulOpenDataRawResult
} from "./seoul-open-data-api";

export function clean(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function getSeoulOpenDataApiKey(env: NodeJS.ProcessEnv) {
  return env.SEOUL_METRO_DATA_API_KEY?.trim() || env.SEOUL_OPEN_DATA_API_KEY?.trim() || "";
}

function getStationQuery(query: string) {
  const station = query
    .replace(/서울|지하철|역|교통|열린데이터|metro|subway/gi, " ")
    .replace(/[,.!?，。！？]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return station || "서울역";
}

export function selectSeoulOpenDataService(query: string, env: NodeJS.ProcessEnv) {
  const configured = env.SEOUL_OPEN_DATA_DEFAULT_SERVICE?.trim();
  if (configured) {
    return configured;
  }
  if (query.includes("지하철") || query.includes("역") || /metro|subway|station/i.test(query)) {
    return "SearchInfoBySubwayNameService";
  }
  return "SearchInfoBySubwayNameService";
}

export function buildSeoulOpenDataUrl(input: {
  apiKey: string;
  limit: number;
  query: string;
  service: string;
}) {
  const station = encodeURIComponent(getStationQuery(input.query));
  return new URL(`http://openapi.seoul.go.kr:8088/${encodeURIComponent(input.apiKey)}/json/${encodeURIComponent(input.service)}/1/${input.limit}/${station}`);
}

function getServicePayload(payload: unknown, service: string) {
  const root = asObject(payload);
  return asObject(root?.[service]) ?? root;
}

export function normalizeSeoulOpenDataRows(payload: unknown, service: string): SeoulOpenDataRawResult[] {
  const servicePayload = getServicePayload(payload, service);
  const rows = servicePayload?.row ?? servicePayload?.rows ?? servicePayload?.data;
  if (Array.isArray(rows)) {
    return rows.filter((row): row is SeoulOpenDataRawResult => Boolean(asObject(row)));
  }
  if (asObject(rows)) {
    return [rows as SeoulOpenDataRawResult];
  }
  return [];
}

export function getSeoulOpenDataPayloadStatus(
  payload: unknown,
  service: string,
  results: SeoulOpenDataRawResult[]
): SeoulOpenDataProviderStatus {
  const servicePayload = getServicePayload(payload, service);
  const result = asObject(servicePayload?.RESULT) ?? asObject(asObject(payload)?.RESULT);
  const code = clean(result?.CODE ?? result?.code);
  const message = clean(result?.MESSAGE ?? result?.message);
  if (code && code !== "INFO-000") {
    if (/ERROR-300|ERROR-336|인증|auth|key/i.test(`${code} ${message}`)) {
      return "INVALID_CREDENTIALS";
    }
    if (/INFO-200|데이터없음|no data/i.test(`${code} ${message}`)) {
      return "NOT_FOUND";
    }
    return "EXTERNAL_API_ERROR";
  }
  return results.length > 0 ? "OK" : "NOT_FOUND";
}
