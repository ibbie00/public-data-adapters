import type {
  ContextAlias,
  ContextAsset,
  ContextFreshnessPolicy
} from "./types";

const SENSITIVE_LEGAL_HINTS = [
  "election",
  "privacy",
  "labor",
  "criminal",
  "youth",
  "media",
  "waste",
  "resource"
];

export function getAliasFreshnessPolicy(alias: Pick<ContextAlias, "aliasType" | "status">): ContextFreshnessPolicy {
  if (alias.status === "ambiguous" || alias.status === "needs_review") {
    return {
      reason: "ambiguous_or_review_alias",
      ttlDays: 7
    };
  }

  if (alias.aliasType === "official_short_name") {
    return {
      reason: "official_short_name",
      ttlDays: 90
    };
  }

  if (alias.aliasType === "media_nickname" || alias.aliasType === "issue_label") {
    return {
      reason: "nickname_or_issue_label",
      ttlDays: 30
    };
  }

  return {
    reason: "default_alias_policy",
    ttlDays: 30
  };
}

export function getContextAssetFreshnessPolicy(
  asset: Pick<ContextAsset, "assetType" | "providerType" | "sourceTitle">,
  options: {
    electionPeriod?: boolean;
    hotIssue?: boolean;
    knownUpdateCycleDays?: number;
    sensitiveArea?: boolean;
  } = {}
): ContextFreshnessPolicy {
  if (asset.providerType === "election") {
    return {
      reason: options.electionPeriod ? "election_period" : "historical_election_info",
      ttlDays: options.electionPeriod ? 1 : 365
    };
  }

  if (asset.providerType === "bill" || asset.providerType === "parliament_record") {
    return {
      reason: options.hotIssue ? "active_legislative_issue" : "legislative_status",
      ttlDays: options.hotIssue ? 1 : 7
    };
  }

  if (asset.providerType === "statistics") {
    return {
      reason: options.knownUpdateCycleDays ? "known_statistics_update_cycle" : "default_statistics_policy",
      ttlDays: options.knownUpdateCycleDays ?? 30
    };
  }

  if (asset.providerType === "corporate_disclosure") {
    return {
      reason: options.hotIssue ? "hot_corporate_disclosure" : "corporate_disclosure_metadata",
      ttlDays: options.hotIssue ? 1 : 7
    };
  }

  if (
    asset.providerType === "game_metadata" ||
    asset.providerType === "music_metadata" ||
    asset.providerType === "media_catalog"
  ) {
    return {
      reason: "public_catalog_metadata",
      ttlDays: 30
    };
  }

  if (asset.providerType === "weather_environment") {
    return {
      reason: "weather_environment_metadata",
      ttlDays: 1
    };
  }

  if (asset.providerType === "news_media") {
    return {
      reason: "news_media_metadata",
      ttlDays: options.hotIssue ? 1 : 7
    };
  }

  if (asset.providerType === "government_press" || asset.providerType === "policy_report") {
    return {
      reason: "dated_publication_metadata",
      ttlDays: 365
    };
  }

  if (asset.providerType === "law" || asset.providerType === "ordinance") {
    const title = asset.sourceTitle.toLowerCase();
    const isSensitive =
      options.sensitiveArea || SENSITIVE_LEGAL_HINTS.some((hint) => title.includes(hint));

    return {
      reason: isSensitive ? "sensitive_legal_context" : "default_legal_context",
      ttlDays: isSensitive ? 7 : 30
    };
  }

  return {
    reason: "default_context_policy",
    ttlDays: asset.providerType === "public_institution" ? 30 : 30
  };
}

export function isContextAssetPossiblyStale(input: {
  checkedAt?: Date | string | null;
  now?: Date;
  policy: ContextFreshnessPolicy;
}) {
  if (!input.checkedAt) {
    return true;
  }

  const now = input.now ?? new Date();
  const checkedAt = new Date(input.checkedAt);
  const ttlMs = input.policy.ttlDays * 24 * 60 * 60 * 1000;

  return now.getTime() - checkedAt.getTime() > ttlMs;
}

export function getContextCacheSignal(input: {
  aliasHit?: boolean;
  cacheHit?: boolean;
  reuseHit?: boolean;
}) {
  return {
    aliasHit: input.aliasHit === true,
    cacheHit: input.cacheHit === true,
    reuseHit: input.reuseHit === true
  };
}

export function getContextAmortizedCost(generatedCostUsd: number | null | undefined, reuseCount: number) {
  if (generatedCostUsd === null || generatedCostUsd === undefined) {
    return null;
  }

  return Number((generatedCostUsd / Math.max(reuseCount, 1)).toFixed(8));
}
