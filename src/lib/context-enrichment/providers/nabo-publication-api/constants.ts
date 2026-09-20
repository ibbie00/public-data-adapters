import { contextEnrichmentUserAgent } from "../user-agent";

export const PROVIDER_ID = "nabo_publication";
export const NABO_API_BASE_URL = "https://www.nabo.go.kr/api/v1";
export const DEFAULT_USER_AGENT =
  contextEnrichmentUserAgent("NABO publication smoke");
export const SOURCE_NAME_KO = "\uad6d\ud68c\uc608\uc0b0\uc815\ucc45\ucc98";
export const SOURCE_INSTITUTION_KO = "\uad6d\ud68c\uc608\uc0b0\uc815\ucc45\ucc98";
