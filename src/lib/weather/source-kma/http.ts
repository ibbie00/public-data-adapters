export function buildUrl(
  baseUrl: string,
  path: string,
  key: string,
  params: Record<string, string>
): URL {
  const url = new URL(baseUrl + path);
  url.searchParams.set("serviceKey", key);
  url.searchParams.set("dataType", "JSON");
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, value);
  }
  return url;
}

export type AdvisoryFetchLike = (url: URL, init: RequestInit) => Promise<Response>;

export async function fetchJson(
  url: URL,
  timeoutMs: number,
  // 테스트에서 갈아 끼우는 자리. 맥락 제공자도 자기 fetch 를 넘긴다(그쪽은 예산·재시도
  // 정책이 붙은 fetch 를 쓴다). 안 넘기면 예전 그대로 전역 fetch 다.
  fetchImpl: AdvisoryFetchLike = fetch
): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
