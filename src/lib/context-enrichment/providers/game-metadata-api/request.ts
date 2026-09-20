import { contextEnrichmentUserAgent } from "../user-agent";

import { isContextProviderEnabled } from "../../config";
import {
  evaluateContextProviderBudget,
  getContextProviderSearchLimit
} from "../../guards";
import type { ContextResearchProviderSearchOptions } from "../../types";
import {
  fetchContextProviderJson,
  getDefaultContextProviderHttpStatus,
  type ProviderFetchLike
} from "../fetch-with-retry";
import { findGameNameInText } from "./name-index";
import {
  GAME_METADATA_PROVIDER_TYPE,
  GameMetadataProviderError,
  type GameMetadataProviderStatus,
  type GameMetadataRawResult,
  type GameMetadataSearchStatusResult,
  type RawgGameResult
} from "./types";

const RAWG_GAMES_URL = "https://api.rawg.io/api/games";
const DEFAULT_USER_AGENT = contextEnrichmentUserAgent("public game catalog metadata");

export function cleanGameMetadataValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function getGameSearchQuery(query: string) {
  // ⚠️ RAWG 는 영문 이름만 안다. `Stardew Valley` 는 찾고 `스타듀 밸리` 는 못 찾으며
  // `젤다의 전설` 에는 엉뚱한 게임을 준다(실측 2026-08-18). 사람은 한국어로 쓰므로
  // 굽어 둔 이름 목록에서 영문 이름을 찾아 넘긴다.
  const known = findGameNameInText(query);

  if (known) {
    return known.english;
  }

  const cleaned = query
    .replace(/\b(game|steam|rawg|release date|released)\b/gi, " ")
    .replace(/게임|스팀|출시일|출시\s*맥락|플레이|작품\s*맥락/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || query.trim();
}

function getRawgApiKey(env: NodeJS.ProcessEnv) {
  return env.RAWG_API_KEY?.trim() || "";
}

function hasGameMetadataCredential(env: NodeJS.ProcessEnv) {
  return Boolean(getRawgApiKey(env) || env.STEAM_WEB_API_KEY?.trim());
}

function buildRawgSearchUrl(input: { apiKey: string; limit: number; query: string }) {
  const url = new URL(RAWG_GAMES_URL);
  url.searchParams.set("key", input.apiKey);
  url.searchParams.set("search", input.query);
  url.searchParams.set("page_size", String(input.limit));

  return url;
}

async function fetchJson(input: {
  env: NodeJS.ProcessEnv;
  fetchImpl: ProviderFetchLike;
  url: URL;
}): Promise<unknown> {
  return fetchContextProviderJson({
    env: input.env,
    fallbackError: () => new GameMetadataProviderError("EXTERNAL_API_ERROR", "GAME_METADATA_FETCH_FAILED"),
    fetchImpl: input.fetchImpl,
    headers: {
      accept: "application/json",
      "user-agent": DEFAULT_USER_AGENT
    },
    isProviderError: (error) => error instanceof GameMetadataProviderError,
    responseError: (response) => {
      const status = getDefaultContextProviderHttpStatus<GameMetadataProviderStatus>(response, {
        externalApiError: "EXTERNAL_API_ERROR",
        invalidCredentials: "INVALID_CREDENTIALS",
        notFound: "NOT_FOUND",
        rateLimited: "RATE_LIMITED"
      });

      return status ? new GameMetadataProviderError(status, `GAME_METADATA_HTTP_${response.status}`) : null;
    },
    timeoutError: () => new GameMetadataProviderError("TIMEOUT", "GAME_METADATA_TIMEOUT"),
    url: input.url
  });
}

function getRawgResults(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new GameMetadataProviderError("PARSE_ERROR", "GAME_METADATA_RAWG_PARSE_ERROR");
  }

  const results = (payload as Record<string, unknown>).results;
  if (!Array.isArray(results)) {
    throw new GameMetadataProviderError("PARSE_ERROR", "GAME_METADATA_RAWG_RESULTS_MISSING");
  }

  return results
    .map((item) => item && typeof item === "object" ? item as RawgGameResult : null)
    .filter((item): item is RawgGameResult => Boolean(item && (item.id || cleanGameMetadataValue(item.name))));
}

export function redactGameMetadataUrl(input: URL | string) {
  const url = new URL(String(input));

  if (url.searchParams.has("key")) {
    url.searchParams.set("key", "REDACTED");
  }

  return url.toString();
}

export async function searchGameMetadataWithStatus({
  fetchImpl,
  now,
  options,
  query
}: {
  fetchImpl: ProviderFetchLike;
  now: () => Date;
  options: ContextResearchProviderSearchOptions;
  query: string;
}): Promise<GameMetadataSearchStatusResult> {
  const env = options.env ?? process.env;
  const checkedAt = now().toISOString();
  // 글에 적힌 한국어 이름. 검색에는 영문을 쓰지만 카드에는 이 표기를 되돌려 준다.
  const koreanName = findGameNameInText(query)?.korean ?? null;
  const trimmedQuery = getGameSearchQuery(query);

  if (!isContextProviderEnabled(GAME_METADATA_PROVIDER_TYPE, env)) {
    return { checkedAt, provider: GAME_METADATA_PROVIDER_TYPE, results: [], status: "PROVIDER_DISABLED" };
  }
  if (!trimmedQuery) {
    return { checkedAt, provider: GAME_METADATA_PROVIDER_TYPE, results: [], status: "INVALID_QUERY" };
  }
  if (!hasGameMetadataCredential(env) || !getRawgApiKey(env)) {
    return { checkedAt, provider: GAME_METADATA_PROVIDER_TYPE, results: [], status: "MISSING_CREDENTIALS" };
  }

  const budget = evaluateContextProviderBudget(options.budgetSnapshot, env);
  if (!budget.allowed) {
    return { checkedAt, provider: GAME_METADATA_PROVIDER_TYPE, results: [], status: "RATE_LIMITED" };
  }

  try {
    const payload = await fetchJson({
      env,
      fetchImpl,
      url: buildRawgSearchUrl({
        apiKey: getRawgApiKey(env),
        limit: getContextProviderSearchLimit(options.limit, env),
        query: trimmedQuery
      })
    });
    const results: GameMetadataRawResult[] = getRawgResults(payload).map((result) => ({
      checkedAt,
      koreanName,
      provider: "rawg",
      query: trimmedQuery,
      result,
      status: "OK"
    }));

    return {
      checkedAt,
      provider: GAME_METADATA_PROVIDER_TYPE,
      results,
      status: results.length > 0 ? "OK" : "NOT_FOUND"
    };
  } catch (error) {
    return {
      checkedAt,
      provider: GAME_METADATA_PROVIDER_TYPE,
      results: [],
      status: error instanceof GameMetadataProviderError ? error.status : "EXTERNAL_API_ERROR"
    };
  }
}
