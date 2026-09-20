import type {
  ContextAsset,
  ContextFreshnessPolicy,
  ContextResearchProvider,
  ContextResearchProviderSearchOptions
} from "../types";
import { getContextProviderFetchImpl, type ProviderFetchLike } from "./fetch-with-retry";
import {
  getGameMetadataFreshnessPolicy,
  normalizeGameMetadataResult,
  validateGameMetadataAsset
} from "./game-metadata-api/normalize";
import {
  redactGameMetadataUrl,
  searchGameMetadataWithStatus
} from "./game-metadata-api/request";
import {
  GAME_METADATA_PROVIDER_TYPE,
  type GameMetadataApiProviderOptions,
  type GameMetadataRawResult,
  type GameMetadataSearchStatusResult
} from "./game-metadata-api/types";

export {
  GameMetadataProviderError,
  type GameMetadataApiProviderOptions,
  type GameMetadataProviderStatus,
  type GameMetadataRawResult,
  type GameMetadataSearchStatusResult,
  type RawgGameResult
} from "./game-metadata-api/types";
export {
  findGameNameInText,
  getGameNameIndexRetrievedAt,
  getGameNameIndexSize,
  toEnglishGameName,
  toKoreanGameName
} from "./game-metadata-api/name-index";
export { redactGameMetadataUrl };

export class GameMetadataApiProvider implements ContextResearchProvider<GameMetadataRawResult> {
  readonly providerType = GAME_METADATA_PROVIDER_TYPE;
  private readonly fetchImpl: ProviderFetchLike;
  private readonly now: () => Date;

  constructor(options: GameMetadataApiProviderOptions = {}) {
    this.fetchImpl = getContextProviderFetchImpl(options.fetchImpl);
    this.now = options.now ?? (() => new Date());
  }

  async searchWithStatus(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<GameMetadataSearchStatusResult> {
    return searchGameMetadataWithStatus({
      fetchImpl: this.fetchImpl,
      now: this.now,
      options,
      query
    });
  }

  async search(query: string, options: ContextResearchProviderSearchOptions = {}) {
    const result = await this.searchWithStatus(query, options);

    return result.status === "OK" ? result.results : [];
  }

  async fetchById(): Promise<GameMetadataRawResult | null> {
    return null;
  }

  normalize(rawResult: GameMetadataRawResult): ContextAsset {
    return normalizeGameMetadataResult(rawResult, this.now);
  }

  validate(normalizedAsset: ContextAsset): void {
    validateGameMetadataAsset(normalizedAsset);
  }

  getFreshnessPolicy(asset?: ContextAsset): ContextFreshnessPolicy {
    return getGameMetadataFreshnessPolicy(asset);
  }
}

export function createGameMetadataApiProvider(options: GameMetadataApiProviderOptions = {}) {
  return new GameMetadataApiProvider(options);
}
