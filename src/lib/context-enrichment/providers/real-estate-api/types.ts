import type { ProviderFetchLike } from "../fetch-with-retry";

export type RealEstateProviderStatus =
  | "OK"
  | "NOT_FOUND"
  | "INVALID_QUERY"
  | "INVALID_CREDENTIALS"
  | "MISSING_CREDENTIALS"
  | "EXTERNAL_API_ERROR"
  | "PARSE_ERROR"
  | "PROVIDER_DISABLED"
  | "RATE_LIMITED"
  | "TIMEOUT";

export type MolitRealEstateService = {
  apiKeyEnv: string;
  assetTitle: string;
  endpoint: string;
  kind: "apartment_trade" | "apartment_rent" | "row_house_trade" | "row_house_rent" | "detached_house_rent" | "officetel_rent";
  providerId: string;
  sourceName: string;
};

export type RealEstateRawResult = {
  checkedAt: string;
  dealMonth: string;
  dealYear: string;
  item: Record<string, unknown>;
  lawdCode: string;
  provider: "molit";
  query: string;
  service: MolitRealEstateService;
};

export type RealEstateSearchStatusResult = {
  checkedAt: string;
  provider: "real_estate";
  results: RealEstateRawResult[];
  status: RealEstateProviderStatus;
};

export type RealEstateApiProviderOptions = {
  fetchImpl?: ProviderFetchLike;
  now?: () => Date;
  timeoutMs?: number;
};

export class RealEstateProviderError extends Error {
  readonly status: RealEstateProviderStatus;

  constructor(status: RealEstateProviderStatus, message: string) {
    super(message);
    this.name = "RealEstateProviderError";
    this.status = status;
  }
}
