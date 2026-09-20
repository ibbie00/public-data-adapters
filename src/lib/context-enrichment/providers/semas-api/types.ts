import type { ProviderFetchLike } from "../fetch-with-retry";

export type SemasProviderStatus =
  | "OK"
  | "NOT_FOUND"
  // The post named no district, so there is nothing honest to ask for. See
  // lib/context-enrichment/region-mention.ts.
  | "INVALID_QUERY"
  | "INVALID_CREDENTIALS"
  | "MISSING_CREDENTIALS"
  | "PROVIDER_DISABLED"
  | "EXTERNAL_API_ERROR"
  | "PARSE_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT";

export type SemasRawResult = Record<string, unknown> & {
  __checkedAt?: string;
  __provider?: "semas";
  __query?: string;
};

export type SemasSearchStatusResult = {
  checkedAt: string;
  provider: "semas";
  results: SemasRawResult[];
  status: SemasProviderStatus;
};

export type SemasApiProviderOptions = {
  fetchImpl?: ProviderFetchLike;
  now?: () => Date;
};

export class SemasProviderError extends Error {
  readonly status: SemasProviderStatus;

  constructor(status: SemasProviderStatus, message: string) {
    super(message);
    this.name = "SemasProviderError";
    this.status = status;
  }
}

export const SEMAS_PROVIDER_TYPE = "statistics" as const;
