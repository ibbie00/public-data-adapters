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
import { PROVIDER_TYPE } from "./constants";
import {
  getGuardianApiKey,
  getNewsApiKey,
  getNytApiKey,
  hasAnyNewsCredential
} from "./env";
import { normalizeNewsMediaRawResult } from "./normalize";
import {
  searchGuardian,
  searchNewsApi,
  searchNyt
} from "./search";
import {
  NewsMediaProviderError,
  type NewsMediaApiProviderOptions,
  type NewsMediaProviderStatus,
  type NewsMediaRawResult,
  type NewsMediaSearchStatusResult,
  type ReserveExtraNewsCall
} from "./types";

export class NewsMediaApiProvider implements ContextResearchProvider<NewsMediaRawResult> {
  readonly providerType = PROVIDER_TYPE;
  private readonly fetchImpl: ProviderFetchLike;
  private readonly now: () => Date;
  private readonly reserveExtraCall: ReserveExtraNewsCall | null;

  constructor(options: NewsMediaApiProviderOptions = {}) {
    this.fetchImpl = getContextProviderFetchImpl(options.fetchImpl);
    this.now = options.now ?? (() => new Date());
    this.reserveExtraCall = options.reserveExtraCall ?? null;
  }

  async searchWithStatus(
    query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<NewsMediaSearchStatusResult> {
    const env = options.env ?? process.env;
    const checkedAt = this.now().toISOString();
    const trimmedQuery = query.trim();

    if (!isContextProviderEnabled(PROVIDER_TYPE, env)) {
      return { checkedAt, provider: PROVIDER_TYPE, results: [], status: "PROVIDER_DISABLED" };
    }
    if (!trimmedQuery) {
      return { checkedAt, provider: PROVIDER_TYPE, results: [], status: "INVALID_QUERY" };
    }
    if (!hasAnyNewsCredential(env)) {
      return { checkedAt, provider: PROVIDER_TYPE, results: [], status: "MISSING_CREDENTIALS" };
    }

    const budget = evaluateContextProviderBudget(options.budgetSnapshot, env);
    if (!budget.allowed) {
      return { checkedAt, provider: PROVIDER_TYPE, results: [], status: "RATE_LIMITED" };
    }

    const limit = getContextProviderSearchLimit(options.limit, env);
    const runners: Array<() => Promise<Omit<NewsMediaRawResult, "checkedAt">[]>> = [];

    if (getGuardianApiKey(env)) {
      runners.push(() => searchGuardian({ env, fetchImpl: this.fetchImpl, limit, query: trimmedQuery }));
    }
    if (getNytApiKey(env)) {
      runners.push(() => searchNyt({ env, fetchImpl: this.fetchImpl, limit, query: trimmedQuery }));
    }
    if (getNewsApiKey(env)) {
      runners.push(() => searchNewsApi({ env, fetchImpl: this.fetchImpl, limit, query: trimmedQuery }));
    }
    const errors: NewsMediaProviderStatus[] = [];

    // ONE RESERVATION PER OUTBOUND CALL (audit 07-F7).
    //
    // This provider is a fallback chain: guardian, then nyt, then newsapi, stopping at the
    // first that answers. The caller reserved ONE slot before invoking it, so a query that
    // fell through to the third API spent three metered calls against a ledger that had
    // counted one. The budget then reads as a third of what is actually being spent, on the
    // only lane whose cost is a bill from somebody else.
    //
    // The first runner rides the caller's reservation; each additional attempt takes its
    // own. Running out mid-chain stops the chain rather than failing the query: what has
    // been tried has been tried, and the answer is the same "nothing found" the chain would
    // have produced anyway.
    for (const [index, run] of runners.entries()) {
      if (index > 0) {
        // 추가 호출의 예약은 호출자 몫이다(옵션 주입). 없으면 사슬을 멈춘다(fail-closed):
        // 예산을 셀 수 없는데 과금되는 API 를 더 부르지 않는다.
        if (!this.reserveExtraCall) {
          break;
        }

        const extra = await this.reserveExtraCall();

        if (!extra.allowed) {
          break;
        }
      }

      try {
        const results = await run();
        if (results.length > 0) {
          return {
            checkedAt,
            provider: PROVIDER_TYPE,
            results: results.slice(0, limit).map((item) => ({ ...item, checkedAt })),
            status: "OK"
          };
        }
      } catch (error) {
        errors.push(error instanceof NewsMediaProviderError ? error.status : "EXTERNAL_API_ERROR");
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

  async fetchById(): Promise<NewsMediaRawResult | null> {
    return null;
  }

  normalize(rawResult: NewsMediaRawResult): ContextAsset {
    return normalizeNewsMediaRawResult({
      checkedAt: this.now().toISOString(),
      rawResult
    });
  }

  validate(normalizedAsset: ContextAsset): void {
    assertValidContextAsset(normalizedAsset);
  }

  getFreshnessPolicy(asset?: ContextAsset): ContextFreshnessPolicy {
    return getContextAssetFreshnessPolicy(asset ?? {
      assetType: "NEWS_MEDIA_CONTEXT",
      providerType: PROVIDER_TYPE,
      sourceTitle: "news media"
    });
  }
}

export function createNewsMediaApiProvider(options: NewsMediaApiProviderOptions = {}) {
  return new NewsMediaApiProvider(options);
}
