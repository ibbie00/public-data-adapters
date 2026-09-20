import {
  KMDB_API_BASE_URL,
  OMDB_API_BASE_URL,
  TVMAZE_API_BASE_URL,
  TVMAZE_SHOW_BASE_URL
} from "./constants";

export function buildOmdbSearchUrl(input: { apiKey: string; query: string }) {
  const url = new URL(OMDB_API_BASE_URL);
  url.searchParams.set("apikey", input.apiKey);
  url.searchParams.set("s", input.query);
  url.searchParams.set("r", "json");

  return url;
}

export function buildKmdbSearchUrl(input: {
  apiKey: string;
  limit: number;
  query: string;
}) {
  const url = new URL(KMDB_API_BASE_URL);
  url.searchParams.set("collection", "kmdb_new2");
  url.searchParams.set("detail", "Y");
  url.searchParams.set("ServiceKey", input.apiKey);
  url.searchParams.set("title", input.query);
  url.searchParams.set("listCount", String(input.limit));

  return url;
}

export function buildOmdbTitleUrl(input: { apiKey: string; imdbId: string }) {
  const url = new URL(OMDB_API_BASE_URL);
  url.searchParams.set("apikey", input.apiKey);
  url.searchParams.set("i", input.imdbId);
  url.searchParams.set("plot", "short");
  url.searchParams.set("r", "json");

  return url;
}

export function buildTvMazeSearchUrl(query: string) {
  const url = new URL(TVMAZE_API_BASE_URL);
  url.searchParams.set("q", query);

  return url;
}

export function buildTvMazeShowUrl(id: string) {
  return new URL(`${TVMAZE_SHOW_BASE_URL}/${encodeURIComponent(id)}`);
}

export function redactMediaCatalogUrl(input: URL | string) {
  const url = new URL(String(input));

  if (url.searchParams.has("apikey")) {
    url.searchParams.set("apikey", "REDACTED");
  }
  if (url.searchParams.has("ServiceKey")) {
    url.searchParams.set("ServiceKey", "REDACTED");
  }

  return url.toString();
}
