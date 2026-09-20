import { contextEnrichmentUserAgent } from "../user-agent";

export const PROVIDER_TYPE = "news_media" as const;
export const GUARDIAN_URL = "https://content.guardianapis.com/search";
export const NYT_URL = "https://api.nytimes.com/svc/search/v2/articlesearch.json";
export const NEWSAPI_URL = "https://newsapi.org/v2/everything";
export const DEFAULT_USER_AGENT =
  contextEnrichmentUserAgent("public news metadata");
