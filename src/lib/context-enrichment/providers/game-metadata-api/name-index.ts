import gameNameIndex from "../../../../data/context-work-names/games.json";

// 글에 쓰인 한국어 게임 이름을 영문 이름으로 바꾼다.
//
// 왜 필요한가. RAWG 는 **영문 이름만 안다**(실측 2026-08-18: `Stardew Valley` 는 찾고
// `스타듀 밸리` 는 못 찾는다. `젤다의 전설` 은 엉뚱한 게임을 준다). 사람은 한국어로 쓴다.
//
// ⚠️ 통계 갈래와 다르다. 거기서는 "사전이 필요하다" 가 틀렸고 기관 API 가 이미 이름 검색을
// 제공하고 있었다. 게임은 세 곳을 다 재 보고 사전이 필요하다고 판단했다.
// 목록을 다시 굽는 명령: npm run ai:context-game-names:refresh

// 글에서 찾기에 너무 짧은 이름. 두 글자 이름은 아무 문장에나 들어 있다.
const MIN_NAME_LENGTH = 3;

type GameNamePair = { english: string; korean: string };

// 긴 이름부터 본다. "젤다의 전설" 과 "젤다의 전설: 브레스 오브 더 와일드" 가 둘 다 있을 때
// 글에 긴 쪽이 적혀 있으면 그것이 맞는 답이다.
const SORTED_NAMES: GameNamePair[] = [...(gameNameIndex.names as GameNamePair[])]
  .filter((pair) => pair.korean.length >= MIN_NAME_LENGTH && pair.english)
  .sort((left, right) => right.korean.length - left.korean.length);

const BY_KOREAN = new Map(SORTED_NAMES.map((pair) => [pair.korean, pair.english]));
const BY_ENGLISH = new Map(
  // 영문에서 한국어로 되돌릴 때는 먼저 등록된 것을 쓴다. 같은 영문 이름에 한국어가 여럿
  // 달리는 경우가 있는데(판본 표기 차이) 그중 무엇을 고를지는 여기서 정할 일이 아니다.
  [...SORTED_NAMES].reverse().map((pair) => [pair.english.toLowerCase(), pair.korean])
);

export function findGameNameInText(text: string): GameNamePair | null {
  for (const pair of SORTED_NAMES) {
    if (text.includes(pair.korean)) {
      return pair;
    }
  }

  return null;
}

export function toEnglishGameName(koreanName: string) {
  return BY_KOREAN.get(koreanName.trim()) ?? null;
}

// 영문 이름을 한국어 표기로 되돌린다. 카드에 무엇을 적을지 고르는 쪽에서 쓴다.
export function toKoreanGameName(englishName: string) {
  return BY_ENGLISH.get(englishName.trim().toLowerCase()) ?? null;
}

export function getGameNameIndexRetrievedAt() {
  return gameNameIndex.retrievedAt;
}

export function getGameNameIndexSize() {
  return SORTED_NAMES.length;
}
