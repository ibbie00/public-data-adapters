import type { ProviderFetchLike } from "../fetch-with-retry";

export type OpenAssemblyProviderStatus =
  | "OK"
  | "NOT_FOUND"
  | "INVALID_QUERY"
  | "MISSING_CREDENTIALS"
  | "PROVIDER_DISABLED"
  | "EXTERNAL_API_ERROR"
  | "PARSE_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT";

export type OpenAssemblyBillRawResult = Record<string, unknown> & {
  __checkedAt?: string;
  __provider?: "open_assembly";
  __serviceId?: string;
  __status?: OpenAssemblyProviderStatus;
};

export type OpenAssemblySearchStatusResult = {
  checkedAt: string;
  provider: "open_assembly";
  results: OpenAssemblyBillRawResult[];
  status: OpenAssemblyProviderStatus;
};

export type OpenAssemblyApiProviderOptions = {
  fetchImpl?: ProviderFetchLike;
  now?: () => Date;
};

export class OpenAssemblyProviderError extends Error {
  readonly status: OpenAssemblyProviderStatus;

  constructor(status: OpenAssemblyProviderStatus, message: string) {
    super(message);
    this.name = "OpenAssemblyProviderError";
    this.status = status;
  }
}
