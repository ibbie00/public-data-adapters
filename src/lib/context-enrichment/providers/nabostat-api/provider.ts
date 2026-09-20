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
import { fetchNabostatResponse } from "./fetch";
import { normalizeNabostatRawResult } from "./normalize";
import { getStatusFromResponse, normalizeRows } from "./parse";
import {
  getNabostatApiKey,
  getNabostatDataCycle,
  looksLikeTableId
} from "./query";
import {
  canSearchNabostatTables,
  nabostatSearchTerms,
  pickNabostatTableMatch
} from "./table-search";
import {
  NabostatProviderError,
  type NabostatApiProviderOptions,
  type NabostatRawResult,
  type NabostatSearchStatusResult,
  type NabostatTableMatch
} from "./types";
import { buildNabostatSearchUrl, buildNabostatUrl } from "./urls";

export class NabostatApiProvider implements ContextResearchProvider<NabostatRawResult> {
  readonly providerType = PROVIDER_TYPE;
  private readonly fetchImpl: ProviderFetchLike;
  private readonly now: () => Date;

  constructor(options: NabostatApiProviderOptions = {}) {
    this.fetchImpl = getContextProviderFetchImpl(options.fetchImpl);
    this.now = options.now ?? (() => new Date());
  }

  async search(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<NabostatRawResult[]> {
    return (await this.searchWithStatus(query, options)).results;
  }

  async searchWithStatus(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<NabostatSearchStatusResult> {
    const env = options.env ?? process.env;
    const checkedAt = this.now().toISOString();
    const apiKey = getNabostatApiKey(env);

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
    // 표 id 를 아는 질의인가, 사람이 쓴 지표명인가.
    const searchable = !looksLikeTableId(query) && canSearchNabostatTables(query);

    if (!looksLikeTableId(query) && !searchable) {
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

    const table: NabostatTableMatch | null = searchable
      ? await this.findTableByName(query, apiKey, env, options)
      : { cycleCodes: [], tableId: query.trim(), tableName: null };

    if (!table) {
      return {
        checkedAt,
        provider: PROVIDER_ID,
        results: [],
        status: "NOT_FOUND"
      };
    }

    const { payload, response } = await this.fetchTableValues(table, apiKey, env, options);

    if (!response.ok) {
      throw new NabostatProviderError("EXTERNAL_API_ERROR", `NABOSTAT_API_SEARCH_FAILED:${response.status}`);
    }

    const results = normalizeRows(payload).map((row) => ({
      ...row,
      __checkedAt: checkedAt,
      __provider: PROVIDER_ID as "nabostat",
      __status: "OK" as const,
      __tableId: table.tableId
    }));

    return {
      checkedAt,
      provider: PROVIDER_ID,
      results,
      status: getStatusFromResponse(payload, results)
    };
  }

  // 지표명으로 표를 찾는다. 못 찾으면 null 이고 호출 측이 NOT_FOUND 로 돌려준다.
  //
  // 낱말 후보를 순서대로 넣어 본다. 이 API 는 이름을 통째로 맞춰 보므로 "소비자물가
  // 통계청" 같은 검색어는 쪼개야 걸린다(table-search.ts).
  private async findTableByName(
    query: string,
    apiKey: string,
    env: NodeJS.ProcessEnv,
    options: ContextResearchProviderSearchOptions
  ): Promise<NabostatTableMatch | null> {
    for (const term of nabostatSearchTerms(query)) {
      const { response, text } = await fetchNabostatResponse({
        env,
        fetchImpl: this.fetchImpl,
        url: buildNabostatSearchUrl({
          key: apiKey,
          limit: getContextProviderSearchLimit(options.limit, env),
          term
        })
      });

      if (!response.ok) {
        throw new NabostatProviderError(
          "EXTERNAL_API_ERROR",
          `NABOSTAT_API_TABLE_SEARCH_FAILED:${response.status}`
        );
      }

      let match: NabostatTableMatch | null;
      try {
        match = pickNabostatTableMatch(JSON.parse(text));
      } catch {
        throw new NabostatProviderError("PARSE_ERROR", "NABOSTAT_API_TABLE_SEARCH_JSON_PARSE_FAILED");
      }

      if (match) {
        return match;
      }
    }

    return null;
  }

  // 표의 값을 가져온다. 주기 코드 후보를 순서대로 넣어 보고 행이 오면 멈춘다.
  //
  // ⚠️ 후보가 여럿인 이유는 목록이 주기를 "년,분기,월" 처럼 여럿으로 적어 두고, 그중
  // 실제로 답하는 것이 하나뿐일 수 있기 때문이다(table-search.ts). 표 539개 중 495개가
  // 년 하나뿐이라 대부분 첫 판에 끝난다.
  private async fetchTableValues(
    table: NabostatTableMatch,
    apiKey: string,
    env: NodeJS.ProcessEnv,
    options: ContextResearchProviderSearchOptions
  ) {
    const cycles = table.cycleCodes.length > 0 ? table.cycleCodes : [getNabostatDataCycle(env)];
    let last: { payload: unknown; response: Response } | null = null;

    for (const dataCycle of cycles) {
      const { response, text } = await fetchNabostatResponse({
        env,
        fetchImpl: this.fetchImpl,
        url: buildNabostatUrl({
          dataCycle,
          key: apiKey,
          limit: getContextProviderSearchLimit(options.limit, env),
          tableId: table.tableId
        })
      });

      let payload: unknown;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new NabostatProviderError("PARSE_ERROR", "NABOSTAT_API_JSON_PARSE_FAILED");
      }

      last = { payload, response };
      if (!response.ok || normalizeRows(payload).length > 0) {
        return last;
      }
    }

    return last!;
  }

  async fetchById(sourceIdentifier: string, options: ContextResearchProviderSearchOptions = {}) {
    const result = await this.search(sourceIdentifier, {
      ...options,
      limit: 1
    });

    return result[0] ?? null;
  }

  normalize(rawResult: NabostatRawResult): ContextAsset {
    return normalizeNabostatRawResult({
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

export function createNabostatApiProvider(options: NabostatApiProviderOptions = {}) {
  return new NabostatApiProvider(options);
}
