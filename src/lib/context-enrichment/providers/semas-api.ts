import type {
  ContextAsset,
  ContextFreshnessPolicy,
  ContextResearchProvider,
  ContextResearchProviderSearchOptions
} from "../types";
import { getContextProviderFetchImpl, type ProviderFetchLike } from "./fetch-with-retry";
import {
  getSemasFreshnessPolicy,
  normalizeSemasResult,
  validateSemasAsset
} from "./semas-api/normalize";
import { searchSemasWithStatus } from "./semas-api/request";
import {
  SEMAS_PROVIDER_TYPE,
  type SemasApiProviderOptions,
  type SemasRawResult,
  type SemasSearchStatusResult
} from "./semas-api/types";

export {
  SemasProviderError,
  type SemasApiProviderOptions,
  type SemasProviderStatus,
  type SemasRawResult,
  type SemasSearchStatusResult
} from "./semas-api/types";

export class SemasApiProvider implements ContextResearchProvider<SemasRawResult> {
  readonly providerType = SEMAS_PROVIDER_TYPE;
  private readonly fetchImpl: ProviderFetchLike;
  private readonly now: () => Date;

  constructor(options: SemasApiProviderOptions = {}) {
    this.fetchImpl = getContextProviderFetchImpl(options.fetchImpl);
    this.now = options.now ?? (() => new Date());
  }

  async search(query: string, options: ContextResearchProviderSearchOptions = {}) {
    return (await this.searchWithStatus(query, options)).results;
  }

  async searchWithStatus(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<SemasSearchStatusResult> {
    return searchSemasWithStatus({
      fetchImpl: this.fetchImpl,
      now: this.now,
      options,
      query
    });
  }

  async fetchById(sourceIdentifier: string, options: ContextResearchProviderSearchOptions = {}) {
    const results = await this.search(sourceIdentifier, { ...options, limit: 1 });
    return results[0] ?? null;
  }

  normalize(rawResult: SemasRawResult): ContextAsset {
    return normalizeSemasResult(rawResult, this.now);
  }

  validate(normalizedAsset: ContextAsset) {
    validateSemasAsset(normalizedAsset);
  }

  getFreshnessPolicy(asset?: ContextAsset): ContextFreshnessPolicy {
    return getSemasFreshnessPolicy(asset);
  }
}

export function createSemasApiProvider(options: SemasApiProviderOptions = {}) {
  return new SemasApiProvider(options);
}
