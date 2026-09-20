import { getKmaAlertConfig } from "../../../weather/config";
import { fetchActiveAdvisories, tidyAdvisoryTitle } from "../../../weather/source-kma";
import type { ProviderFetchLike } from "../fetch-with-retry";

// 지역을 정하지 않고 답할 수 있는 날씨 자료.
//
// 왜 이렇게 하나. OpenWeatherMap 과 OpenUV 는 **둘 다 지역이 필수**다(도시명 또는 좌표).
// 그래서 예전 구현은 글에서 지명을 뽑으려 했고, 지명이 없는 글에는 아무것도 못 했다
// (실측 2026-08-18: `날씨` 도 `야외 행사` 도 NOT_FOUND, 통하는 것은 `서울 날씨` 하나였다).
//
// ⚠️ 그런데 글에서 지명을 뽑아 지역을 정하는 것은 **우리가 글쓴이의 위치를 추론하는 일**
// 이다(창업자 판단 2026-08-18: "지역 갈라주는 건 너무 위험하다"). 최소수집 원칙과 부딪히고,
// 틀리면 엉뚱한 곳의 날씨를 남의 글에 붙이게 된다.
//
// 기상청 특보 목록은 그 문제가 없다. **지역 파라미터가 아예 없고** 전국에 지금 무엇이
// 발효 중인지를 돌려준다. 우리는 고르지 않고 그대로 전한다.

export type WeatherAdvisoryMatch = {
  // 사람이 읽는 특보 제목. 기상청이 쓴 문장을 다듬기만 한 것이고 뜻은 안 바꾼다.
  headline: string;
  issuedAt: string;
  // 글이 말한 현상 중 이 특보와 맞은 낱말. 무엇 때문에 골랐는지 남긴다.
  matchedTerm: string | null;
};

// 글의 낱말과 특보 문구를 잇는 표.
//
// 사람이 쓰는 말과 기상청이 쓰는 말이 다르다. "미세먼지" 가 나쁜 날 기상청이 내는 것은
// 황사 특보이고, 야외 일정을 걱정하는 글에는 더위·비·바람이 다 걸린다.
const TERM_TO_ADVISORY_WORDS: Record<string, string[]> = {
  미세먼지: ["황사"],
  야외: ["폭염", "호우", "강풍", "한파", "대설"],
  초미세먼지: ["황사"]
};

// 기상청이 특보 제목에 쓰는 현상 이름.
//
// ⚠️ 낱말을 그대로 맞춰 보면 조사에 걸려 넘어진다. `폭염이` 는 `폭염주의보` 를 못 찾는다.
// 규칙이 캡처해서 넘기는 검색어에는 조사가 없지만(rules.ts) 이 제공자를 문장으로 부르는
// 자리가 생길 수 있으므로 여기서 현상 이름을 뽑아 쓴다.
const KNOWN_PHENOMENA = [
  "폭염", "한파", "호우", "태풍", "대설", "강풍", "풍랑", "건조", "황사", "열대야"
];

function advisoryWordsFor(term: string) {
  for (const [key, words] of Object.entries(TERM_TO_ADVISORY_WORDS)) {
    if (term.includes(key)) {
      return words;
    }
  }

  const known = KNOWN_PHENOMENA.filter((phenomenon) => term.includes(phenomenon));

  return known.length > 0 ? known : [term];
}

export function hasWeatherAdvisoryCredential(env: NodeJS.ProcessEnv) {
  return getKmaAlertConfig(env).hasKey;
}

// 전국 발효 특보 중 글이 말한 현상만 고른다.
//
// ⚠️ 같은 특보가 관측소마다 한 건씩 오므로(2026-08-18 실측: 폭염·열대야로 50건) 제목이
// 같은 것은 한 번만 남긴다. 카드에 같은 문장을 여러 번 실을 이유가 없고, 관측소를 구별해
// 보여 주면 그것이 곧 지역을 가르는 일이 된다.
export async function findWeatherAdvisories(input: {
  env: NodeJS.ProcessEnv;
  fetchImpl: ProviderFetchLike;
  limit: number;
  terms: string[];
}): Promise<WeatherAdvisoryMatch[]> {
  const { announcements } = await fetchActiveAdvisories({
    env: input.env,
    fetchImpl: (url, init) => input.fetchImpl(url, init)
  });
  const wanted = input.terms.flatMap((term) =>
    advisoryWordsFor(term).map((word) => ({ term, word }))
  );
  const byHeadline = new Map<string, WeatherAdvisoryMatch>();

  for (const announcement of announcements) {
    // ⚠️ 해제된 특보는 뺀다. 목록에는 발표와 해제가 같이 오는데(실측 2026-08-18: "호우주의보
    // 해제" 가 섞여 왔다) 해제는 지금 상황이 아니라 지나간 일이다. 글에 붙일 것은 지금
    // 발효 중인 것뿐이다.
    if (announcement.lifecycle === "LIFTED") {
      continue;
    }

    const headline = tidyAdvisoryTitle(announcement.rawTitle) || announcement.body;

    if (!headline) {
      continue;
    }

    const hit = wanted.find(({ word }) => headline.includes(word));

    // 글이 아무 현상도 짚지 않았으면(검색어가 비었으면) 전부 지나간다. 그 경우는 애초에
    // 계획이 서지 않으므로 여기까지 오지 않지만, 방어로 둔다.
    if (!hit) {
      continue;
    }
    if (!byHeadline.has(headline)) {
      byHeadline.set(headline, {
        headline,
        issuedAt: announcement.effectiveAt,
        matchedTerm: hit.term
      });
    }
  }

  return [...byHeadline.values()].slice(0, input.limit);
}
