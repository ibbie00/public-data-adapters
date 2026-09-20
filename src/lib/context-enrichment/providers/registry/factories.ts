import {
  getLawContextProvider,
  isContextProviderEnabled,
  isEnabledEnv
} from "../../config";
import type { ProviderFetchLike } from "../fetch-with-retry";
import type { MediaTitleLlmFallback } from "../media-catalog-api/media-title-fallback";
import type { ReserveExtraNewsCall } from "../news-media-api/types";
import type {
  ContextProviderType,
  ContextResearchProvider
} from "../../types";
import { createEcosApiProvider } from "../ecos-api";
import { createGameMetadataApiProvider } from "../game-metadata-api";
import { createMediaCoverageProvider } from "../media-coverage";
import { createMediaCatalogApiProvider } from "../media-catalog-api";
import { createMusicMetadataApiProvider } from "../music-metadata-api";
import { createNkisPolicyApiProvider } from "../nkis-policy-api";
import { createNewsMediaApiProvider } from "../news-media-api";
import { createNecElectionApiProvider } from "../nec-election-api";
import { createNabostatApiProvider } from "../nabostat-api";
import { createNaboPublicationApiProvider } from "../nabo-publication-api";
import { createNationalLawApiProvider } from "../national-law-api";
import { createLegalizeKrProvider } from "../legalize-kr";
import { createKosisApiProvider } from "../kosis-api";
import { createOpenAssemblyApiProvider } from "../open-assembly-api";
import { createOpenDartApiProvider } from "../opendart-api";
import { createRealEstateApiProvider } from "../real-estate-api";
import { createSemasApiProvider } from "../semas-api";
import { createSeoulOpenDataApiProvider } from "../seoul-open-data-api";
import { createSgisApiProvider } from "../sgis-api";
import { createWeatherEnvironmentApiProvider } from "../weather-environment-api";
import {
  hasNaboPublicationCredential,
  hasNkisPolicyCredential,
  hasPolicyReportCredential,
  hasPublicInstitutionCredential,
  hasStatisticsCredential
} from "./credentials";

// How a caller wires its own infrastructure into the adapters. Everything is
// optional: an omitted seam falls back to the package default (plain fetch, no
// extra-call budget, no LLM title extraction).
export type ProviderInjection = {
  fetchImpl?: ProviderFetchLike;
  reserveExtraCall?: ReserveExtraNewsCall;
  titleFallback?: MediaTitleLlmFallback;
};

type ProviderFactoryRule = {
  create: (
    env: NodeJS.ProcessEnv,
    injection: ProviderInjection
  ) => ContextResearchProvider[];
  providerType: ContextProviderType;
};

function getPolicyReportProviders(env: NodeJS.ProcessEnv, injection: ProviderInjection) {
  const providers: ContextResearchProvider[] = [];

  if (hasNaboPublicationCredential(env) || !hasPolicyReportCredential(env)) {
    providers.push(createNaboPublicationApiProvider({
      fetchImpl: injection.fetchImpl,
      providerType: "policy_report"
    }));
  }
  if (hasNkisPolicyCredential(env)) {
    providers.push(createNkisPolicyApiProvider({ fetchImpl: injection.fetchImpl }));
  }

  return providers;
}

function getStatisticsProviders(env: NodeJS.ProcessEnv, injection: ProviderInjection) {
  const providers: ContextResearchProvider[] = [];
  const hasAnyStatisticsCredential = hasStatisticsCredential(env);

  if (env.OPEN_NABOSTAT_API_KEY?.trim() || !hasAnyStatisticsCredential) {
    providers.push(createNabostatApiProvider({ fetchImpl: injection.fetchImpl }));
  }
  if (env.OPEN_KOSIS_API_KEY?.trim()) {
    providers.push(createKosisApiProvider({ fetchImpl: injection.fetchImpl }));
  }
  if (env.OPEN_ECOS_API_KEY?.trim() || env.ECOS_API_KEY?.trim()) {
    providers.push(createEcosApiProvider({ fetchImpl: injection.fetchImpl }));
  }
  if (env.SGIS_CONSUMER_KEY?.trim() && env.SGIS_CONSUMER_SECRET?.trim()) {
    providers.push(createSgisApiProvider({ fetchImpl: injection.fetchImpl }));
  }
  // ⚠️ Commercial-area (SEMAS) is opt-in, and the key alone no longer turns it on.
  //
  // It searches by SHOP NAME, and the `statistics` bucket is shared by three different
  // context-need rules: commercial-area words, regional-population words, and the
  // price/KOSIS/ECOS ones. So a post about 소비자물가 reached the shop registry and it
  // answered, because a shop registry answers almost anything. Measured 2026-08-09 on
  // three unrelated posts (물가, 전세, 미세먼지): all three were attached the same
  // "샤론스톤 - 시계/귀금속 소매업". It was the only statistics provider that returned
  // rows at all (10 of them); the rest returned 0.
  //
  // Turning it back on means splitting the bucket first, so a commercial-area rule can
  // reach the shop registry without the price rules doing the same. Until then this
  // provider costs three wrong cards for every right one it might place.
  if (
    isEnabledEnv(env.CONTEXT_PROVIDER_COMMERCIAL_AREA_ENABLED) &&
    (env.SEMAS_STORE_API_KEY?.trim() || env.SEMAS_API_KEY?.trim())
  ) {
    providers.push(createSemasApiProvider({ fetchImpl: injection.fetchImpl }));
  }

  return providers;
}

const CONTEXT_PROVIDER_FACTORY_RULES: ProviderFactoryRule[] = [
  {
    create: (_env, injection) => [
      createOpenAssemblyApiProvider({ fetchImpl: injection.fetchImpl })
    ],
    providerType: "bill"
  },
  {
    // OpenDART only answers callers whose IP is registered against the API key.
    // Routed through an egress proxy it answers HTTP 200 with
    // `{"status":"012","message":"접근할 수 없는 IP입니다"}`.
    //
    // An API that gates on a registered IP cannot be hidden behind a proxy:
    // registering tells the provider who the caller is up front, and a proxy
    // exists to not say it. This adapter therefore uses a plain direct fetch by
    // default; callers that need a different egress path inject their own
    // fetchImpl (or override per search call).
    create: () => [createOpenDartApiProvider({ fetchImpl: directOutboundFetch })],
    providerType: "corporate_disclosure"
  },
  {
    // ⚠️ Opt-in, and not because of credentials. The NEC common-code API does not take a
    // search term: `search()` fetches page 1 of the election-code LIST and picks from it,
    // so the answer is the same regardless of what the post is about, and page 1 is old
    // elections. Measured 2026-08-09 on two runs of the same ten posts: a piece about
    // watching results come in was given the 2015 by-elections, then the 2014 district
    // council elections. Neither had anything to do with it.
    //
    // The door-level pointer readers actually want ("the official place to check turnout
    // and counts") is already produced by FLINT_LINK_CONTEXT on the link card, and it
    // survives this being off. What this provider adds on top is a specific election it
    // cannot actually identify.
    //
    // Turning it back on needs a path that can NAME the election: narrowing the code list
    // by date/type, or matching a year taken from the post. Until then it is noise with an
    // official-looking badge, which is worse than nothing.
    create: (env, injection) =>
      isEnabledEnv(env.CONTEXT_PROVIDER_ELECTION_DETAIL_ENABLED)
        ? [createNecElectionApiProvider({ fetchImpl: injection.fetchImpl })]
        : [],
    providerType: "election"
  },
  {
    create: (_env, injection) => [
      createGameMetadataApiProvider({ fetchImpl: injection.fetchImpl })
    ],
    providerType: "game_metadata"
  },
  {
    create: () => [createMediaCoverageProvider()],
    providerType: "media_coverage"
  },
  {
    create: (_env, injection) => [
      createMediaCatalogApiProvider({
        fetchImpl: injection.fetchImpl,
        titleFallback: injection.titleFallback
      })
    ],
    providerType: "media_catalog"
  },
  {
    create: (_env, injection) => [
      createMusicMetadataApiProvider({ fetchImpl: injection.fetchImpl })
    ],
    providerType: "music_metadata"
  },
  {
    create: (_env, injection) => [
      createNewsMediaApiProvider({
        fetchImpl: injection.fetchImpl,
        reserveExtraCall: injection.reserveExtraCall
      })
    ],
    providerType: "news_media"
  },
  {
    create: getPolicyReportProviders,
    providerType: "policy_report"
  },
  {
    // ⚠️ Opt-in, and not because of credentials. This provider answers every post, and
    // always with the same district.
    //
    // `selectService` matches on word pairs ("아파트" + "전세"). When nothing matches it
    // does not decline: it falls back to MOLIT_SERVICES[0], apartment sales. So a post
    // about jeonse is asked of the sales endpoint, and a post about fine dust is asked
    // too. `inferLawdCode` is worse: both of its branches return "11110", so whatever the
    // post is about, the rows come from Jongno-gu. Measured 2026-08-10 against the five
    // queries this lane actually produced: all five selected apartment sales in Jongno.
    //
    // This is the shape that made us switch the shop registry off: a provider that
    // answers anything will eventually attach to anything. It has not attached a card yet
    // only because the endpoint returned no rows on the day we measured, and the API key
    // is live, so that is luck rather than a guard.
    //
    // Both conditions were met on 2026-08-18, so the extra gate is gone.
    //
    // The district now comes from the post itself and nowhere else: `inferLawdCode` resolves
    // a si/gun/gu the writer named, through the baked table, and returns null otherwise
    // (region-mention.ts). Names shared across provinces (중구 is in five) need the province
    // named too. And `selectService` no longer falls back to apartment sales: the post has to
    // name both a property type and a transaction type or the provider declines.
    //
    // What is left is the ordinary provider flag, same as every other entry here.
    create: (_env, injection) => [
      createRealEstateApiProvider({ fetchImpl: injection.fetchImpl })
    ],
    providerType: "real_estate"
  },
  {
    create: (_env, injection) => [
      createNaboPublicationApiProvider({
        fetchImpl: injection.fetchImpl,
        providerType: "legislative_library"
      })
    ],
    providerType: "legislative_library"
  },
  {
    create: getStatisticsProviders,
    providerType: "statistics"
  },
  {
    create: (env, injection) =>
      hasPublicInstitutionCredential(env)
        ? [createSeoulOpenDataApiProvider({ fetchImpl: injection.fetchImpl })]
        : [],
    providerType: "public_institution"
  },
  {
    create: (_env, injection) => [
      createWeatherEnvironmentApiProvider({ fetchImpl: injection.fetchImpl })
    ],
    providerType: "weather_environment"
  }
];

// A plain fetch used where the provider must not share the default outbound path.
// Only OpenDART uses it, and the reason is on that entry above.
const directOutboundFetch = ((url: URL, init?: RequestInit) =>
  fetch(url, init)) as ProviderFetchLike;

export function getContextResearchProviders(
  env: NodeJS.ProcessEnv = process.env,
  injection: ProviderInjection = {}
): ContextResearchProvider[] {
  const providers: ContextResearchProvider[] = [];
  const lawProvider = getLawContextProvider(env);

  if (lawProvider === "legalize-kr") {
    providers.push(createLegalizeKrProvider());
  }
  if (lawProvider === "national-law-api") {
    providers.push(createNationalLawApiProvider({
      fetchImpl: injection.fetchImpl,
      providerType: "law"
    }));
    providers.push(createNationalLawApiProvider({
      fetchImpl: injection.fetchImpl,
      providerType: "ordinance"
    }));
  }

  for (const rule of CONTEXT_PROVIDER_FACTORY_RULES) {
    if (isContextProviderEnabled(rule.providerType, env)) {
      providers.push(...rule.create(env, injection));
    }
  }

  return providers;
}
