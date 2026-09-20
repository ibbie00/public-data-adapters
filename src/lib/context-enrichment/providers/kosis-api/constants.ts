import { contextEnrichmentUserAgent } from "../user-agent";

export const PROVIDER_TYPE = "statistics" as const;
export const PROVIDER_ID = "kosis";
export const KOSIS_API_BASE_URL = "https://kosis.kr/openapi/Param/statisticsParameterData.do";
// 지표명으로 통계표를 찾는다. 위 조회 URL 은 표 id 를 이미 아는 상태에서 값을 가져오는
// 자리라 한글 지표명이 통하지 않는다(2026-08-17 실측에서 INVALID_QUERY 6건).
export const KOSIS_SEARCH_URL = "https://kosis.kr/openapi/statisticsSearch.do";
// 표의 분류축이 몇 개인지 알려준다. 표마다 다르고, 조회 URL 은 그 개수만큼 objL 을
// 정확히 요구한다(모자라면 err 20, 넘치면 err 21).
export const KOSIS_META_URL = "https://kosis.kr/openapi/statisticsData.do";
export const DEFAULT_USER_AGENT =
  contextEnrichmentUserAgent("KOSIS statistics smoke");
export const SOURCE_NAME_KO = "\ud1b5\uacc4\uccad KOSIS \uad6d\uac00\ud1b5\uacc4\ud3ec\ud138";
export const SOURCE_INSTITUTION_KO = "\ud1b5\uacc4\uccad";
