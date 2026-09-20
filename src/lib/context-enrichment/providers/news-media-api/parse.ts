import {
  NewsMediaProviderError,
  type GuardianArticle,
  type NewsApiArticle,
  type NytArticle
} from "./types";

export function clean(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

export function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function getGuardianResults(payload: unknown) {
  const results = payload && typeof payload === "object" && !Array.isArray(payload)
    ? ((payload as Record<string, unknown>).response as Record<string, unknown> | undefined)?.results
    : null;

  if (!Array.isArray(results)) {
    throw new NewsMediaProviderError("PARSE_ERROR", "NEWS_MEDIA_GUARDIAN_PARSE_ERROR");
  }

  return results
    .map((item) => item && typeof item === "object" ? item as GuardianArticle : null)
    .filter((item): item is GuardianArticle => Boolean(item && clean(item.webTitle) && clean(item.webUrl)));
}

export function getNytResults(payload: unknown) {
  const docs = payload && typeof payload === "object" && !Array.isArray(payload)
    ? ((payload as Record<string, unknown>).response as Record<string, unknown> | undefined)?.docs
    : null;

  if (!Array.isArray(docs)) {
    throw new NewsMediaProviderError("PARSE_ERROR", "NEWS_MEDIA_NYT_PARSE_ERROR");
  }

  return docs
    .map((item) => item && typeof item === "object" ? item as NytArticle : null)
    .filter((item): item is NytArticle => Boolean(item && clean(item.headline?.main) && clean(item.web_url)));
}

export function getNewsApiResults(payload: unknown) {
  const articles = payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).articles
    : null;

  if (!Array.isArray(articles)) {
    throw new NewsMediaProviderError("PARSE_ERROR", "NEWS_MEDIA_NEWSAPI_PARSE_ERROR");
  }

  return articles
    .map((item) => item && typeof item === "object" ? item as NewsApiArticle : null)
    .filter((item): item is NewsApiArticle => Boolean(item && clean(item.title) && clean(item.url)));
}
