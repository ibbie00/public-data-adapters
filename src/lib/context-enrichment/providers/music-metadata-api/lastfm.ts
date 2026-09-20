import type { ProviderFetchLike } from "../fetch-with-retry";
import { LASTFM_API_URL } from "./constants";
import { clean, getLastfmApiKey } from "./env";
import { fetchJson } from "./fetch";
import { MusicMetadataProviderError } from "./types";
import type { LastfmArtist } from "./types";

function buildLastfmSearchUrl(input: {
  apiKey: string;
  limit: number;
  query: string;
}) {
  const url = new URL(LASTFM_API_URL);
  url.searchParams.set("method", "artist.search");
  url.searchParams.set("artist", input.query);
  url.searchParams.set("api_key", input.apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(input.limit));

  return url;
}

function getLastfmArtists(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new MusicMetadataProviderError(
      "PARSE_ERROR",
      "MUSIC_METADATA_LASTFM_PARSE_ERROR"
    );
  }
  const artistmatches = (
    (payload as Record<string, unknown>).results as
      | Record<string, unknown>
      | undefined
  )?.artistmatches;
  const artists =
    artistmatches &&
    typeof artistmatches === "object" &&
    !Array.isArray(artistmatches)
      ? (artistmatches as Record<string, unknown>).artist
      : [];

  return (Array.isArray(artists) ? artists : [artists])
    .map((item) =>
      item && typeof item === "object" ? item as LastfmArtist : null
    )
    .filter((item): item is LastfmArtist => Boolean(item && clean(item.name)));
}

export async function searchLastfm(input: {
  env: NodeJS.ProcessEnv;
  fetchImpl: ProviderFetchLike;
  limit: number;
  query: string;
}) {
  const payload = await fetchJson({
    env: input.env,
    fetchImpl: input.fetchImpl,
    url: buildLastfmSearchUrl({
      apiKey: getLastfmApiKey(input.env),
      limit: input.limit,
      query: input.query
    })
  });

  return getLastfmArtists(payload).map((result) => ({
    provider: "lastfm" as const,
    query: input.query,
    result,
    status: "OK" as const
  }));
}
