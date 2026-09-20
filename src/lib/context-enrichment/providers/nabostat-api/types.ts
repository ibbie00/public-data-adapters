import type { ProviderFetchLike } from "../fetch-with-retry";

export type NabostatProviderStatus =
  | "OK"
  | "NOT_FOUND"
  | "INVALID_QUERY"
  | "MISSING_CREDENTIALS"
  | "PROVIDER_DISABLED"
  | "EXTERNAL_API_ERROR"
  | "PARSE_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT";

export type NabostatRawResult = Record<string, unknown> & {
  __checkedAt?: string;
  __provider?: "nabostat";
  __status?: NabostatProviderStatus;
  __tableId?: string;
};

export type NabostatSearchStatusResult = {
  checkedAt: string;
  provider: "nabostat";
  results: NabostatRawResult[];
  status: NabostatProviderStatus;
};

// 지표명 검색이 찾아 준 표. `cycleCodes` 는 조회에 넣어 볼 주기 코드 후보다.
export type NabostatTableMatch = {
  cycleCodes: string[];
  tableId: string;
  tableName: string | null;
};

export type NabostatApiProviderOptions = {
  fetchImpl?: ProviderFetchLike;
  now?: () => Date;
};

export class NabostatProviderError extends Error {
  readonly status: NabostatProviderStatus;

  constructor(status: NabostatProviderStatus, message: string) {
    super(message);
    this.name = "NabostatProviderError";
    this.status = status;
  }
}
