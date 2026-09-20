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
import {
  getOpenAssemblyApiKey,
  normalizeAssemblyAge,
  normalizeServiceId
} from "./env";
import { fetchOpenAssemblyResponse } from "./fetch";
import { normalizeOpenAssemblyBillResult } from "./normalize";
import { getStatusFromPayload, normalizeRows } from "./parse";
import {
  OpenAssemblyProviderError,
  type OpenAssemblyApiProviderOptions,
  type OpenAssemblyBillRawResult,
  type OpenAssemblySearchStatusResult
} from "./types";
import { buildOpenAssemblyBillUrl } from "./urls";

export class OpenAssemblyApiProvider implements ContextResearchProvider<OpenAssemblyBillRawResult> {
  readonly providerType = PROVIDER_TYPE;
  private readonly fetchImpl: ProviderFetchLike;
  private readonly now: () => Date;

  constructor(options: OpenAssemblyApiProviderOptions = {}) {
    this.fetchImpl = getContextProviderFetchImpl(options.fetchImpl);
    this.now = options.now ?? (() => new Date());
  }

  async search(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<OpenAssemblyBillRawResult[]> {
    return (await this.searchWithStatus(query, options)).results;
  }

  async searchWithStatus(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<OpenAssemblySearchStatusResult> {
    const env = options.env ?? process.env;
    const checkedAt = this.now().toISOString();
    const apiKey = getOpenAssemblyApiKey(env);

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
    if (!query.trim()) {
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

    const serviceId = normalizeServiceId(env);
    const { response, text } = await fetchOpenAssemblyResponse({
      env,
      fetchImpl: this.fetchImpl,
      url: buildOpenAssemblyBillUrl({
        assemblyAge: normalizeAssemblyAge(env),
        key: apiKey,
        limit: getContextProviderSearchLimit(options.limit, env),
        query,
        serviceId
      })
    });

    if (!response.ok) {
      throw new OpenAssemblyProviderError("EXTERNAL_API_ERROR", `OPEN_ASSEMBLY_API_SEARCH_FAILED:${response.status}`);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new OpenAssemblyProviderError("PARSE_ERROR", "OPEN_ASSEMBLY_API_JSON_PARSE_FAILED");
    }

    const results = normalizeRows(payload, serviceId).map((row) => ({
      ...row,
      __checkedAt: checkedAt,
      __provider: PROVIDER_ID as "open_assembly",
      __serviceId: serviceId,
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

  normalize(rawResult: OpenAssemblyBillRawResult): ContextAsset {
    return normalizeOpenAssemblyBillResult({
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
        assetType: "BILL_CONTEXT",
        providerType: PROVIDER_TYPE,
        sourceTitle: ""
      }
    );
  }
}

export function createOpenAssemblyApiProvider(options: OpenAssemblyApiProviderOptions = {}) {
  return new OpenAssemblyApiProvider(options);
}
