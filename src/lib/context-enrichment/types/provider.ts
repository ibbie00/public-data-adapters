export const CONTEXT_PROVIDER_TYPES = [
  "alias",
  "law",
  "ordinance",
  "bill",
  "parliament_record",
  "local_council_record",
  "election",
  "real_estate",
  "statistics",
  "game_metadata",
  "music_metadata",
  "media_catalog",
  "weather_environment",
  "news_media",
  "government_press",
  "policy_report",
  "corporate_disclosure",
  "legislative_library",
  "public_institution",
  "media_coverage",
  "media_correction"
] as const;

export type ContextProviderType = (typeof CONTEXT_PROVIDER_TYPES)[number];

export const CONTEXT_ASSET_TYPES = [
  "ALIAS_CONTEXT",
  "LAW_CONTEXT",
  "ORDINANCE_CONTEXT",
  "BILL_CONTEXT",
  "PARLIAMENT_RECORD_CONTEXT",
  "LOCAL_COUNCIL_CONTEXT",
  "ELECTION_CONTEXT",
  "REAL_ESTATE_CONTEXT",
  "STATISTICS_CONTEXT",
  "GAME_METADATA_CONTEXT",
  "MUSIC_METADATA_CONTEXT",
  "MEDIA_CATALOG_CONTEXT",
  "WEATHER_ENVIRONMENT_CONTEXT",
  "NEWS_MEDIA_CONTEXT",
  "GOVERNMENT_PRESS_CONTEXT",
  "POLICY_REPORT_CONTEXT",
  "CORPORATE_DISCLOSURE_CONTEXT",
  "LEGISLATIVE_LIBRARY_CONTEXT",
  "PUBLIC_INSTITUTION_CONTEXT",
  "MEDIA_COVERAGE_CONTEXT",
  "MEDIA_COVERAGE_TIMELINE",
  "MEDIA_CORRECTION_STATUS"
] as const;

export type ContextAssetType = (typeof CONTEXT_ASSET_TYPES)[number];
