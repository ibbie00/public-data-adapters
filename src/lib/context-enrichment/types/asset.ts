import type { ContextAssetType, ContextProviderType } from "./provider";

export type ContextTargetType = "SPARK" | "FLINT" | "LINK" | "SOURCE";
export type ContextConfidence = "high" | "medium" | "low";
export type ContextStatus =
  | "current"
  | "possibly_stale"
  | "superseded"
  | "needs_review"
  | "disabled";

export type ContextAttachmentReason =
  | "alias_match"
  | "keyword_match"
  | "same_source"
  | "same_law_article"
  | "same_ordinance"
  | "same_bill"
  | "same_statistic"
  | "same_report"
  | "operator_attached"
  | "related_spark"
  | "manual_review";

export type ContextAsset = {
  id?: string;
  targetType?: ContextTargetType;
  targetId?: string;
  providerType: ContextProviderType;
  assetType: ContextAssetType;
  sourceName: string;
  sourceInstitution?: string | null;
  sourceTitle: string;
  sourceUrl?: string | null;
  sourceIdentifier?: string | null;
  sourceDate?: Date | string | null;
  sourceArticles?: ContextSourceArticle[];
  effectiveDate?: Date | string | null;
  promulgationDate?: Date | string | null;
  checkedAt?: Date | string | null;
  retrievedAt?: Date | string | null;
  sourceRevisionKey?: string | null;
  sourceHash?: string | null;
  canonicalSourceKey?: string | null;
  // A DERIVED lookup key (getContextQueryFingerprint), never the raw query: on the
  // flint-keyword path the query IS the author's sentence, and these assets are stored
  // public and outlive the post. lib/context-enrichment/assets.ts re-derives whatever it
  // is handed, so a provider slipping raw text in here still cannot publish it.
  queryKey?: string | null;
  canonicalQueryKey?: string | null;
  aliasKey?: string | null;
  resolvedAliasId?: string | null;
  summary?: string | null;
  keyPoints?: string[];
  limitations?: string[];
  confidence: ContextConfidence;
  status: ContextStatus;
  locale: string;
  modelMetadata?: Record<string, unknown> | null;
  generatedCostUsd?: number | null;
  amortizedCostUsd?: number | null;
  reuseCount?: number;
  lastUsedAt?: Date | string | null;
  disclaimer?: string | null;
};

export type ContextSourceArticle = {
  articleNo: string;
  articleTitle?: string | null;
  effectiveDate?: Date | string | null;
  sourceIdentifier?: string | null;
  sourceUrl?: string | null;
  summary?: string | null;
};

export type ContextFreshnessPolicy = {
  ttlDays: number;
  reason: string;
};

export type ContextAssetAttachmentInput = {
  assetId: string;
  targetType: Exclude<ContextTargetType, "SOURCE">;
  targetId: string;
  reason: ContextAttachmentReason;
  confidence: ContextConfidence;
  attachedBy: "system" | "operator" | "migration";
  visibleInPublicUi?: boolean;
};
