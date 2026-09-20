import { isContextProviderEnabled } from "../../config";
import { getContextAssetFreshnessPolicy } from "../../freshness";
import {
  evaluateContextProviderBudget,
  getContextProviderSearchLimit
} from "../../guards";
import type {
  ContextAsset,
  ContextFreshnessPolicy,
  ContextResearchProvider,
  ContextResearchProviderSearchOptions
} from "../../types";
import { assertValidContextAsset } from "../../validation";
import {
  getContextProviderFetchImpl,
  type ProviderFetchLike
} from "../fetch-with-retry";
import { PROVIDER_TYPE } from "./constants";
import {
  getMediaCatalogSearchQueries,
  hasAnyMediaCatalogCredential,
  mediaTitleMatchesQuery
} from "./env";
import type { MediaTitleLlmFallback } from "./media-title-fallback";
import { normalizeMediaCatalogRawResult } from "./normalize";
import {
  fetchMediaCatalogById,
  searchKmdbCatalog,
  searchOmdbCatalog,
  searchTvMazeCatalog
} from "./search";
import {
  MediaCatalogProviderError,
  type MediaCatalogApiProviderOptions,
  type MediaCatalogProviderStatus,
  type MediaCatalogRawResult,
  type MediaCatalogSearchStatusResult
} from "./types";

export class MediaCatalogApiProvider implements ContextResearchProvider<MediaCatalogRawResult> {
  readonly providerType = PROVIDER_TYPE;
  private readonly fetchImpl: ProviderFetchLike;
  private readonly now: () => Date;
  private readonly titleFallback: MediaTitleLlmFallback | null;

  constructor(options: MediaCatalogApiProviderOptions = {}) {
    this.fetchImpl = getContextProviderFetchImpl(options.fetchImpl);
    this.now = options.now ?? (() => new Date());
    this.titleFallback = options.titleFallback ?? null;
  }

  private isTitleFallbackEnabled(env: NodeJS.ProcessEnv): boolean {
    try {
      return this.titleFallback?.enabled(env) ?? false;
    } catch {
      return false;
    }
  }

  async searchWithStatus(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<MediaCatalogSearchStatusResult> {
    const env = options.env ?? process.env;
    const checkedAt = this.now().toISOString();
    const candidateQueries = getMediaCatalogSearchQueries(query);

    if (!isContextProviderEnabled(PROVIDER_TYPE, env)) {
      return {
        checkedAt,
        provider: PROVIDER_TYPE,
        results: [],
        status: "PROVIDER_DISABLED"
      };
    }
    // 규칙으로 후보를 못 뽑아도 LLM 폴백이 켜져 있으면 거기서 제목을 시도하므로 단락하지 않는다.
    if (candidateQueries.length === 0 && !this.isTitleFallbackEnabled(env)) {
      return {
        checkedAt,
        provider: PROVIDER_TYPE,
        results: [],
        status: "INVALID_QUERY"
      };
    }
    if (!hasAnyMediaCatalogCredential(env)) {
      return {
        checkedAt,
        provider: PROVIDER_TYPE,
        results: [],
        status: "MISSING_CREDENTIALS"
      };
    }

    const budget = evaluateContextProviderBudget(options.budgetSnapshot, env);
    if (!budget.allowed) {
      return {
        checkedAt,
        provider: PROVIDER_TYPE,
        results: [],
        status: "RATE_LIMITED"
      };
    }

    const limit = getContextProviderSearchLimit(options.limit, env);

    try {
      // 1) 규칙 기반 후보를 우선순위대로 검색하고, 제목이 정확히 일치하는 첫 결과를 채택.
      const primary = await this.searchAndSelectCandidates(candidateQueries, { checkedAt, env, limit });
      if (primary.matched.length > 0) {
        return { checkedAt, provider: PROVIDER_TYPE, results: primary.matched, status: "OK" };
      }
      let lastErrorStatus = primary.lastErrorStatus;

      // 2) 규칙으로 못 잡았을 때만(맨제목 등) 로컬 LLM로 제목 1개를 추출해 재검색.
      //    KMDb 정확일치 선별이 그대로 적용되어 LLM이 틀린 제목을 줘도 오탐이 안 생긴다.
      if (this.isTitleFallbackEnabled(env) && this.titleFallback) {
        const llmTitle = await this.titleFallback.extract(query, env);
        if (llmTitle && !candidateQueries.includes(llmTitle)) {
          const fallback = await this.searchAndSelectCandidates([llmTitle], { checkedAt, env, limit });
          if (fallback.matched.length > 0) {
            return { checkedAt, provider: PROVIDER_TYPE, results: fallback.matched, status: "OK" };
          }
          lastErrorStatus = fallback.lastErrorStatus ?? lastErrorStatus;
        }
      }

      return { checkedAt, provider: PROVIDER_TYPE, results: [], status: lastErrorStatus ?? "NOT_FOUND" };
    } catch (error) {
      return {
        checkedAt,
        provider: PROVIDER_TYPE,
        results: [],
        status:
          error instanceof MediaCatalogProviderError
            ? error.status
            : "EXTERNAL_API_ERROR"
      };
    }
  }

  // 후보 질의들을 KMDb→OMDb→TVMaze 순으로 검색하고, 제목이 후보와 정확히 일치하는
  // 결과가 나오는 첫 후보를 채택한다(짧은 제목 우선). 느슨한 부분일치는 버린다.
  private async searchAndSelectCandidates(
    candidateQueries: string[],
    context: { checkedAt: string; env: NodeJS.ProcessEnv; limit: number }
  ): Promise<{ lastErrorStatus: MediaCatalogProviderStatus | null; matched: MediaCatalogRawResult[] }> {
    const { checkedAt, env, limit } = context;
    let lastErrorStatus: MediaCatalogProviderStatus | null = null;

    for (const candidateQuery of candidateQueries) {
      const results: MediaCatalogRawResult[] = [];

      try {
        results.push(
          ...await searchKmdbCatalog({ checkedAt, env, fetchImpl: this.fetchImpl, limit, query: candidateQuery })
        );
      } catch (error) {
        lastErrorStatus = error instanceof MediaCatalogProviderError ? error.status : "EXTERNAL_API_ERROR";
      }

      if (results.length < limit) {
        try {
          results.push(
            ...await searchOmdbCatalog({
              checkedAt,
              env,
              fetchImpl: this.fetchImpl,
              limit: limit - results.length,
              query: candidateQuery
            })
          );
        } catch (error) {
          lastErrorStatus = error instanceof MediaCatalogProviderError ? error.status : "EXTERNAL_API_ERROR";
        }
      }

      if (results.length < limit) {
        results.push(
          ...await searchTvMazeCatalog({
            checkedAt,
            env,
            fetchImpl: this.fetchImpl,
            limit: limit - results.length,
            query: candidateQuery
          })
        );
      }

      // 제목 길이가 짧을수록(정확 일치에 가까움) 우선, 동률이면 최신 연도 우선
      // (동명 구작 대신 최근작을 고르도록).
      const yearOf = (title: string) => {
        const match = title.match(/\((\d{4})\)\s*$/u);
        return match ? Number(match[1]) : 0;
      };
      const matched = results
        .map((result) => ({ result, title: this.safeSourceTitle(result) }))
        .filter((entry) => entry.title.length > 0 && mediaTitleMatchesQuery(entry.title, candidateQuery))
        .sort((a, b) => a.title.length - b.title.length || yearOf(b.title) - yearOf(a.title))
        .map((entry) => entry.result);
      if (matched.length > 0) {
        return { lastErrorStatus, matched };
      }
    }

    return { lastErrorStatus, matched: [] };
  }

  private safeSourceTitle(rawResult: MediaCatalogRawResult): string {
    try {
      return this.normalize(rawResult).sourceTitle ?? "";
    } catch {
      return "";
    }
  }

  async search(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<MediaCatalogRawResult[]> {
    const result = await this.searchWithStatus(query, options);

    return result.status === "OK" ? result.results : [];
  }

  async fetchById(
    sourceIdentifier: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<MediaCatalogRawResult | null> {
    return fetchMediaCatalogById({
      checkedAt: this.now().toISOString(),
      env: options.env ?? process.env,
      fetchImpl: this.fetchImpl,
      sourceIdentifier
    });
  }

  normalize(rawResult: MediaCatalogRawResult): ContextAsset {
    return normalizeMediaCatalogRawResult({
      checkedAt: this.now().toISOString(),
      rawResult
    });
  }

  validate(normalizedAsset: ContextAsset): void {
    assertValidContextAsset(normalizedAsset);
  }

  getFreshnessPolicy(asset?: ContextAsset): ContextFreshnessPolicy {
    return getContextAssetFreshnessPolicy(asset ?? {
      assetType: "MEDIA_CATALOG_CONTEXT",
      providerType: PROVIDER_TYPE,
      sourceTitle: "media catalog metadata"
    });
  }
}

export function createMediaCatalogApiProvider(
  options: MediaCatalogApiProviderOptions = {}
) {
  return new MediaCatalogApiProvider(options);
}
