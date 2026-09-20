import { NABO_API_BASE_URL } from "./constants";

export function redactNaboPublicationUrl(url: URL | string) {
  const parsed = typeof url === "string" ? new URL(url) : new URL(url.toString());

  if (parsed.searchParams.has("key")) {
    parsed.searchParams.set("key", "REDACTED");
  }

  return parsed.toString();
}

export function buildNaboPublicationUrl(input: {
  endpoint: "report" | "periodical";
  key: string;
  limit: number;
  query: string;
}) {
  const url = new URL(`${NABO_API_BASE_URL}/${input.endpoint}.do`);

  url.searchParams.set("key", input.key);
  url.searchParams.set("page", "1");
  url.searchParams.set("size", String(input.limit));
  url.searchParams.set("scSort", "pubDt");
  url.searchParams.set("scOrder", "desc");
  if (input.query.trim()) {
    url.searchParams.set(input.endpoint === "periodical" ? "sw" : "scSw", input.query.trim());
  }

  return url;
}
