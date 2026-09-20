import {
  MissingNecCommonCodeApiKeyError,
  MissingNecPollingPlaceApiKeyError,
  MissingNecVoteCountApiKeyError
} from "./errors";
import type {
  NecClientOptions,
  NecElectionService
} from "./types";

export const DEFAULT_TIMEOUT_MS = 8000;
export const DEFAULT_USER_AGENT =
  process.env.PUBLIC_DATA_ADAPTERS_USER_AGENT?.trim() ||
  "public-data-adapters/0.1 (NEC election metadata; https://github.com/ibbie00/public-data-adapters)";
// numOfRows defaults to 10, but the election-code scan asks for 200 and vote
// counts return a row per candidate per constituency. Records are short code
// tuples rather than prose, so 1 MiB covers the widest page these services
// serve with room to spare, while staying an order of magnitude under the
// catalog-sized GRAC cap.
export const MAX_RESPONSE_BYTES = 1024 * 1024;

export function getFetchImpl(fetchImpl?: NecClientOptions["fetchImpl"]) {
  return fetchImpl ?? (fetch as unknown as NonNullable<NecClientOptions["fetchImpl"]>);
}

export function getNecServiceKey(service: NecElectionService, env: NodeJS.ProcessEnv = process.env) {
  if (service === "CommonCodeService") {
    const key = env.NEC_COMMON_CODE_API_SERVICE_KEY?.trim();
    if (!key) {
      throw new MissingNecCommonCodeApiKeyError();
    }
    return key;
  }
  if (service === "PolplcInfoInqireService2") {
    const key = env.NEC_POLLING_PLACE_API_SERVICE_KEY?.trim();
    if (!key) {
      throw new MissingNecPollingPlaceApiKeyError();
    }
    return key;
  }

  const key = env.NEC_VOTE_COUNT_API_SERVICE_KEY?.trim();
  if (!key) {
    throw new MissingNecVoteCountApiKeyError();
  }
  return key;
}
