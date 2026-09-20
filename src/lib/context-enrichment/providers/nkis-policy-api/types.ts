import type { ProviderFetchLike } from "../fetch-with-retry";

export type NkisPolicyProviderStatus =
  | "OK"
  | "NOT_FOUND"
  | "INVALID_QUERY"
  | "MISSING_CREDENTIALS"
  | "PROVIDER_DISABLED"
  | "EXTERNAL_API_ERROR"
  | "PARSE_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT";

export type NkisPolicyRawResult = Record<string, unknown> & {
  __checkedAt?: string;
  __provider?: "nkis_policy";
  __query?: string;
  __status?: NkisPolicyProviderStatus;
};

export type NkisPolicySearchStatusResult = {
  checkedAt: string;
  provider: "nkis_policy";
  results: NkisPolicyRawResult[];
  status: NkisPolicyProviderStatus;
};

export type NkisPolicyApiProviderOptions = {
  fetchImpl?: ProviderFetchLike;
  now?: () => Date;
};

export class NkisPolicyProviderError extends Error {
  readonly status: NkisPolicyProviderStatus;

  constructor(status: NkisPolicyProviderStatus, message: string) {
    super(message);
    this.name = "NkisPolicyProviderError";
    this.status = status;
  }
}
