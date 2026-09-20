import type { ContextAssetType, ContextProviderType } from "./provider";
import type { ContextFreshnessPolicy } from "./asset";

export type ContextProviderImplementationStatus =
  | "scaffolded"
  | "mocked"
  | "live_available"
  | "disabled"
  | "missing_credentials";

export type ContextProviderCatalogEntry = {
  assetTypes: ContextAssetType[];
  defaultEnabled: false;
  featureFlag: string;
  freshnessPolicy: ContextFreshnessPolicy;
  implementationStatus: ContextProviderImplementationStatus;
  notes: string;
  providerType: ContextProviderType;
  publicUiFeatureFlag?: string;
  requiredEnvVars: string[];
  sourceRequirements: string[];
  supportsFetchById: boolean;
  supportsLiveSmoke: boolean;
  supportsSearch: boolean;
  workerFeatureFlag?: string;
};
