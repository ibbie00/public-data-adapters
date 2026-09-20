import type {
  NecElectionApiError,
  NecElectionService,
  NecRequestParams
} from "./types";

const DATA_GO_KR_RETRYABLE_CODES = new Set([
  "22",
  "99",
  "UNKNOWN_ERROR"
]);

const NEC_RETRYABLE_CODES = new Set([
  "ERROR-500",
  "UNKNOWN_ERROR"
]);

const SENSITIVE_PARAM_KEYS = new Set(["serviceKey", "key", "apiKey", "authKey"]);

export class MissingNecCommonCodeApiKeyError extends Error {
  constructor() {
    super("NEC_COMMON_CODE_API_SERVICE_KEY is required for CommonCodeService");
    this.name = "MissingNecCommonCodeApiKeyError";
  }
}

export class MissingNecVoteCountApiKeyError extends Error {
  constructor() {
    super("NEC_VOTE_COUNT_API_SERVICE_KEY is required for VoteXmntckInfoInqireService2");
    this.name = "MissingNecVoteCountApiKeyError";
  }
}

export class MissingNecPollingPlaceApiKeyError extends Error {
  constructor() {
    super("NEC_POLLING_PLACE_API_SERVICE_KEY is required for PolplcInfoInqireService2");
    this.name = "MissingNecPollingPlaceApiKeyError";
  }
}

export class NecOpenApiRequestError extends Error {
  detail: NecElectionApiError;

  constructor(detail: NecElectionApiError) {
    super(detail.message);
    this.name = "NecOpenApiRequestError";
    this.detail = detail;
  }
}

export function sanitizeNecParams(params: NecRequestParams) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      SENSITIVE_PARAM_KEYS.has(key) && value ? "REDACTED" : value
    ])
  );
}

export function redactNecUrl(input: URL | string) {
  const url = new URL(String(input));

  for (const key of SENSITIVE_PARAM_KEYS) {
    if (url.searchParams.has(key)) {
      url.searchParams.set(key, "REDACTED");
    }
  }

  return url.toString();
}

export function isNecErrorRetryable(input: {
  code?: string;
  httpStatus?: number;
  network?: boolean;
}) {
  if (input.network) {
    return true;
  }
  if (typeof input.httpStatus === "number") {
    return input.httpStatus === 429 || input.httpStatus >= 500;
  }

  const code = input.code?.trim();
  if (!code) {
    return false;
  }

  return DATA_GO_KR_RETRYABLE_CODES.has(code) || NEC_RETRYABLE_CODES.has(code);
}

export function buildNecApiError(input: {
  code?: string;
  endpoint: string;
  httpStatus?: number;
  message: string;
  network?: boolean;
  params: NecRequestParams;
  service: NecElectionService;
}): NecElectionApiError {
  return {
    code: input.code,
    endpoint: input.endpoint,
    message: input.message,
    provider: "NEC",
    retryable: isNecErrorRetryable({
      code: input.code,
      httpStatus: input.httpStatus,
      network: input.network
    }),
    sanitizedParams: sanitizeNecParams(input.params),
    service: input.service
  };
}
