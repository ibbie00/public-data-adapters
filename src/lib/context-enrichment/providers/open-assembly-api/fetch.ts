import {
  fetchContextProviderJsonWithRetry,
  isProviderRetryDisabled,
  type ProviderFetchLike
} from "../fetch-with-retry";
import { DEFAULT_USER_AGENT } from "./constants";
import { OpenAssemblyProviderError } from "./types";

export function fetchOpenAssemblyResponse(input: {
  env: NodeJS.ProcessEnv;
  fetchImpl: ProviderFetchLike;
  url: URL;
}) {
  return fetchContextProviderJsonWithRetry({
    env: input.env,
    fallbackErrorMessage: "OPEN_ASSEMBLY_API_FETCH_FAILED",
    fetchImpl: input.fetchImpl,
    headers: {
      accept: "application/json",
      "user-agent": input.env.OPEN_ASSEMBLY_USER_AGENT?.trim() || DEFAULT_USER_AGENT
    },
    retryCount: isProviderRetryDisabled(input.env) ? 0 : 1,
    timeoutError: () => new OpenAssemblyProviderError("TIMEOUT", "OPEN_ASSEMBLY_API_TIMEOUT"),
    url: input.url
  });
}
