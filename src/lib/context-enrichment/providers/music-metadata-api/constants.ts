import { contextEnrichmentUserAgent } from "../user-agent";

export const PROVIDER_TYPE = "music_metadata" as const;
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
export const SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search";
export const LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/";
export const DEFAULT_USER_AGENT =
  contextEnrichmentUserAgent("public music catalog metadata");
