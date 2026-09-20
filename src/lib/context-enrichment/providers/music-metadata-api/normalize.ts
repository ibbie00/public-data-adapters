import { getContextHash, getContextQueryFingerprint } from "../../normalize";
import type { ContextAsset } from "../../types";
import { CULTURAL_METADATA_CONTEXT_DISCLAIMER_KO } from "../../types";
import { PROVIDER_TYPE } from "./constants";
import { clean } from "./env";
import {
  getSpotifyImageUrl,
  getSpotifySourceUrl
} from "./spotify";
import type {
  LastfmArtist,
  MusicMetadataRawResult,
  SpotifyItem
} from "./types";

function getMusicTitle(rawResult: MusicMetadataRawResult) {
  const result = rawResult.result;
  if (rawResult.provider === "spotify") {
    const artists = Array.isArray((result as SpotifyItem).artists)
      ? (result as SpotifyItem).artists!.map((artist) => clean(artist.name)).filter(Boolean)
      : [];
    return artists.length > 0
      ? `${clean(result.name)} - ${artists.join(", ")}`
      : clean(result.name) || "\uAD00\uB828 \uC74C\uC545";
  }

  return clean(result.name) || "\uAD00\uB828 \uC74C\uC545";
}

function getMusicKeyPoints(rawResult: MusicMetadataRawResult) {
  const result = rawResult.result;
  if (rawResult.provider === "spotify") {
    const spotify = result as SpotifyItem;
    const artists = Array.isArray(spotify.artists)
      ? spotify.artists.map((artist) => clean(artist.name)).filter(Boolean)
      : [];
    const genres = Array.isArray(spotify.genres)
      ? spotify.genres.map(clean).filter(Boolean)
      : [];

    return [
      "contentStoragePolicy:metadata_only",
      "catalogProvider:Spotify",
      clean(spotify.type) ? `type:${clean(spotify.type)}` : null,
      artists.length > 0 ? `artists:${artists.join(", ")}` : null,
      genres.length > 0 ? `genres:${genres.join(", ")}` : null,
      clean(spotify.album?.name) ? `album:${clean(spotify.album?.name)}` : null,
      clean(spotify.album?.release_date)
        ? `releaseDate:${clean(spotify.album?.release_date)}`
        : null
    ].filter((item): item is string => Boolean(item));
  }

  const lastfm = result as LastfmArtist;
  return [
    "contentStoragePolicy:metadata_only",
    "catalogProvider:Last.fm",
    clean(lastfm.listeners)
      ? `publicListenerCount:${clean(lastfm.listeners)}`
      : null
  ].filter((item): item is string => Boolean(item));
}

export function normalizeMusicMetadataRawResult(input: {
  now: () => Date;
  rawResult: MusicMetadataRawResult;
}): ContextAsset {
  const rawResult = input.rawResult;
  const checkedAt = rawResult.checkedAt ?? input.now().toISOString();
  const result = rawResult.result;
  const title = getMusicTitle(rawResult);
  const providerLabel = rawResult.provider === "spotify" ? "Spotify" : "Last.fm";
  const identifier = rawResult.provider === "spotify"
    ? clean((result as SpotifyItem).id) || title
    : clean((result as LastfmArtist).mbid) || clean(result.name) || title;
  const sourceUrl = rawResult.provider === "spotify"
    ? getSpotifySourceUrl(result as SpotifyItem)
    : clean((result as LastfmArtist).url) || undefined;

  return {
    assetType: "MUSIC_METADATA_CONTEXT",
    canonicalSourceKey: `music_metadata:${rawResult.provider}:${identifier}`,
    checkedAt,
    confidence: rawResult.provider === "spotify" ? "medium" : "low",
    disclaimer: CULTURAL_METADATA_CONTEXT_DISCLAIMER_KO,
    keyPoints: getMusicKeyPoints(rawResult),
    limitations: [
      "\uACF5\uAC1C \uC74C\uC545 \uCE74\uD0C8\uB85C\uADF8 \uBA54\uD0C0\uB370\uC774\uD130\uB9CC \uC800\uC7A5\uD569\uB2C8\uB2E4.",
      "\uC0AC\uC6A9\uC790\uC758 \uCCAD\uCDE8 \uC774\uB825, \uBCF4\uAD00\uD568, \uD314\uB85C\uC6B0, \uCDE8\uD5A5\uC744 \uC870\uD68C\uD558\uAC70\uB098 \uCD94\uB860\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."
    ],
    locale: "ko",
    modelMetadata: {
      catalogProvider: providerLabel,
      contentStoragePolicy: "metadata_only",
      imageUrl: rawResult.provider === "spotify"
        ? getSpotifyImageUrl(result as SpotifyItem)
        : null,
      // Fingerprint, never the query itself: on the flint-keyword path this string is
      // the author's own sentence, and modelMetadata is stored in a public asset row
      // that outlives the post. The write boundary re-derives this anyway.
      queryFingerprint: rawResult.query ? getContextQueryFingerprint(rawResult.query) : null,
      visibleInPublicUi: false
    },
    providerType: PROVIDER_TYPE,
    retrievedAt: checkedAt,
    sourceHash: getContextHash(result),
    sourceIdentifier: `${rawResult.provider}:${identifier}`,
    sourceInstitution: providerLabel,
    sourceName: providerLabel,
    sourceTitle: title,
    sourceUrl,
    status: "current"
  };
}
