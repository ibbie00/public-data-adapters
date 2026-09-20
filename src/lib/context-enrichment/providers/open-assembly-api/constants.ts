import { contextEnrichmentUserAgent } from "../user-agent";

export const PROVIDER_TYPE = "bill" as const;
export const PROVIDER_ID = "open_assembly";
export const OPEN_ASSEMBLY_BASE_URL = "https://open.assembly.go.kr/portal/openapi";
export const DEFAULT_BILL_SERVICE_ID = "nzmimeepazxkubdpn";
export const DEFAULT_USER_AGENT = contextEnrichmentUserAgent("bill metadata");
export const SOURCE_NAME_KO = "\uc5f4\ub9b0\uad6d\ud68c\uc815\ubcf4";
export const SOURCE_INSTITUTION_KO = "\uad6d\ud68c\uc0ac\ubb34\ucc98";
