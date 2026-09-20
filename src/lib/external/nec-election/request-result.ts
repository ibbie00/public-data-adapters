import type {
  NecElectionApiError,
  NecElectionService,
  NecOpenApiResult
} from "./types";

export function buildNecErrorResult(input: {
  endpoint: string;
  error: NecElectionApiError;
  fetchedAt: Date;
  rawText?: string;
  redactedUrl?: string;
  service: NecElectionService;
  status: NecOpenApiResult["status"];
}): NecOpenApiResult {
  return {
    endpoint: input.endpoint,
    error: input.error,
    fetchedAt: input.fetchedAt,
    items: [],
    ok: false,
    rawText: input.rawText,
    redactedUrl: input.redactedUrl,
    service: input.service,
    status: input.status
  };
}
