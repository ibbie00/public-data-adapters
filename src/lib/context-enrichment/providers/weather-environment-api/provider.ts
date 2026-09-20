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
import { findWeatherAdvisories, hasWeatherAdvisoryCredential } from "./advisory";
import { normalizeWeatherEnvironmentRawResult } from "./normalize";
import {
  WeatherEnvironmentProviderError,
  type WeatherEnvironmentApiProviderOptions,
  type WeatherEnvironmentRawResult,
  type WeatherEnvironmentSearchStatusResult
} from "./types";

export class WeatherEnvironmentApiProvider implements ContextResearchProvider<WeatherEnvironmentRawResult> {
  readonly providerType = PROVIDER_TYPE;
  private readonly fetchImpl: ProviderFetchLike;
  private readonly now: () => Date;

  constructor(options: WeatherEnvironmentApiProviderOptions = {}) {
    this.fetchImpl = getContextProviderFetchImpl(options.fetchImpl);
    this.now = options.now ?? (() => new Date());
  }

  async searchWithStatus(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<WeatherEnvironmentSearchStatusResult> {
    const env = options.env ?? process.env;
    const checkedAt = this.now().toISOString();
    // 글이 짚은 현상들. 지명은 쓰지 않는다.
    //
    // ⚠️ 예전에는 여기서 글에서 도시를 뽑아 OpenWeatherMap 을 불렀다. 그것은 우리가
    // 글쓴이의 위치를 추론하는 일이고(창업자 판단 2026-08-18) 지명이 없는 글에는 어차피
    // 아무것도 못 했다. 지금은 기상청 특보만 본다. 특보 목록에는 지역 파라미터가 없다.
    // → advisory.ts
    const terms = query
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 2);

    if (!isContextProviderEnabled(PROVIDER_TYPE, env)) {
      return { checkedAt, provider: PROVIDER_TYPE, results: [], status: "PROVIDER_DISABLED" };
    }
    if (terms.length === 0) {
      return { checkedAt, provider: PROVIDER_TYPE, results: [], status: "INVALID_QUERY" };
    }
    if (!hasWeatherAdvisoryCredential(env)) {
      return { checkedAt, provider: PROVIDER_TYPE, results: [], status: "MISSING_CREDENTIALS" };
    }

    const budget = evaluateContextProviderBudget(options.budgetSnapshot, env);
    if (!budget.allowed) {
      return { checkedAt, provider: PROVIDER_TYPE, results: [], status: "RATE_LIMITED" };
    }

    try {
      const advisories = await findWeatherAdvisories({
        env,
        fetchImpl: this.fetchImpl,
        limit: getContextProviderSearchLimit(options.limit, env),
        terms
      });

      return {
        checkedAt,
        provider: PROVIDER_TYPE,
        results: advisories.map((advisory) => ({
          advisory,
          checkedAt,
          provider: "kma_advisory" as const,
          query,
          status: "OK" as const
        })),
        // 특보가 없는 것은 흔한 일이고 오류가 아니다. 이 자료는 이례적인 일이 있을 때만
        // 있다.
        status: advisories.length > 0 ? "OK" : "NOT_FOUND"
      };
    } catch (error) {
      return {
        checkedAt,
        provider: PROVIDER_TYPE,
        results: [],
        status: error instanceof WeatherEnvironmentProviderError ? error.status : "EXTERNAL_API_ERROR"
      };
    }
  }

  async search(query: string, options: ContextResearchProviderSearchOptions = {}) {
    const result = await this.searchWithStatus(query, options);

    return result.status === "OK" ? result.results.slice(0, getContextProviderSearchLimit(options.limit, options.env ?? process.env)) : [];
  }

  async fetchById(): Promise<WeatherEnvironmentRawResult | null> {
    return null;
  }

  normalize(rawResult: WeatherEnvironmentRawResult): ContextAsset {
    return normalizeWeatherEnvironmentRawResult({
      checkedAt: this.now().toISOString(),
      rawResult
    });
  }

  validate(normalizedAsset: ContextAsset): void {
    assertValidContextAsset(normalizedAsset);
  }

  getFreshnessPolicy(asset?: ContextAsset): ContextFreshnessPolicy {
    return getContextAssetFreshnessPolicy(asset ?? {
      assetType: "WEATHER_ENVIRONMENT_CONTEXT",
      providerType: PROVIDER_TYPE,
      sourceTitle: "weather environment"
    });
  }
}

export function createWeatherEnvironmentApiProvider(options: WeatherEnvironmentApiProviderOptions = {}) {
  return new WeatherEnvironmentApiProvider(options);
}
