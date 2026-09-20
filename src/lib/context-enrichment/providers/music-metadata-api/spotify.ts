import type { ProviderFetchLike } from "../fetch-with-retry";
import {
  SPOTIFY_SEARCH_URL,
  SPOTIFY_TOKEN_URL
} from "./constants";
import {
  clean,
  getSpotifyClientId,
  getSpotifyClientSecret
} from "./env";
import { fetchJson } from "./fetch";
import {
  MusicMetadataProviderError,
  type SpotifyItem
} from "./types";

function buildSpotifySearchUrl(input: { limit: number; query: string }) {
  const url = new URL(SPOTIFY_SEARCH_URL);
  url.searchParams.set("q", input.query);
  url.searchParams.set("type", "track,artist,album");
  url.searchParams.set("limit", String(input.limit));

  return url;
}

async function fetchSpotifyAccessToken(input: {
  env: NodeJS.ProcessEnv;
  fetchImpl: ProviderFetchLike;
}) {
  const body = new URLSearchParams({ grant_type: "client_credentials" });
  const credentials = Buffer.from(
    `${getSpotifyClientId(input.env)}:${getSpotifyClientSecret(input.env)}`
  ).toString("base64");
  const payload = await fetchJson({
    env: input.env,
    fetchImpl: input.fetchImpl,
    init: {
      body,
      headers: {
        authorization: `Basic ${credentials}`,
        "content-type": "application/x-www-form-urlencoded"
      },
      method: "POST"
    },
    url: new URL(SPOTIFY_TOKEN_URL)
  });

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new MusicMetadataProviderError(
      "PARSE_ERROR",
      "MUSIC_METADATA_SPOTIFY_TOKEN_PARSE_ERROR"
    );
  }
  const accessToken = clean((payload as Record<string, unknown>).access_token);
  if (!accessToken) {
    throw new MusicMetadataProviderError(
      "INVALID_CREDENTIALS",
      "MUSIC_METADATA_SPOTIFY_TOKEN_MISSING"
    );
  }

  return accessToken;
}

function getSpotifyItems(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new MusicMetadataProviderError(
      "PARSE_ERROR",
      "MUSIC_METADATA_SPOTIFY_PARSE_ERROR"
    );
  }
  const record = payload as Record<string, unknown>;
  const groups = ["artists", "albums", "tracks"]
    .flatMap((key) => {
      const group = record[key];
      return group &&
        typeof group === "object" &&
        !Array.isArray(group) &&
        Array.isArray((group as Record<string, unknown>).items)
        ? (group as { items: unknown[] }).items
        : [];
    });

  return groups
    .map((item) => item && typeof item === "object" ? item as SpotifyItem : null)
    .filter((item): item is SpotifyItem =>
      Boolean(item && clean(item.id) && clean(item.name))
    );
}

// Keep only what actually carries the name the post used.
//
// ⚠️ The relevance gate cannot do this job. It asks "does this answer the query", and a
// different artist of the same era and genre answers it well. On 2026-08-19 a post
// remembering one late Korean folk singer was attached to a contemporary of his, scored
// comfortably, and auto-published before the author could see it. Two names, one grief,
// and nothing downstream could tell them apart.
//
// So the check is on the STRING, not on the score. But only an EXACT name match may narrow
// the list, and only when there is one.
//
// ⚠️ Substring matching was tried first and was worse than no filter at all. Searching the
// Korean name of one artist kept `아이유브이` (a different act whose name contains it) and
// dropped `IU` (the right answer, registered under its romanised name). It removed the
// right answer and kept the wrong one, in the same query.
//
// The rule that survives both cases: if some result carries exactly the searched name, the
// post named that act and everything else is noise -- keep only those. If nothing matches
// exactly, we cannot tell from the string alone (the act is likely registered under another
// spelling), so leave the list intact and let the relevance gate choose.
export function keepNameMatches(items: SpotifyItem[], query: string) {
  const needle = normalizeForNameMatch(query);

  if (!needle) {
    return items;
  }

  const exact = items.filter((item) =>
    [clean(item.name), ...(item.artists ?? []).map((artist) => clean(artist.name))].some(
      (name) => normalizeForNameMatch(name) === needle
    )
  );

  return exact.length > 0 ? exact : items;
}

function normalizeForNameMatch(value: string) {
  return value.toLowerCase().replace(/\s+/gu, "");
}

export async function searchSpotify(input: {
  env: NodeJS.ProcessEnv;
  fetchImpl: ProviderFetchLike;
  limit: number;
  query: string;
}) {
  const accessToken = await fetchSpotifyAccessToken(input);
  const payload = await fetchJson({
    env: input.env,
    fetchImpl: input.fetchImpl,
    init: {
      headers: {
        authorization: `Bearer ${accessToken}`
      }
    },
    url: buildSpotifySearchUrl({ limit: input.limit, query: input.query })
  });

  return keepNameMatches(getSpotifyItems(payload), input.query).map((result) => ({
    provider: "spotify" as const,
    query: input.query,
    result,
    status: "OK" as const
  }));
}

export function getSpotifySourceUrl(result: SpotifyItem) {
  return clean(result.external_urls?.spotify) || undefined;
}

export function getSpotifyImageUrl(result: SpotifyItem) {
  const images = Array.isArray(result.images) && result.images.length > 0
    ? result.images
    : Array.isArray(result.album?.images)
      ? result.album.images
      : [];

  return images
    .map((image) => clean(image.url))
    .filter((url): url is string => Boolean(url))[0] ?? null;
}
