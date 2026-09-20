import { contextEnrichmentUserAgent } from "./user-agent";

import { isContextProviderEnabled } from "../config";
import { getContextAssetFreshnessPolicy } from "../freshness";
import {
  evaluateContextProviderBudget,
  getContextProviderSearchLimit
} from "../guards";
import { getContextHash } from "../normalize";
import type {
  ContextAsset,
  ContextFreshnessPolicy,
  ContextResearchProvider,
  ContextResearchProviderSearchOptions
} from "../types";
import { assertValidContextAsset } from "../validation";
import {
  fetchContextProviderJson,
  getContextProviderFetchImpl,
  getDefaultContextProviderHttpStatus,
  type ProviderFetchLike
} from "./fetch-with-retry";
import {
  buildSeoulOpenDataUrl,
  clean,
  getSeoulOpenDataApiKey,
  getSeoulOpenDataPayloadStatus,
  normalizeSeoulOpenDataRows,
  selectSeoulOpenDataService
} from "./seoul-open-data-protocol";

export type SeoulOpenDataProviderStatus =
  | "OK"
  | "NOT_FOUND"
  | "INVALID_CREDENTIALS"
  | "MISSING_CREDENTIALS"
  | "PROVIDER_DISABLED"
  | "EXTERNAL_API_ERROR"
  | "PARSE_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT";

export type SeoulOpenDataRawResult = Record<string, unknown> & {
  __checkedAt?: string;
  __provider?: "seoul-open-data";
  __query?: string;
  __service?: string;
};

export type SeoulOpenDataSearchStatusResult = {
  checkedAt: string;
  provider: "seoul-open-data";
  results: SeoulOpenDataRawResult[];
  status: SeoulOpenDataProviderStatus;
};

export type SeoulOpenDataApiProviderOptions = {
  fetchImpl?: ProviderFetchLike;
  now?: () => Date;
};

export class SeoulOpenDataProviderError extends Error {
  readonly status: SeoulOpenDataProviderStatus;

  constructor(status: SeoulOpenDataProviderStatus, message: string) {
    super(message);
    this.name = "SeoulOpenDataProviderError";
    this.status = status;
  }
}

const PROVIDER_TYPE = "public_institution" as const;
const SOURCE_NAME_KO = "서울 열린데이터광장";
const SOURCE_INSTITUTION_KO = "서울특별시";
const DEFAULT_USER_AGENT = contextEnrichmentUserAgent("Seoul public data metadata");

async function fetchJson(input: {
  env: NodeJS.ProcessEnv;
  fetchImpl: ProviderFetchLike;
  url: URL;
}) {
  return fetchContextProviderJson({
    env: input.env,
    fallbackError: () => new SeoulOpenDataProviderError("EXTERNAL_API_ERROR", "SEOUL_OPEN_DATA_FETCH_FAILED"),
    fetchImpl: input.fetchImpl,
    headers: {
      accept: "application/json",
      "user-agent": DEFAULT_USER_AGENT
    },
    isProviderError: (error) => error instanceof SeoulOpenDataProviderError,
    responseError: (response) => {
      const status = getDefaultContextProviderHttpStatus<SeoulOpenDataProviderStatus>(response, {
        externalApiError: "EXTERNAL_API_ERROR",
        invalidCredentials: "INVALID_CREDENTIALS",
        notFound: "NOT_FOUND",
        rateLimited: "RATE_LIMITED"
      });

      return status ? new SeoulOpenDataProviderError(status, `SEOUL_OPEN_DATA_HTTP_${response.status}`) : null;
    },
    timeoutError: () => new SeoulOpenDataProviderError("TIMEOUT", "SEOUL_OPEN_DATA_TIMEOUT"),
    url: input.url
  });
}

export class SeoulOpenDataApiProvider implements ContextResearchProvider<SeoulOpenDataRawResult> {
  readonly providerType = PROVIDER_TYPE;
  private readonly fetchImpl: ProviderFetchLike;
  private readonly now: () => Date;

  constructor(options: SeoulOpenDataApiProviderOptions = {}) {
    this.fetchImpl = getContextProviderFetchImpl(options.fetchImpl);
    this.now = options.now ?? (() => new Date());
  }

  async search(query: string, options: ContextResearchProviderSearchOptions = {}) {
    return (await this.searchWithStatus(query, options)).results;
  }

  async searchWithStatus(query: string, options: ContextResearchProviderSearchOptions = {}): Promise<SeoulOpenDataSearchStatusResult> {
    const env = options.env ?? process.env;
    const checkedAt = this.now().toISOString();

    if (!isContextProviderEnabled(PROVIDER_TYPE, env)) {
      return { checkedAt, provider: "seoul-open-data", results: [], status: "PROVIDER_DISABLED" };
    }
    const apiKey = getSeoulOpenDataApiKey(env);
    if (!apiKey) {
      return { checkedAt, provider: "seoul-open-data", results: [], status: "MISSING_CREDENTIALS" };
    }
    const budget = evaluateContextProviderBudget(options.budgetSnapshot, env);
    if (!budget.allowed) {
      return { checkedAt, provider: "seoul-open-data", results: [], status: "RATE_LIMITED" };
    }

    const service = selectSeoulOpenDataService(query, env);
    const payload = await fetchJson({
      env,
      fetchImpl: this.fetchImpl,
      url: buildSeoulOpenDataUrl({
        apiKey,
        limit: getContextProviderSearchLimit(options.limit, env),
        query,
        service
      })
    });
    const results = normalizeSeoulOpenDataRows(payload, service).map((row) => ({
      ...row,
      __checkedAt: checkedAt,
      __provider: "seoul-open-data" as const,
      __query: query,
      __service: service
    }));

    return {
      checkedAt,
      provider: "seoul-open-data",
      results,
      status: getSeoulOpenDataPayloadStatus(payload, service, results)
    };
  }

  async fetchById(sourceIdentifier: string, options: ContextResearchProviderSearchOptions = {}) {
    const results = await this.search(sourceIdentifier, { ...options, limit: 1 });
    return results[0] ?? null;
  }

  normalize(rawResult: SeoulOpenDataRawResult): ContextAsset {
    const checkedAt = rawResult.__checkedAt ?? this.now().toISOString();
    // `__query` is deliberately NOT a fallback: on the flint-keyword path it is the
    // author's own sentence, and this value becomes the asset's public title/identifier.
    const stationName = clean(rawResult.STATION_NM ?? rawResult.station_nm ?? rawResult.STATION_CD) || "서울 공공데이터";
    const lineName = clean(rawResult.LINE_NUM ?? rawResult.line_num ?? rawResult.LINE_NM);
    const service = clean(rawResult.__service) || "SearchInfoBySubwayNameService";
    const sourceIdentifier = `seoul-open-data:${service}:${clean(rawResult.STATION_CD) || stationName}`;

    return {
      assetType: "PUBLIC_INSTITUTION_CONTEXT",
      checkedAt,
      confidence: stationName ? "medium" : "low",
      keyPoints: [
        lineName ? `line:${lineName}` : null,
        clean(rawResult.STATION_CD) ? `stationCode:${clean(rawResult.STATION_CD)}` : null,
        `service:${service}`,
        "sourceProvider:seoul-open-data"
      ].filter((point): point is string => Boolean(point)),
      limitations: [
        "서울 열린데이터광장 자료는 공공 데이터 연결용 메타데이터로 사용하며, 생활권·이동 패턴을 개인에게 귀속해 추론하지 않습니다."
      ],
      locale: "ko",
      modelMetadata: {
        lineName,
        provider: "seoul-open-data",
        service,
        stationName,
        validationStatus: "public_institution_metadata_normalized"
      },
      providerType: PROVIDER_TYPE,
      retrievedAt: checkedAt,
      sourceHash: getContextHash(rawResult),
      sourceIdentifier,
      sourceInstitution: SOURCE_INSTITUTION_KO,
      sourceName: SOURCE_NAME_KO,
      sourceTitle: lineName ? `${stationName} 지하철역 정보 - ${lineName}` : `${stationName} 지하철역 정보`,
      sourceUrl: "https://data.seoul.go.kr/",
      status: "current",
      summary: "서울 열린데이터광장의 공개 공공데이터를 위치·교통 맥락 메타데이터로 정리한 항목입니다."
    };
  }

  validate(normalizedAsset: ContextAsset) {
    assertValidContextAsset(normalizedAsset);
  }

  getFreshnessPolicy(asset?: ContextAsset): ContextFreshnessPolicy {
    return getContextAssetFreshnessPolicy(
      asset ?? {
        assetType: "PUBLIC_INSTITUTION_CONTEXT",
        providerType: PROVIDER_TYPE,
        sourceTitle: ""
      }
    );
  }
}

export function createSeoulOpenDataApiProvider(options: SeoulOpenDataApiProviderOptions = {}) {
  return new SeoulOpenDataApiProvider(options);
}
