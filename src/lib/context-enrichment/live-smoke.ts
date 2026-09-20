import type { ContextProviderCatalogEntry, ContextResearchProvider } from "./types";
import { isEnabledOrConfiguredEnv } from "./config";

export type ContextProviderSmokeResult = {
  credentialEnvVars: string[];
  credentialPresent: boolean;
  errorCode?: string | null;
  ownerActionRequired: string | null;
  providerType: string;
  scenarios?: {
    query: string;
    sampleSourceCount: number;
    status: string;
  }[];
  sampleSourceCount: number;
  status:
    | "SKIPPED_DISABLED"
    | "SKIPPED_MISSING_CREDENTIALS"
    | "SKIPPED_UNSUPPORTED"
    | "PASS"
    | "FAIL";
  validationOk: boolean;
};

type ProviderWithStatusSmoke = ContextResearchProvider & {
  searchWithStatus?: (
    query: string,
    options?: Parameters<ContextResearchProvider["search"]>[1]
  ) => Promise<{
    results: unknown[];
    status: string;
  }>;
};

function hasCredentialForProvider(
  providerType: string,
  requiredEnvVars: string[],
  env: NodeJS.ProcessEnv
) {
  if (providerType === "statistics") {
    return Boolean(
      env.OPEN_NABOSTAT_API_KEY?.trim() ||
      env.OPEN_KOSIS_API_KEY?.trim() ||
      env.OPEN_ECOS_API_KEY?.trim() ||
      env.ECOS_API_KEY?.trim() ||
      (env.SGIS_CONSUMER_KEY?.trim() && env.SGIS_CONSUMER_SECRET?.trim()) ||
      env.SEMAS_STORE_API_KEY?.trim() ||
      env.SEMAS_API_KEY?.trim()
    );
  }
  if (providerType === "policy_report" || providerType === "legislative_library") {
    if (providerType === "policy_report") {
      return Boolean(
        env.OPEN_NABO_API_KEY?.trim() ||
        env.NABO_API_KEY?.trim() ||
        env.OPEN_NKIS_API_KEY?.trim() ||
        env.NKIS_API_KEY?.trim()
      );
    }

    return Boolean(env.OPEN_NABO_API_KEY?.trim() || env.NABO_API_KEY?.trim());
  }
  if (providerType === "game_metadata") {
    return Boolean(env.STEAM_WEB_API_KEY?.trim() || env.RAWG_API_KEY?.trim());
  }
  if (providerType === "music_metadata") {
    return Boolean(
      (env.SPOTIFY_CLIENT_ID?.trim() && env.SPOTIFY_CLIENT_SECRET?.trim()) ||
      env.LASTFM_API_KEY?.trim()
    );
  }
  if (providerType === "media_catalog") {
    return Boolean(
      env.KMDB_API_KEY?.trim() ||
      env.OMDB_API_KEY?.trim() ||
      isEnabledOrConfiguredEnv(env.TVMAZE_CONTEXT_ENABLED)
    );
  }
  if (providerType === "weather_environment") {
    // The FOURTH copy of this judgement (here, registry/credentials.ts, catalog.ts's
    // requiredEnvVars, catalog-required-env.ts). On 2026-08-18 the city-keyed sources were
    // dropped in favour of KMA advisories alone, and all four had to move together: each
    // one missed produced "the provider works but the catalog says no credentials".
    return Boolean(env.KMA_ALERT_OPENAPI_KEY?.trim());
  }
  if (providerType === "real_estate") {
    return Boolean(
      env.MOLIT_APARTMENT_TRADE_API_KEY?.trim() ||
      env.MOLIT_APARTMENT_RENT_API_KEY?.trim() ||
      env.MOLIT_ROW_HOUSE_TRADE_API_KEY?.trim() ||
      env.MOLIT_ROW_HOUSE_RENT_API_KEY?.trim() ||
      env.MOLIT_DETACHED_HOUSE_RENT_API_KEY?.trim() ||
      env.MOLIT_OFFICETEL_RENT_API_KEY?.trim() ||
      env.REB_REAL_ESTATE_STATS_API_KEY?.trim()
    );
  }
  if (providerType === "news_media") {
    return Boolean(
      env.GUARDIAN_API_KEY?.trim() ||
      env.NYT_API_KEY?.trim() ||
      env.NEWSAPI_KEY?.trim()
    );
  }
  if (providerType === "public_institution") {
    return Boolean(env.SEOUL_OPEN_DATA_API_KEY?.trim() || env.SEOUL_METRO_DATA_API_KEY?.trim());
  }

  return requiredEnvVars.every((name) => Boolean(env[name]?.trim()));
}

function ownerActionForProvider(providerType: string, requiredEnvVars: string[]) {
  if (providerType === "statistics") {
    return "OPEN_NABOSTAT_API_KEY_OR_OPEN_KOSIS_API_KEY_OR_OPEN_ECOS_API_KEY_OR_SGIS_OR_SEMAS_KEY";
  }
  if (providerType === "policy_report" || providerType === "legislative_library") {
    return providerType === "policy_report"
      ? "OPEN_NABO_API_KEY_OR_OPEN_NKIS_API_KEY"
      : "OPEN_NABO_API_KEY";
  }
  if (providerType === "game_metadata") {
    return "STEAM_WEB_API_KEY_OR_RAWG_API_KEY";
  }
  if (providerType === "music_metadata") {
    return "SPOTIFY_CLIENT_CREDENTIALS_OR_LASTFM_API_KEY";
  }
  if (providerType === "media_catalog") {
    return "KMDB_API_KEY_OR_OMDB_API_KEY_OR_TVMAZE_CONTEXT_ENABLED";
  }
  if (providerType === "weather_environment") {
    return "KMA_ALERT_OPENAPI_KEY";
  }
  if (providerType === "real_estate") {
    return "MOLIT_OR_REB_REAL_ESTATE_API_KEY";
  }
  if (providerType === "news_media") {
    return "GUARDIAN_API_KEY_OR_NYT_API_KEY_OR_NEWSAPI_KEY";
  }
  if (providerType === "public_institution") {
    return "SEOUL_OPEN_DATA_API_KEY_OR_SEOUL_METRO_DATA_API_KEY";
  }

  return requiredEnvVars[0] ?? null;
}

export async function runCredentialGatedProviderSmoke(input: {
  catalogEntry: ContextProviderCatalogEntry;
  env?: NodeJS.ProcessEnv;
  provider?: ContextResearchProvider;
  query: string;
}): Promise<ContextProviderSmokeResult> {
  const env = input.env ?? process.env;
  const credentialPresent = hasCredentialForProvider(
    input.catalogEntry.providerType,
    input.catalogEntry.requiredEnvVars,
    env
  );
  const ownerActionRequired = ownerActionForProvider(
    input.catalogEntry.providerType,
    input.catalogEntry.requiredEnvVars
  );

  if (input.catalogEntry.implementationStatus === "disabled") {
    return {
      credentialEnvVars: input.catalogEntry.requiredEnvVars,
      credentialPresent,
      ownerActionRequired: credentialPresent ? null : ownerActionRequired,
      providerType: input.catalogEntry.providerType,
      sampleSourceCount: 0,
      status: "SKIPPED_DISABLED",
      validationOk: false
    };
  }
  if (!credentialPresent) {
    return {
      credentialEnvVars: input.catalogEntry.requiredEnvVars,
      credentialPresent,
      ownerActionRequired,
      providerType: input.catalogEntry.providerType,
      sampleSourceCount: 0,
      status: "SKIPPED_MISSING_CREDENTIALS",
      validationOk: false
    };
  }
  if (env.CONTEXT_PROVIDER_SMOKE_ENABLED !== "1" && env.CONTEXT_PROVIDER_SMOKE_ENABLED?.toLowerCase() !== "true") {
    return {
      credentialEnvVars: input.catalogEntry.requiredEnvVars,
      credentialPresent,
      ownerActionRequired: "CONTEXT_PROVIDER_SMOKE_ENABLED",
      providerType: input.catalogEntry.providerType,
      sampleSourceCount: 0,
      status: "SKIPPED_DISABLED",
      validationOk: false
    };
  }
  if (!input.catalogEntry.supportsLiveSmoke || !input.provider) {
    return {
      credentialEnvVars: input.catalogEntry.requiredEnvVars,
      credentialPresent,
      ownerActionRequired: null,
      providerType: input.catalogEntry.providerType,
      sampleSourceCount: 0,
      status: "SKIPPED_UNSUPPORTED",
      validationOk: false
    };
  }

  try {
    const provider = input.provider as ProviderWithStatusSmoke;
    const smokeQueries = input.catalogEntry.providerType === "law"
      ? [input.query, "\uae40\uc601\ub780\ubc95", "\ubc95\uc81c\ucc98_\uc5c6\ub294_\ubc95\ub839_\uc2a4\ubaa8\ud06c"]
      : [input.query];
    const scenarios = [];
    let results: unknown[] = [];

    for (const query of smokeQueries) {
      const scenario = provider.searchWithStatus
        ? await provider.searchWithStatus(query, { env, limit: 1 })
        : {
            results: await input.provider.search(query, { env, limit: 1 }),
            status: "OK"
          };

      scenarios.push({
        query,
        sampleSourceCount: scenario.results.length,
        status: scenario.status
      });

      if (scenario.status === "OK" && results.length === 0) {
        results = scenario.results;
      }

      if (query.includes("\uc5c6\ub294") && scenario.status !== "NOT_FOUND") {
        return {
          credentialEnvVars: input.catalogEntry.requiredEnvVars,
          credentialPresent,
          errorCode: "NOT_FOUND_SCENARIO_DID_NOT_RETURN_NOT_FOUND",
          ownerActionRequired: null,
          providerType: input.catalogEntry.providerType,
          sampleSourceCount: 0,
          scenarios,
          status: "FAIL",
          validationOk: false
        };
      }
    }
    const first = results[0];
    if (!first) {
      return {
        credentialEnvVars: input.catalogEntry.requiredEnvVars,
        credentialPresent,
        errorCode: "NO_OK_SAMPLE_SOURCE",
        ownerActionRequired: null,
        providerType: input.catalogEntry.providerType,
        sampleSourceCount: 0,
        scenarios,
        status: "FAIL",
        validationOk: false
      };
    }
    input.provider.validate(input.provider.normalize(first));
    return {
      credentialEnvVars: input.catalogEntry.requiredEnvVars,
      credentialPresent,
      ownerActionRequired: null,
      providerType: input.catalogEntry.providerType,
      sampleSourceCount: results.length,
      scenarios,
      status: "PASS",
      validationOk: true
    };
  } catch (error) {
    return {
      credentialEnvVars: input.catalogEntry.requiredEnvVars,
      credentialPresent,
      errorCode: error instanceof Error ? error.message : String(error),
      ownerActionRequired: null,
      providerType: input.catalogEntry.providerType,
      sampleSourceCount: 0,
      status: "FAIL",
      validationOk: false
    };
  }
}
