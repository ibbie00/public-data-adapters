import { isContextProviderEnabled } from "../../config";
import { getContextAssetFreshnessPolicy } from "../../freshness";
import { evaluateContextProviderBudget } from "../../guards";
import type {
  ContextAsset,
  ContextFreshnessPolicy,
  ContextResearchProvider,
  ContextResearchProviderSearchOptions
} from "../../types";
import { assertValidContextAsset } from "../../validation";
import { getContextProviderFetchImpl } from "../fetch-with-retry";
import { DEFAULT_TIMEOUT_MS, PROVIDER_TYPE } from "./constants";
import { fetchMolit } from "./fetch";
import { normalizeRealEstateRawResult } from "./normalize";
import { getServiceKey, selectService } from "./query";
import {
  RealEstateProviderError,
  type RealEstateApiProviderOptions,
  type RealEstateRawResult,
  type RealEstateSearchStatusResult
} from "./types";

export function createRealEstateApiProvider(
  providerOptions: RealEstateApiProviderOptions = {}
): ContextResearchProvider<RealEstateRawResult> & {
  searchWithStatus(query: string, options?: ContextResearchProviderSearchOptions): Promise<RealEstateSearchStatusResult>;
} {
  return {
    providerType: PROVIDER_TYPE,
    async search(query: string, options: ContextResearchProviderSearchOptions = {}) {
      const result = await this.searchWithStatus(query, options);

      return result.status === "OK" ? result.results : [];
    },
    async searchWithStatus(query: string, options: ContextResearchProviderSearchOptions = {}) {
      const env = options.env ?? process.env;
      const now = providerOptions.now?.() ?? new Date();

      // The same four gates every sibling stands behind, in the same order: feature flag,
      // query, credentials, budget, then the network. The factory only builds this provider
      // when the flag is on and the worker reserves the call budget before invoking it, but
      // direct callers (the election/real-estate smoke, the relevance eval harness) reach
      // `searchWithStatus` without those outer layers. Without these checks a switched-off
      // provider still announces us to MOLIT, which is the exact thing the flag promises not
      // to do. See tests/unit/context-providers-share-one-gate-order.test.ts.
      if (!isContextProviderEnabled(PROVIDER_TYPE, env)) {
        return {
          checkedAt: now.toISOString(),
          provider: PROVIDER_TYPE,
          results: [],
          status: "PROVIDER_DISABLED"
        };
      }

      const service = selectService(query);

      // The post did not name both a property type and a transaction type, so there is
      // nothing honest to ask for (query.ts explains why there is no fallback).
      if (!service) {
        return {
          checkedAt: now.toISOString(),
          provider: PROVIDER_TYPE,
          results: [],
          status: "INVALID_QUERY"
        };
      }

      // Missing key is a refusal, not a rejected auth request upstream.
      if (!getServiceKey(service, env)) {
        return {
          checkedAt: now.toISOString(),
          provider: PROVIDER_TYPE,
          results: [],
          status: "MISSING_CREDENTIALS"
        };
      }

      const budget = evaluateContextProviderBudget(options.budgetSnapshot, env);
      if (!budget.allowed) {
        return {
          checkedAt: now.toISOString(),
          provider: PROVIDER_TYPE,
          results: [],
          status: "RATE_LIMITED"
        };
      }

      try {
        const results = await fetchMolit({
          env,
          fetchImpl: getContextProviderFetchImpl(providerOptions.fetchImpl),
          now,
          query,
          service,
          timeoutMs: providerOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS
        });

        return {
          checkedAt: now.toISOString(),
          provider: PROVIDER_TYPE,
          results: results.slice(0, options.limit ?? 5),
          status: "OK"
        };
      } catch (error) {
        return {
          checkedAt: now.toISOString(),
          provider: PROVIDER_TYPE,
          results: [],
          status: error instanceof RealEstateProviderError ? error.status : "EXTERNAL_API_ERROR"
        };
      }
    },
    async fetchById(sourceIdentifier: string, options: ContextResearchProviderSearchOptions = {}) {
      const results = await this.search(sourceIdentifier, options);

      return results[0] ?? null;
    },
    normalize(rawResult: RealEstateRawResult): ContextAsset {
      return normalizeRealEstateRawResult(rawResult);
    },
    validate(normalizedAsset: ContextAsset) {
      assertValidContextAsset(normalizedAsset);
    },
    getFreshnessPolicy(asset?: ContextAsset): ContextFreshnessPolicy {
      return getContextAssetFreshnessPolicy(
        asset ?? {
          assetType: "REAL_ESTATE_CONTEXT",
          providerType: PROVIDER_TYPE,
          sourceTitle: "국토교통부 실거래가"
        }
      );
    }
  };
}
