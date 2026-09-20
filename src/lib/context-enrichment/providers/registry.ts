import {
  type ContextProviderCatalogEntry,
  CONTEXT_PROVIDER_TYPES
} from "../types";
import {
  getCatalogRequiredEnvVars,
  PROVIDER_CATALOG
} from "./catalog";
import { getImplementationStatus } from "./registry/status";
export { getContextResearchProviders } from "./registry/factories";

export function getContextProviderCatalog(
  env: NodeJS.ProcessEnv = process.env
): ContextProviderCatalogEntry[] {
  return CONTEXT_PROVIDER_TYPES.map((providerType) => {
    const entry = PROVIDER_CATALOG[providerType];
    const requiredEnvVars = getCatalogRequiredEnvVars(providerType, entry, env);

    return {
      ...entry,
      defaultEnabled: false,
      implementationStatus: getImplementationStatus(providerType, entry, env),
      providerType,
      requiredEnvVars,
      sourceRequirements: ["sourceName", "sourceIdentifier_or_sourceUrl", "checkedAt"]
    };
  });
}
