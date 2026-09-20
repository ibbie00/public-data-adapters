import type { ProviderFetchLike } from "../fetch-with-retry";
import {
  getGuardianApiKey,
  getNewsApiKey,
  getNytApiKey
} from "./env";
import { fetchJson } from "./fetch";
import {
  getGuardianResults,
  getNewsApiResults,
  getNytResults
} from "./parse";
import type { NewsMediaRawResult } from "./types";
import {
  buildGuardianUrl,
  buildNewsApiUrl,
  buildNytUrl
} from "./urls";

type SearchInput = {
  env: NodeJS.ProcessEnv;
  fetchImpl: ProviderFetchLike;
  limit: number;
  query: string;
};

export async function searchGuardian(input: SearchInput): Promise<Omit<NewsMediaRawResult, "checkedAt">[]> {
  const payload = await fetchJson({
    env: input.env,
    fetchImpl: input.fetchImpl,
    url: buildGuardianUrl({ apiKey: getGuardianApiKey(input.env), limit: input.limit, query: input.query })
  });

  return getGuardianResults(payload).map((result) => ({
    provider: "guardian" as const,
    query: input.query,
    result,
    status: "OK" as const
  }));
}

export async function searchNyt(input: SearchInput): Promise<Omit<NewsMediaRawResult, "checkedAt">[]> {
  const payload = await fetchJson({
    env: input.env,
    fetchImpl: input.fetchImpl,
    url: buildNytUrl({ apiKey: getNytApiKey(input.env), limit: input.limit, query: input.query })
  });

  return getNytResults(payload).slice(0, input.limit).map((result) => ({
    provider: "nyt" as const,
    query: input.query,
    result,
    status: "OK" as const
  }));
}

export async function searchNewsApi(input: SearchInput): Promise<Omit<NewsMediaRawResult, "checkedAt">[]> {
  const payload = await fetchJson({
    env: input.env,
    fetchImpl: input.fetchImpl,
    url: buildNewsApiUrl({ apiKey: getNewsApiKey(input.env), limit: input.limit, query: input.query })
  });

  return getNewsApiResults(payload).map((result) => ({
    provider: "newsapi" as const,
    query: input.query,
    result,
    status: "OK" as const
  }));
}
