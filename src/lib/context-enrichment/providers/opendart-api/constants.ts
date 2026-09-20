import { contextEnrichmentUserAgent } from "../user-agent";

export const PROVIDER_TYPE = "corporate_disclosure" as const;
export const PROVIDER_ID = "opendart";
export const OPENDART_API_BASE_URL =
  "https://opendart.fss.or.kr/api/list.json";
export const OPENDART_DISCLOSURE_BASE_URL =
  "https://dart.fss.or.kr/dsaf001/main.do";
export const DEFAULT_USER_AGENT =
  contextEnrichmentUserAgent("OpenDART disclosure context");
export const SOURCE_NAME_KO = "OpenDART \uae30\uc5c5\uacf5\uc2dc";
export const SOURCE_INSTITUTION_KO =
  "\uae08\uc735\uac10\ub3c5\uc6d0 \uc804\uc790\uacf5\uc2dc\uc2dc\uc2a4\ud15c";

export const BUILT_IN_CORP_CODES: Record<string, string> = {
  "samsung electronics": "00126380",
  "\uc0bc\uc131": "00126380",
  "\uc0bc\uc131\uc804\uc790": "00126380"
};
