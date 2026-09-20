import { getLawContextProvider } from "../config";
import type { ContextProviderType } from "../types";
import type { ProviderCatalogDefinition } from "./catalog";

export function getCatalogRequiredEnvVars(
  providerType: ContextProviderType,
  entry: ProviderCatalogDefinition,
  env: NodeJS.ProcessEnv
) {
  if (providerType === "law" && getLawContextProvider(env) === "national-law-api") {
    return ["LAW_OC"];
  }

  switch (providerType) {
    case "election":
      return ["NEC_COMMON_CODE_API_SERVICE_KEY", "NEC_VOTE_COUNT_API_SERVICE_KEY"];
    case "game_metadata":
      return ["STEAM_WEB_API_KEY", "RAWG_API_KEY"];
    case "legislative_library":
      return ["OPEN_NABO_API_KEY"];
    case "media_catalog":
      return ["KMDB_API_KEY", "OMDB_API_KEY", "TVMAZE_CONTEXT_ENABLED"];
    case "music_metadata":
      return ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET", "LASTFM_API_KEY"];
    case "news_media":
      return ["GUARDIAN_API_KEY", "NYT_API_KEY", "NEWSAPI_KEY"];
    case "policy_report":
      return ["OPEN_NABO_API_KEY", "OPEN_NKIS_API_KEY"];
    case "public_institution":
      return ["SEOUL_OPEN_DATA_API_KEY", "SEOUL_METRO_DATA_API_KEY"];
    case "real_estate":
      return [
        "MOLIT_APARTMENT_TRADE_API_KEY",
        "MOLIT_APARTMENT_RENT_API_KEY",
        "REB_REAL_ESTATE_STATS_API_KEY"
      ];
    case "statistics":
      return [
        "OPEN_NABOSTAT_API_KEY",
        "OPEN_KOSIS_API_KEY",
        "OPEN_ECOS_API_KEY",
        "SGIS_CONSUMER_KEY",
        "SGIS_CONSUMER_SECRET",
        "SEMAS_STORE_API_KEY"
      ];
    case "weather_environment":
      // 2026-08-18 에 도시 기반 자료(OpenWeatherMap, OpenUV)를 검색 경로에서 뺐다. 글에서
      // 도시를 뽑는 것은 글쓴이의 위치를 추론하는 일이다. 기상청 특보는 지역 파라미터가
      // 없어서 그 문제가 없다.
      return ["KMA_ALERT_OPENAPI_KEY"];
    default:
      return entry.requiredEnvVars;
  }
}
