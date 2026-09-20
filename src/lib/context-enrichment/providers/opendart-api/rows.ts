import { clean } from "./query";
import type {
  OpenDartParsedQuery,
  OpenDartProviderStatus,
  OpenDartRawResult
} from "./types";

export function getStatusFromPayload(
  payload: unknown,
  results: OpenDartRawResult[]
): OpenDartProviderStatus {
  if (results.length > 0) {
    return "OK";
  }
  if (!payload || typeof payload !== "object") {
    return "PARSE_ERROR";
  }

  const record = payload as Record<string, unknown>;
  const status = clean(record.status);

  if (status === "000") {
    return "NOT_FOUND";
  }
  if (status === "013") {
    return "NOT_FOUND";
  }
  if (status === "020") {
    return "RATE_LIMITED";
  }
  if (status) {
    return "EXTERNAL_API_ERROR";
  }

  return "NOT_FOUND";
}

export function normalizeRows(
  payload: unknown,
  parsed: OpenDartParsedQuery
): OpenDartRawResult[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  const rows = record.list;
  const normalizedRows = Array.isArray(rows)
    ? rows.filter((row): row is OpenDartRawResult =>
        Boolean(row && typeof row === "object")
      )
    : [];

  if (!parsed.rceptNo) {
    return sortRowsByQueryRelevance(normalizedRows, parsed.keyword);
  }

  return normalizedRows.filter((row) => clean(row.rcept_no) === parsed.rceptNo);
}

function sortRowsByQueryRelevance(
  rows: OpenDartRawResult[],
  keyword: string | undefined
) {
  const normalizedKeyword = (keyword ?? "").replace(/\s+/g, "").toLowerCase();

  function score(row: OpenDartRawResult) {
    const reportName = clean(row.report_nm).replace(/\s+/g, "").toLowerCase();
    let value = 0;

    if (
      normalizedKeyword.includes("\uc18c\uac01") &&
      reportName.includes("\uc18c\uac01")
    ) {
      value -= 100;
    }
    if (
      normalizedKeyword.includes("\uc790\uae30\uc8fc\uc2dd") &&
      reportName.includes("\uc790\uae30\uc8fc\uc2dd")
    ) {
      value -= 50;
    }
    if (reportName.includes("\uc815\uc815")) {
      value += 10;
    }

    return value;
  }

  return [...rows].sort((left, right) => score(left) - score(right));
}
