import { getContextProviderSearchLimit } from "../../guards";
import {
  fetchContextProviderJsonWithRetry,
  type ProviderFetchLike
} from "../fetch-with-retry";
import { getSearchQuery } from "./alias";
import { DEFAULT_USER_AGENT, LAW_API_BASE_URL } from "./constants";
import { NationalLawProviderError, type NationalLawTarget } from "./types";
import { getNationalLawReferer } from "./urls";

export function buildNationalLawSearchUrl({
  env,
  limit,
  query,
  target
}: {
  env: NodeJS.ProcessEnv;
  limit?: number;
  query: string;
  target: NationalLawTarget;
}) {
  const url = new URL(`${LAW_API_BASE_URL}/lawSearch.do`);
  url.searchParams.set("OC", env.LAW_OC ?? "");
  url.searchParams.set("target", target);
  url.searchParams.set("type", "JSON");
  url.searchParams.set("query", getSearchQuery(query));
  url.searchParams.set(
    "display",
    String(getContextProviderSearchLimit(limit, env))
  );

  return url;
}

export function buildNationalLawFetchByIdUrl({
  env,
  sourceIdentifier,
  target
}: {
  env: NodeJS.ProcessEnv;
  sourceIdentifier: string;
  target: NationalLawTarget;
}) {
  const url = new URL(`${LAW_API_BASE_URL}/lawService.do`);
  const [, identifierKind, identifierValue] = sourceIdentifier.split(":");
  url.searchParams.set("OC", env.LAW_OC ?? "");
  url.searchParams.set("target", target);
  url.searchParams.set("type", "JSON");

  if (identifierKind === "MST") {
    url.searchParams.set("MST", identifierValue);
  } else {
    url.searchParams.set("ID", identifierValue ?? sourceIdentifier);
  }

  return url;
}

export function fetchNationalLawProviderJson({
  env,
  fetchImpl,
  url
}: {
  env: NodeJS.ProcessEnv;
  fetchImpl: ProviderFetchLike;
  url: URL;
}) {
  const retryCount = Math.max(
    0,
    Math.min(2, Number(env.LAW_API_RETRY_COUNT ?? 1) || 0)
  );

  return fetchContextProviderJsonWithRetry({
    env,
    fallbackErrorMessage: "NATIONAL_LAW_API_FETCH_FAILED",
    fetchImpl,
    headers: {
      accept: "application/json, application/xml;q=0.9, text/xml;q=0.8",
      referer: getNationalLawReferer(env),
      "user-agent": env.LAW_USER_AGENT?.trim() || DEFAULT_USER_AGENT
    },
    retryCount,
    timeoutError: () =>
      new NationalLawProviderError("TIMEOUT", "NATIONAL_LAW_API_TIMEOUT"),
    url
  });
}
