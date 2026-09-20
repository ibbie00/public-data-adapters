import {
  fetchContextProviderJsonWithRetry,
  isProviderRetryDisabled,
  type ProviderFetchLike
} from "../fetch-with-retry";
import { DEFAULT_USER_AGENT } from "./constants";
import { KosisProviderError } from "./types";

export function fetchKosisResponse(input: {
  env: NodeJS.ProcessEnv;
  fetchImpl: ProviderFetchLike;
  url: URL;
}) {
  return fetchContextProviderJsonWithRetry({
    env: input.env,
    fallbackErrorMessage: "KOSIS_API_FETCH_FAILED",
    fetchImpl: input.fetchImpl,
    headers: {
      accept: "application/json",
      "user-agent": input.env.KOSIS_USER_AGENT?.trim() || DEFAULT_USER_AGENT
    },
    retryCount: isProviderRetryDisabled(input.env) ? 0 : 1,
    timeoutError: () => new KosisProviderError("TIMEOUT", "KOSIS_API_TIMEOUT"),
    url: input.url
  });
}
