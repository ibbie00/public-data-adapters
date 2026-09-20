import { contextEnrichmentUserAgent } from "../user-agent";

export const PROVIDER_TYPE = "media_catalog" as const;

export const KMDB_API_BASE_URL =
  "https://api.koreafilm.or.kr/openapi-data2/wisenut/search_api/search_json2.jsp";
export const OMDB_API_BASE_URL = "https://www.omdbapi.com/";
export const TVMAZE_API_BASE_URL = "https://api.tvmaze.com/search/shows";
export const TVMAZE_SHOW_BASE_URL = "https://api.tvmaze.com/shows";

export const SOURCE_NAME_KMDB = "KMDb";
export const SOURCE_NAME_OMDB = "OMDb";
export const SOURCE_NAME_TVMAZE = "TVMaze";

export const DEFAULT_USER_AGENT =
  contextEnrichmentUserAgent("public media catalog metadata");
