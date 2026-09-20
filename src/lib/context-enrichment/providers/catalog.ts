import type {
  ContextAssetType,
  ContextFreshnessPolicy,
  ContextProviderType
} from "../types";

export { getCatalogRequiredEnvVars } from "./catalog-required-env";

export type ProviderCatalogDefinition = {
  assetTypes: ContextAssetType[];
  featureFlag: string;
  freshnessPolicy: ContextFreshnessPolicy;
  notes: string;
  publicUiFeatureFlag?: string;
  requiredEnvVars: string[];
  supportsFetchById: boolean;
  supportsLiveSmoke: boolean;
  supportsSearch: boolean;
  workerFeatureFlag?: string;
};

export const PROVIDER_CATALOG: Record<ContextProviderType, ProviderCatalogDefinition> = {
  alias: {
    assetTypes: ["ALIAS_CONTEXT"],
    featureFlag: "CONTEXT_ALIAS_RESOLUTION_ENABLED",
    freshnessPolicy: { reason: "alias_default", ttlDays: 30 },
    notes: "Pre-provider alias resolution layer.",
    requiredEnvVars: [],
    supportsFetchById: false,
    supportsLiveSmoke: false,
    supportsSearch: true
  },
  bill: {
    assetTypes: ["BILL_CONTEXT"],
    featureFlag: "CONTEXT_PROVIDER_BILL_ENABLED",
    freshnessPolicy: { reason: "active_legislative_status", ttlDays: 7 },
    notes: "Open Assembly bill metadata adapter is available when OPEN_ASSEMBLY_API_KEY is present.",
    requiredEnvVars: ["OPEN_ASSEMBLY_API_KEY"],
    supportsFetchById: false,
    supportsLiveSmoke: true,
    supportsSearch: true
  },
  corporate_disclosure: {
    assetTypes: ["CORPORATE_DISCLOSURE_CONTEXT"],
    featureFlag: "CONTEXT_PROVIDER_CORPORATE_DISCLOSURE_ENABLED",
    freshnessPolicy: { reason: "corporate_disclosure_metadata", ttlDays: 7 },
    notes: "OpenDART disclosure metadata adapter. Metadata-only; no investment advice or article truth verdict.",
    requiredEnvVars: ["OPENDART_API_KEY"],
    supportsFetchById: true,
    supportsLiveSmoke: true,
    supportsSearch: true
  },
  election: {
    assetTypes: ["ELECTION_CONTEXT"],
    featureFlag: "CONTEXT_PROVIDER_ELECTION_ENABLED",
    freshnessPolicy: { reason: "official_election_metadata", ttlDays: 1 },
    notes: "NEC official election code context adapter is available. Vote-count comparison requires exact election identifiers and must not infer predictions or election legitimacy.",
    requiredEnvVars: ["NEC_COMMON_CODE_API_SERVICE_KEY", "NEC_VOTE_COUNT_API_SERVICE_KEY"],
    supportsFetchById: false,
    supportsLiveSmoke: false,
    supportsSearch: true
  },
  game_metadata: {
    assetTypes: ["GAME_METADATA_CONTEXT"],
    featureFlag: "CONTEXT_PROVIDER_GAME_METADATA_ENABLED",
    freshnessPolicy: { reason: "public_game_catalog_metadata", ttlDays: 30 },
    notes: "Steam and RAWG public game metadata credentials are recognized. User-owned games, profiles, friends, and play time are out of scope.",
    requiredEnvVars: ["STEAM_WEB_API_KEY", "RAWG_API_KEY"],
    supportsFetchById: false,
    supportsLiveSmoke: true,
    supportsSearch: true
  },
  government_press: {
    assetTypes: ["GOVERNMENT_PRESS_CONTEXT"],
    featureFlag: "CONTEXT_PROVIDER_GOVERNMENT_PRESS_ENABLED",
    freshnessPolicy: { reason: "agency_announcement", ttlDays: 30 },
    notes: "Scaffold only; must be labeled as official announcement or position.",
    requiredEnvVars: [],
    supportsFetchById: false,
    supportsLiveSmoke: false,
    supportsSearch: true
  },
  law: {
    assetTypes: ["LAW_CONTEXT"],
    featureFlag: "CONTEXT_PROVIDER_LAW_ENABLED",
    freshnessPolicy: { reason: "law_context_default", ttlDays: 30 },
    notes: "legalize-kr static law index is preferred for official-material metadata; National Law API remains available when LAW_CONTEXT_PROVIDER=national-law-api and LAW_OC is present.",
    requiredEnvVars: [],
    supportsFetchById: true,
    supportsLiveSmoke: true,
    supportsSearch: true
  },
  legislative_library: {
    assetTypes: ["LEGISLATIVE_LIBRARY_CONTEXT"],
    featureFlag: "CONTEXT_PROVIDER_LEGISLATIVE_LIBRARY_ENABLED",
    freshnessPolicy: { reason: "library_metadata", ttlDays: 30 },
    notes: "NABO periodicals adapter is available when OPEN_NABO_API_KEY is present; metadata-only and copyright-safe.",
    requiredEnvVars: ["OPEN_NABO_API_KEY"],
    supportsFetchById: false,
    supportsLiveSmoke: true,
    supportsSearch: true
  },
  local_council_record: {
    assetTypes: ["LOCAL_COUNCIL_CONTEXT"],
    featureFlag: "CONTEXT_PROVIDER_LOCAL_COUNCIL_ENABLED",
    freshnessPolicy: { reason: "local_council_record", ttlDays: 7 },
    notes: "Scaffold only; regional record adapter not wired.",
    requiredEnvVars: [],
    supportsFetchById: false,
    supportsLiveSmoke: false,
    supportsSearch: true
  },
  media_catalog: {
    assetTypes: ["MEDIA_CATALOG_CONTEXT"],
    featureFlag: "CONTEXT_PROVIDER_MEDIA_CATALOG_ENABLED",
    freshnessPolicy: { reason: "public_media_catalog_metadata", ttlDays: 30 },
    notes: "KMDb, OMDb, and TVMaze live metadata adapters are available. User watch history is out of scope.",
    requiredEnvVars: ["KMDB_API_KEY", "OMDB_API_KEY"],
    supportsFetchById: true,
    supportsLiveSmoke: true,
    supportsSearch: true
  },
  media_correction: {
    assetTypes: ["MEDIA_CORRECTION_STATUS"],
    featureFlag: "CONTEXT_PROVIDER_MEDIA_CORRECTION_ENABLED",
    freshnessPolicy: { reason: "media_correction_status", ttlDays: 7 },
    notes: "Media correction scaffold only; no truth verdicts.",
    publicUiFeatureFlag: "MEDIA_CONTEXT_PUBLIC_UI_ENABLED",
    requiredEnvVars: [],
    supportsFetchById: false,
    supportsLiveSmoke: false,
    supportsSearch: true,
    workerFeatureFlag: "MEDIA_CONTEXT_WORKER_ENABLED"
  },
  media_coverage: {
    assetTypes: ["MEDIA_COVERAGE_CONTEXT", "MEDIA_COVERAGE_TIMELINE"],
    featureFlag: "CONTEXT_PROVIDER_MEDIA_COVERAGE_ENABLED",
    freshnessPolicy: { reason: "media_metadata", ttlDays: 7 },
    notes: "Media coverage scaffold only; metadata-first, no full article body.",
    publicUiFeatureFlag: "MEDIA_CONTEXT_PUBLIC_UI_ENABLED",
    requiredEnvVars: [],
    supportsFetchById: false,
    supportsLiveSmoke: false,
    supportsSearch: true,
    workerFeatureFlag: "MEDIA_CONTEXT_WORKER_ENABLED"
  },
  music_metadata: {
    assetTypes: ["MUSIC_METADATA_CONTEXT"],
    featureFlag: "CONTEXT_PROVIDER_MUSIC_METADATA_ENABLED",
    freshnessPolicy: { reason: "public_music_catalog_metadata", ttlDays: 30 },
    notes: "Spotify Client Credentials and Last.fm API key are recognized for public catalog metadata. User listening history, library, and scrobbling are out of scope.",
    requiredEnvVars: ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET", "LASTFM_API_KEY"],
    supportsFetchById: false,
    supportsLiveSmoke: true,
    supportsSearch: true
  },
  news_media: {
    assetTypes: ["NEWS_MEDIA_CONTEXT"],
    featureFlag: "CONTEXT_PROVIDER_NEWS_MEDIA_ENABLED",
    freshnessPolicy: { reason: "news_media_metadata", ttlDays: 7 },
    notes: "Guardian, NYT, and NewsAPI credentials are recognized for public article metadata. Full article bodies, outlet trust scores, and truth verdicts are out of scope.",
    requiredEnvVars: ["GUARDIAN_API_KEY", "NYT_API_KEY", "NEWSAPI_KEY"],
    supportsFetchById: false,
    supportsLiveSmoke: true,
    supportsSearch: true
  },
  ordinance: {
    assetTypes: ["ORDINANCE_CONTEXT"],
    featureFlag: "CONTEXT_PROVIDER_ORDINANCE_ENABLED",
    freshnessPolicy: { reason: "ordinance_context_default", ttlDays: 30 },
    notes: "National Law API ordinance adapter is available when LAW_CONTEXT_PROVIDER=national-law-api and LAW_OC is present.",
    requiredEnvVars: ["LAW_OC"],
    supportsFetchById: true,
    supportsLiveSmoke: true,
    supportsSearch: true
  },
  parliament_record: {
    assetTypes: ["PARLIAMENT_RECORD_CONTEXT"],
    featureFlag: "CONTEXT_PROVIDER_PARLIAMENT_RECORD_ENABLED",
    freshnessPolicy: { reason: "parliament_record", ttlDays: 7 },
    notes: "Scaffold only; no live record adapter in this phase.",
    requiredEnvVars: [],
    supportsFetchById: false,
    supportsLiveSmoke: false,
    supportsSearch: true
  },
  policy_report: {
    assetTypes: ["POLICY_REPORT_CONTEXT"],
    featureFlag: "CONTEXT_PROVIDER_POLICY_REPORT_ENABLED",
    freshnessPolicy: { reason: "policy_report_metadata", ttlDays: 30 },
    notes: "NABO report adapter is available when OPEN_NABO_API_KEY is present; report bodies are not stored.",
    requiredEnvVars: ["OPEN_NABO_API_KEY"],
    supportsFetchById: false,
    supportsLiveSmoke: true,
    supportsSearch: true
  },
  public_institution: {
    assetTypes: ["PUBLIC_INSTITUTION_CONTEXT"],
    featureFlag: "CONTEXT_PROVIDER_PUBLIC_INSTITUTION_ENABLED",
    freshnessPolicy: { reason: "public_institution_metadata", ttlDays: 30 },
    notes: "Seoul Open Data public-institution adapter is available when a Seoul public data key is present. Location/transport data must not be used for private mobility inference.",
    requiredEnvVars: ["SEOUL_OPEN_DATA_API_KEY", "SEOUL_METRO_DATA_API_KEY"],
    supportsFetchById: false,
    supportsLiveSmoke: true,
    supportsSearch: true
  },
  real_estate: {
    assetTypes: ["REAL_ESTATE_CONTEXT"],
    featureFlag: "CONTEXT_PROVIDER_REAL_ESTATE_ENABLED",
    freshnessPolicy: { reason: "official_real_estate_metadata", ttlDays: 7 },
    notes: "MOLIT real-estate transaction adapters are available for official public metadata. Election/real-estate bundles must remain background-only and internal for AI interpretation.",
    requiredEnvVars: [
      "MOLIT_APARTMENT_TRADE_API_KEY",
      "MOLIT_APARTMENT_RENT_API_KEY",
      "REB_REAL_ESTATE_STATS_API_KEY"
    ],
    supportsFetchById: false,
    supportsLiveSmoke: true,
    supportsSearch: true
  },
  statistics: {
    assetTypes: ["STATISTICS_CONTEXT"],
    featureFlag: "CONTEXT_PROVIDER_STATISTICS_ENABLED",
    freshnessPolicy: { reason: "official_statistics", ttlDays: 30 },
    notes: "NABOSTATS, KOSIS, ECOS, SGIS, and SEMAS adapters are available when one matching statistics key is present; statistics context requires unit, period, and source.",
    requiredEnvVars: [
      "OPEN_NABOSTAT_API_KEY",
      "OPEN_KOSIS_API_KEY",
      "OPEN_ECOS_API_KEY",
      "SGIS_CONSUMER_KEY",
      "SGIS_CONSUMER_SECRET",
      "SEMAS_STORE_API_KEY"
    ],
    supportsFetchById: false,
    supportsLiveSmoke: true,
    supportsSearch: true
  },
  weather_environment: {
    assetTypes: ["WEATHER_ENVIRONMENT_CONTEXT"],
    featureFlag: "CONTEXT_PROVIDER_WEATHER_ENVIRONMENT_ENABLED",
    freshnessPolicy: { reason: "weather_environment_metadata", ttlDays: 1 },
    notes: "KMA special-weather advisories only, and deliberately so: the advisory list has NO region parameter, so relaying it never asks where the author is. City-keyed sources (OpenWeatherMap, OpenUV) were dropped from the search path on 2026-08-18 because picking a city out of a post is inferring the author's location.",
    requiredEnvVars: ["KMA_ALERT_OPENAPI_KEY"],
    supportsFetchById: false,
    supportsLiveSmoke: true,
    supportsSearch: true
  }
};
