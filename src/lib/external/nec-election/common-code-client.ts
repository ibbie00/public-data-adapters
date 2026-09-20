import { getNecServiceKey, requestNecOpenApi } from "./request";
import type {
  NecClientOptions,
  NecCommonCodeClient,
  NecConstituencyCodeParams,
  NecDistrictCodeParams,
  NecListParams,
  NecSgIdParams
} from "./types";

const DEFAULT_COMMON_CODE_BASE_URL = "https://apis.data.go.kr/9760000/CommonCodeService";

function getBaseUrl(options: NecClientOptions = {}) {
  return options.baseUrl ??
    options.env?.NEC_COMMON_CODE_API_BASE_URL?.trim() ??
    process.env.NEC_COMMON_CODE_API_BASE_URL?.trim() ??
    DEFAULT_COMMON_CODE_BASE_URL;
}

function requestCommonCode(endpoint: string, params: Record<string, string | number | undefined>, options: NecClientOptions = {}) {
  const env = options.env ?? process.env;
  const serviceKey = getNecServiceKey("CommonCodeService", env);

  return requestNecOpenApi({
    baseUrl: getBaseUrl(options),
    endpoint,
    options,
    params,
    service: "CommonCodeService",
    serviceKey
  });
}

export function createNecCommonCodeClient(options: NecClientOptions = {}): NecCommonCodeClient {
  return {
    fetchConstituencyCodes(params: NecConstituencyCodeParams) {
      return requestCommonCode("/getCommonSggCodeList", params, options);
    },
    fetchDistrictCodes(params: NecDistrictCodeParams) {
      return requestCommonCode("/getCommonGusigunCodeList", params, options);
    },
    fetchEducationCodes(params: NecSgIdParams) {
      return requestCommonCode("/getCommonEduBckgrdCodeList", params, options);
    },
    fetchElectionCodes(params: NecListParams = {}) {
      return requestCommonCode("/getCommonSgCodeList", params, options);
    },
    fetchJobCodes(params: NecSgIdParams) {
      return requestCommonCode("/getCommonJobCodeList", params, options);
    },
    fetchPartyCodes(params: NecSgIdParams) {
      return requestCommonCode("/getCommonPartyCodeList", params, options);
    }
  };
}
