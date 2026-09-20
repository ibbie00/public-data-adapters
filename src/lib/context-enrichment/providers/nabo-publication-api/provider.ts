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
import { PROVIDER_ID } from "./constants";
import {
  getDefaultQuery,
  getNaboApiKey
} from "./env";
import { fetchNaboPublicationResponse } from "./fetch";
import { normalizeNaboPublicationRawResult } from "./normalize";
import {
  getStatusFromPayload,
  normalizeRows
} from "./parse";
import { getAssetType, getEndpoint } from "./policy";
import {
  NaboPublicationProviderError,
  type NaboPublicationApiProviderOptions,
  type NaboPublicationProviderType,
  type NaboPublicationRawResult,
  type NaboPublicationSearchStatusResult
} from "./types";
import { buildNaboPublicationUrl } from "./urls";

export class NaboPublicationApiProvider implements ContextResearchProvider<NaboPublicationRawResult> {
  readonly providerType: NaboPublicationProviderType;
  private readonly fetchImpl: ProviderFetchLike;
  private readonly now: () => Date;

  constructor(options: NaboPublicationApiProviderOptions = {}) {
    this.providerType = options.providerType ?? "policy_report";
    this.fetchImpl = getContextProviderFetchImpl(options.fetchImpl);
    this.now = options.now ?? (() => new Date());
  }

  async search(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<NaboPublicationRawResult[]> {
    return (await this.searchWithStatus(query, options)).results;
  }

  async searchWithStatus(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<NaboPublicationSearchStatusResult> {
    const env = options.env ?? process.env;
    const checkedAt = this.now().toISOString();
    const key = getNaboApiKey(env);
    const searchQuery = query.trim() || getDefaultQuery(this.providerType, env);

    if (!isContextProviderEnabled(this.providerType, env)) {
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

    const budget = evaluateContextProviderBudget(options.budgetSnapshot, env);

    if (!budget.allowed) {
      return {
        checkedAt,
        provider: PROVIDER_ID,
        results: [],
        status: "RATE_LIMITED"
      };
    }

    const endpoint = getEndpoint(this.providerType);
    const { response, text } = await fetchNaboPublicationResponse({
      env,
      fetchImpl: this.fetchImpl,
      url: buildNaboPublicationUrl({
        endpoint,
        key,
        limit: getContextProviderSearchLimit(options.limit, env),
        query: searchQuery
      })
    });

    if (!response.ok) {
      throw new NaboPublicationProviderError("EXTERNAL_API_ERROR", `NABO_PUBLICATION_API_SEARCH_FAILED:${response.status}`);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new NaboPublicationProviderError("PARSE_ERROR", "NABO_PUBLICATION_API_JSON_PARSE_FAILED");
    }

    const results = normalizeRows(payload).map((row) => ({
      ...row,
      __checkedAt: checkedAt,
      __endpoint: endpoint,
      __provider: PROVIDER_ID as "nabo_publication",
      __query: searchQuery,
      __status: "OK" as const
    }));

    return {
      checkedAt,
      provider: PROVIDER_ID,
      results,
      status: getStatusFromPayload(payload, results)
    };
  }

  async fetchById(sourceIdentifier: string, options: ContextResearchProviderSearchOptions = {}) {
    const result = await this.search(sourceIdentifier, {
      ...options,
      limit: 1
    });

    return result[0] ?? null;
  }

  normalize(rawResult: NaboPublicationRawResult): ContextAsset {
    return normalizeNaboPublicationRawResult({
      checkedAt: this.now().toISOString(),
      providerType: this.providerType,
      rawResult
    });
  }

  validate(normalizedAsset: ContextAsset) {
    assertValidContextAsset(normalizedAsset);
  }

  getFreshnessPolicy(asset?: ContextAsset): ContextFreshnessPolicy {
    return getContextAssetFreshnessPolicy(
      asset ?? {
        assetType: getAssetType(this.providerType),
        providerType: this.providerType,
        sourceTitle: ""
      }
    );
  }
}

export function createNaboPublicationApiProvider(options: NaboPublicationApiProviderOptions = {}) {
  return new NaboPublicationApiProvider(options);
}
