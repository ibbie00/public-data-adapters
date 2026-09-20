import {
  fetchContextProviderJson,
  getDefaultContextProviderHttpStatus,
  type ProviderFetchLike
} from "../fetch-with-retry";
import { DEFAULT_USER_AGENT } from "./constants";
import {
  NewsMediaProviderError,
  type NewsMediaProviderStatus
} from "./types";

export async function fetchJson(input: {
  env: NodeJS.ProcessEnv;
  fetchImpl: ProviderFetchLike;
  init?: RequestInit;
  url: URL;
}): Promise<unknown> {
  return fetchContextProviderJson({
    env: input.env,
    fallbackError: () => new NewsMediaProviderError("EXTERNAL_API_ERROR", "NEWS_MEDIA_FETCH_FAILED"),
    fetchImpl: input.fetchImpl,
    headers: {
      accept: "application/json",
      "user-agent": DEFAULT_USER_AGENT
    },
    init: input.init,
    isProviderError: (error) => error instanceof NewsMediaProviderError,
    responseError: (response) => {
      const status = getDefaultContextProviderHttpStatus<NewsMediaProviderStatus>(response, {
        externalApiError: "EXTERNAL_API_ERROR",
        invalidCredentials: "INVALID_CREDENTIALS",
        notFound: "NOT_FOUND",
        rateLimited: "RATE_LIMITED"
      });

      return status ? new NewsMediaProviderError(status, `NEWS_MEDIA_HTTP_${response.status}`) : null;
    },
    timeoutError: () => new NewsMediaProviderError("TIMEOUT", "NEWS_MEDIA_TIMEOUT"),
    url: input.url
  });
}
