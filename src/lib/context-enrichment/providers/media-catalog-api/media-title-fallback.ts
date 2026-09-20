// LLM 기반 제목 추출은 이 패키지 밖에서 주입한다.
// 패키지는 외부 LLM 클라이언트(OpenAI 호환 엔드포인트, 프롬프트 저장소, JSON 파서)에
// 의존하지 않는다. 호출자는 enabled()로 켜짐 여부를, extract()로 실제 추출을 제공한다.
// extract()가 null을 돌려주면 규칙 기반 검색 결과만 쓰던 원래 동작으로 조용히 돌아간다.

export type MediaTitleLlmExtractor = (
  text: string,
  env: NodeJS.ProcessEnv
) => Promise<string | null>;

export type MediaTitleLlmFallback = {
  enabled: (env: NodeJS.ProcessEnv) => boolean;
  extract: MediaTitleLlmExtractor;
};
