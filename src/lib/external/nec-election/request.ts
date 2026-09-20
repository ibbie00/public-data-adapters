import { fetchExternalTextWithLimits } from "../fetch-with-limits";
import {
  buildNecApiError,
  NecOpenApiRequestError,
  redactNecUrl
} from "./errors";
import {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  getFetchImpl,
  MAX_RESPONSE_BYTES
} from "./request-config";
import { buildNecErrorResult } from "./request-result";
import {
  buildNecOpenApiUrl,
  normalizeNecEndpoint
} from "./request-url";
import {
  extractNecItems,
  findNecServiceError,
  parseNecPayload
} from "./response-parser";
import type {
  NecClientOptions,
  NecElectionService,
  NecOpenApiResult,
  NecRequestParams
} from "./types";

export { getNecServiceKey } from "./request-config";
export { buildNecOpenApiUrl } from "./request-url";

export async function requestNecOpenApi(input: {
  baseUrl: string;
  endpoint: string;
  options?: NecClientOptions;
  params?: NecRequestParams;
  service: NecElectionService;
  serviceKey: string;
}): Promise<NecOpenApiResult> {
  const now = input.options?.now ?? (() => new Date());
  const fetchedAt = now();
  const endpoint = normalizeNecEndpoint(input.endpoint);
  const url = buildNecOpenApiUrl({
    baseUrl: input.baseUrl,
    endpoint,
    params: input.params,
    serviceKey: input.serviceKey
  });
  const redactedUrl = redactNecUrl(url);

  try {
    const { response, text: rawText } = await fetchExternalTextWithLimits({
      fetchImpl: getFetchImpl(input.options?.fetchImpl),
      init: {
        headers: {
          accept: "application/json, application/xml, text/xml, */*",
          "user-agent": DEFAULT_USER_AGENT
        }
      },
      maxResponseBytes: MAX_RESPONSE_BYTES,
      timeoutMs: input.options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      url
    });

    if (!response.ok) {
      return buildNecErrorResult({
        endpoint,
        error: buildNecApiError({
          endpoint,
          httpStatus: response.status,
          message: `HTTP_${response.status}`,
          params: input.params ?? {},
          service: input.service
        }),
        fetchedAt,
        rawText,
        redactedUrl,
        service: input.service,
        status: "HTTP_ERROR"
      });
    }

    let payload: unknown;
    try {
      payload = parseNecPayload(rawText);
    } catch {
      return buildNecErrorResult({
        endpoint,
        error: buildNecApiError({
          endpoint,
          message: "PARSE_ERROR",
          params: input.params ?? {},
          service: input.service
        }),
        fetchedAt,
        rawText,
        redactedUrl,
        service: input.service,
        status: "PARSE_ERROR"
      });
    }

    const serviceError = findNecServiceError(payload);
    if (serviceError) {
      return buildNecErrorResult({
        endpoint,
        error: buildNecApiError({
          code: serviceError.code,
          endpoint,
          message: serviceError.message,
          params: input.params ?? {},
          service: input.service
        }),
        fetchedAt,
        rawText,
        redactedUrl,
        service: input.service,
        status: "SERVICE_ERROR"
      });
    }

    return {
      endpoint,
      fetchedAt,
      items: extractNecItems(payload),
      ok: true,
      rawText,
      redactedUrl,
      service: input.service,
      status: "OK"
    };
  } catch (error) {
    const detail = buildNecApiError({
      endpoint,
      message: error instanceof Error && error.name === "AbortError" ? "TIMEOUT" : "EXTERNAL_API_ERROR",
      network: true,
      params: input.params ?? {},
      service: input.service
    });
    if (error instanceof NecOpenApiRequestError) {
      return buildNecErrorResult({
        endpoint,
        error: error.detail,
        fetchedAt,
        redactedUrl,
        service: input.service,
        status: "EXTERNAL_API_ERROR"
      });
    }

    return buildNecErrorResult({
      endpoint,
      error: detail,
      fetchedAt,
      redactedUrl,
      service: input.service,
      status: detail.message === "TIMEOUT" ? "TIMEOUT" : "EXTERNAL_API_ERROR"
    });
  }
}
