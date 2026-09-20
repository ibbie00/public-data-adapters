import { contextEnrichmentUserAgent } from "../user-agent";

export const PROVIDER_TYPE = "statistics" as const;
export const PROVIDER_ID = "ecos";
export const ECOS_API_BASE_URL = "https://ecos.bok.or.kr/api";
export const DEFAULT_USER_AGENT =
  contextEnrichmentUserAgent("ECOS statistics smoke");
export const SOURCE_NAME_KO = "\ud55c\uad6d\uc740\ud589 ECOS \uacbd\uc81c\ud1b5\uacc4\uc2dc\uc2a4\ud15c";
export const SOURCE_INSTITUTION_KO = "\ud55c\uad6d\uc740\ud589";
