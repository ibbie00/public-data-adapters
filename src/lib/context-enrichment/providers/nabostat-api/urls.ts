import { NABOSTAT_API_BASE_URL } from "./constants";

export function redactNabostatUrl(url: URL | string) {
  const parsed = typeof url === "string" ? new URL(url) : new URL(url.toString());

  if (parsed.searchParams.has("KEY")) {
    parsed.searchParams.set("KEY", "REDACTED");
  }

  return parsed.toString();
}

// 지표명으로 표를 찾는다. 값 조회 URL 은 표 id 를 이미 아는 자리라 이름이 통하지 않는다.
export function buildNabostatSearchUrl(input: {
  key: string;
  limit: number;
  term: string;
}) {
  const url = new URL(`${NABOSTAT_API_BASE_URL}/Sttsapitbl.do`);

  url.searchParams.set("KEY", input.key);
  url.searchParams.set("Type", "json");
  url.searchParams.set("pIndex", "1");
  url.searchParams.set("pSize", String(input.limit));
  url.searchParams.set("STATBL_NM", input.term);

  return url;
}

export function buildNabostatUrl(input: {
  dataCycle: string;
  key: string;
  limit: number;
  tableId: string;
}) {
  const url = new URL(`${NABOSTAT_API_BASE_URL}/Sttsapitbldata.do`);

  url.searchParams.set("KEY", input.key);
  url.searchParams.set("Type", "json");
  url.searchParams.set("pIndex", "1");
  url.searchParams.set("pSize", String(input.limit));
  url.searchParams.set("STATBL_ID", input.tableId);
  url.searchParams.set("DTACYCLE_CD", input.dataCycle);

  return url;
}
