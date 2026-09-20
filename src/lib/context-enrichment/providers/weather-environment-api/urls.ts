// ⚠️ `serviceKey` 다. 이 제공자가 부르는 URL 은 기상청 특보 하나이고(lib/weather/source-kma),
// 그 키는 query parameter 로 나간다. 예전에는 OpenWeatherMap 의 `appid` 를 지웠는데, 그 자료를
// 2026-08-18 에 검색 경로에서 뺀 뒤로는 지울 것이 하나도 없는 함수였다.
export function redactWeatherEnvironmentUrl(input: URL | string) {
  const url = new URL(String(input));

  for (const param of ["serviceKey"]) {
    if (url.searchParams.has(param)) {
      url.searchParams.set(param, "REDACTED");
    }
  }

  return url.toString();
}
