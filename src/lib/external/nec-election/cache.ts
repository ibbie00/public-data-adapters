import type { NecElectionService, NecRequestParams } from "./types";

export type NecElectionCachePolicy = {
  negativeTtlSeconds: number;
  ttlSeconds: number;
};

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

export function getNecElectionCachePolicy(input: {
  endpoint: string;
  recent?: boolean;
  service: NecElectionService;
}): NecElectionCachePolicy {
  if (input.recent) {
    return {
      negativeTtlSeconds: 10 * 60,
      ttlSeconds: input.service === "CommonCodeService" ? 6 * HOUR : 6 * HOUR
    };
  }

  return {
    negativeTtlSeconds: 15 * 60,
    ttlSeconds: input.service === "CommonCodeService" ? 7 * DAY : 30 * DAY
  };
}

export function getNecElectionCacheKey(input: {
  endpoint: string;
  params?: NecRequestParams;
  resultType?: "json" | "xml";
  service: NecElectionService;
}) {
  const entries = Object.entries(input.params ?? {})
    .filter(([key, value]) => value !== undefined && key !== "serviceKey")
    .sort(([a], [b]) => a.localeCompare(b));

  return [
    "nec-election",
    input.service,
    input.endpoint,
    input.resultType ?? "json",
    ...entries.map(([key, value]) => `${key}=${String(value)}`)
  ].join(":");
}
