import { isEnabledOrConfiguredEnv } from "../../config";

// 자연 문장을 통째로 KMDb/OMDb에 넣으면 제목 키워드 검색이 0건이 된다.
// 사람들이 영화/드라마를 언급하는 다양한 한국어 구조에서 "제목으로 보이는 토막"을
// 우선순위대로 뽑아 후보 리스트를 만든다. KMDb가 실제 제목만 매칭하므로 코멘트성
// 토막은 0건으로 자정되고, 흔한 코멘트 단어(명작/진짜/장면 등)는 후보에서 제외해
// 엉뚱한 작품에 매칭되는 것을 줄인다. 우선순위: 따옴표 > "X라는" > 장르어 단서 > 본문 토막.

// 제목에 잘 들어가지 않는 흔한 코멘트 어휘 (조사/종결 제거 후 기준). 여기 있는 어절은
// 후보 경계(boundary)로 취급해, 연속한 비-경계 어절 묶음만 제목 후보로 본다.
const TITLE_BOUNDARY_WORDS = new Set<string>([
  // 시간·정도 부사
  "어제", "오늘", "내일", "요즘", "요새", "예전", "그때", "방금", "이번", "저번", "올해", "작년",
  "최근", "당시", "주말", "주중", "평일", "다시", "또", "진짜", "정말", "너무", "완전", "그냥",
  "솔직히", "아무리", "결국", "드디어", "한참", "역시", "무조건", "이제야", "아직도", "거의", "막",
  "좀", "왜", "와", "아", "어", "음",
  // 지시·대명사
  "그", "이", "저", "이거", "이건", "그거", "저거", "그게", "이게", "요거", "그건", "다들", "나",
  "난", "내", "넌", "니", "우리", "사람", "사람들", "분", "누가", "뭐", "뭔가", "뭘", "다", "무슨",
  "어떤", "그런", "이런", "저런", "무엇", "뭐지", "뭐였지", "뭐냐", "언제", "어디", "누구",
  "다음", "정도", "일본", "한국", "미국", "중국", "영국", "프랑스", "독일",
  // 평가·메타 명사 (분명한 코멘트)
  "명작", "띵작", "갓작", "수작", "범작", "망작", "졸작", "인생", "최고", "최애", "레전드", "강추",
  "천재", "명불허전", "수준", "퀄", "작화", "연기", "장면", "엔딩", "결말", "서사", "케미", "미모",
  "떡밥", "스포", "후기", "리뷰", "평점", "호불호",
  // 장르·플랫폼·제작
  "영화", "드라마", "애니메이션", "애니", "웹툰", "만화", "다큐멘터리", "다큐", "시리즈", "예능",
  "영화관", "극장", "넷플릭스", "넷플", "디즈니플러스", "디플", "왓챠", "티빙", "쿠팡플레이", "본방",
  "정주행", "개봉", "재개봉", "원작", "제작", "제작사", "감독", "배우", "주연", "출연", "추천", "별로",
  // 흔한 서술·연결 (어절 통째)
  "봤는데", "봤다", "봤어", "봤음", "봤을", "봤고", "보고", "보는데", "보다가", "보다", "본", "봐도",
  "봐", "보러", "보면서", "보면", "볼", "볼만한", "볼까", "재밌었는데", "재밌었다", "재밌었어요",
  "재밌게", "재밌네요", "재밌던데", "재밌고", "재밌어", "재밌음", "재미", "좋았어요", "좋았다", "좋아",
  "좋네요", "좋고", "좋은", "울었다", "울었어", "울", "웃겼다", "처음", "마지막", "그래도", "그러고",
  "근데", "그런데", "하지만", "그리고", "아무튼", "암튼",
  // 감탄·자모
  "ㅋㅋ", "ㅋㅋㅋ", "ㅎㅎ", "ㅠㅠ", "ㄷㄷ", "ㅇㅇ"
]);

const GENRE_WORDS = "영화|드라마|애니메이션|애니|웹툰|만화|다큐멘터리|시리즈";
const QUOTED_TITLE = /["'「『《〈“‘]([^"'「『《〈“‘」』》〉”’]{1,40})["'」』》〉”’]/gu;
const NAMED_TITLE = /([가-힣A-Za-z0-9][^.!?\n]{0,29}?)(?:이라는|라는|이라고|라고)/gu;
const TITLE_BEFORE_GENRE = new RegExp(`([가-힣A-Za-z0-9][^.!?\\n]{0,29}?)\\s*(?:${GENRE_WORDS})`, "gu");
const GENRE_BEFORE_TITLE = new RegExp(`(?:${GENRE_WORDS})\\s*(?:는|은|이|가)?\\s*([가-힣A-Za-z0-9][^.!?\\n]{0,29}?)(?:[.!?…]|$)`, "gu");
const TRAILING_PARTICLE = /(?:으로|로서|로써|로|에서|에게|한테|께서|께|보다|처럼|같이|까지|부터|마저|조차|이랑|랑|와|과|은|는|이|가|을|를|도|만|의)$/u;
const TRAILING_ENDING = /(?:이라니|라니|이라고|라고|이라는|라는|이다|이야|예요|이에요|입니다|이네요|이네|구나|군요|군|거든요|거든|더라고요|더라고|더라|래요|래|대요|대|이지|지요|지|죠|네요|네|임|이었|였|다)$/u;
const LEADING_PUNCTUATION = /^[(\[\{"'「『《〈“‘]+/u;
const TRAILING_PUNCTUATION = /[)\]\}.,!?…~"'」』》〉”’·:]+$/u;

function stripEdgePunctuation(token: string): string {
  return token.replace(LEADING_PUNCTUATION, "").replace(TRAILING_PUNCTUATION, "").trim();
}

// 끝의 조사/종결어미를 한 번씩 떼어 제목 토큰만 남긴다 (과하게 자르지 않도록 길이 가드).
function stripParticleAndEnding(token: string): string {
  let result = stripEdgePunctuation(token);
  const withoutParticle = result.replace(TRAILING_PARTICLE, "");
  if (withoutParticle.length >= 2) {
    result = withoutParticle;
  }
  const withoutEnding = result.replace(TRAILING_ENDING, "");
  if (withoutEnding.length >= 2) {
    result = withoutEnding;
  }
  return result.trim();
}

function isBoundaryToken(token: string): boolean {
  const bare = stripEdgePunctuation(token);
  if (TITLE_BOUNDARY_WORDS.has(bare)) {
    return true;
  }
  return TITLE_BOUNDARY_WORDS.has(stripParticleAndEnding(token));
}

// 단서 앞쪽의 제목(예: "영화는 OO")을 잡을 때: 앞에서부터 경계어가 아닌 어절만 모은다.
function leadingTitleTokens(span: string): string {
  const tokens = span.split(/\s+/).filter(Boolean);
  const collected: string[] = [];
  for (const token of tokens) {
    if (isBoundaryToken(token) || collected.length >= 5) {
      break;
    }
    collected.push(token);
  }
  return collected.join(" ");
}

// 단서 뒤쪽의 제목(예: "OO라는", "OO 영화")을 잡을 때: 뒤에서부터 경계어가 아닌 어절만 모은다.
function trailingTitleTokens(span: string): string {
  const tokens = span.split(/\s+/).filter(Boolean);
  const collected: string[] = [];
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    if (isBoundaryToken(tokens[index]!) || collected.length >= 5) {
      break;
    }
    collected.unshift(tokens[index]!);
  }
  return collected.join(" ");
}

function isUsableCandidate(value: string): boolean {
  return value.length >= 2 && !TITLE_BOUNDARY_WORDS.has(value);
}

// 우선순위(priority)와 등장 위치(position)로 정렬한 제목 후보 리스트를 만든다.
export function getMediaCatalogSearchQueries(query: string): string[] {
  const ranked: Array<{ value: string; priority: number; position: number }> = [];
  const seen = new Set<string>();
  const add = (rawValue: string, priority: number, position: number) => {
    const value = (rawValue || "").trim();
    if (!isUsableCandidate(value) || seen.has(value)) {
      return;
    }
    seen.add(value);
    ranked.push({ value, priority, position });
  };

  // 제목 후보를 추가하되, 원형과 조사/종결을 떼어낸 형을 모두 넣는다 (KMDb 매칭 폭을 넓힘).
  // "올드보이"처럼 제목이 조사처럼 끝나는("이") 경우 과도하게 깎이는 것을 원형이 보완한다.
  const addTitle = (raw: string, priority: number, position: number) => {
    add(raw, priority, position);
    add(stripParticleAndEnding(raw), priority, position);
  };

  for (const match of query.matchAll(QUOTED_TITLE)) {
    add(match[1]!.trim(), 0, match.index ?? 0);
  }
  for (const match of query.matchAll(NAMED_TITLE)) {
    const base = trailingTitleTokens(match[1]!.trim());
    addTitle(base, 1, match.index ?? 0);
    // "올드보이라는"이 "올드보" + "이라는"으로 끊길 수 있어, 끝에 "이"를 붙인 형도 후보로 둔다.
    const particle = match[0]!.slice(match[1]!.length);
    if (base && particle.startsWith("이")) {
      addTitle(`${base}이`, 1, match.index ?? 0);
    }
  }
  for (const match of query.matchAll(TITLE_BEFORE_GENRE)) {
    addTitle(trailingTitleTokens(match[1]!.trim()), 2, match.index ?? 0);
  }
  for (const match of query.matchAll(GENRE_BEFORE_TITLE)) {
    addTitle(leadingTitleTokens(match[1]!.trim()), 2, match.index ?? 0);
  }

  // 본문 토막(코멘트성 어구) 추측은 하지 않는다: KMDb 카탈로그가 방대·느슨해서
  // "주말"·"정도" 같은 흔한 단어도 무명 작품의 정확한 제목으로 매칭되어 오탐을 만든다.
  // 따옴표·"X라는"·장르어 인접 같은 명시적 단서가 있을 때만 제목으로 본다.

  // 단, 경계어가 하나도 없는 입력은 이미 제목에 가까운 정제된 질의(직접 검색·스모크 등)로
  // 보고 통째로 후보화한다. 코멘트가 섞인 자유 문장은 거의 항상 경계어를 포함하므로 제외된다.
  const queryTokens = query.split(/\s+/).filter(Boolean);
  if (queryTokens.length > 0 && !queryTokens.some((token) => isBoundaryToken(token))) {
    const whole = queryTokens.map(stripEdgePunctuation).filter(Boolean).join(" ");
    add(whole, 2, 0);
    add(stripParticleAndEnding(whole), 2, 0);
  }

  ranked.sort(
    (a, b) =>
      a.priority - b.priority ||
      a.position - b.position ||
      b.value.split(" ").length - a.value.split(" ").length
  );

  return ranked.map((candidate) => candidate.value).slice(0, 5);
}

export function getMediaCatalogSearchQuery(query: string): string {
  return getMediaCatalogSearchQueries(query)[0] ?? "";
}

// KMDb title 검색은 부분 일치가 너무 느슨해(예: "기생충" → "기생충을 예방하자") 코멘트 단어에도
// 엉뚱한 작품을 반환한다. 그래서 후보와 결과 제목이 충분히 일치하는 것만 채택한다.
// 정규화: !HS/HE 마커·괄호·공백·구두점 제거, 연도 접미사 "(2019)" 제거, 소문자화.
function normalizeTitleForMatch(value: string): string {
  return value
    .replace(/!HS|!HE/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s*\(\d{4}\)\s*$/u, "")
    // "제7광구"처럼 작품 번호 앞에 붙이는 "제"는 KMDb 정식명("7광구")에 없으므로 제거한다.
    .replace(/제(?=\d)/gu, "")
    .replace(/[\s:_\-·.,!?…~"'「」『』《》〈〉“”‘’()\[\]]/gu, "")
    .toLowerCase()
    .trim();
}

// 결과 제목이 질의 제목과 일치하는가: 정확 일치, 또는 한쪽이 다른 쪽으로 시작하고
// 나머지가 짧은 경우(후속편 "시즌2"·잔여 조사 등)만 인정한다. 그 외 느슨한 포함은 거부.
export function mediaTitleMatchesQuery(resultTitle: string, query: string): boolean {
  const title = normalizeTitleForMatch(resultTitle);
  const target = normalizeTitleForMatch(query);
  if (title.length < 2 || target.length < 2) {
    return false;
  }
  if (title === target) {
    return true;
  }
  if (title.startsWith(target) && title.length - target.length <= 4) {
    return true;
  }
  if (target.startsWith(title) && target.length - title.length <= 4) {
    return true;
  }
  return false;
}

export function getOmdbApiKey(env: NodeJS.ProcessEnv) {
  return env.OMDB_API_KEY?.trim() || "";
}

export function getKmdbApiKey(env: NodeJS.ProcessEnv) {
  return env.KMDB_API_KEY?.trim() || "";
}

export function isTvMazeEnabled(env: NodeJS.ProcessEnv) {
  return isEnabledOrConfiguredEnv(env.TVMAZE_CONTEXT_ENABLED);
}

export function hasAnyMediaCatalogCredential(env: NodeJS.ProcessEnv) {
  return Boolean(getKmdbApiKey(env) || getOmdbApiKey(env) || isTvMazeEnabled(env));
}
