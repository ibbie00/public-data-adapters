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
  fetchContextProviderJsonWithRetry,
  getContextProviderFetchImpl,
  isProviderRetryDisabled,
  type ProviderFetchLike
} from "../fetch-with-retry";
import {
  DEFAULT_USER_AGENT,
  PROVIDER_ID,
  PROVIDER_TYPE
} from "./constants";
import {
  getDefaultQuery,
  getNkisApiKey
} from "./env";
import { normalizeNkisPolicyRawResult } from "./normalize";
import { parseNkisPolicyResponse } from "./parse";
import type {
  NkisPolicyApiProviderOptions,
  NkisPolicyRawResult,
  NkisPolicySearchStatusResult
} from "./types";
import { NkisPolicyProviderError } from "./types";
import {
  buildNkisPolicyDetailUrl,
  buildNkisPolicyUrl,
  getHttpErrorStatus,
  getStatusFromRows
} from "./urls";

export class NkisPolicyApiProvider implements ContextResearchProvider<NkisPolicyRawResult> {
  readonly providerType = PROVIDER_TYPE;
  private readonly fetchImpl: ProviderFetchLike;
  private readonly now: () => Date;

  constructor(options: NkisPolicyApiProviderOptions = {}) {
    this.fetchImpl = getContextProviderFetchImpl(options.fetchImpl);
    this.now = options.now ?? (() => new Date());
  }

  async search(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<NkisPolicyRawResult[]> {
    return (await this.searchWithStatus(query, options)).results;
  }

  async searchWithStatus(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<NkisPolicySearchStatusResult> {
    const env = options.env ?? process.env;
    const checkedAt = this.now().toISOString();
    const key = getNkisApiKey(env);
    const searchQuery = query.trim() || getDefaultQuery(env);

    if (!isContextProviderEnabled(PROVIDER_TYPE, env)) {
      return {
        checkedAt,
        provider: PROVIDER_ID,
        results: [],
        status: "PROVIDER_DISABLED"
      };
    }
    if (!key) {
      return {
        checkedAt,
        provider: PROVIDER_ID,
        results: [],
        status: "MISSING_CREDENTIALS"
      };
    }
    if (!searchQuery) {
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

    const { bytes, response } = await this.fetchWithTimeout(
      buildNkisPolicyUrl({
        key,
        limit: getContextProviderSearchLimit(options.limit, env),
        query: searchQuery
      }),
      env
    );

    if (!response.ok) {
      throw new NkisPolicyProviderError(
        getHttpErrorStatus(response.status),
        `NKIS_POLICY_API_SEARCH_FAILED:${response.status}`
      );
    }

    const results = parseNkisPolicyResponse(response, bytes).map((row) => ({
      ...row,
      __checkedAt: checkedAt,
      __provider: PROVIDER_ID,
      __query: searchQuery,
      __status: "OK" as const
    }));

    return {
      checkedAt,
      provider: PROVIDER_ID,
      results,
      status: getStatusFromRows(results)
    };
  }

  async fetchById(sourceIdentifier: string, options: ContextResearchProviderSearchOptions = {}) {
    const [otpCd, otpId, otpSeq = "0"] = sourceIdentifier.replace(/^nkis:/, "").split(":");
    const env = options.env ?? process.env;
    const key = getNkisApiKey(env);

    if (!key || !otpCd || !otpId) {
      return null;
    }

    const { bytes, response } = await this.fetchWithTimeout(
      buildNkisPolicyDetailUrl({
        key,
        otpCd,
        otpId,
        otpSeq
      }),
      env
    );

    if (!response.ok) {
      throw new NkisPolicyProviderError(
        getHttpErrorStatus(response.status),
        `NKIS_POLICY_API_DETAIL_FAILED:${response.status}`
      );
    }

    const results = parseNkisPolicyResponse(response, bytes);

    return results[0] ?? null;
  }

  normalize(rawResult: NkisPolicyRawResult): ContextAsset {
    return normalizeNkisPolicyRawResult({
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
        assetType: "POLICY_REPORT_CONTEXT",
        providerType: PROVIDER_TYPE,
        sourceTitle: ""
      }
    );
  }

  private async fetchWithTimeout(url: URL, env: NodeJS.ProcessEnv) {
    return fetchContextProviderJsonWithRetry({
      env,
      fallbackErrorMessage: "NKIS_POLICY_API_FETCH_FAILED",
      fetchImpl: this.fetchImpl,
      headers: {
        accept: "application/xml, text/xml;q=0.9, application/json;q=0.8",
        "user-agent": env.NKIS_USER_AGENT?.trim() || DEFAULT_USER_AGENT
      },
      retryCount: isProviderRetryDisabled(env) ? 0 : 1,
      timeoutError: () => new NkisPolicyProviderError("TIMEOUT", "NKIS_POLICY_API_TIMEOUT"),
      url
    });
  }
}

export function createNkisPolicyApiProvider(options: NkisPolicyApiProviderOptions = {}) {
  return new NkisPolicyApiProvider(options);
}
