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
  CONTEXT_PROVIDER_TRANSIENT_STATUS_CODES,
  fetchContextProviderJson,
  getContextProviderFetchImpl,
  type ProviderFetchLike
} from "../fetch-with-retry";
import {
  DEFAULT_USER_AGENT,
  PROVIDER_ID,
  PROVIDER_TYPE
} from "./constants";
import { normalizeOpenDartRawResult } from "./normalize";
import {
  getOpenDartApiKey,
  parseOpenDartQuery
} from "./query";
import {
  getStatusFromPayload,
  normalizeRows
} from "./rows";
import type {
  OpenDartApiProviderOptions,
  OpenDartRawResult,
  OpenDartSearchStatusResult
} from "./types";
import { OpenDartProviderError } from "./types";
import { buildOpenDartListUrl } from "./urls";

export class OpenDartApiProvider implements ContextResearchProvider<OpenDartRawResult> {
  readonly providerType = PROVIDER_TYPE;
  private readonly fetchImpl: ProviderFetchLike;
  private readonly now: () => Date;

  constructor(options: OpenDartApiProviderOptions = {}) {
    this.fetchImpl = getContextProviderFetchImpl(options.fetchImpl);
    this.now = options.now ?? (() => new Date());
  }

  async search(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<OpenDartRawResult[]> {
    return (await this.searchWithStatus(query, options)).results;
  }

  async searchWithStatus(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<OpenDartSearchStatusResult> {
    const env = options.env ?? process.env;
    const checkedAt = this.now().toISOString();
    const apiKey = getOpenDartApiKey(env);

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

    const parsed = parseOpenDartQuery(query, env, this.now());

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

    const limit = getContextProviderSearchLimit(options.limit, env);
    const url = buildOpenDartListUrl({
      apiKey,
      limit,
      parsed
    });

    try {
      const payload = await fetchContextProviderJson({
        env,
        fallbackError: () =>
          new OpenDartProviderError("EXTERNAL_API_ERROR", "OPENDART_FETCH_FAILED"),
        fetchImpl: this.fetchImpl,
        headers: {
          accept: "application/json",
          "user-agent": DEFAULT_USER_AGENT
        },
        isProviderError: (error) => error instanceof OpenDartProviderError,
        responseError: (response) => {
          if (!response.ok) {
            return new OpenDartProviderError(
              CONTEXT_PROVIDER_TRANSIENT_STATUS_CODES.has(response.status)
                ? "RATE_LIMITED"
                : "EXTERNAL_API_ERROR",
              `OPENDART_HTTP_${response.status}`
            );
          }

          return null;
        },
        timeoutError: () =>
          new OpenDartProviderError("TIMEOUT", "OPENDART_TIMEOUT"),
        url
      });
      const results: OpenDartRawResult[] = normalizeRows(payload, parsed).map(
        (row) => ({
          ...row,
          __checkedAt: checkedAt,
          __provider: PROVIDER_ID as "opendart",
          __query: query,
          __status: "OK" as const
        })
      );

      return {
        checkedAt,
        provider: PROVIDER_ID,
        results,
        status: getStatusFromPayload(payload, results)
      };
    } catch (error) {
      return {
        checkedAt,
        provider: PROVIDER_ID,
        results: [],
        status:
          error instanceof OpenDartProviderError
            ? error.status
            : "EXTERNAL_API_ERROR"
      };
    }
  }

  async fetchById(
    sourceIdentifier: string,
    options: ContextResearchProviderSearchOptions = {}
  ) {
    const rceptNo = sourceIdentifier.match(/\d{14}/)?.[0];

    if (!rceptNo) {
      return null;
    }

    const result = await this.searchWithStatus(`rcept_no:${rceptNo}`, options);

    return result.results[0] ?? null;
  }

  normalize(rawResult: OpenDartRawResult): ContextAsset {
    return normalizeOpenDartRawResult({
      now: this.now,
      rawResult
    });
  }

  validate(normalizedAsset: ContextAsset) {
    assertValidContextAsset(normalizedAsset);
  }

  getFreshnessPolicy(asset?: ContextAsset): ContextFreshnessPolicy {
    return getContextAssetFreshnessPolicy(
      asset ?? {
        assetType: "CORPORATE_DISCLOSURE_CONTEXT",
        providerType: PROVIDER_TYPE,
        sourceTitle: ""
      }
    );
  }
}

export function createOpenDartApiProvider(
  options: OpenDartApiProviderOptions = {}
) {
  return new OpenDartApiProvider(options);
}
