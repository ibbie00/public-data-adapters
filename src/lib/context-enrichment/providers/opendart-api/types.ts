import type { ProviderFetchLike } from "../fetch-with-retry";

export type OpenDartProviderStatus =
  | "OK"
  | "NOT_FOUND"
  | "INVALID_QUERY"
  | "MISSING_CREDENTIALS"
  | "PROVIDER_DISABLED"
  | "EXTERNAL_API_ERROR"
  | "PARSE_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT";

export type OpenDartRawResult = Record<string, unknown> & {
  __checkedAt?: string;
  __provider?: "opendart";
  __query?: string;
  __status?: OpenDartProviderStatus;
};

export type OpenDartSearchStatusResult = {
  checkedAt: string;
  provider: "opendart";
  results: OpenDartRawResult[];
  status: OpenDartProviderStatus;
};

export type OpenDartApiProviderOptions = {
  fetchImpl?: ProviderFetchLike;
  now?: () => Date;
};

export type OpenDartParsedQuery = {
  bgnDe: string;
  corpCode?: string;
  endDe: string;
  keyword?: string;
  rceptNo?: string;
};

export class OpenDartProviderError extends Error {
  readonly status: OpenDartProviderStatus;

  constructor(status: OpenDartProviderStatus, message: string) {
    super(message);
    this.name = "OpenDartProviderError";
    this.status = status;
  }
}
