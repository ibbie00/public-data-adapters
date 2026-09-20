import { NKIS_API_BASE_URL } from "./constants";
import type {
  NkisPolicyProviderStatus,
  NkisPolicyRawResult
} from "./types";

export function buildNkisPolicyUrl(input: {
  key: string;
  limit: number;
  query: string;
}) {
  const url = new URL(`${NKIS_API_BASE_URL}/TongList.do`);

  url.searchParams.set("serviceKey", input.key);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("rowCnt", String(input.limit));

  if (input.query.trim()) {
    url.searchParams.set("otpHanNm", input.query.trim());
  }

  return url;
}

export function buildNkisPolicyDetailUrl(input: {
  key: string;
  otpCd: string;
  otpId: string;
  otpSeq: string;
}) {
  const url = new URL(`${NKIS_API_BASE_URL}/TongDetail.do`);

  url.searchParams.set("serviceKey", input.key);
  url.searchParams.set("otpCd", input.otpCd);
  url.searchParams.set("otpId", input.otpId);
  url.searchParams.set("otpSeq", input.otpSeq);

  return url;
}

export function getStatusFromRows(results: NkisPolicyRawResult[]): NkisPolicyProviderStatus {
  return results.length > 0 ? "OK" : "NOT_FOUND";
}

export function getHttpErrorStatus(status: number): NkisPolicyProviderStatus {
  if (status === 404) return "NOT_FOUND";
  if (status === 408) return "TIMEOUT";
  if (status === 429) return "RATE_LIMITED";
  return "EXTERNAL_API_ERROR";
}

export function redactNkisPolicyUrl(url: URL | string) {
  const parsed = typeof url === "string" ? new URL(url) : new URL(url.toString());

  if (parsed.searchParams.has("serviceKey")) {
    parsed.searchParams.set("serviceKey", "REDACTED");
  }

  return parsed.toString();
}
