import type { ContextProviderType } from "./types";

const PROVIDER_FLAG_BY_TYPE: Record<ContextProviderType, string> = {
  alias: "CONTEXT_ALIAS_RESOLUTION_ENABLED",
  bill: "CONTEXT_PROVIDER_BILL_ENABLED",
  corporate_disclosure: "CONTEXT_PROVIDER_CORPORATE_DISCLOSURE_ENABLED",
  election: "CONTEXT_PROVIDER_ELECTION_ENABLED",
  game_metadata: "CONTEXT_PROVIDER_GAME_METADATA_ENABLED",
  government_press: "CONTEXT_PROVIDER_GOVERNMENT_PRESS_ENABLED",
  law: "CONTEXT_PROVIDER_LAW_ENABLED",
  legislative_library: "CONTEXT_PROVIDER_LEGISLATIVE_LIBRARY_ENABLED",
  local_council_record: "CONTEXT_PROVIDER_LOCAL_COUNCIL_ENABLED",
  real_estate: "CONTEXT_PROVIDER_REAL_ESTATE_ENABLED",
  media_catalog: "CONTEXT_PROVIDER_MEDIA_CATALOG_ENABLED",
  media_correction: "CONTEXT_PROVIDER_MEDIA_CORRECTION_ENABLED",
  media_coverage: "CONTEXT_PROVIDER_MEDIA_COVERAGE_ENABLED",
  music_metadata: "CONTEXT_PROVIDER_MUSIC_METADATA_ENABLED",
  news_media: "CONTEXT_PROVIDER_NEWS_MEDIA_ENABLED",
  ordinance: "CONTEXT_PROVIDER_ORDINANCE_ENABLED",
  parliament_record: "CONTEXT_PROVIDER_PARLIAMENT_RECORD_ENABLED",
  policy_report: "CONTEXT_PROVIDER_POLICY_REPORT_ENABLED",
  public_institution: "CONTEXT_PROVIDER_PUBLIC_INSTITUTION_ENABLED",
  statistics: "CONTEXT_PROVIDER_STATISTICS_ENABLED",
  weather_environment: "CONTEXT_PROVIDER_WEATHER_ENVIRONMENT_ENABLED"
};

export type LawContextProvider = "korean-law-mcp" | "legalize-kr" | "national-law-api" | "disabled";

export function isEnabledEnv(value: string | undefined) {
  return value === "1" || value?.toLowerCase() === "true";
}

export function isEnabledOrConfiguredEnv(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();

  return Boolean(normalized && normalized !== "0" && normalized !== "false" && normalized !== "no" && normalized !== "off");
}

export function isContextEnrichmentEnabled(env: NodeJS.ProcessEnv = process.env) {
  return isEnabledEnv(env.CONTEXT_ENRICHMENT_ENABLED);
}

export function isContextPublicUiEnabled(env: NodeJS.ProcessEnv = process.env) {
  return isEnabledEnv(env.CONTEXT_PUBLIC_UI_ENABLED);
}

export function isContextTelemetryEnabled(env: NodeJS.ProcessEnv = process.env) {
  return isEnabledEnv(env.CONTEXT_TELEMETRY_ENABLED);
}

export function isContextAliasDiscoveryEnabled(env: NodeJS.ProcessEnv = process.env) {
  return isContextAliasResolutionEnabled(env) && isEnabledEnv(env.CONTEXT_ALIAS_DISCOVERY_ENABLED);
}

export function isContextOperatorReviewEnabled(env: NodeJS.ProcessEnv = process.env) {
  return isContextEnrichmentEnabled(env) && isEnabledEnv(env.CONTEXT_OPERATOR_REVIEW_ENABLED);
}

export function isContextQueuePlannerEnabled(env: NodeJS.ProcessEnv = process.env) {
  return isContextEnrichmentEnabled(env) && isEnabledEnv(env.CONTEXT_QUEUE_PLANNER_ENABLED);
}

export function isContextWorkerEnqueueEnabled(env: NodeJS.ProcessEnv = process.env) {
  return (
    isContextQueuePlannerEnabled(env) &&
    isEnabledEnv(env.CONTEXT_WORKER_ENQUEUE_ENABLED)
  );
}

export function isSparkCandidateContextEagerEnabled(env: NodeJS.ProcessEnv = process.env) {
  return (
    isContextWorkerEnqueueEnabled(env) &&
    isEnabledEnv(env.CONTEXT_SPARK_CANDIDATE_CONTEXT_EAGER_ENABLED)
  );
}

export function isContextLinkEnrichmentEnabled(env: NodeJS.ProcessEnv = process.env) {
  return (
    isContextWorkerEnqueueEnabled(env) &&
    isEnabledEnv(env.CONTEXT_LINK_ENRICHMENT_ENABLED)
  );
}

export function isContextProviderExecutionEnabled(env: NodeJS.ProcessEnv = process.env) {
  return (
    isContextEnrichmentEnabled(env) &&
    isEnabledEnv(env.CONTEXT_PROVIDER_EXECUTION_ENABLED)
  );
}

export function isMediaContextPublicUiEnabled(env: NodeJS.ProcessEnv = process.env) {
  return isEnabledEnv(env.MEDIA_CONTEXT_PUBLIC_UI_ENABLED);
}

export function isMediaContextEnabled(env: NodeJS.ProcessEnv = process.env) {
  return isContextEnrichmentEnabled(env) && isEnabledEnv(env.MEDIA_CONTEXT_ENABLED);
}

export function isMediaContextWorkerEnabled(env: NodeJS.ProcessEnv = process.env) {
  return (
    isContextEnrichmentEnabled(env) &&
    isEnabledEnv(env.MEDIA_CONTEXT_WORKER_ENABLED)
  );
}

export function isMediaContextAiSummaryEnabled(env: NodeJS.ProcessEnv = process.env) {
  return (
    isMediaContextWorkerEnabled(env) &&
    isEnabledEnv(env.MEDIA_CONTEXT_AI_SUMMARY_ENABLED)
  );
}

export function isContextAliasResolutionEnabled(env: NodeJS.ProcessEnv = process.env) {
  return isContextEnrichmentEnabled(env) && isEnabledEnv(env.CONTEXT_ALIAS_RESOLUTION_ENABLED);
}

export function isContextProviderEnabled(
  providerType: ContextProviderType,
  env: NodeJS.ProcessEnv = process.env
) {
  return isContextEnrichmentEnabled(env) && isEnabledEnv(env[PROVIDER_FLAG_BY_TYPE[providerType]]);
}

export function getLawContextProvider(env: NodeJS.ProcessEnv = process.env): LawContextProvider {
  const value = env.LAW_CONTEXT_PROVIDER;

  if (value === "korean-law-mcp" || value === "legalize-kr" || value === "national-law-api") {
    return value;
  }

  return "disabled";
}
