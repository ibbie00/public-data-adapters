import { XMLParser } from "fast-xml-parser";

const DATA_GO_KR_ERROR_MESSAGES: Record<string, string> = {
  "1": "APPLICATION_ERROR",
  "04": "HTTP ERROR",
  "12": "NO_OPENAPI_SERVICE_ERROR",
  "20": "SERVICE_ACCESS_DENIED_ERROR",
  "22": "LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR",
  "30": "SERVICE_KEY_IS_NOT_REGISTERED_ERROR",
  "31": "DEADLINE_HAS_EXPIRED_ERROR",
  "32": "UNREGISTERED_IP_ERROR",
  "99": "UNKNOWN_ERROR"
};

const NEC_ERROR_MESSAGES: Record<string, string> = {
  "ERROR-03": "데이터가 정보가 없음",
  "ERROR-301": "파일타입 값 누락 또는 유효하지 않음",
  "ERROR-310": "해당 서비스 없음",
  "ERROR-333": "요청위치 값 타입 오류",
  "ERROR-340": "필수 파라미터 누락",
  "ERROR-500": "서버 오류",
  "ERROR-601": "SQL 문장 오류"
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: true
});

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function getPath(value: unknown, path: string[]) {
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

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" || typeof value === "number") {
      const text = String(value).trim();
      if (text) {
        return text;
      }
    }
  }
  return "";
}

function toArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => Boolean(asObject(item)));
  }
  const object = asObject(value);
  return object ? [object] : [];
}

export function parseNecPayload(rawText: string) {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error("EMPTY_RESPONSE");
  }
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return JSON.parse(trimmed) as unknown;
  }
  return xmlParser.parse(trimmed) as unknown;
}

export function findNecServiceError(payload: unknown) {
  const code = firstText(
    getPath(payload, ["OpenAPI_ServiceResponse", "cmmMsgHeader", "returnReasonCode"]),
    getPath(payload, ["OpenAPI_ServiceResponse", "cmmMsgHeader", "returnAuthMsg"]),
    getPath(payload, ["cmmMsgHeader", "returnReasonCode"]),
    getPath(payload, ["RESULT", "CODE"]),
    getPath(payload, ["Result", "CODE"]),
    getPath(payload, ["response", "header", "resultCode"]),
    getPath(payload, ["header", "resultCode"])
  );
  const message = firstText(
    getPath(payload, ["OpenAPI_ServiceResponse", "cmmMsgHeader", "errMsg"]),
    getPath(payload, ["OpenAPI_ServiceResponse", "cmmMsgHeader", "returnAuthMsg"]),
    getPath(payload, ["cmmMsgHeader", "errMsg"]),
    getPath(payload, ["RESULT", "MESSAGE"]),
    getPath(payload, ["Result", "MESSAGE"]),
    getPath(payload, ["response", "header", "resultMsg"]),
    getPath(payload, ["header", "resultMsg"]),
    code ? DATA_GO_KR_ERROR_MESSAGES[code] || NEC_ERROR_MESSAGES[code] : ""
  );

  if (!code || code === "00" || code.toUpperCase() === "INFO-00" || code.toUpperCase() === "INFO-000") {
    return null;
  }

  return {
    code,
    message: message || DATA_GO_KR_ERROR_MESSAGES[code] || NEC_ERROR_MESSAGES[code] || "NEC OpenAPI error"
  };
}

export function extractNecItems(payload: unknown) {
  const candidatePaths = [
    ["response", "body", "items", "item"],
    ["response", "body", "item"],
    ["body", "items", "item"],
    ["items", "item"],
    ["item"],
    ["response", "body", "items"],
    ["body", "items"],
    ["items"]
  ];

  for (const path of candidatePaths) {
    const items = toArray(getPath(payload, path));
    if (items.length > 0) {
      return items;
    }
  }

  return [];
}
