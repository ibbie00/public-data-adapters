import { clean, normalizeRows } from "./parse";
import type { KosisTableMatch } from "./types";

// 표 id 로 보이는 질의. 사람이 쓴 지표명과 가르는 선이다.
//
// `parseKosisQuery` 가 받는 모양(`101:DT_1J22042`, 또는 기본 기관이 정해진 환경에서
// `DT_1J22042`)은 검색을 거치지 않는다. 그쪽은 이미 표를 아는 질의다.
//
// ⚠️ 밑줄을 요구하는 것이 이 선의 전부다. `parseKosisQuery` 는 `KOSIS_DEFAULT_ORG_ID`
// 가 있으면 영숫자 아무 낱말이나 표 id 로 받는데, 규칙이 걸어내는 검색어에는 `GDP`
// 처럼 영문 지표명이 있다(context-need-planner/rules.ts 의 통계 규칙). 그것을 표 id 로
// 읽으면 조회가 반드시 빈손으로 돌아온다. 실제 표 id 는 `DT_1J22042` 처럼 밑줄을 낀다
// (실측 2026-08-18 에 검색이 돌려준 여덟 표가 모두 그랬다).
const TABLE_ID_PATTERN = /^[A-Za-z0-9_]+\s*[:/]\s*[A-Za-z0-9_./-]+$|^[A-Za-z0-9]+_[A-Za-z0-9_./-]+$/;

// 검색어로 쓰기에 너무 짧은 질의. 한 글자는 어떤 통계표에나 걸린다.
const MIN_SEARCH_TERM_LENGTH = 2;

export function looksLikeKosisTableId(query: string) {
  return TABLE_ID_PATTERN.test(query.trim());
}

export function canSearchKosisTables(query: string) {
  const trimmed = query.trim();

  return trimmed.length >= MIN_SEARCH_TERM_LENGTH && !looksLikeKosisTableId(trimmed);
}

// 검색 응답에서 표를 고른다.
//
// ⚠️ 첫 번째 하나만 쓴다. 검색은 늘 스무 건쯤 돌려주는데(실측 2026-08-18: "소비자물가"
// 20건, "고용률" 20건) 그것을 다 조회하면 표 하나에 외부 호출이 스무 번이다. 무엇이
// 가장 맞는 표인지는 우리가 아니라 채점기가 가리는 일이고, 채점기는 이미 그 자리에 있다.
// 후보를 늘리는 것은 채점기가 첫 번째를 계속 떨어뜨린다는 실측이 나온 다음 일이다.
export function pickKosisTableMatch(payload: unknown): KosisTableMatch | null {
  for (const row of normalizeRows(payload)) {
    const record = row as Record<string, unknown>;
    const orgId = clean(record.ORG_ID);
    const tableId = clean(record.TBL_ID);

    if (orgId && tableId) {
      return {
        orgId,
        tableId,
        tableName: clean(record.TBL_NM) || null
      };
    }
  }

  return null;
}

// 축의 총계 항목을 알아보는 이름들. 코드가 `00` 인 것이 관례이고, 이름 쪽은 그 관례가
// 깨진 표를 위한 두 번째 그물이다.
const TOTAL_ITEM_NAME_PATTERN = /^(계|전국|합계|총계|전체)$/;

// 표의 분류축마다 무엇을 고를 것인가.
//
// 두 가지를 한꺼번에 푼다.
//
// 하나. **축 개수.** 조회 URL 은 축 개수만큼 objL 을 정확히 요구한다. 하나 모자라면
// `필수요청변수값이 누락되었습니다. (objL)`, 하나 넘치면 `잘못된 요청 변수를 호출
// 하였습니다`(실측 2026-08-18, DT_1DA7105S). 그래서 추측하지 않고 메타에서 읽는다.
//
// 둘. **축을 다 펼치지 않는다.** 예전 코드는 objL1 에 `ALL` 을 넣었는데, 축이 여럿인 표에서
// 그것은 곱집합을 통째로 받겠다는 뜻이다. 합계출산율 표(DT_1B81A17)는 지역 축이 384개이고
// 항목이 8개라 응답이 한도를 넘어 `SAFE_FETCH_RESPONSE_TOO_LARGE` 로 죽었다(실측 2026-08-18).
// 카드에 필요한 것은 대표값 하나이지 모든 지역·연령 조합이 아니다.
//
// 메타는 항목(`OBJ_ID: "ITEM"`)과 분류축을 한 배열에 섞어서 준다. 분류축 행만 `OBJ_ID_SN`
// 을 들고 있고 그 값이 축 번호다. 축마다 총계 항목을 고르고, 없으면 그 축의 첫 항목을 쓴다.
export function parseKosisObjSelections(payload: unknown): string[] {
  const totals = new Map<number, string>();
  let maxLevel = 0;

  for (const row of normalizeRows(payload)) {
    const record = row as Record<string, unknown>;
    const serial = Number.parseInt(clean(record.OBJ_ID_SN), 10);
    const itemId = clean(record.ITM_ID);

    if (!Number.isFinite(serial) || serial < 1 || !itemId) {
      continue;
    }

    maxLevel = Math.max(maxLevel, serial);
    if (
      !totals.has(serial) &&
      (itemId === "00" || TOTAL_ITEM_NAME_PATTERN.test(clean(record.ITM_NM)))
    ) {
      totals.set(serial, itemId);
    }
  }

  if (maxLevel === 0) {
    return [];
  }

  const selections: string[] = [];
  for (let level = 1; level <= maxLevel; level += 1) {
    // ⚠️ 총계가 없는 축은 통째로 받는다. 첫 항목으로 대신하면 안 된다. 축이 계층인 표가
    // 있고(DT_2KAAD34 는 국가 축의 첫 항목이 "아시아" 라는 그룹 머리다) 그 머리를 objL 에
    // 넣으면 `잘못된 요청 변수를 호출 하였습니다`(err 21) 로 조회 자체가 죽는다. 즉 이
    // 폴백은 응답 크기를 아끼려다 결과를 0 으로 만드는 쪽이었다(실측 2026-08-18: 이
    // 규칙을 넣자 가계부채가 OK 에서 EXTERNAL_API_ERROR 로 퇴행했다).
    selections.push(totals.get(level) ?? "ALL");
  }

  return selections;
}
