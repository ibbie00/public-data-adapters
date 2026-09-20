import type { ProviderFetchLike } from "../fetch-with-retry";

export type MusicMetadataProviderStatus =
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

export type SpotifyArtist = {
  name?: string;
};

type SpotifyImage = {
  url?: string;
};

export type SpotifyItem = Record<string, unknown> & {
  album?: {
    album_type?: string;
    images?: SpotifyImage[];
    name?: string;
    release_date?: string;
    total_tracks?: number;
  };
  artists?: SpotifyArtist[];
  external_urls?: { spotify?: string };
  genres?: string[];
  id?: string;
  images?: SpotifyImage[];
  name?: string;
  popularity?: number;
  release_date?: string;
  total_tracks?: number;
  type?: "album" | "artist" | "track";
};

export type LastfmArtist = Record<string, unknown> & {
  listeners?: string;
  mbid?: string;
  name?: string;
  url?: string;
};

export type MusicMetadataRawResult = {
  checkedAt?: string;
  provider: "spotify" | "lastfm";
  query?: string;
  result: SpotifyItem | LastfmArtist;
  status?: MusicMetadataProviderStatus;
};

export type MusicMetadataSearchStatusResult = {
  checkedAt: string;
  provider: "music_metadata";
  results: MusicMetadataRawResult[];
  status: MusicMetadataProviderStatus;
};

export type MusicMetadataApiProviderOptions = {
  fetchImpl?: ProviderFetchLike;
  now?: () => Date;
};

export class MusicMetadataProviderError extends Error {
  readonly status: MusicMetadataProviderStatus;

  constructor(status: MusicMetadataProviderStatus, message: string) {
    super(message);
    this.name = "MusicMetadataProviderError";
    this.status = status;
  }
}
