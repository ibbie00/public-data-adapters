import {
  KOSIS_API_BASE_URL,
  KOSIS_META_URL,
  KOSIS_SEARCH_URL
} from "./constants";

export function redactKosisUrl(url: URL | string) {
  const parsed = typeof url === "string" ? new URL(url) : new URL(url.toString());

  if (parsed.searchParams.has("apiKey")) {
    parsed.searchParams.set("apiKey", "REDACTED");
  }

  return parsed.toString();
}

// KOSIS 표의 분류축 개수. 표마다 다르고, 조회는 그 개수만큼 objL 을 정확히 요구한다.
// 하나 모자라면 `필수요청변수값이 누락되었습니다. (objL)`, 하나 넘치면 `잘못된 요청
// 변수를 호출 하였습니다`. 그래서 추측하지 않고 메타에서 읽는다.
export const KOSIS_MAX_OBJ_LEVELS = 8;

export function buildKosisUrl(input: {
  apiKey: string;
  limit: number;
  // 축마다 무엇을 받을지. 빈 배열이면 축 하나를 통째로 받는다(메타를 못 읽었을 때의
  // 예전 거동이다).
  objSelections: string[];
  orgId: string;
  prdSe: string;
  tableId: string;
}) {
  const url = new URL(KOSIS_API_BASE_URL);
  const selections = input.objSelections.length > 0
    ? input.objSelections.slice(0, KOSIS_MAX_OBJ_LEVELS)
    : ["ALL"];

  url.searchParams.set("method", "getList");
  url.searchParams.set("apiKey", input.apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("jsonVD", "Y");
  url.searchParams.set("orgId", input.orgId);
  url.searchParams.set("tblId", input.tableId);
  url.searchParams.set("itmId", "ALL");
  selections.forEach((selection, index) => {
    url.searchParams.set(`objL${index + 1}`, selection);
  });
  url.searchParams.set("prdSe", input.prdSe);
  url.searchParams.set("newEstPrdCnt", String(input.limit));
  url.searchParams.set("prdInterval", "1");

  return url;
}

export function buildKosisSearchUrl(input: { apiKey: string; term: string }) {
  const url = new URL(KOSIS_SEARCH_URL);

  url.searchParams.set("method", "getList");
  url.searchParams.set("apiKey", input.apiKey);
  url.searchParams.set("searchNm", input.term);
  url.searchParams.set("format", "json");
  url.searchParams.set("jsonVD", "Y");

  return url;
}

export function buildKosisMetaUrl(input: {
  apiKey: string;
  orgId: string;
  tableId: string;
}) {
  const url = new URL(KOSIS_META_URL);

  url.searchParams.set("method", "getMeta");
  url.searchParams.set("apiKey", input.apiKey);
  url.searchParams.set("orgId", input.orgId);
  url.searchParams.set("tblId", input.tableId);
  url.searchParams.set("type", "ITM");
  url.searchParams.set("format", "json");
  url.searchParams.set("jsonVD", "Y");

  return url;
}
