import type { ContextAsset, ContextFreshnessPolicy } from "./asset";
import type { ContextResearchProviderSearchOptions } from "./queue";
import type { ContextProviderType } from "./provider";

/**
 * What a provider says about a search besides "here are the rows".
 *
 * Deliberately `string`, not a union. Each provider declares its own status type in its
 * own types.ts and they do not all carry the same members; a union repeated here would be
 * a second list to keep in step, and it would reject a provider that adds a status rather
 * than letting the ledger record it. The vocabulary in use across the 17 implementers as
 * of 2026-08-10:
 *
 *   OK  NOT_FOUND  INVALID_QUERY  MISSING_CREDENTIALS  INVALID_CREDENTIALS
 *   PROVIDER_DISABLED  RATE_LIMITED  TIMEOUT  EXTERNAL_API_ERROR  PARSE_ERROR
 */
export type ContextResearchProviderSearchStatus = string;

export type ContextResearchProvider<RawResult = unknown> = {
  providerType: ContextProviderType;
  search(query: string, options?: ContextResearchProviderSearchOptions): Promise<RawResult[]>;
  /**
   * Same call as `search`, keeping the reason it came back empty.
   *
   * `search` returns only the rows, so "we asked in a shape this provider cannot read"
   * (INVALID_QUERY) and "the source had nothing today" (NOT_FOUND) both arrived at the
   * ledger as `succeeded / 0 results`. That is how five measured runs of the context lane
   * read as "providers had nothing" when three of them had been handed a diary entry where
   * they expect a table id (measured 2026-08-10). Seventeen providers already compute this
   * status; nothing outside providers/ read it.
   *
   * Optional because the contract does not require it. Callers fall back to `search`.
   */
  searchWithStatus?(
    query: string,
    options?: ContextResearchProviderSearchOptions
  ): Promise<{ results: RawResult[]; status: ContextResearchProviderSearchStatus }>;
  fetchById(sourceIdentifier: string, options?: ContextResearchProviderSearchOptions): Promise<RawResult | null>;
  normalize(rawResult: RawResult): ContextAsset;
  validate(normalizedAsset: ContextAsset): void;
  getFreshnessPolicy(asset?: ContextAsset): ContextFreshnessPolicy;
};
