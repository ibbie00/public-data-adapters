import { isEnabledOrConfiguredEnv } from "../../config";

export function hasAllEnv(requiredEnvVars: string[], env: NodeJS.ProcessEnv) {
  return requiredEnvVars.every((name) => Boolean(env[name]?.trim()));
}

export function hasStatisticsCredential(env: NodeJS.ProcessEnv) {
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

export function hasNaboPublicationCredential(env: NodeJS.ProcessEnv) {
  return Boolean(env.OPEN_NABO_API_KEY?.trim() || env.NABO_API_KEY?.trim());
}

export function hasNkisPolicyCredential(env: NodeJS.ProcessEnv) {
  return Boolean(env.OPEN_NKIS_API_KEY?.trim() || env.NKIS_API_KEY?.trim());
}

export function hasGameMetadataCredential(env: NodeJS.ProcessEnv) {
  return Boolean(env.STEAM_WEB_API_KEY?.trim() || env.RAWG_API_KEY?.trim());
}

export function hasMusicMetadataCredential(env: NodeJS.ProcessEnv) {
  return Boolean(
    (env.SPOTIFY_CLIENT_ID?.trim() && env.SPOTIFY_CLIENT_SECRET?.trim()) ||
    env.LASTFM_API_KEY?.trim()
  );
}

export function hasMediaCatalogCredential(env: NodeJS.ProcessEnv) {
  return Boolean(
    env.KMDB_API_KEY?.trim() ||
    env.OMDB_API_KEY?.trim() ||
    isEnabledOrConfiguredEnv(env.TVMAZE_CONTEXT_ENABLED)
  );
}

export function hasWeatherEnvironmentCredential(env: NodeJS.ProcessEnv) {
  // 2026-08-18 에 도시 기반 자료(OpenWeatherMap, OpenUV)를 검색 경로에서 뺐다. 글에서
  // 도시를 뽑는 것은 글쓴이의 위치를 추론하는 일이다. 지금 이 제공자가 부르는 것은 기상청
  // 특보뿐이고, 그 목록에는 지역 파라미터가 없다.
  //
  // ⚠️ 이 판정은 사본이 셋이다(여기, catalog.ts 의 requiredEnvVars, catalog-required-env.ts).
  // 셋을 같이 옮기지 않으면 카탈로그가 `missing_credentials` 라고 말하면서 제공자는 잘 도는
  // 상태가 된다. 실제로 여기를 빠뜨려서 그 상태를 한 번 만들었다.
  return Boolean(env.KMA_ALERT_OPENAPI_KEY?.trim());
}

export function hasNewsMediaCredential(env: NodeJS.ProcessEnv) {
  return Boolean(
    env.GUARDIAN_API_KEY?.trim() ||
    env.NYT_API_KEY?.trim() ||
    env.NEWSAPI_KEY?.trim()
  );
}

export function hasPublicInstitutionCredential(env: NodeJS.ProcessEnv) {
  return Boolean(
    env.SEOUL_OPEN_DATA_API_KEY?.trim() || env.SEOUL_METRO_DATA_API_KEY?.trim()
  );
}

export function hasRealEstateCredential(env: NodeJS.ProcessEnv) {
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

export function hasElectionCredential(env: NodeJS.ProcessEnv) {
  return Boolean(
    env.NEC_COMMON_CODE_API_SERVICE_KEY?.trim() ||
    env.NEC_VOTE_COUNT_API_SERVICE_KEY?.trim() ||
    env.NEC_API_SERVICE_KEY?.trim()
  );
}

export function hasPolicyReportCredential(env: NodeJS.ProcessEnv) {
  return hasNaboPublicationCredential(env) || hasNkisPolicyCredential(env);
}
