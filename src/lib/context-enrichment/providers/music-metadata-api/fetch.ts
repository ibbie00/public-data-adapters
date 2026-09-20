import {
  fetchContextProviderJson,
  getDefaultContextProviderHttpStatus,
  type ProviderFetchLike
} from "../fetch-with-retry";
import { DEFAULT_USER_AGENT } from "./constants";
import {
  MusicMetadataProviderError,
  type MusicMetadataProviderStatus
} from "./types";

export async function fetchJson(input: {
  env: NodeJS.ProcessEnv;
  fetchImpl: ProviderFetchLike;
  init?: RequestInit;
  url: URL;
}): Promise<unknown> {
  return fetchContextProviderJson({
    env: input.env,
    fallbackError: () =>
      new MusicMetadataProviderError(
        "EXTERNAL_API_ERROR",
        "MUSIC_METADATA_FETCH_FAILED"
      ),
    fetchImpl: input.fetchImpl,
    headers: {
      accept: "application/json",
      "user-agent": DEFAULT_USER_AGENT
    },
    init: input.init,
    isProviderError: (error) => error instanceof MusicMetadataProviderError,
    responseError: (response) => {
      const status = getDefaultContextProviderHttpStatus<MusicMetadataProviderStatus>(
        response,
        {
          externalApiError: "EXTERNAL_API_ERROR",
          invalidCredentials: "INVALID_CREDENTIALS",
          notFound: "NOT_FOUND",
          rateLimited: "RATE_LIMITED"
        }
      );

      return status
        ? new MusicMetadataProviderError(
            status,
            `MUSIC_METADATA_HTTP_${response.status}`
          )
        : null;
    },
    timeoutError: () =>
      new MusicMetadataProviderError("TIMEOUT", "MUSIC_METADATA_TIMEOUT"),
    url: input.url
  });
}
