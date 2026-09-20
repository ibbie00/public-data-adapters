import type { NaboPublicationProviderType } from "./types";

export function getEndpoint(providerType: NaboPublicationProviderType): "report" | "periodical" {
  return providerType === "legislative_library" ? "periodical" : "report";
}

export function getAssetType(providerType: NaboPublicationProviderType) {
  return providerType === "legislative_library" ? "LEGISLATIVE_LIBRARY_CONTEXT" : "POLICY_REPORT_CONTEXT";
}
