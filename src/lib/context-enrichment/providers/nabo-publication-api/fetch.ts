import {
  fetchContextProviderJsonWithRetry,
  isProviderRetryDisabled,
  type ProviderFetchLike
} from "../fetch-with-retry";
import { DEFAULT_USER_AGENT } from "./constants";
import { NaboPublicationProviderError } from "./types";

export function fetchNaboPublicationResponse(input: {
  env: NodeJS.ProcessEnv;
  fetchImpl: ProviderFetchLike;
  url: URL;
}) {
  return fetchContextProviderJsonWithRetry({
    env: input.env,
    fallbackErrorMessage: "NABO_PUBLICATION_API_FETCH_FAILED",
    fetchImpl: input.fetchImpl,
    headers: {
      accept: "application/json",
      "user-agent": input.env.NABO_USER_AGENT?.trim() || DEFAULT_USER_AGENT
    },
    retryCount: isProviderRetryDisabled(input.env) ? 0 : 1,
    timeoutError: () => new NaboPublicationProviderError("TIMEOUT", "NABO_PUBLICATION_API_TIMEOUT"),
    url: input.url
  });
}
