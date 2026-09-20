import type { ProviderFetchLike } from "../fetch-with-retry";
import type { MediaTitleLlmFallback } from "./media-title-fallback";

export type MediaCatalogProviderStatus =
  | "OK"
  | "NOT_FOUND"
  | "INVALID_QUERY"
  | "INVALID_CREDENTIALS"
  | "MISSING_CREDENTIALS"
  | "PROVIDER_DISABLED"
  | "EXTERNAL_API_ERROR"
  | "PARSE_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT";

export type OmdbSearchResult = Record<string, unknown> & {
  imdbID?: string;
  Poster?: string;
  Title?: string;
  Type?: string;
  Year?: string;
};

export type OmdbTitleResult = Record<string, unknown> & {
  Actors?: string;
  Director?: string;
  Genre?: string;
  imdbID?: string;
  Plot?: string;
  Poster?: string;
  Rated?: string;
  Released?: string;
  Response?: string;
  Runtime?: string;
  Title?: string;
  totalSeasons?: string;
  Type?: string;
  Year?: string;
};

export type TvMazeShow = Record<string, unknown> & {
  ended?: string | null;
  genres?: string[];
  id?: number;
  image?: {
    medium?: string | null;
    original?: string | null;
  } | null;
  language?: string | null;
  name?: string;
  officialSite?: string | null;
  premiered?: string | null;
  status?: string | null;
  summary?: string | null;
  type?: string | null;
  url?: string | null;
};

export type KmdbMovieResult = Record<string, unknown> & {
  DOCID?: string;
  directors?: unknown;
  genre?: string;
  kmdbUrl?: string;
  movieId?: string;
  movieSeq?: string;
  nation?: string;
  plots?: unknown;
  prodYear?: string;
  rating?: string;
  repRlsDate?: string;
  runtime?: string;
  title?: string;
  titleEng?: string;
};

export type TvMazeSearchResult = {
  score?: number;
  show?: TvMazeShow;
};

export type MediaCatalogRawResult = {
  checkedAt?: string;
  provider: "kmdb" | "omdb" | "tvmaze";
  query?: string;
  result: KmdbMovieResult | OmdbTitleResult | TvMazeShow;
  searchScore?: number | null;
  status?: MediaCatalogProviderStatus;
};

export type MediaCatalogSearchStatusResult = {
  checkedAt: string;
  provider: "media_catalog";
  results: MediaCatalogRawResult[];
  status: MediaCatalogProviderStatus;
};

export type MediaCatalogApiProviderOptions = {
  fetchImpl?: ProviderFetchLike;
  now?: () => Date;
  titleFallback?: MediaTitleLlmFallback;
};

export class MediaCatalogProviderError extends Error {
  readonly status: MediaCatalogProviderStatus;

  constructor(status: MediaCatalogProviderStatus, message: string) {
    super(message);
    this.name = "MediaCatalogProviderError";
    this.status = status;
  }
}
