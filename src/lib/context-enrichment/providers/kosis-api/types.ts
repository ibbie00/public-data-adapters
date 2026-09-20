import type { ProviderFetchLike } from "../fetch-with-retry";

export type KosisProviderStatus =
  | "OK"
  | "NOT_FOUND"
  | "INVALID_QUERY"
  | "MISSING_CREDENTIALS"
  | "PROVIDER_DISABLED"
  | "EXTERNAL_API_ERROR"
  | "PARSE_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT";

export type KosisRawResult = Record<string, unknown> & {
  __checkedAt?: string;
  __orgId?: string;
  __provider?: "kosis";
  __status?: KosisProviderStatus;
  __tableId?: string;
};

export type KosisSearchStatusResult = {
  checkedAt: string;
  provider: "kosis";
  results: KosisRawResult[];
  status: KosisProviderStatus;
};

export type KosisApiProviderOptions = {
  fetchImpl?: ProviderFetchLike;
  now?: () => Date;
};

export type KosisParsedQuery = {
  orgId: string;
  tableId: string;
};

// 지표명 검색이 찾아 준 표. `tableName` 은 사람이 읽는 이름이라 로그와 테스트에만 쓴다.
export type KosisTableMatch = {
  orgId: string;
  tableId: string;
  tableName: string | null;
};

export class KosisProviderError extends Error {
  readonly status: KosisProviderStatus;

  constructor(status: KosisProviderStatus, message: string) {
    super(message);
    this.name = "KosisProviderError";
    this.status = status;
  }
}
