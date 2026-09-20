import type { NaboPublicationProviderType } from "./types";

export function getNaboApiKey(env: NodeJS.ProcessEnv) {
  return env.OPEN_NABO_API_KEY?.trim() || env.NABO_API_KEY?.trim() || "";
}

export function getDefaultQuery(providerType: NaboPublicationProviderType, env: NodeJS.ProcessEnv) {
  if (providerType === "legislative_library") {
    return env.NABO_PERIODICAL_SMOKE_QUERY?.trim() || env.NABO_PUBLICATION_SMOKE_QUERY?.trim() || "";
  }

  return env.NABO_REPORT_SMOKE_QUERY?.trim() || env.NABO_PUBLICATION_SMOKE_QUERY?.trim() || "";
}
