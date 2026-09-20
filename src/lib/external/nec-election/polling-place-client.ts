import { getNecServiceKey, requestNecOpenApi } from "./request";
import type {
  NecClientOptions,
  NecPollingPlaceClient,
  NecPollingPlaceParams
} from "./types";

const DEFAULT_POLLING_PLACE_BASE_URL = "https://apis.data.go.kr/9760000/PolplcInfoInqireService2";

function getBaseUrl(options: NecClientOptions = {}) {
  return options.baseUrl ??
    options.env?.NEC_POLLING_PLACE_API_BASE_URL?.trim() ??
    process.env.NEC_POLLING_PLACE_API_BASE_URL?.trim() ??
    DEFAULT_POLLING_PLACE_BASE_URL;
}

function requestPollingPlace(
  endpoint: string,
  params: Record<string, string | number | undefined>,
  options: NecClientOptions = {}
) {
  const env = options.env ?? process.env;
  const serviceKey = getNecServiceKey("PolplcInfoInqireService2", env);

  return requestNecOpenApi({
    baseUrl: getBaseUrl(options),
    endpoint,
    options,
    params,
    service: "PolplcInfoInqireService2",
    serviceKey
  });
}

export function createNecPollingPlaceClient(options: NecClientOptions = {}): NecPollingPlaceClient {
  return {
    fetchElectionDayPollingPlaces(params: NecPollingPlaceParams) {
      return requestPollingPlace("/getPolplcOtlnmapTrnsportInfoInqire", params, options);
    },
    fetchEarlyVotingPollingPlaces(params: NecPollingPlaceParams) {
      return requestPollingPlace("/getPrePolplcOtlnmapTrnsportInfoInqire", params, options);
    }
  };
}
