import ecosTableIndex from "../../../../data/context-stat-tables/ecos.json";
import type { EcosTableMatch } from "./types";

// 굽어 둔 ECOS 통계표 목록에서 지표명으로 표를 찾는다.
//
// 통계 제공자 셋 중 ECOS 만 이름으로 표를 찾는 길이 없다. KOSIS 와 NABOSTAT 은 서버가
// 걸러 주는데 `StatisticTableList` 에는 검색어 자리가 없다(2026-08-18 확인). 목록이
// 834개로 작으니 받아 두고 우리 쪽에서 맞춘다.
// 목록을 다시 굽는 명령: npm run ai:context-ecos-tables:refresh

// 검색어로 쓰기에 너무 짧은 낱말. 한 글자는 아무 표 이름에나 걸린다.
//
// ⚠️ 세 글자로 잡았다가 되돌렸다. 한국어 경제 지표명은 두 글자가 흔하고(환율, 물가,
// 금리) 규칙이 걸어내는 낱말도 그 모양이다. 세 글자면 "환율" 이 통째로 빠진다.
const MIN_TERM_LENGTH = 2;

// 주기별 기간 형식. 실측 2026-08-18 에 여섯 주기를 형식 후보와 다 맞춰 봤다.
//
// ⚠️ `SM`(반월)은 어느 형식도 통하지 않아 뺐다. 굽은 목록 609개 중 그 주기는 하나뿐이라
// 지금 이것을 푸는 값이 없다. 빼면 그 표는 안 골리고, 고르면 반드시 실패한다.
//
// ⚠️ 기간을 최근으로 좁히는 것이 중요하다. 조회는 범위의 **앞에서부터** 돌려주므로
// (실측: 2015~2026 을 물으면 2015 년 값이 첫 행이다) 범위를 넓게 잡으면 카드에 몇 년 전
// 숫자가 실린다.
const CYCLE_WINDOWS: Record<string, { format: (date: Date, offset: number) => string; span: number }> = {
  A: {
    format: (date, offset) => String(date.getUTCFullYear() - offset),
    span: 3
  },
  D: {
    format: (date, offset) => {
      const shifted = new Date(date);
      shifted.setUTCDate(shifted.getUTCDate() - offset);
      return [
        shifted.getUTCFullYear(),
        String(shifted.getUTCMonth() + 1).padStart(2, "0"),
        String(shifted.getUTCDate()).padStart(2, "0")
      ].join("");
    },
    span: 14
  },
  M: {
    format: (date, offset) => {
      const shifted = new Date(date);
      shifted.setUTCMonth(shifted.getUTCMonth() - offset);
      return `${shifted.getUTCFullYear()}${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
    },
    span: 12
  },
  Q: {
    format: (date, offset) => {
      const quarters = date.getUTCFullYear() * 4 + Math.floor(date.getUTCMonth() / 3) - offset;
      return `${Math.floor(quarters / 4)}Q${(quarters % 4) + 1}`;
    },
    span: 4
  },
  S: {
    format: (date, offset) => {
      const halves = date.getUTCFullYear() * 2 + Math.floor(date.getUTCMonth() / 6) - offset;
      return `${Math.floor(halves / 2)}S${(halves % 2) + 1}`;
    },
    span: 2
  }
};

export function isSupportedEcosCycle(cycle: string | null | undefined): cycle is string {
  return Boolean(cycle && cycle in CYCLE_WINDOWS);
}

export function buildEcosPeriod(cycle: string, now: Date) {
  const window = CYCLE_WINDOWS[cycle];

  if (!window) {
    return null;
  }

  return {
    end: window.format(now, 0),
    start: window.format(now, window.span)
  };
}

// 질의에서 표 이름과 맞을 만한 낱말을 뽑는다.
//
// planner 는 규칙이 걸어낸 낱말을 공백으로 이어 넘긴다("소비자물가 통계청"). 그 문자열
// 통째로는 어떤 표 이름에도 안 들어 있으므로 낱말로도 각각 맞춰 본다. 긴 낱말이 먼저다.
// 구체적인 낱말일수록 엉뚱한 표에 걸릴 확률이 낮다.
function candidateTerms(query: string) {
  const trimmed = query.trim();
  const words = trimmed.split(/\s+/).filter((word) => word.length >= MIN_TERM_LENGTH);

  return [...new Set([trimmed, ...words.sort((left, right) => right.length - left.length)])].filter(
    (term) => term.length >= MIN_TERM_LENGTH
  );
}

// 이름으로 표를 찾는다.
//
// 여럿이 걸리면 **이름이 가장 짧은 것**을 고른다. "소비자물가" 는 세 표에 걸리는데
// (소비자물가지수 / 소비자물가지수(특수분류) / 국제 주요국 소비자물가지수) 사람이 그냥
// 물가를 말했을 때 뜻하는 것은 첫째다. 이름이 길수록 조건이 붙은 표다.
export function findEcosTableByName(query: string): EcosTableMatch | null {
  for (const term of candidateTerms(query)) {
    let best: EcosTableMatch | null = null;

    for (const table of ecosTableIndex.tables) {
      if (!isSupportedEcosCycle(table.cycle) || !table.name.includes(term)) {
        continue;
      }
      if (!best || table.name.length < best.tableName.length) {
        best = { cycle: table.cycle, statCode: table.code, tableName: table.name };
      }
    }

    if (best) {
      return best;
    }
  }

  return null;
}

export function getEcosTableIndexRetrievedAt() {
  return ecosTableIndex.retrievedAt;
}
