import {
  GUARDIAN_URL,
  NEWSAPI_URL,
  NYT_URL
} from "./constants";

export function buildGuardianUrl(input: { apiKey: string; limit: number; query: string }) {
  const url = new URL(GUARDIAN_URL);
  url.searchParams.set("api-key", input.apiKey);
  url.searchParams.set("q", input.query);
  url.searchParams.set("page-size", String(input.limit));
  url.searchParams.set("order-by", "relevance");

  return url;
}

export function buildNytUrl(input: { apiKey: string; limit: number; query: string }) {
  const url = new URL(NYT_URL);
  url.searchParams.set("api-key", input.apiKey);
  url.searchParams.set("q", input.query);
  url.searchParams.set("sort", "relevance");
  url.searchParams.set("page", "0");

  return url;
}

export function buildNewsApiUrl(input: { apiKey: string; limit: number; query: string }) {
  const url = new URL(NEWSAPI_URL);
  url.searchParams.set("apiKey", input.apiKey);
  url.searchParams.set("q", input.query);
  url.searchParams.set("pageSize", String(input.limit));
  url.searchParams.set("sortBy", "relevancy");

  return url;
}

export function redactNewsMediaUrl(input: URL | string) {
  const url = new URL(String(input));

  for (const param of ["api-key", "apiKey"]) {
    if (url.searchParams.has(param)) {
      url.searchParams.set(param, "REDACTED");
    }
  }

  return url.toString();
}
