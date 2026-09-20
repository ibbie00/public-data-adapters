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
import { fetchKosisResponse } from "./fetch";
import { normalizeKosisRawResult } from "./normalize";
import { getStatusFromPayload, normalizeRows } from "./parse";
import {
  getKosisApiKey,
  getKosisPeriodicity,
  parseKosisQuery
} from "./query";
import {
  canSearchKosisTables,
  parseKosisObjSelections,
  pickKosisTableMatch
} from "./table-search";
import {
  KosisProviderError,
  type KosisApiProviderOptions,
  type KosisParsedQuery,
  type KosisRawResult,
  type KosisSearchStatusResult
} from "./types";
import {
  buildKosisMetaUrl,
  buildKosisSearchUrl,
  buildKosisUrl
} from "./urls";

export class KosisApiProvider implements ContextResearchProvider<KosisRawResult> {
  readonly providerType = PROVIDER_TYPE;
  private readonly fetchImpl: ProviderFetchLike;
  private readonly now: () => Date;

  constructor(options: KosisApiProviderOptions = {}) {
    this.fetchImpl = getContextProviderFetchImpl(options.fetchImpl);
    this.now = options.now ?? (() => new Date());
  }

  async search(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<KosisRawResult[]> {
    return (await this.searchWithStatus(query, options)).results;
  }

  async searchWithStatus(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<KosisSearchStatusResult> {
    const env = options.env ?? process.env;
    const checkedAt = this.now().toISOString();
    const apiKey = getKosisApiKey(env);

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
    //
    // 지표명을 먼저 가른다. `parseKosisQuery` 는 `KOSIS_DEFAULT_ORG_ID` 가 있으면 영숫자
    // 낱말을 표 id 로 받아 버리므로, 순서가 거꾸로면 `GDP` 같은 검색어가 표 id 로 읽힌다.
    const searchable = canSearchKosisTables(query);
    const parsed = searchable ? null : parseKosisQuery(query, env);

    if (!parsed && !searchable) {
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

    const table = parsed ?? (await this.findTableByName(query, apiKey, env));

    if (!table) {
      return {
        checkedAt,
        provider: PROVIDER_ID,
        results: [],
        status: "NOT_FOUND"
      };
    }

    const { response, text } = await fetchKosisResponse({
      env,
      fetchImpl: this.fetchImpl,
      url: buildKosisUrl({
        apiKey,
        limit: getContextProviderSearchLimit(options.limit, env),
        objSelections: await this.readObjSelections(table, apiKey, env),
        orgId: table.orgId,
        prdSe: getKosisPeriodicity(env),
        tableId: table.tableId
      })
    });

    if (!response.ok) {
      throw new KosisProviderError("EXTERNAL_API_ERROR", `KOSIS_API_SEARCH_FAILED:${response.status}`);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new KosisProviderError("PARSE_ERROR", "KOSIS_API_JSON_PARSE_FAILED");
    }

    const results = normalizeRows(payload).map((row) => ({
      ...row,
      __checkedAt: checkedAt,
      __orgId: table.orgId,
      __provider: PROVIDER_ID as "kosis",
      __status: "OK" as const,
      __tableId: table.tableId
    }));

    return {
      checkedAt,
      provider: PROVIDER_ID,
      results,
      status: getStatusFromPayload(payload, results)
    };
  }

  // 지표명으로 표를 찾는다. 못 찾으면 null 이고 호출 측이 NOT_FOUND 로 돌려준다.
  private async findTableByName(
    term: string,
    apiKey: string,
    env: NodeJS.ProcessEnv
  ): Promise<KosisParsedQuery | null> {
    const { response, text } = await fetchKosisResponse({
      env,
      fetchImpl: this.fetchImpl,
      url: buildKosisSearchUrl({ apiKey, term: term.trim() })
    });

    if (!response.ok) {
      throw new KosisProviderError(
        "EXTERNAL_API_ERROR",
        `KOSIS_API_TABLE_SEARCH_FAILED:${response.status}`
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new KosisProviderError("PARSE_ERROR", "KOSIS_API_TABLE_SEARCH_JSON_PARSE_FAILED");
    }

    const match = pickKosisTableMatch(payload);

    return match ? { orgId: match.orgId, tableId: match.tableId } : null;
  }

  // 표의 분류축마다 무엇을 받을지 읽는다.
  //
  // 메타를 못 읽어도 조회를 포기하지 않는다. 빈 배열은 "축 하나를 통째로" 라는 뜻이고
  // 그것이 예전 코드가 늘 돌던 자리다. 여기서 던지면 메타 한 번 실패가 조회까지 죽인다.
  private async readObjSelections(
    table: KosisParsedQuery,
    apiKey: string,
    env: NodeJS.ProcessEnv
  ): Promise<string[]> {
    try {
      const { response, text } = await fetchKosisResponse({
        env,
        fetchImpl: this.fetchImpl,
        url: buildKosisMetaUrl({
          apiKey,
          orgId: table.orgId,
          tableId: table.tableId
        })
      });

      return response.ok ? parseKosisObjSelections(JSON.parse(text)) : [];
    } catch {
      return [];
    }
  }

  async fetchById(sourceIdentifier: string, options: ContextResearchProviderSearchOptions = {}) {
    const result = await this.search(sourceIdentifier, {
      ...options,
      limit: 1
    });

    return result[0] ?? null;
  }

  normalize(rawResult: KosisRawResult): ContextAsset {
    return normalizeKosisRawResult({
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

export function createKosisApiProvider(options: KosisApiProviderOptions = {}) {
  return new KosisApiProvider(options);
}
