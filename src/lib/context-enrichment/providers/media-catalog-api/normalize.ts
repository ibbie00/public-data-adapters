import { getContextHash, getContextQueryFingerprint } from "../../normalize";
import type { ContextAsset } from "../../types";
import { CULTURAL_METADATA_CONTEXT_DISCLAIMER_KO } from "../../types";
import {
  PROVIDER_TYPE,
  SOURCE_NAME_KMDB,
  SOURCE_NAME_OMDB,
  SOURCE_NAME_TVMAZE
} from "./constants";
import {
  clean,
  getKmdbMovieId,
  getKmdbMovieUrl,
  getNestedFirstText,
  stripHtml
} from "./parse";
import type {
  KmdbMovieResult,
  MediaCatalogRawResult,
  OmdbTitleResult,
  TvMazeShow
} from "./types";

function getExternalUrlForRaw(raw: MediaCatalogRawResult) {
  if (raw.provider === "kmdb") {
    return getKmdbMovieUrl(raw.result as KmdbMovieResult);
  }
  if (raw.provider === "omdb") {
    const result = raw.result as OmdbTitleResult;
    const imdbId = clean(result.imdbID);

    return imdbId ? `https://www.imdb.com/title/${imdbId}/` : undefined;
  }

  return clean((raw.result as TvMazeShow).url) || undefined;
}

function buildCanonicalKey(raw: MediaCatalogRawResult) {
  if (raw.provider === "kmdb") {
    const result = raw.result as KmdbMovieResult;
    return `media_catalog:kmdb:${
      getKmdbMovieId(result) || clean(result.title) || "unknown"
    }`;
  }
  if (raw.provider === "omdb") {
    const result = raw.result as OmdbTitleResult;
    return `media_catalog:omdb:${
      clean(result.imdbID) || clean(result.Title) || "unknown"
    }`;
  }

  const result = raw.result as TvMazeShow;
  return `media_catalog:tvmaze:${clean(result.id) || clean(result.name) || "unknown"}`;
}

function getTitle(raw: MediaCatalogRawResult) {
  if (raw.provider === "kmdb") {
    const result = raw.result as KmdbMovieResult;
    // KMDb wraps matched words in !HS/!HE markers and pads the inside of each with a space,
    // so dropping the markers alone leaves their padding behind and the card reads
    // " Parasite  (2019)". Collapse whitespace after the markers are gone, not before.
    //
    // Measured shapes (2026-08-19, live API):
    //
    //   "  !HS 7광구 !HE "                 -> 7광구
    //   "  !HS 헤어질 !HE   !HS 결심 !HE "  -> 헤어질 결심   (two matched words, gap kept)
    //   "  !HS 괴물 !HE  고양이"            -> 괴물 고양이   (one matched, rest plain)
    //
    // ⚠️ KMDb marks WHOLE WORDS. A live asset carries " 7   광구  (2011)", which looks like
    // a mid-word match, but that row predates this fix and its original bytes are gone. Do
    // not widen this to eat the spaces OUTSIDE the markers on that evidence: tried
    // 2026-08-19 and it produced "헤어질결심" and "살인의추억" against the real API. If a
    // mid-word match ever shows up, the original spacing is unrecoverable anyway.
    const title =
      stripHtml(clean(result.title))
        .replace(/!HS|!HE/g, "")
        .replace(/\s+/g, " ")
        .trim() || "related film";
    const year = clean(result.prodYear);

    return year ? `${title} (${year})` : title;
  }
  if (raw.provider === "omdb") {
    const result = raw.result as OmdbTitleResult;
    const title = clean(result.Title) || "\uAD00\uB828 \uC601\uC0C1\uBB3C";
    const year = clean(result.Year);

    return year ? `${title} (${year})` : title;
  }

  const result = raw.result as TvMazeShow;
  const title = clean(result.name) || "\uAD00\uB828 TV \uC2DC\uB9AC\uC988";
  const year = clean(result.premiered)?.slice(0, 4);

  return year ? `${title} (${year})` : title;
}

function getMediaCatalogImageUrl(raw: MediaCatalogRawResult) {
  if (raw.provider === "omdb") {
    const poster = clean((raw.result as OmdbTitleResult).Poster);

    return poster && poster !== "N/A" ? poster : null;
  }

  if (raw.provider === "tvmaze") {
    const image = (raw.result as TvMazeShow).image;

    return clean(image?.original) ?? clean(image?.medium);
  }

  return null;
}

function getSourceDate(raw: MediaCatalogRawResult) {
  if (raw.provider === "kmdb") {
    const released = clean((raw.result as KmdbMovieResult).repRlsDate);
    return released ? released : undefined;
  }
  if (raw.provider === "omdb") {
    const released = clean((raw.result as OmdbTitleResult).Released);
    return released && released !== "N/A" ? released : undefined;
  }

  return clean((raw.result as TvMazeShow).premiered) || undefined;
}

function buildKeyPoints(raw: MediaCatalogRawResult) {
  if (raw.provider === "kmdb") {
    const result = raw.result as KmdbMovieResult;
    const director = getNestedFirstText(result.directors, ["directorNm"]);

    return [
      "contentStoragePolicy:metadata_only",
      `catalogProvider:${SOURCE_NAME_KMDB}`,
      clean(result.genre) ? `genre:${clean(result.genre)}` : null,
      director ? `director:${director}` : null,
      clean(result.nation) ? `nation:${clean(result.nation)}` : null,
      clean(result.runtime) ? `runtime:${clean(result.runtime)}` : null,
      clean(result.rating) ? `rated:${clean(result.rating)}` : null
    ].filter((item): item is string => Boolean(item));
  }
  if (raw.provider === "omdb") {
    const result = raw.result as OmdbTitleResult;

    return [
      "contentStoragePolicy:metadata_only",
      `catalogProvider:${SOURCE_NAME_OMDB}`,
      clean(result.Type) ? `type:${clean(result.Type)}` : null,
      clean(result.Genre) ? `genre:${clean(result.Genre)}` : null,
      clean(result.Director) && clean(result.Director) !== "N/A"
        ? `director:${clean(result.Director)}`
        : null,
      clean(result.Runtime) && clean(result.Runtime) !== "N/A"
        ? `runtime:${clean(result.Runtime)}`
        : null,
      clean(result.Rated) && clean(result.Rated) !== "N/A"
        ? `rated:${clean(result.Rated)}`
        : null,
      clean(result.totalSeasons)
        ? `totalSeasons:${clean(result.totalSeasons)}`
        : null
    ].filter((item): item is string => Boolean(item));
  }

  const result = raw.result as TvMazeShow;

  return [
    "contentStoragePolicy:metadata_only",
    `catalogProvider:${SOURCE_NAME_TVMAZE}`,
    clean(result.type) ? `type:${clean(result.type)}` : null,
    clean(result.language) ? `language:${clean(result.language)}` : null,
    Array.isArray(result.genres) && result.genres.length > 0
      ? `genres:${result.genres.join(", ")}`
      : null,
    clean(result.status) ? `status:${clean(result.status)}` : null,
    clean(result.ended) ? `ended:${clean(result.ended)}` : null
  ].filter((item): item is string => Boolean(item));
}

export function normalizeMediaCatalogRawResult(input: {
  checkedAt: string;
  rawResult: MediaCatalogRawResult;
}): ContextAsset {
  const rawResult = input.rawResult;
  const checkedAt = rawResult.checkedAt ?? input.checkedAt;
  const sourceName =
    rawResult.provider === "kmdb"
      ? SOURCE_NAME_KMDB
      : rawResult.provider === "omdb"
        ? SOURCE_NAME_OMDB
        : SOURCE_NAME_TVMAZE;
  const sourceUrl = getExternalUrlForRaw(rawResult);
  const sourceDate = getSourceDate(rawResult);
  const title = getTitle(rawResult);
  const summary =
    rawResult.provider === "kmdb"
      ? getNestedFirstText((rawResult.result as KmdbMovieResult).plots, [
          "plotText"
        ])
      : rawResult.provider === "omdb"
        ? clean((rawResult.result as OmdbTitleResult).Plot)
        : stripHtml(clean((rawResult.result as TvMazeShow).summary));

  return {
    assetType: "MEDIA_CATALOG_CONTEXT",
    canonicalSourceKey: buildCanonicalKey(rawResult),
    checkedAt,
    confidence: "medium",
    disclaimer: CULTURAL_METADATA_CONTEXT_DISCLAIMER_KO,
    keyPoints: buildKeyPoints(rawResult),
    limitations: [
      "\uACF5\uAC1C \uCE74\uD0C8\uB85C\uADF8 \uBA54\uD0C0\uB370\uC774\uD130\uB9CC \uC800\uC7A5\uD569\uB2C8\uB2E4.",
      "\uC0AC\uC6A9\uC790\uC758 \uC2DC\uCCAD \uC774\uB825, \uBCF4\uC720 \uBAA9\uB85D, \uCDE8\uD5A5 \uD504\uB85C\uD544\uC744 \uCD94\uB860\uD558\uAC70\uB098 \uC800\uC7A5\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
      "\uD3C9\uC810\uC774\uB098 \uC778\uAE30\uB3C4\uB97C \uCD94\uCC9C/\uD310\uC815 \uADFC\uAC70\uB85C \uC0AC\uC6A9\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."
    ],
    locale: "ko",
    modelMetadata: {
      catalogProvider: sourceName,
      contentStoragePolicy: "metadata_only",
      imageUrl: getMediaCatalogImageUrl(rawResult),
      externalPosterUrlPresent:
        rawResult.provider === "omdb"
          ? Boolean(
              clean((rawResult.result as OmdbTitleResult).Poster) &&
                clean((rawResult.result as OmdbTitleResult).Poster) !== "N/A"
            )
          : false,
      // Fingerprint, never the query itself: on the flint-keyword path this string is
      // the author's own sentence, and modelMetadata is stored in a public asset row
      // that outlives the post. The write boundary re-derives this anyway.
      queryFingerprint: rawResult.query ? getContextQueryFingerprint(rawResult.query) : null,
      searchScore: rawResult.searchScore ?? null,
      visibleInPublicUi: false
    },
    providerType: PROVIDER_TYPE,
    retrievedAt: checkedAt,
    sourceDate,
    sourceHash: getContextHash(rawResult.result),
    sourceIdentifier:
      rawResult.provider === "kmdb"
        ? `kmdb:${getKmdbMovieId(rawResult.result as KmdbMovieResult)}`
        : rawResult.provider === "omdb"
          ? `omdb:${clean((rawResult.result as OmdbTitleResult).imdbID)}`
          : `tvmaze:${clean((rawResult.result as TvMazeShow).id)}`,
    sourceInstitution: sourceName,
    sourceName,
    sourceTitle: title,
    sourceUrl,
    status: "current",
    summary: summary && summary !== "N/A" ? summary : null
  };
}
