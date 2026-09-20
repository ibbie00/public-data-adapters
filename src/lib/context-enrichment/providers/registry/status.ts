import {
  getLawContextProvider,
  isContextProviderEnabled
} from "../../config";
import type {
  ContextProviderCatalogEntry,
  ContextProviderType
} from "../../types";
import type { ProviderCatalogDefinition } from "../catalog";
import {
  hasAllEnv,
  hasElectionCredential,
  hasGameMetadataCredential,
  hasMediaCatalogCredential,
  hasMusicMetadataCredential,
  hasNaboPublicationCredential,
  hasNewsMediaCredential,
  hasPolicyReportCredential,
  hasPublicInstitutionCredential,
  hasRealEstateCredential,
  hasStatisticsCredential,
  hasWeatherEnvironmentCredential
} from "./credentials";

export function getImplementationStatus(
  providerType: ContextProviderType,
  entry: ProviderCatalogDefinition,
  env: NodeJS.ProcessEnv
): ContextProviderCatalogEntry["implementationStatus"] {
  if (!isContextProviderEnabled(providerType, env)) {
    return "disabled";
  }
  if (providerType === "law" || providerType === "ordinance") {
    const lawProvider = getLawContextProvider(env);
    if (providerType === "law" && lawProvider === "legalize-kr") {
      return env.LEGALIZE_KR_DATA_DIR ? "live_available" : "scaffolded";
    }
    if (lawProvider === "national-law-api" && !env.LAW_OC) {
      return "missing_credentials";
    }
    return lawProvider === "national-law-api" ? "live_available" : "scaffolded";
  }
  if (providerType === "alias") {
    return "mocked";
  }
  if (providerType === "bill") {
    return env.OPEN_ASSEMBLY_API_KEY?.trim() ? "live_available" : "missing_credentials";
  }
  if (providerType === "statistics") {
    return hasStatisticsCredential(env) ? "live_available" : "missing_credentials";
  }
  if (providerType === "public_institution") {
    return hasPublicInstitutionCredential(env) ? "live_available" : "missing_credentials";
  }
  if (providerType === "corporate_disclosure") {
    return env.OPENDART_API_KEY?.trim() ? "live_available" : "missing_credentials";
  }
  if (providerType === "election") {
    return hasElectionCredential(env) ? "live_available" : "missing_credentials";
  }
  if (providerType === "game_metadata") {
    return hasGameMetadataCredential(env) ? "live_available" : "missing_credentials";
  }
  if (providerType === "music_metadata") {
    return hasMusicMetadataCredential(env) ? "live_available" : "missing_credentials";
  }
  if (providerType === "media_catalog") {
    return hasMediaCatalogCredential(env) ? "live_available" : "missing_credentials";
  }
  if (providerType === "weather_environment") {
    return hasWeatherEnvironmentCredential(env) ? "live_available" : "missing_credentials";
  }
  if (providerType === "news_media") {
    return hasNewsMediaCredential(env) ? "live_available" : "missing_credentials";
  }
  if (providerType === "real_estate") {
    return hasRealEstateCredential(env) ? "live_available" : "missing_credentials";
  }
  if (providerType === "policy_report" || providerType === "legislative_library") {
    const hasCredential = providerType === "policy_report"
      ? hasPolicyReportCredential(env)
      : hasNaboPublicationCredential(env);

    return hasCredential ? "live_available" : "missing_credentials";
  }
  if (!hasAllEnv(entry.requiredEnvVars, env)) {
    return "missing_credentials";
  }
  return "scaffolded";
}
