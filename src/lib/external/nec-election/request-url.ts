import { assertAllowedExternalBaseUrl } from "../base-url-allowlist";
import type { NecRequestParams } from "./types";

const DEFAULT_NUM_OF_ROWS = 10;
const DEFAULT_PAGE_NO = 1;
const DATA_GO_KR_API_HOST = "apis.data.go.kr";

export function normalizeNecEndpoint(endpoint: string) {
  return endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
}

export function normalizeNecBaseUrl(baseUrl: string) {
  const url = new URL(baseUrl);

  if (url.protocol === "http:" && url.hostname === DATA_GO_KR_API_HOST) {
    url.protocol = "https:";
  }

  // The documented value for these services is still written as http:// in
  // places, so the upgrade above runs first; the allowlist then has the final
  // say on everything else.
  return assertAllowedExternalBaseUrl("nec-election", url)
    .toString()
    .replace(/\/$/u, "");
}

export function buildNecOpenApiUrl(input: {
  baseUrl: string;
  endpoint: string;
  params?: NecRequestParams;
  serviceKey: string;
}) {
  const url = new URL(`${normalizeNecBaseUrl(input.baseUrl)}${normalizeNecEndpoint(input.endpoint)}`);
  url.searchParams.set("serviceKey", input.serviceKey);
  url.searchParams.set("resultType", "json");
  url.searchParams.set("pageNo", String(input.params?.pageNo ?? DEFAULT_PAGE_NO));
  url.searchParams.set("numOfRows", String(input.params?.numOfRows ?? DEFAULT_NUM_OF_ROWS));

  for (const [key, value] of Object.entries(input.params ?? {})) {
    if (value !== undefined && key !== "pageNo" && key !== "numOfRows") {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}
