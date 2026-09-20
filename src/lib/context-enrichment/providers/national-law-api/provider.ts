import { getContextAssetFreshnessPolicy } from "../../freshness";
import {
  getErrorCode,
  recordContextProviderTelemetry,
  type ContextProviderTelemetrySink
} from "../../guards";
import type {
  ContextAsset,
  ContextFreshnessPolicy,
  ContextResearchProvider,
  ContextResearchProviderSearchOptions
} from "../../types";
import { assertValidContextAsset } from "../../validation";
import { getContextProviderFetchImpl, type ProviderFetchLike } from "../fetch-with-retry";
import {
  resolveLawAlias,
  withProviderMetadata
} from "./alias";
import { PROVIDER_ID } from "./constants";
import { normalizeNationalLawRawResult } from "./normalize";
import {
  getHttpErrorStatus,
  parseNationalLawResponse
} from "./parse";
import { getNationalLawProviderPreflight } from "./provider-preflight";
import {
  buildNationalLawFetchByIdUrl,
  buildNationalLawSearchUrl,
  fetchNationalLawProviderJson
} from "./provider-requests";
import type {
  NationalLawApiProviderOptions,
  NationalLawRawResult,
  NationalLawSearchStatusResult
} from "./types";
import { NationalLawProviderError } from "./types";
import { getTarget } from "./urls";

export class NationalLawApiProvider implements ContextResearchProvider<NationalLawRawResult> {
  readonly providerType: "law" | "ordinance";
  private readonly fetchImpl: ProviderFetchLike;
  private readonly now: () => Date;
  private readonly telemetry: ContextProviderTelemetrySink | undefined;

  constructor(options: NationalLawApiProviderOptions) {
    this.providerType = options.providerType;
    this.fetchImpl = getContextProviderFetchImpl(options.fetchImpl);
    this.now = options.now ?? (() => new Date());
    this.telemetry = options.telemetry;
  }

  async search(query: string, options: ContextResearchProviderSearchOptions = {}) {
    const result = await this.searchWithStatus(query, options);

    return result.results;
  }

  async searchWithStatus(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<NationalLawSearchStatusResult> {
    const env = options.env ?? process.env;
    const checkedAt = this.now().toISOString();
    if (!query.trim()) {
      return {
        checkedAt,
        notFoundReason: "EMPTY_QUERY",
        provider: PROVIDER_ID,
        results: [],
        status: "INVALID_QUERY"
      };
    }
    const alias = resolveLawAlias(query);
    if (alias?.ambiguous) {
      return {
        checkedAt,
        notFoundReason: `AMBIGUOUS_ALIAS:${alias.candidates?.join("|") ?? query}`,
        provider: PROVIDER_ID,
        results: [],
        status: "NOT_FOUND"
      };
    }
    const preflight = getNationalLawProviderPreflight({
      budgetSnapshot: options.budgetSnapshot,
      env,
      operation: "search",
      providerType: this.providerType,
      telemetry: this.telemetry
    });
    if (!preflight.allowed) {
      return {
        checkedAt,
        notFoundReason: preflight.notFoundReason,
        provider: PROVIDER_ID,
        results: [],
        status: preflight.status
      };
    }

    const target = getTarget(this.providerType);
    const startedAt = Date.now();
    const url = buildNationalLawSearchUrl({
      env,
      limit: options.limit,
      query,
      target
    });

    recordContextProviderTelemetry(this.telemetry, {
      operation: "search",
      providerType: this.providerType,
      status: "started"
    });

    try {
      const { response, text } = await fetchNationalLawProviderJson({
        env,
        fetchImpl: this.fetchImpl,
        url
      });
      if (!response.ok) {
        throw new NationalLawProviderError(
          getHttpErrorStatus(response.status),
          `NATIONAL_LAW_API_SEARCH_FAILED:${response.status}`
        );
      }

      const results = parseNationalLawResponse(response, text, target)
        .map((record) => withProviderMetadata(record, query, checkedAt));
      recordContextProviderTelemetry(this.telemetry, {
        durationMs: Date.now() - startedAt,
        operation: "search",
        providerType: this.providerType,
        resultCount: results.length,
        status: "succeeded"
      });
      return {
        checkedAt,
        notFoundReason: results.length > 0 ? undefined : "NO_MATCHING_LAW_RESULT",
        provider: PROVIDER_ID,
        results,
        status: results.length > 0 ? "OK" : "NOT_FOUND"
      };
    } catch (error) {
      recordContextProviderTelemetry(this.telemetry, {
        durationMs: Date.now() - startedAt,
        errorCode: getErrorCode(error),
        operation: "search",
        providerType: this.providerType,
        status: "failed"
      });
      throw error;
    }
  }

  async fetchById(
    sourceIdentifier: string,
    options: ContextResearchProviderSearchOptions = {}
  ) {
    const env = options.env ?? process.env;
    const preflight = getNationalLawProviderPreflight({
      budgetSnapshot: options.budgetSnapshot,
      env,
      operation: "fetchById",
      providerType: this.providerType,
      telemetry: this.telemetry
    });
    if (!preflight.allowed) {
      return null;
    }

    const target = getTarget(this.providerType);
    const startedAt = Date.now();
    const url = buildNationalLawFetchByIdUrl({
      env,
      sourceIdentifier,
      target
    });

    recordContextProviderTelemetry(this.telemetry, {
      operation: "fetchById",
      providerType: this.providerType,
      status: "started"
    });

    try {
      const { response, text } = await fetchNationalLawProviderJson({
        env,
        fetchImpl: this.fetchImpl,
        url
      });
      if (!response.ok) {
        throw new NationalLawProviderError(
          getHttpErrorStatus(response.status),
          `NATIONAL_LAW_API_FETCH_FAILED:${response.status}`
        );
      }

      const results = parseNationalLawResponse(response, text, target)
        .map((record) =>
          withProviderMetadata(record, sourceIdentifier, this.now().toISOString())
        );
      recordContextProviderTelemetry(this.telemetry, {
        durationMs: Date.now() - startedAt,
        operation: "fetchById",
        providerType: this.providerType,
        resultCount: results.length,
        status: "succeeded"
      });
      return results[0] ?? null;
    } catch (error) {
      recordContextProviderTelemetry(this.telemetry, {
        durationMs: Date.now() - startedAt,
        errorCode: getErrorCode(error),
        operation: "fetchById",
        providerType: this.providerType,
        status: "failed"
      });
      throw error;
    }
  }

  normalize(rawResult: NationalLawRawResult): ContextAsset {
    return normalizeNationalLawRawResult({
      now: this.now,
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
        assetType: this.providerType === "law" ? "LAW_CONTEXT" : "ORDINANCE_CONTEXT",
        providerType: this.providerType,
        sourceTitle: ""
      }
    );
  }
}

export function createNationalLawApiProvider(options: NationalLawApiProviderOptions) {
  return new NationalLawApiProvider(options);
}
