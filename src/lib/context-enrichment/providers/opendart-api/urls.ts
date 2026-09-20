import {
  OPENDART_API_BASE_URL,
  OPENDART_DISCLOSURE_BASE_URL
} from "./constants";
import type { OpenDartParsedQuery } from "./types";

export function buildOpenDartListUrl(input: {
  apiKey: string;
  limit: number;
  parsed: OpenDartParsedQuery;
}) {
  const url = new URL(OPENDART_API_BASE_URL);
  url.searchParams.set("crtfc_key", input.apiKey);
  url.searchParams.set("bgn_de", input.parsed.bgnDe);
  url.searchParams.set("end_de", input.parsed.endDe);
  url.searchParams.set("page_no", "1");
  url.searchParams.set("page_count", String(input.limit));

  if (input.parsed.corpCode) {
    url.searchParams.set("corp_code", input.parsed.corpCode);
  }

  return url;
}

export function disclosureUrl(rceptNo: string | null) {
  if (!rceptNo) {
    return null;
  }

  const url = new URL(OPENDART_DISCLOSURE_BASE_URL);
  url.searchParams.set("rcpNo", rceptNo);

  return url.toString();
}

export function redactOpenDartUrl(url: URL | string) {
  const parsed = typeof url === "string" ? new URL(url) : new URL(url.toString());

  if (parsed.searchParams.has("crtfc_key")) {
    parsed.searchParams.set("crtfc_key", "REDACTED");
  }

  return parsed.toString();
}
