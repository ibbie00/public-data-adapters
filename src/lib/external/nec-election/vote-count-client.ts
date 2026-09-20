import { getNecServiceKey, requestNecOpenApi } from "./request";
import type {
  NecClientOptions,
  NecCountingStatusParams,
  NecVoteCountClient,
  NecVoteStatusParams
} from "./types";

const DEFAULT_VOTE_COUNT_BASE_URL = "https://apis.data.go.kr/9760000/VoteXmntckInfoInqireService2";

function getBaseUrl(options: NecClientOptions = {}) {
  return options.baseUrl ??
    options.env?.NEC_VOTE_COUNT_API_BASE_URL?.trim() ??
    process.env.NEC_VOTE_COUNT_API_BASE_URL?.trim() ??
    DEFAULT_VOTE_COUNT_BASE_URL;
}

function requestVoteCount(endpoint: string, params: Record<string, string | number | undefined>, options: NecClientOptions = {}) {
  const env = options.env ?? process.env;
  const serviceKey = getNecServiceKey("VoteXmntckInfoInqireService2", env);

  return requestNecOpenApi({
    baseUrl: getBaseUrl(options),
    endpoint,
    options,
    params,
    service: "VoteXmntckInfoInqireService2",
    serviceKey
  });
}

export function createNecVoteCountClient(options: NecClientOptions = {}): NecVoteCountClient {
  return {
    fetchCountingStatus(params: NecCountingStatusParams) {
      return requestVoteCount("/getXmntckSttusInfoInqire", params, options);
    },
    fetchVoteStatus(params: NecVoteStatusParams) {
      return requestVoteCount("/getVoteSttusInfoInqire", params, options);
    }
  };
}
