import { contextEnrichmentUserAgent } from "../user-agent";

export const PROVIDER_TYPE = "statistics" as const;
export const PROVIDER_ID = "nabostat";
export const NABOSTAT_API_BASE_URL = "https://www.nabostats.go.kr/openapi";
export const DEFAULT_USER_AGENT =
  contextEnrichmentUserAgent("NABOSTATS smoke");
export const SOURCE_NAME_KO = "\uad6d\ud68c\uc608\uc0b0\uc815\ucc45\ucc98 \uc7ac\uc815\uacbd\uc81c\ud1b5\uacc4\uc2dc\uc2a4\ud15c";
export const SOURCE_INSTITUTION_KO = "\uad6d\ud68c\uc608\uc0b0\uc815\ucc45\ucc98";
