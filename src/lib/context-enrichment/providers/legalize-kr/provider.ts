import { getLawContextProvider, isContextProviderEnabled } from "../../config";
import { getContextAssetFreshnessPolicy } from "../../freshness";
import type {
  ContextAsset,
  ContextFreshnessPolicy,
  ContextResearchProvider
} from "../../types";
import { assertValidContextAsset } from "../../validation";
import { matchesLegalizeQuery } from "./aliases";
import { PROVIDER_TYPE } from "./constants";
import { loadLegalizeIndexFromDirectory } from "./directory";
import {
  matchesLegalizeSourceIdentifier,
  normalizeLegalizeKrLawRecord
} from "./normalize";
import type {
  LegalizeKrLawRecord,
  LegalizeKrProviderOptions,
  LegalizeKrSearchOptions
} from "./types";

export class LegalizeKrProvider implements ContextResearchProvider<LegalizeKrLawRecord> {
  readonly providerType = PROVIDER_TYPE;
  private readonly index: LegalizeKrLawRecord[] | undefined;
  private readonly now: () => Date;

  constructor(options: LegalizeKrProviderOptions = {}) {
    this.index = options.index;
    this.now = options.now ?? (() => new Date());
  }

  async search(query: string, options: LegalizeKrSearchOptions = {}) {
    const env = options.env ?? process.env;
    if (
      !query.trim() ||
      !isContextProviderEnabled(PROVIDER_TYPE, env) ||
      getLawContextProvider(env) !== "legalize-kr"
    ) {
      return [];
    }

    return this.loadIndex(env)
      .filter((record) => matchesLegalizeQuery(record, query))
      .slice(0, Math.max(1, Math.min(options.limit ?? 5, 20)));
  }

  async fetchById(sourceIdentifier: string, options: LegalizeKrSearchOptions = {}) {
    const env = options.env ?? process.env;
    if (!isContextProviderEnabled(PROVIDER_TYPE, env) || getLawContextProvider(env) !== "legalize-kr") {
      return null;
    }

    return this.loadIndex(env).find((record) =>
      matchesLegalizeSourceIdentifier(sourceIdentifier, record)
    ) ?? null;
  }

  normalize(rawResult: LegalizeKrLawRecord): ContextAsset {
    return normalizeLegalizeKrLawRecord(rawResult, this.now().toISOString());
  }

  validate(normalizedAsset: ContextAsset) {
    assertValidContextAsset(normalizedAsset);
  }

  getFreshnessPolicy(asset?: ContextAsset): ContextFreshnessPolicy {
    return getContextAssetFreshnessPolicy(
      asset ?? {
        assetType: "LAW_CONTEXT",
        providerType: PROVIDER_TYPE,
        sourceTitle: ""
      }
    );
  }

  private loadIndex(env: NodeJS.ProcessEnv) {
    return this.index ?? loadLegalizeIndexFromDirectory(env.LEGALIZE_KR_DATA_DIR);
  }
}

export function createLegalizeKrProvider(options?: LegalizeKrProviderOptions) {
  return new LegalizeKrProvider(options);
}
