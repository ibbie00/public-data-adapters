import type { ProviderFetchLike } from "../fetch-with-retry";
import type { WeatherAdvisoryMatch } from "./advisory";

export type WeatherEnvironmentProviderStatus =
  | "OK"
  | "NOT_FOUND"
  | "INVALID_QUERY"
  | "INVALID_CREDENTIALS"
  | "MISSING_CREDENTIALS"
  | "PROVIDER_DISABLED"
  | "EXTERNAL_API_ERROR"
  | "PARSE_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT";

// 갈래가 하나다. 기상청 특보는 전국 발효 목록으로 오고 우리는 고르지 않는다(advisory.ts).
//
// ⚠️ 2026-08-19까지 여기에 `openweathermap` 갈래가 함께 있었다. 그 자료를 만들던 코드는
// 2026-08-18에 사라졌는데(도시가 필수라 글에서 지명을 뽑아야 했고, 그것이 글쓴이 위치 추론
// 이다) 타입과 정규화는 남아 도달할 수 없는 갈래가 되었다. `provider` 를 리터럴로 남겨 두는
// 것은 자산 행에 그대로 실리는 값이기 때문이고, 지역 없이 답할 수 있는 자료가 더 생기면
// 그때 다시 union 이 된다.
export type WeatherEnvironmentRawResult = {
  advisory: WeatherAdvisoryMatch;
  checkedAt?: string;
  provider: "kma_advisory";
  query?: string;
  status?: WeatherEnvironmentProviderStatus;
};

export type WeatherEnvironmentSearchStatusResult = {
  checkedAt: string;
  provider: "weather_environment";
  results: WeatherEnvironmentRawResult[];
  status: WeatherEnvironmentProviderStatus;
};

export type WeatherEnvironmentApiProviderOptions = {
  fetchImpl?: ProviderFetchLike;
  now?: () => Date;
};

export class WeatherEnvironmentProviderError extends Error {
  readonly status: WeatherEnvironmentProviderStatus;

  constructor(status: WeatherEnvironmentProviderStatus, message: string) {
    super(message);
    this.name = "WeatherEnvironmentProviderError";
    this.status = status;
  }
}
