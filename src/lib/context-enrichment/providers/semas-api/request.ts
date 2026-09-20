import { contextEnrichmentUserAgent } from "../user-agent";

import { isContextProviderEnabled } from "../../config";
import {
  evaluateContextProviderBudget,
  getContextProviderSearchLimit
} from "../../guards";
import type { ContextResearchProviderSearchOptions } from "../../types";
import {
  fetchContextProviderJson,
  getDefaultContextProviderHttpStatus,
  type ProviderFetchLike
} from "../fetch-with-retry";
import {
  SemasProviderError,
  type SemasProviderStatus,
  type SemasRawResult,
  type SemasSearchStatusResult
} from "./types";

import { resolveRegionCode } from "../../region-mention";

const ENDPOINT = "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInDong";
const DEFAULT_USER_AGENT = contextEnrichmentUserAgent("SEMAS commercial area metadata");

export function cleanSemasValue(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function getApiKey(env: NodeJS.ProcessEnv) {
  return env.SEMAS_STORE_API_KEY?.trim() || env.SEMAS_API_KEY?.trim() || "";
}

function inferDongCode(query: string, env: NodeJS.ProcessEnv) {
  const explicit = query.match(/\b\d{8,10}\b/);
  if (explicit) {
    return explicit[0]!;
  }
  if (env.SEMAS_DEFAULT_DONG_CODE?.trim()) {
    return env.SEMAS_DEFAULT_DONG_CODE.trim();
  }

  // Both branches of the old code returned the same Gangnam dong, so every post got Gangnam
  // shop statistics whatever it was about. The owner ruled on 2026-08-18 that we do not pick
  // a region for the writer: choosing one infers where they are, and choosing wrong is worse
  // than attaching nothing.
  //
  // Now the post's own district decides, via the baked table. This API accepts a five-digit
  // district code directly (divId=signguCd), so no dong-level code is needed.
  // See lib/context-enrichment/region-mention.ts.
  return resolveRegionCode(query)?.code ?? null;
}

function getDivId(regionCode: string) {
  if (/^\d{2}$/.test(regionCode)) {
    return "ctprvnCd";
  }
  if (/^\d{5}$/.test(regionCode)) {
    return "signguCd";
  }
  if (/^\d{8}$/.test(regionCode)) {
    return "adongCd";
  }
  return "adongCd";
}

function buildSemasUrl(input: { apiKey: string; regionCode: string; limit: number }) {
  const url = new URL(ENDPOINT);
  url.searchParams.set("serviceKey", input.apiKey);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", String(input.limit));
  url.searchParams.set("divId", getDivId(input.regionCode));
  url.searchParams.set("key", input.regionCode);
  url.searchParams.set("type", "json");
  return url;
}

function normalizeRows(payload: unknown): SemasRawResult[] {
  const root = asObject(payload);
  if (!root) {
    return [];
  }
  const body = asObject(root.body ?? root.response);
  const items = body?.items ?? root.items;
  if (Array.isArray(items)) {
    return items.filter((item): item is SemasRawResult => Boolean(asObject(item)));
  }
  if (asObject(items)) {
    return [items as SemasRawResult];
  }
  return [];
}

function getPayloadStatus(payload: unknown, results: SemasRawResult[]): SemasProviderStatus {
  const root = asObject(payload);
  const header = asObject(root?.header);
  const resultCode = cleanSemasValue(header?.resultCode ?? header?.code);
  const message = cleanSemasValue(header?.resultMsg ?? header?.message);
  if (resultCode && resultCode !== "00" && resultCode !== "0") {
    if (/NODATA|NO_DATA|데이터\s*없|not found/i.test(`${resultCode} ${message}`)) {
      return "NOT_FOUND";
    }
    return /auth|key|SERVICE_KEY|인증/i.test(`${resultCode} ${message}`) ? "INVALID_CREDENTIALS" : "EXTERNAL_API_ERROR";
  }
  return results.length > 0 ? "OK" : "NOT_FOUND";
}

async function fetchJson(input: {
  env: NodeJS.ProcessEnv;
  fetchImpl: ProviderFetchLike;
  url: URL;
}) {
  return fetchContextProviderJson({
    env: input.env,
    fallbackError: () => new SemasProviderError("EXTERNAL_API_ERROR", "SEMAS_FETCH_FAILED"),
    fetchImpl: input.fetchImpl,
    headers: {
      accept: "application/json",
      "user-agent": DEFAULT_USER_AGENT
    },
    isProviderError: (error) => error instanceof SemasProviderError,
    responseError: (response) => {
      const status = getDefaultContextProviderHttpStatus<SemasProviderStatus>(response, {
        externalApiError: "EXTERNAL_API_ERROR",
        invalidCredentials: "INVALID_CREDENTIALS",
        notFound: "NOT_FOUND",
        rateLimited: "RATE_LIMITED"
      });

      return status ? new SemasProviderError(status, `SEMAS_HTTP_${response.status}`) : null;
    },
    timeoutError: () => new SemasProviderError("TIMEOUT", "SEMAS_TIMEOUT"),
    url: input.url
  });
}

export async function searchSemasWithStatus({
  fetchImpl,
  now,
  options,
  query
}: {
  fetchImpl: ProviderFetchLike;
  now: () => Date;
  options: ContextResearchProviderSearchOptions;
  query: string;
}): Promise<SemasSearchStatusResult> {
  const env = options.env ?? process.env;
  const checkedAt = now().toISOString();

  if (!isContextProviderEnabled("statistics", env)) {
    return { checkedAt, provider: "semas", results: [], status: "PROVIDER_DISABLED" };
  }
  const apiKey = getApiKey(env);
  if (!apiKey) {
    return { checkedAt, provider: "semas", results: [], status: "MISSING_CREDENTIALS" };
  }
  const budget = evaluateContextProviderBudget(options.budgetSnapshot, env);
  if (!budget.allowed) {
    return { checkedAt, provider: "semas", results: [], status: "RATE_LIMITED" };
  }

  const regionCode = inferDongCode(query, env);

  // No region in the post means no honest answer here (inferDongCode explains why we do not
  // substitute one).
  if (!regionCode) {
    return { checkedAt, provider: "semas", results: [], status: "INVALID_QUERY" };
  }

  const payload = await fetchJson({
    env,
    fetchImpl,
    url: buildSemasUrl({
      apiKey,
      regionCode,
      limit: getContextProviderSearchLimit(options.limit, env)
    })
  });
  const results = normalizeRows(payload).map((row) => ({
    ...row,
    __checkedAt: checkedAt,
    __provider: "semas" as const,
    __query: query
  }));

  return {
    checkedAt,
    provider: "semas",
    results,
    status: getPayloadStatus(payload, results)
  };
}
