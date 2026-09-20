import type { ContextProviderType } from "../../types";
import type { ProviderFetchLike } from "../fetch-with-retry";

export type NaboPublicationProviderType = Extract<ContextProviderType, "policy_report" | "legislative_library">;

export type NaboPublicationProviderStatus =
  | "OK"
  | "NOT_FOUND"
  | "INVALID_QUERY"
  | "MISSING_CREDENTIALS"
  | "PROVIDER_DISABLED"
  | "EXTERNAL_API_ERROR"
  | "PARSE_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT";

export type NaboPublicationRawResult = Record<string, unknown> & {
  __checkedAt?: string;
  __endpoint?: "report" | "periodical";
  __provider?: "nabo_publication";
  __query?: string;
  __status?: NaboPublicationProviderStatus;
};

export type NaboPublicationSearchStatusResult = {
  checkedAt: string;
  provider: "nabo_publication";
  results: NaboPublicationRawResult[];
  status: NaboPublicationProviderStatus;
};

export type NaboPublicationApiProviderOptions = {
  fetchImpl?: ProviderFetchLike;
  now?: () => Date;
  providerType?: NaboPublicationProviderType;
};

export class NaboPublicationProviderError extends Error {
  readonly status: NaboPublicationProviderStatus;

  constructor(status: NaboPublicationProviderStatus, message: string) {
    super(message);
    this.name = "NaboPublicationProviderError";
    this.status = status;
  }
}
