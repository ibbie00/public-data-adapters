import type { ProviderFetchLike } from "../fetch-with-retry";

export type EcosProviderStatus =
  | "OK"
  | "NOT_FOUND"
  | "INVALID_QUERY"
  | "MISSING_CREDENTIALS"
  | "PROVIDER_DISABLED"
  | "EXTERNAL_API_ERROR"
  | "PARSE_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT";

export type EcosRawResult = Record<string, unknown> & {
  __checkedAt?: string;
  __mode?: "key-statistics" | "statistic-search";
  __provider?: "ecos";
  __query?: string;
  __status?: EcosProviderStatus;
};

export type EcosSearchStatusResult = {
  checkedAt: string;
  provider: "ecos";
  results: EcosRawResult[];
  status: EcosProviderStatus;
};

export type EcosApiProviderOptions = {
  fetchImpl?: ProviderFetchLike;
  now?: () => Date;
};

export type EcosParsedQuery =
  | { mode: "key-statistics" }
  | {
    cycle: string;
    end: string;
    itemCode?: string;
    mode: "statistic-search";
    start: string;
    statCode: string;
  };

// 굽어 둔 목록에서 이름으로 찾은 표. `tableName` 은 사람이 읽는 이름이라 고를 때와
// 테스트에만 쓴다.
export type EcosTableMatch = {
  cycle: string;
  statCode: string;
  tableName: string;
};

export class EcosProviderError extends Error {
  readonly status: EcosProviderStatus;

  constructor(status: EcosProviderStatus, message: string) {
    super(message);
    this.name = "EcosProviderError";
    this.status = status;
  }
}
