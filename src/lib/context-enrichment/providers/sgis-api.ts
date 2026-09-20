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
  buildSgisAuthUrl,
  buildSgisPopulationUrl,
  clean,
  getSgisAccessToken,
  getSgisCredentials,
  getSgisPayloadStatus,
  normalizeSgisRows
} from "./sgis-protocol";

export type SgisProviderStatus =
  | "OK"
  | "NOT_FOUND"
  | "INVALID_CREDENTIALS"
  | "MISSING_CREDENTIALS"
  | "PROVIDER_DISABLED"
  | "EXTERNAL_API_ERROR"
  | "PARSE_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT";

export type SgisRawResult = Record<string, unknown> & {
  __checkedAt?: string;
  __provider?: "sgis";
  __query?: string;
};

export type SgisSearchStatusResult = {
  checkedAt: string;
  provider: "sgis";
  results: SgisRawResult[];
  status: SgisProviderStatus;
};

export type SgisApiProviderOptions = {
  fetchImpl?: ProviderFetchLike;
  now?: () => Date;
};

export class SgisProviderError extends Error {
  readonly status: SgisProviderStatus;

  constructor(status: SgisProviderStatus, message: string) {
    super(message);
    this.name = "SgisProviderError";
    this.status = status;
  }
}

const PROVIDER_TYPE = "statistics" as const;
const DEFAULT_USER_AGENT = contextEnrichmentUserAgent("SGIS regional statistics");
const SOURCE_NAME_KO = "통계청 SGIS 통계지리정보서비스";
const SOURCE_INSTITUTION_KO = "통계청";

async function fetchJson(input: {
  env: NodeJS.ProcessEnv;
  fetchImpl: ProviderFetchLike;
  url: URL;
}): Promise<unknown> {
  return fetchContextProviderJson({
    env: input.env,
    fallbackError: () => new SgisProviderError("EXTERNAL_API_ERROR", "SGIS_FETCH_FAILED"),
    fetchImpl: input.fetchImpl,
    headers: {
      accept: "application/json",
      "user-agent": DEFAULT_USER_AGENT
    },
    isProviderError: (error) => error instanceof SgisProviderError,
    responseError: (response) => {
      const status = getDefaultContextProviderHttpStatus<SgisProviderStatus>(response, {
        externalApiError: "EXTERNAL_API_ERROR",
        invalidCredentials: "INVALID_CREDENTIALS",
        notFound: "NOT_FOUND",
        rateLimited: "RATE_LIMITED"
      });

      return status ? new SgisProviderError(status, `SGIS_HTTP_${response.status}`) : null;
    },
    timeoutError: () => new SgisProviderError("TIMEOUT", "SGIS_TIMEOUT"),
    url: input.url
  });
}

export class SgisApiProvider implements ContextResearchProvider<SgisRawResult> {
  readonly providerType = PROVIDER_TYPE;
  private readonly fetchImpl: ProviderFetchLike;
  private readonly now: () => Date;

  constructor(options: SgisApiProviderOptions = {}) {
    this.fetchImpl = getContextProviderFetchImpl(options.fetchImpl);
    this.now = options.now ?? (() => new Date());
  }

  async search(query: string, options: ContextResearchProviderSearchOptions = {}) {
    return (await this.searchWithStatus(query, options)).results;
  }

  async searchWithStatus(query: string, options: ContextResearchProviderSearchOptions = {}): Promise<SgisSearchStatusResult> {
    const env = options.env ?? process.env;
    const checkedAt = this.now().toISOString();

    if (!isContextProviderEnabled(PROVIDER_TYPE, env)) {
      return { checkedAt, provider: "sgis", results: [], status: "PROVIDER_DISABLED" };
    }

    const credentials = getSgisCredentials(env);
    if (!credentials.consumerKey || !credentials.consumerSecret) {
      return { checkedAt, provider: "sgis", results: [], status: "MISSING_CREDENTIALS" };
    }

    const budget = evaluateContextProviderBudget(options.budgetSnapshot, env);
    if (!budget.allowed) {
      return { checkedAt, provider: "sgis", results: [], status: "RATE_LIMITED" };
    }

    const authPayload = await fetchJson({
      env,
      fetchImpl: this.fetchImpl,
      url: buildSgisAuthUrl(credentials)
    });
    const accessToken = getSgisAccessToken(authPayload);
    if (!accessToken) {
      return { checkedAt, provider: "sgis", results: [], status: "INVALID_CREDENTIALS" };
    }

    const payload = await fetchJson({
      env,
      fetchImpl: this.fetchImpl,
      url: buildSgisPopulationUrl({ accessToken, query })
    });
    // SGIS has no row-count parameter, so the limit is applied here. Sending one made the
    // whole request a 412 (see buildSgisPopulationUrl).
    const results = normalizeSgisRows(payload)
      .slice(0, getContextProviderSearchLimit(options.limit, env))
      .map((row) => ({
        ...row,
        __checkedAt: checkedAt,
        __provider: "sgis" as const,
        __query: query
      }));

    return {
      checkedAt,
      provider: "sgis",
      results,
      status: getSgisPayloadStatus(payload, results)
    };
  }

  async fetchById(sourceIdentifier: string, options: ContextResearchProviderSearchOptions = {}) {
    const results = await this.search(sourceIdentifier, { ...options, limit: 1 });
    return results[0] ?? null;
  }

  normalize(rawResult: SgisRawResult): ContextAsset {
    const checkedAt = rawResult.__checkedAt ?? this.now().toISOString();
    // `__query` is deliberately NOT a fallback: on the flint-keyword path it is the
    // author's own sentence, and this value becomes the asset's public title/identifier.
    const admName = clean(rawResult.adm_nm ?? rawResult.admName) || "지역";
    const population = clean(rawResult.population ?? rawResult.ppltn_cnt ?? rawResult.tot_ppltn);
    const period = clean(rawResult.year ?? rawResult.base_year) || "2024";
    const unit = "명";
    const sourceIdentifier = `sgis:${admName}:${period}`;

    return {
      assetType: "STATISTICS_CONTEXT",
      checkedAt,
      confidence: population ? "medium" : "low",
      keyPoints: [
        `unit:${unit}`,
        `period:${period}`,
        population ? `population:${population}` : null,
        "sourceProvider:sgis"
      ].filter((point): point is string => Boolean(point)),
      limitations: [
        "SGIS 공개 지역통계는 지역 배경자료로만 사용하며, 개인의 성향이나 행동을 추론하지 않습니다."
      ],
      locale: "ko",
      modelMetadata: {
        admName,
        period,
        population,
        provider: "sgis",
        validationStatus: "regional_statistics_normalized"
      },
      providerType: PROVIDER_TYPE,
      retrievedAt: checkedAt,
      sourceDate: period,
      sourceHash: getContextHash(rawResult),
      sourceIdentifier,
      sourceInstitution: SOURCE_INSTITUTION_KO,
      sourceName: SOURCE_NAME_KO,
      sourceTitle: `${admName} 지역 인구 통계`,
      sourceUrl: "https://sgis.kostat.go.kr/",
      status: population ? "current" : "needs_review",
      summary: "SGIS 공개 지역통계를 단위와 기준연도가 보존된 지역 배경자료로 정리한 항목입니다."
    };
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

export function createSgisApiProvider(options: SgisApiProviderOptions = {}) {
  return new SgisApiProvider(options);
}
