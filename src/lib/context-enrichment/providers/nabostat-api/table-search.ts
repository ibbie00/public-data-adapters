import { clean } from "./parse";
import { looksLikeTableId } from "./query";
import type { NabostatTableMatch } from "./types";

// 검색어로 쓰기에 너무 짧은 질의. 한 글자는 아무 표에나 걸린다.
const MIN_SEARCH_TERM_LENGTH = 2;

// 목록이 주는 주기 이름과 조회가 요구하는 주기 코드의 대응.
//
// 목록(`Sttsapitbl.do`)은 `DTACYCLE_NM` 을 "년" 처럼 사람 말로 주는데, 값 조회
// (`Sttsapitbldata.do`)는 `DTACYCLE_CD` 를 코드로 요구한다. 그 사이를 잇는 표가 응답
// 어디에도 없어서 실측으로 만들었다(2026-08-18, 주기 이름 일곱 가지를 코드 일곱 개와
// 다 맞춰 봤다).
const CYCLE_NAME_TO_CODE: Array<[RegExp, string]> = [
  [/년|연간/, "YY"],
  [/분기/, "QY"],
  [/월/, "MM"]
];

export function canSearchNabostatTables(query: string) {
  const trimmed = query.trim();

  return trimmed.length >= MIN_SEARCH_TERM_LENGTH && !looksLikeTableId(trimmed);
}

// 검색에 넣어 볼 낱말 후보.
//
// ⚠️ NABOSTAT 의 `STATBL_NM` 은 문자열을 통째로 맞춰 본다. planner 가 넘기는 검색어는
// 규칙이 걸어낸 낱말을 공백으로 이은 것이라("소비자물가 통계청") 그대로 던지면 0건이다
// (실측 2026-08-18: 통째로는 NOT_FOUND, "소비자물가" 만은 OK). KOSIS 는 같은 문자열을
// 잘 받으므로 이 쪼개기는 이 제공자에만 있다.
//
// 긴 낱말이 먼저다. 구체적인 낱말일수록 엉뚱한 표에 걸릴 확률이 낮다.
export function nabostatSearchTerms(query: string) {
  const trimmed = query.trim();
  const words = trimmed
    .split(/\s+/)
    .filter((word) => word.length >= MIN_SEARCH_TERM_LENGTH)
    .sort((left, right) => right.length - left.length);

  return [...new Set([trimmed, ...words])].filter(
    (term) => term.length >= MIN_SEARCH_TERM_LENGTH
  );
}

// 주기 이름에서 조회에 쓸 코드 후보를 뽑는다.
//
// ⚠️ 이름이 하나가 아니다. 표 539개 중 마흔넷이 "년,분기,월" 처럼 여럿을 들고 있고,
// 그 경우 이름에 적힌 주기가 모두 통하지는 않는다(실측: "분기,월" 표는 QY 만, "년,분기,월"
// 표는 MM 만 답했다). 그래서 하나를 골라 단정하지 않고 순서대로 시도할 후보로 돌려준다.
// 순서는 년 > 분기 > 월이다. 카드에 쓰기 좋은 것은 연간 값이고, 표 539개 중 495개가
// 년 하나뿐이라 대부분 첫 후보에서 끝난다.
export function parseNabostatCycleCodes(dataCycleName: string): string[] {
  const codes: string[] = [];

  for (const [pattern, code] of CYCLE_NAME_TO_CODE) {
    if (pattern.test(dataCycleName) && !codes.includes(code)) {
      codes.push(code);
    }
  }

  return codes;
}

// 목록 응답에서 표 하나를 고른다.
//
// ⚠️ 목록은 값 조회와 응답 봉투가 다르다(`Sttsapitbl` 대 `Sttsapitbldata`). parse.ts 의
// normalizeRows 는 값 조회 쪽만 알아보므로 여기서 따로 벗긴다.
export function pickNabostatTableMatch(payload: unknown): NabostatTableMatch | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const service = (payload as Record<string, unknown>).Sttsapitbl;
  const containers = Array.isArray(service) ? service : [];

  for (const container of containers) {
    if (!container || typeof container !== "object") {
      continue;
    }

    const rows = (container as Record<string, unknown>).row;

    for (const row of Array.isArray(rows) ? rows : []) {
      if (!row || typeof row !== "object") {
        continue;
      }

      const record = row as Record<string, unknown>;
      const tableId = clean(record.STATBL_ID);

      if (tableId) {
        return {
          cycleCodes: parseNabostatCycleCodes(clean(record.DTACYCLE_NM)),
          tableId,
          tableName: clean(record.STATBL_NM) || null
        };
      }
    }
  }

  return null;
}
