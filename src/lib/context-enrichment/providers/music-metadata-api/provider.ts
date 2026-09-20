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
import { getContextProviderFetchImpl, type ProviderFetchLike } from "../fetch-with-retry";
import { PROVIDER_TYPE } from "./constants";
import {
  getLastfmApiKey,
  getMusicSearchQuery,
  hasAnyMusicCredential,
  hasSpotifyCredential
} from "./env";
import { searchLastfm } from "./lastfm";
import { normalizeMusicMetadataRawResult } from "./normalize";
import { searchSpotify } from "./spotify";
import {
  MusicMetadataProviderError,
  type MusicMetadataApiProviderOptions,
  type MusicMetadataProviderStatus,
  type MusicMetadataRawResult,
  type MusicMetadataSearchStatusResult
} from "./types";

export class MusicMetadataApiProvider implements ContextResearchProvider<MusicMetadataRawResult> {
  readonly providerType = PROVIDER_TYPE;
  private readonly fetchImpl: ProviderFetchLike;
  private readonly now: () => Date;

  constructor(options: MusicMetadataApiProviderOptions = {}) {
    this.fetchImpl = getContextProviderFetchImpl(options.fetchImpl);
    this.now = options.now ?? (() => new Date());
  }

  async searchWithStatus(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<MusicMetadataSearchStatusResult> {
    const env = options.env ?? process.env;
    const checkedAt = this.now().toISOString();
    const trimmedQuery = getMusicSearchQuery(query);

    if (!isContextProviderEnabled(PROVIDER_TYPE, env)) {
      return { checkedAt, provider: PROVIDER_TYPE, results: [], status: "PROVIDER_DISABLED" };
    }
    if (!trimmedQuery) {
      return { checkedAt, provider: PROVIDER_TYPE, results: [], status: "INVALID_QUERY" };
    }
    if (!hasAnyMusicCredential(env)) {
      return { checkedAt, provider: PROVIDER_TYPE, results: [], status: "MISSING_CREDENTIALS" };
    }

    const budget = evaluateContextProviderBudget(options.budgetSnapshot, env);
    if (!budget.allowed) {
      return { checkedAt, provider: PROVIDER_TYPE, results: [], status: "RATE_LIMITED" };
    }

    const limit = getContextProviderSearchLimit(options.limit, env);
    const errors: MusicMetadataProviderStatus[] = [];

    if (hasSpotifyCredential(env)) {
      try {
        const results = await searchSpotify({
          env,
          fetchImpl: this.fetchImpl,
          limit,
          query: trimmedQuery
        });

        if (results.length > 0) {
          return {
            checkedAt,
            provider: PROVIDER_TYPE,
            results: results.map((item) => ({ ...item, checkedAt })),
            status: "OK"
          };
        }
      } catch (error) {
        errors.push(
          error instanceof MusicMetadataProviderError
            ? error.status
            : "EXTERNAL_API_ERROR"
        );
      }
    }

    if (getLastfmApiKey(env)) {
      try {
        const results = await searchLastfm({
          env,
          fetchImpl: this.fetchImpl,
          limit,
          query: trimmedQuery
        });

        return {
          checkedAt,
          provider: PROVIDER_TYPE,
          results: results.map((item) => ({ ...item, checkedAt })),
          status: results.length > 0 ? "OK" : "NOT_FOUND"
        };
      } catch (error) {
        errors.push(
          error instanceof MusicMetadataProviderError
            ? error.status
            : "EXTERNAL_API_ERROR"
        );
      }
    }

    return {
      checkedAt,
      provider: PROVIDER_TYPE,
      results: [],
      status: errors[0] ?? "NOT_FOUND"
    };
  }

  async search(query: string, options: ContextResearchProviderSearchOptions = {}) {
    const result = await this.searchWithStatus(query, options);

    return result.status === "OK" ? result.results : [];
  }

  async fetchById(): Promise<MusicMetadataRawResult | null> {
    return null;
  }

  normalize(rawResult: MusicMetadataRawResult): ContextAsset {
    return normalizeMusicMetadataRawResult({
      now: this.now,
      rawResult
    });
  }

  validate(normalizedAsset: ContextAsset): void {
    assertValidContextAsset(normalizedAsset);
  }

  getFreshnessPolicy(asset?: ContextAsset): ContextFreshnessPolicy {
    return getContextAssetFreshnessPolicy(asset ?? {
      assetType: "MUSIC_METADATA_CONTEXT",
      providerType: PROVIDER_TYPE,
      sourceTitle: "music metadata"
    });
  }
}

export function createMusicMetadataApiProvider(
  options: MusicMetadataApiProviderOptions = {}
) {
  return new MusicMetadataApiProvider(options);
}
