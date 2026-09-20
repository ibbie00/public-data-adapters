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
import { PROVIDER_ID, PROVIDER_TYPE } from "./constants";
import { fetchEcosResponse } from "./fetch";
import { normalizeEcosRawResult } from "./normalize";
import { getStatusFromPayload, normalizeRows } from "./parse";
import { getEcosApiKey, parseEcosQuery } from "./query";
import { buildEcosPeriod, findEcosTableByName } from "./table-index";
import {
  EcosProviderError,
  type EcosApiProviderOptions,
  type EcosParsedQuery,
  type EcosRawResult,
  type EcosSearchStatusResult
} from "./types";
import { buildEcosUrl } from "./urls";

export class EcosApiProvider implements ContextResearchProvider<EcosRawResult> {
  readonly providerType = PROVIDER_TYPE;
  private readonly fetchImpl: ProviderFetchLike;
  private readonly now: () => Date;

  constructor(options: EcosApiProviderOptions = {}) {
    this.fetchImpl = getContextProviderFetchImpl(options.fetchImpl);
    this.now = options.now ?? (() => new Date());
  }

  async search(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<EcosRawResult[]> {
    return (await this.searchWithStatus(query, options)).results;
  }

  async searchWithStatus(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<EcosSearchStatusResult> {
    const env = options.env ?? process.env;
    const checkedAt = this.now().toISOString();
    const apiKey = getEcosApiKey(env);

    if (!isContextProviderEnabled(PROVIDER_TYPE, env)) {
      return {
        checkedAt,
        provider: PROVIDER_ID,
        results: [],
        status: "PROVIDER_DISABLED"
      };
    }
    if (!apiKey) {
      return {
        checkedAt,
        provider: PROVIDER_ID,
        results: [],
        status: "MISSING_CREDENTIALS"
      };
    }

    // 굽어 둔 목록에서 이름으로 먼저 찾는다.
    //
    // 이 순서인 이유는 `parseEcosQuery` 가 기본값 환경에서 영숫자 낱말을 통계 코드로
    // 받아 버리기 때문이다. 목록에 있는 이름이면 그것이 맞는 답이고, 없을 때만 기존
    // 경로로 넘어간다(표 코드를 직접 준 질의가 그쪽이다).
    const parsed = this.findTableInIndex(query) ?? parseEcosQuery(query, env);
    if (!parsed) {
      return {
        checkedAt,
        provider: PROVIDER_ID,
        results: [],
        status: "INVALID_QUERY"
      };
    }

    const budget = evaluateContextProviderBudget(options.budgetSnapshot, env);

    if (!budget.allowed) {
      return {
        checkedAt,
        provider: PROVIDER_ID,
        results: [],
        status: "RATE_LIMITED"
      };
    }

    const { response, text } = await fetchEcosResponse({
      env,
      fetchImpl: this.fetchImpl,
      url: buildEcosUrl({
        apiKey,
        limit: getContextProviderSearchLimit(options.limit, env),
        parsed
      })
    });

    if (!response.ok) {
      throw new EcosProviderError("EXTERNAL_API_ERROR", `ECOS_API_SEARCH_FAILED:${response.status}`);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new EcosProviderError("PARSE_ERROR", "ECOS_API_JSON_PARSE_FAILED");
    }

    const results = normalizeRows(payload, parsed.mode).map((row) => ({
      ...row,
      __checkedAt: checkedAt,
      __mode: parsed.mode,
      __provider: PROVIDER_ID as "ecos",
      __query: query.trim() || "key-statistics",
      __status: "OK" as const
    }));

    return {
      checkedAt,
      provider: PROVIDER_ID,
      results,
      status: getStatusFromPayload(payload, results, parsed.mode)
    };
  }

  // 지표명을 굽어 둔 목록에서 찾아 조회 질의로 바꾼다.
  //
  // 외부 호출이 없다. 목록은 저장소에 있고 기간은 계산이다. 그래서 이 층은 예산 검사
  // 앞에 두어도 된다.
  private findTableInIndex(query: string): EcosParsedQuery | null {
    const match = findEcosTableByName(query);

    if (!match) {
      return null;
    }

    const period = buildEcosPeriod(match.cycle, this.now());

    if (!period) {
      return null;
    }

    return {
      cycle: match.cycle,
      end: period.end,
      mode: "statistic-search",
      start: period.start,
      statCode: match.statCode
    };
  }

  async fetchById(sourceIdentifier: string, options: ContextResearchProviderSearchOptions = {}) {
    const result = await this.search(sourceIdentifier, {
      ...options,
      limit: 1
    });

    return result[0] ?? null;
  }

  normalize(rawResult: EcosRawResult): ContextAsset {
    return normalizeEcosRawResult({
      checkedAt: this.now().toISOString(),
      rawResult
    });
  }

  validate(normalizedAsset: ContextAsset) {
    assertValidContextAsset(normalizedAsset);
  }

  getFreshnessPolicy(asset?: ContextAsset): ContextFreshnessPolicy {
    return getContextAssetFreshnessPolicy(
      asset ?? {
        assetType: "STATISTICS_CONTEXT",
        providerType: PROVIDER_TYPE,
        sourceTitle: ""
      }
    );
  }
}

export function createEcosApiProvider(options: EcosApiProviderOptions = {}) {
  return new EcosApiProvider(options);
}
