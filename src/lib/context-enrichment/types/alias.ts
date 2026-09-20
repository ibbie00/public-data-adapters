import type { ContextAssetType, ContextProviderType } from "./provider";
import type { ContextConfidence } from "./asset";

export type ContextAliasStatus = "active" | "deprecated" | "ambiguous" | "needs_review";
export type ContextAliasType =
  | "official_short_name"
  | "media_nickname"
  | "case_name"
  | "policy_slogan"
  | "old_name"
  | "abbreviation"
  | "bill_nickname"
  | "program_name"
  | "campaign_name"
  | "issue_label"
  | "institution_nickname";
export type ContextAliasRelation =
  | "same_law"
  | "related_law"
  | "amendment_package"
  | "enforcement_decree"
  | "official_guidance"
  | "bill_package"
  | "policy_context"
  | "statistics_context"
  | "government_program"
  | "public_institution_context"
  | "local_ordinance_context"
  | "ambiguous";

export type ContextAliasTarget = {
  providerType: ContextProviderType;
  assetType: ContextAssetType;
  officialName: string;
  sourceIdentifier?: string | null;
  sourceUrl?: string | null;
  articleNo?: string | null;
  relation: ContextAliasRelation;
  confidence: ContextConfidence;
  note?: string | null;
  status?: "active" | "deprecated" | "needs_review";
};

export type ContextAlias = {
  alias: string;
  normalizedAlias: string;
  aliasType: ContextAliasType;
  canonicalTargets: ContextAliasTarget[];
  explanation?: string | null;
  sourceName?: string | null;
  sourceInstitution?: string | null;
  sourceUrl?: string | null;
  sourceIdentifier?: string | null;
  checkedAt?: Date | string | null;
  retrievedAt?: Date | string | null;
  sourceRevisionKey?: string | null;
  confidence: ContextConfidence;
  status: ContextAliasStatus;
  locale: string;
};
