import type { ProviderFetchLike } from "../fetch-with-retry";
import { isContextProviderEnabled } from "../../config";
import { PROVIDER_TYPE } from "./constants";
import {
  getKmdbApiKey,
  getOmdbApiKey,
  hasAnyMediaCatalogCredential,
  isTvMazeEnabled
} from "./env";
import { fetchJson } from "./fetch";
import {
  clean,
  getKmdbResults,
  getOmdbSearchItems,
  getOmdbTitle,
  getTvMazeItems,
  parseJsonRecord
} from "./parse";
import type { MediaCatalogRawResult, TvMazeShow } from "./types";
import {
  buildKmdbSearchUrl,
  buildOmdbSearchUrl,
  buildOmdbTitleUrl,
  buildTvMazeSearchUrl,
  buildTvMazeShowUrl
} from "./urls";

type SearchInput = {
  checkedAt: string;
  env: NodeJS.ProcessEnv;
  fetchImpl: ProviderFetchLike;
  limit: number;
  query: string;
};

// How many rows to pull from KMDb before filtering by title. Ten is enough for the
// educational-film case above without turning one lookup into a page scrape.
const KMDB_FETCH_COUNT = 10;

export async function searchKmdbCatalog(input: SearchInput) {
  const apiKey = getKmdbApiKey(input.env);

  if (!apiKey) {
    return [];
  }

  const kmdbPayload = await fetchJson({
    env: input.env,
    fetchImpl: input.fetchImpl,
    url: buildKmdbSearchUrl({
      apiKey,
      limit: KMDB_FETCH_COUNT,
      query: input.query
    })
  });
  // The caller's limit is how many results to KEEP, not how many to ask for.
  //
  // KMDb does not sort by relevance: asking for "기생충" puts a 1974 educational film
  // ("기생충을 예방하자") first and the 2019 feature second (measured 2026-08-18). With the
  // two numbers tied together the real answer fell off the end and the provider reported
  // NOT_FOUND. The title filter in provider.ts already drops the near-misses, so fetching
  // wider costs one response and buys the right title.
  const kmdbItems = getKmdbResults(kmdbPayload).slice(0, KMDB_FETCH_COUNT);

  return kmdbItems.map((item): MediaCatalogRawResult => ({
    checkedAt: input.checkedAt,
    provider: "kmdb",
    query: input.query,
    result: item,
    status: "OK"
  }));
}

export async function searchOmdbCatalog(input: SearchInput) {
  const apiKey = getOmdbApiKey(input.env);

  if (!apiKey) {
    return [];
  }

  const searchPayload = await fetchJson({
    env: input.env,
    fetchImpl: input.fetchImpl,
    url: buildOmdbSearchUrl({ apiKey, query: input.query })
  });
  const items = getOmdbSearchItems(searchPayload).slice(0, input.limit);
  const results: MediaCatalogRawResult[] = [];

  for (const item of items) {
    const titlePayload = await fetchJson({
      env: input.env,
      fetchImpl: input.fetchImpl,
      url: buildOmdbTitleUrl({ apiKey, imdbId: clean(item.imdbID) })
    });
    const title = getOmdbTitle(titlePayload);
    if (title) {
      results.push({
        checkedAt: input.checkedAt,
        provider: "omdb",
        query: input.query,
        result: title,
        status: "OK"
      });
    }
  }

  return results;
}

export async function searchTvMazeCatalog(input: SearchInput) {
  if (!isTvMazeEnabled(input.env)) {
    return [];
  }

  const tvMazePayload = await fetchJson({
    env: input.env,
    fetchImpl: input.fetchImpl,
    url: buildTvMazeSearchUrl(input.query)
  });
  const tvMazeItems = getTvMazeItems(tvMazePayload).slice(0, input.limit);
  const results: MediaCatalogRawResult[] = [];

  for (const item of tvMazeItems) {
    if (item.show) {
      results.push({
        checkedAt: input.checkedAt,
        provider: "tvmaze",
        query: input.query,
        result: item.show,
        searchScore: typeof item.score === "number" ? item.score : null,
        status: "OK"
      });
    }
  }

  return results;
}

export async function fetchMediaCatalogById(input: {
  checkedAt: string;
  env: NodeJS.ProcessEnv;
  fetchImpl: ProviderFetchLike;
  sourceIdentifier: string;
}): Promise<MediaCatalogRawResult | null> {
  const trimmed = input.sourceIdentifier.trim();

  if (
    !isContextProviderEnabled(PROVIDER_TYPE, input.env) ||
    !trimmed ||
    !hasAnyMediaCatalogCredential(input.env)
  ) {
    return null;
  }

  try {
    if (trimmed.startsWith("kmdb:")) {
      const apiKey = getKmdbApiKey(input.env);
      if (!apiKey) {
        return null;
      }
      const query = trimmed.replace(/^kmdb:/, "");
      const payload = await fetchJson({
        env: input.env,
        fetchImpl: input.fetchImpl,
        url: buildKmdbSearchUrl({ apiKey, limit: 1, query })
      });
      const [movie] = getKmdbResults(payload);

      return movie ? {
        checkedAt: input.checkedAt,
        provider: "kmdb",
        result: movie,
        status: "OK"
      } : null;
    }

    if (trimmed.startsWith("omdb:") || /^tt\d+$/i.test(trimmed)) {
      const imdbId = trimmed.replace(/^omdb:/, "");
      const apiKey = getOmdbApiKey(input.env);
      if (!apiKey) {
        return null;
      }
      const payload = await fetchJson({
        env: input.env,
        fetchImpl: input.fetchImpl,
        url: buildOmdbTitleUrl({ apiKey, imdbId })
      });
      const title = getOmdbTitle(payload);

      return title ? {
        checkedAt: input.checkedAt,
        provider: "omdb",
        result: title,
        status: "OK"
      } : null;
    }

    if (trimmed.startsWith("tvmaze:") || /^\d+$/.test(trimmed)) {
      if (!isTvMazeEnabled(input.env)) {
        return null;
      }
      const id = trimmed.replace(/^tvmaze:/, "");
      const payload = await fetchJson({
        env: input.env,
        fetchImpl: input.fetchImpl,
        url: buildTvMazeShowUrl(id)
      });
      const show = parseJsonRecord(payload) as TvMazeShow | null;

      return show && clean(show.id) ? {
        checkedAt: input.checkedAt,
        provider: "tvmaze",
        result: show,
        status: "OK"
      } : null;
    }
  } catch {
    return null;
  }

  return null;
}
