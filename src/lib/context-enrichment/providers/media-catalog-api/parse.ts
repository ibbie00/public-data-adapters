import { MediaCatalogProviderError } from "./types";
import type {
  KmdbMovieResult,
  OmdbSearchResult,
  OmdbTitleResult,
  TvMazeSearchResult
} from "./types";

export function clean(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

export function parseJsonRecord(payload: unknown) {
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : null;
}

export function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function isOmdbNotFound(payload: Record<string, unknown>) {
  return clean(payload.Response).toLowerCase() === "false";
}

export function getOmdbSearchItems(payload: unknown) {
  const record = parseJsonRecord(payload);
  if (!record) {
    throw new MediaCatalogProviderError(
      "PARSE_ERROR",
      "MEDIA_CATALOG_OMDB_PARSE_ERROR"
    );
  }
  if (isOmdbNotFound(record)) {
    return [];
  }

  const search = Array.isArray(record.Search) ? record.Search : [];

  return search
    .map((item) => parseJsonRecord(item))
    .filter((item): item is OmdbSearchResult =>
      Boolean(item && clean(item.imdbID))
    );
}

export function getOmdbTitle(payload: unknown) {
  const record = parseJsonRecord(payload);
  if (!record) {
    throw new MediaCatalogProviderError(
      "PARSE_ERROR",
      "MEDIA_CATALOG_OMDB_PARSE_ERROR"
    );
  }
  if (isOmdbNotFound(record) || !clean(record.imdbID)) {
    return null;
  }

  return record as OmdbTitleResult;
}

export function getTvMazeItems(payload: unknown) {
  if (!Array.isArray(payload)) {
    throw new MediaCatalogProviderError(
      "PARSE_ERROR",
      "MEDIA_CATALOG_TVMAZE_PARSE_ERROR"
    );
  }

  return payload
    .map((item) => parseJsonRecord(item))
    .filter((item): item is TvMazeSearchResult =>
      Boolean(item?.show && parseJsonRecord(item.show))
    );
}

export function getKmdbResults(payload: unknown) {
  const record = parseJsonRecord(payload);
  const data = Array.isArray(record?.Data) ? record.Data : [];
  const results = data.flatMap((entry) => {
    const item = parseJsonRecord(entry);
    return Array.isArray(item?.Result) ? item.Result : [];
  });

  return results
    .map((item) => parseJsonRecord(item))
    .filter((item): item is KmdbMovieResult =>
      Boolean(item && (clean(item.movieId) || clean(item.DOCID) || clean(item.title)))
    );
}

export function getKmdbMovieId(result: KmdbMovieResult) {
  const movieId = clean(result.movieId);
  const movieSeq = clean(result.movieSeq);

  return movieId && movieSeq ? `${movieId}-${movieSeq}` : movieId || clean(result.DOCID);
}

export function getKmdbMovieUrl(result: KmdbMovieResult) {
  // KMDb returns the canonical per-movie detail URL directly (e.g.
  // https://www.kmdb.or.kr/db/kor/detail/movie/K/12599): prefer it verbatim.
  const apiUrl = clean(result.kmdbUrl);
  if (/^https:\/\/(www\.)?kmdb\.or\.kr\/db\/.+\/detail\/movie\//i.test(apiUrl)) {
    return apiUrl;
  }

  // Fallback: build from movieId (the type segment, e.g. "K") + movieSeq.
  // Note movieId is already the "K"-style type, so it must NOT be re-prefixed.
  const movieId = clean(result.movieId);
  const movieSeq = clean(result.movieSeq);
  if (movieId && movieSeq) {
    return `https://www.kmdb.or.kr/db/kor/detail/movie/${encodeURIComponent(movieId)}/${encodeURIComponent(movieSeq)}`;
  }

  // Last resort: split a combined DOCID like "K12599" into type + number.
  const docid = clean(result.DOCID).match(/^([A-Za-z])0*(\d+)$/);
  if (docid) {
    return `https://www.kmdb.or.kr/db/kor/detail/movie/${docid[1].toUpperCase()}/${docid[2]}`;
  }

  return undefined;
}

export function getNestedFirstText(value: unknown, keys: readonly string[]): string {
  const record = parseJsonRecord(value);
  for (const key of keys) {
    const direct = clean(record?.[key]);
    if (direct) {
      return direct;
    }
  }

  for (const child of Object.values(record ?? {})) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const found: string = getNestedFirstText(item, keys);
        if (found) {
          return found;
        }
      }
    }
  }

  return "";
}
