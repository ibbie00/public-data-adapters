import type { ContextProviderType } from "../../types";
import type { ContextProviderTelemetrySink } from "../../guards";
import type { ProviderFetchLike } from "../fetch-with-retry";

export type NationalLawTarget = "law" | "ordin";

export type NationalLawProviderStatus =
  | "OK"
  | "NOT_FOUND"
  | "INVALID_QUERY"
  | "MISSING_CREDENTIALS"
  | "PROVIDER_DISABLED"
  | "EXTERNAL_API_ERROR"
  | "PARSE_ERROR"
  | "VALIDATION_FAILED"
  | "RATE_LIMITED"
  | "TIMEOUT";

export type NationalLawRawResult = Record<string, unknown> & {
  __checkedAt?: string;
  __colloquialAliases?: string[];
  __officialName?: string;
  __provider?: "national_law";
  __shortName?: string;
  __status?: NationalLawProviderStatus;
  __notFoundReason?: string;
};

export type NationalLawSearchStatusResult = {
  checkedAt: string;
  notFoundReason?: string;
  provider: "national_law";
  results: NationalLawRawResult[];
  status: NationalLawProviderStatus;
};

export type NationalLawApiProviderOptions = {
  fetchImpl?: ProviderFetchLike;
  now?: () => Date;
  providerType: Extract<ContextProviderType, "law" | "ordinance">;
  telemetry?: ContextProviderTelemetrySink;
};

export class NationalLawProviderError extends Error {
  readonly status: NationalLawProviderStatus;

  constructor(status: NationalLawProviderStatus, message: string) {
    super(message);
    this.name = "NationalLawProviderError";
    this.status = status;
  }
}
