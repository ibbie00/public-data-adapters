import type { ProviderFetchLike } from "../fetch-with-retry";

export type NewsMediaProviderStatus =
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

export type GuardianArticle = Record<string, unknown> & {
  id?: string;
  sectionName?: string;
  webPublicationDate?: string;
  webTitle?: string;
  webUrl?: string;
};

export type NytArticle = Record<string, unknown> & {
  abstract?: string;
  headline?: { main?: string };
  pub_date?: string;
  section_name?: string;
  uri?: string;
  web_url?: string;
};

export type NewsApiArticle = Record<string, unknown> & {
  description?: string;
  publishedAt?: string;
  source?: { name?: string };
  title?: string;
  url?: string;
};

export type NewsMediaRawResult = {
  checkedAt?: string;
  provider: "guardian" | "nyt" | "newsapi";
  query?: string;
  result: GuardianArticle | NytArticle | NewsApiArticle;
  status?: NewsMediaProviderStatus;
};

export type NewsMediaSearchStatusResult = {
  checkedAt: string;
  provider: "news_media";
  results: NewsMediaRawResult[];
  status: NewsMediaProviderStatus;
};

// 뉴스 provider 는 fallback 사슬이다(guardian → nyt → newsapi). 첫 호출의 예산은
// 호출자가 예약하지만, 사슬이 두 번째·세 번째 API까지 내려가면 추가 과금 호출이
// 생긴다. 그 추가분의 예약은 이 패키지 밖(호출자의 rate-limit 원장)의 일이므로
// 옵션으로 주입받는다. 주입이 없으면 추가 호출을 하지 않는다(fail-closed): 예산을
// 셀 수 없으면 사슬을 멈추는 것이 과금을 모르고 쓰는 것보다 낫다.
export type ReserveExtraNewsCall = () => Promise<{ allowed: boolean }> | { allowed: boolean };

export type NewsMediaApiProviderOptions = {
  fetchImpl?: ProviderFetchLike;
  now?: () => Date;
  reserveExtraCall?: ReserveExtraNewsCall;
};

export class NewsMediaProviderError extends Error {
  readonly status: NewsMediaProviderStatus;

  constructor(status: NewsMediaProviderStatus, message: string) {
    super(message);
    this.name = "NewsMediaProviderError";
    this.status = status;
  }
}
