import {
  fetchContextProviderJson,
  getDefaultContextProviderHttpStatus,
  type ProviderFetchLike
} from "../fetch-with-retry";
import { DEFAULT_USER_AGENT } from "./constants";
import {
  MediaCatalogProviderError,
  type MediaCatalogProviderStatus
} from "./types";

export async function fetchJson(input: {
  env: NodeJS.ProcessEnv;
  fetchImpl: ProviderFetchLike;
  url: URL;
}): Promise<unknown> {
  return fetchContextProviderJson({
    env: input.env,
    fallbackError: () =>
      new MediaCatalogProviderError(
        "EXTERNAL_API_ERROR",
        "MEDIA_CATALOG_FETCH_FAILED"
      ),
    fetchImpl: input.fetchImpl,
    headers: {
      accept: "application/json",
      "user-agent": DEFAULT_USER_AGENT
    },
    isProviderError: (error) => error instanceof MediaCatalogProviderError,
    responseError: (response) => {
      const status = getDefaultContextProviderHttpStatus<MediaCatalogProviderStatus>(
        response,
        {
          externalApiError: "EXTERNAL_API_ERROR",
          invalidCredentials: "INVALID_CREDENTIALS",
          notFound: "NOT_FOUND",
          rateLimited: "RATE_LIMITED"
        }
      );

      return status
        ? new MediaCatalogProviderError(
            status,
            `MEDIA_CATALOG_HTTP_${response.status}`
          )
        : null;
    },
    timeoutError: () =>
      new MediaCatalogProviderError("TIMEOUT", "MEDIA_CATALOG_TIMEOUT"),
    url: input.url
  });
}
