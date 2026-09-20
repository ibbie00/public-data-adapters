import type { ContextProviderType } from "./types";

// "relevance" is not an outbound call. It records the gate's verdict on rows a search
// already returned, so that "why did this card appear" has an answer after the fact.
// Without it the gate is invisible: a wrong card and a correctly-blocked one look the
// same in the ledger, which is exactly the hole found on 2026-08-09.
export type ContextProviderOperation = "search" | "fetchById" | "relevance";

export type ContextProviderTelemetryEvent = {
  durationMs?: number;
  errorCode?: string;
  operation: ContextProviderOperation;
  providerType: ContextProviderType;
  reason?: string;
  resultCount?: number;
  status: "disabled" | "started" | "succeeded" | "failed";
};

export type ContextProviderTelemetrySink = (event: ContextProviderTelemetryEvent) => void;

export type ContextProviderBudgetSnapshot = {
  dailyCallCount?: number;
  hourlyCallCount?: number;
};

const DEFAULT_PROVIDER_TIMEOUT_MS = 8000;
const MIN_PROVIDER_TIMEOUT_MS = 500;
const MAX_PROVIDER_TIMEOUT_MS = 30000;
const DEFAULT_SEARCH_LIMIT = 10;
const MAX_SEARCH_LIMIT = 50;
const DEFAULT_DAILY_CALL_LIMIT = 100;
const DEFAULT_HOURLY_CALL_LIMIT = 20;

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
}

export function getContextProviderTimeoutMs(env: NodeJS.ProcessEnv = process.env) {
  const configured = parsePositiveInteger(env.CONTEXT_PROVIDER_TIMEOUT_MS) ?? DEFAULT_PROVIDER_TIMEOUT_MS;

  return Math.min(Math.max(configured, MIN_PROVIDER_TIMEOUT_MS), MAX_PROVIDER_TIMEOUT_MS);
}

export function getContextProviderSearchLimit(
  requestedLimit: number | undefined,
  env: NodeJS.ProcessEnv = process.env
) {
  const configuredMax = Math.min(
    parsePositiveInteger(env.CONTEXT_PROVIDER_MAX_SEARCH_RESULTS) ?? DEFAULT_SEARCH_LIMIT,
    MAX_SEARCH_LIMIT
  );
  const requested = requestedLimit && Number.isFinite(requestedLimit)
    ? Math.max(1, Math.floor(requestedLimit))
    : configuredMax;

  return Math.min(requested, configuredMax);
}

export function getContextProviderDailyCallLimit(env: NodeJS.ProcessEnv = process.env) {
  return parsePositiveInteger(env.CONTEXT_PROVIDER_DAILY_CALL_LIMIT) ?? DEFAULT_DAILY_CALL_LIMIT;
}

export function getContextProviderHourlyCallLimit(env: NodeJS.ProcessEnv = process.env) {
  return parsePositiveInteger(env.CONTEXT_PROVIDER_HOURLY_CALL_LIMIT) ?? DEFAULT_HOURLY_CALL_LIMIT;
}

export function evaluateContextProviderBudget(
  snapshot: ContextProviderBudgetSnapshot | undefined,
  env: NodeJS.ProcessEnv = process.env
) {
  const dailyLimit = getContextProviderDailyCallLimit(env);
  const hourlyLimit = getContextProviderHourlyCallLimit(env);
  const dailyCallCount = snapshot?.dailyCallCount ?? 0;
  const hourlyCallCount = snapshot?.hourlyCallCount ?? 0;

  if (dailyCallCount >= dailyLimit) {
    return {
      allowed: false,
      reason: "daily_call_limit_exceeded",
      dailyCallCount,
      dailyLimit,
      hourlyCallCount,
      hourlyLimit
    };
  }

  if (hourlyCallCount >= hourlyLimit) {
    return {
      allowed: false,
      reason: "hourly_call_limit_exceeded",
      dailyCallCount,
      dailyLimit,
      hourlyCallCount,
      hourlyLimit
    };
  }

  return {
    allowed: true,
    dailyCallCount,
    dailyLimit,
    hourlyCallCount,
    hourlyLimit,
    reason: null
  };
}

export function recordContextProviderTelemetry(
  sink: ContextProviderTelemetrySink | undefined,
  event: ContextProviderTelemetryEvent
) {
  if (sink) {
    sink(event);
  }
}

export function getErrorCode(error: unknown) {
  if (error instanceof Error) {
    return error.message.split(":")[0] || error.name;
  }

  return "UNKNOWN_ERROR";
}
