import type { ContextAlias } from "./alias";
import type { ContextProviderType } from "./provider";

export type ContextEnrichmentTargetType = "SPARK" | "FLINT" | "LINK";

export type ContextEnrichmentQueueTrigger =
  | "operator_requested"
  | "warmth_threshold"
  | "known_alias"
  | "context_need"
  | "source_keyword"
  | "policy_topic"
  | "stale_refresh"
  | "public_visible_attachment";

export type ContextEnrichmentPrivacyBoundary =
  | "PUBLIC_CONFIRMED_SPARK"
  | "PUBLIC_FLINT_CONTEXT_NEED";

export type ContextEnrichmentSparkCandidateReference = {
  candidateIndex?: number | null;
  candidateKind?: "matches" | "newCandidates" | null;
  candidatePoolId?: string | null;
  confidence?: number | null;
  contextProviderHintBasis?: string[];
  contextProviderTypes?: ContextProviderType[];
  name: string;
  source?: string | null;
  sparkId?: string | null;
  sparkSeedId?: string | null;
  suggestionId?: string | null;
};

export type ContextEnrichmentQueueDecision = {
  aliasHit: boolean;
  cacheHit: boolean;
  enabled: boolean;
  enqueue: boolean;
  priority: "high" | "normal" | "low";
  providerTypes: ContextProviderType[];
  query: string;
  reasons: ContextEnrichmentQueueTrigger[];
  reuseHit: boolean;
  /**
   * Search terms per provider. Absent means "use `query`" (older jobs predate this field).
   *
   * One string sent to everyone lets a term that fits one provider ruin another's query
   * (measured 2026-08-18: the lease-law post's two terms joined find no statute, while the
   * statute name alone does). See searchTermsByProvider in context-need-planner/types.ts.
   */
  searchTermsByProvider?: Partial<Record<ContextProviderType, string[]>>;
  sparkCandidates?: ContextEnrichmentSparkCandidateReference[];
  targetCreatedAt?: Date | string | null;
  targetId: string;
  targetType: ContextEnrichmentTargetType;
};

export type ContextEnrichmentJobDraft = {
  dedupeKey: string;
  jobType: "CONTEXT_ENRICHMENT_RESEARCH";
  payload: {
    cacheHit: boolean;
    privacyBoundary: ContextEnrichmentPrivacyBoundary;
    providerTypes: ContextProviderType[];
    query: string;
    reasons: ContextEnrichmentQueueTrigger[];
    reuseHit: boolean;
    // Search terms per provider. Jobs already queued do NOT carry this field, so the
    // worker must always be able to fall back to `query` (worker-execution.ts).
    searchTermsByProvider?: Partial<Record<ContextProviderType, string[]>>;
    sourceContexts: ["PUBLIC_CONTEXT_RESEARCH"];
    sparkCandidates?: ContextEnrichmentSparkCandidateReference[];
    targetCreatedAt?: string;
    targetId: string;
    targetType: ContextEnrichmentTargetType;
  };
  priority: number;
  targetId: string;
  targetType: ContextEnrichmentTargetType;
};

export type ContextEnrichmentEnqueueOutcome =
  | "enqueued"
  | "skipped_disabled"
  | "skipped_non_public"
  | "skipped_spark_not_confirmed"
  | "provider_disabled"
  | "missing_credentials"
  | "skipped_existing_current_asset"
  | "skipped_duplicate_active_job"
  | "skipped_budget"
  | "needs_operator_review";

export type ContextEnrichmentJobType =
  | "CONTEXT_ENRICH_LINK"
  | "CONTEXT_ENRICH_FLINT"
  | "CONTEXT_ENRICH_SPARK"
  | "CONTEXT_REFRESH_ASSET"
  | "CONTEXT_RESOLVE_ALIAS"
  | "CONTEXT_PROVIDER_SMOKE";

export type MediaContextJobType =
  | "MEDIA_CONTEXT_FOR_LINK"
  | "MEDIA_CONTEXT_FOR_FLINT"
  | "MEDIA_CONTEXT_FOR_SPARK"
  | "MEDIA_COVERAGE_TIMELINE"
  | "MEDIA_CORRECTION_TRACK"
  | "MEDIA_CONTEXT_REFRESH";

export type ContextResearchProviderSearchOptions = {
  budgetSnapshot?: {
    dailyCallCount?: number;
    hourlyCallCount?: number;
  };
  env?: NodeJS.ProcessEnv;
  locale?: string;
  limit?: number;
  alias?: ContextAlias;
  targetCreatedAt?: Date | string | null;
};
