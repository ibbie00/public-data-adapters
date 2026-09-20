import { ECOS_API_BASE_URL } from "./constants";
import type { EcosParsedQuery } from "./types";

export function redactEcosUrl(url: URL | string) {
  const parsed = typeof url === "string" ? new URL(url) : new URL(url.toString());
  const segments = parsed.pathname.split("/");
  const apiIndex = segments.findIndex((segment) => segment === "api");

  if (apiIndex >= 0 && segments[apiIndex + 2]) {
    segments[apiIndex + 2] = "REDACTED";
    parsed.pathname = segments.join("/");
  }

  return parsed.toString();
}

export function buildEcosUrl(input: {
  apiKey: string;
  limit: number;
  parsed: EcosParsedQuery;
}) {
  const endpoint = input.parsed.mode === "key-statistics" ? "KeyStatisticList" : "StatisticSearch";
  const parts = [
    ECOS_API_BASE_URL,
    endpoint,
    encodeURIComponent(input.apiKey),
    "json",
    "kr",
    "1",
    String(input.limit)
  ];

  if (input.parsed.mode === "statistic-search") {
    parts.push(
      encodeURIComponent(input.parsed.statCode),
      encodeURIComponent(input.parsed.cycle),
      encodeURIComponent(input.parsed.start),
      encodeURIComponent(input.parsed.end)
    );
    if (input.parsed.itemCode) {
      parts.push(encodeURIComponent(input.parsed.itemCode));
    }
  }

  return new URL(parts.join("/"));
}
