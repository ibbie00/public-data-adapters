import {
  CONTEXT_PROVIDER_TRANSIENT_STATUS_CODES,
  fetchContextProviderText,
  type ProviderFetchLike
} from "../fetch-with-retry";
import { DEFAULT_USER_AGENT } from "./constants";
import {
  getMolitHeaderError,
  getPath,
  parseMolitPayload,
  toArray
} from "./parse";
import {
  getServiceKey,
  inferDealYmd,
  inferLawdCode
} from "./query";
import { RealEstateProviderError, type MolitRealEstateService, type RealEstateRawResult } from "./types";
import { buildMolitUrl } from "./urls";

export async function fetchMolit(input: {
  env: NodeJS.ProcessEnv;
  fetchImpl: ProviderFetchLike;
  now: Date;
  query: string;
  service: MolitRealEstateService;
  timeoutMs: number;
}): Promise<RealEstateRawResult[]> {
  const serviceKey = getServiceKey(input.service, input.env);
  if (!serviceKey) {
    throw new RealEstateProviderError("MISSING_CREDENTIALS", `${input.service.apiKeyEnv}_MISSING`);
  }

  const lawdCode = inferLawdCode(input.query);

  // No district in the post means no honest answer here (query.ts explains why we do not
  // substitute one).
  if (!lawdCode) {
    throw new RealEstateProviderError("INVALID_QUERY", "REAL_ESTATE_NO_REGION_IN_QUERY");
  }

  const dealYmd = inferDealYmd(input.query, input.now);
  const url = buildMolitUrl({
    dealYmd,
    lawdCode,
    service: input.service,
    serviceKey
  });

  try {
    const rawText = await fetchContextProviderText({
      env: input.env,
      fallbackError: () => new RealEstateProviderError("EXTERNAL_API_ERROR", "MOLIT_FETCH_FAILED"),
      fetchImpl: input.fetchImpl,
      headers: {
        accept: "application/xml, text/xml, */*",
        "user-agent": DEFAULT_USER_AGENT
      },
      isProviderError: (error) => error instanceof RealEstateProviderError,
      responseError: (response) => {
        if (response.status === 401 || response.status === 403) {
          return new RealEstateProviderError("INVALID_CREDENTIALS", `MOLIT_HTTP_${response.status}`);
        }
        if (response.status === 429) {
          return new RealEstateProviderError("RATE_LIMITED", "MOLIT_RATE_LIMITED");
        }
        if (!response.ok || CONTEXT_PROVIDER_TRANSIENT_STATUS_CODES.has(response.status)) {
          return new RealEstateProviderError("EXTERNAL_API_ERROR", `MOLIT_HTTP_${response.status}`);
        }

        return null;
      },
      timeoutError: () => new RealEstateProviderError("TIMEOUT", "MOLIT_TIMEOUT"),
      timeoutMs: input.timeoutMs,
      url
    });
    const payload = parseMolitPayload(rawText);
    const headerError = getMolitHeaderError(payload);
    if (headerError) {
      throw new RealEstateProviderError(headerError, `MOLIT_${headerError}`);
    }
    const items = toArray(getPath(payload, ["response", "body", "items", "item"]));
    if (items.length === 0) {
      throw new RealEstateProviderError("NOT_FOUND", "MOLIT_NO_ITEMS");
    }

    return items.map((item) => ({
      checkedAt: input.now.toISOString(),
      dealMonth: dealYmd,
      dealYear: dealYmd.slice(0, 4),
      item,
      lawdCode,
      provider: "molit",
      query: input.query,
      service: input.service
    }));
  } catch (error) {
    if (error instanceof RealEstateProviderError) {
      throw error;
    }

    throw new RealEstateProviderError("EXTERNAL_API_ERROR", "MOLIT_FETCH_FAILED");
  }
}
