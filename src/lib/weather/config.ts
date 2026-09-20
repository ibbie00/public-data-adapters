// Env knobs for the weather house account.
//
// Everything is OFF by default: WEATHER_ENABLED gates the whole bot (both the
// daily digest and the advisory relay), so timers can be installed safely and
// nothing is generated or posted until the flag is set explicitly in the
// deployment environment.

import type { WeatherLocale } from "./types";

export const WEATHER_LOCALES: readonly WeatherLocale[] = ["ko", "en", "ja", "zh"];

// The bot composes its post in this locale; the others come from translation.
export const WEATHER_SOURCE_LOCALE: WeatherLocale = "ko";

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") {
    return fallback;
  }
  return raw === "1" || raw === "true" || raw === "on" || raw === "yes";
}

function numEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) ? raw : fallback;
}

export function isWeatherEnabled(): boolean {
  return boolEnv("WEATHER_ENABLED", false);
}

// Auto-approve mode for the DAILY "tomorrow's sky" digest (founder decision
// 2026-07-10): a local-LLM safety screen accepts today's digest by itself and
// only the held/doubtful ones ask the operator via Telegram. Off = the original
// approve-every-post-by-hand flow. Mirrors FORTUNE_AUTO_APPROVE /
// WORLDLIT_AUTO_APPROVE. The advisory lane keeps its own policy
// (WEATHER_ADVISORY_AUTOPUBLISH) and is not affected. (Skykeeper has no lantern.)
export function isWeatherAutoApproveEnabled(): boolean {
  return boolEnv("WEATHER_AUTO_APPROVE", false);
}

// The evening "tomorrow's sky" digest (human-approved). On by default within the
// master switch.
export function isWeatherDailyEnabled(): boolean {
  return boolEnv("WEATHER_DAILY_ENABLED", true);
}

// The KMA advisory relay. OFF by default, and the default is the decision rather
// than a precaution: an advisory is only true for the hour it is issued and
// never comes back, which is the opposite of an axis built on return over reach.
// The deployment's own advisory timer must also be enabled. It still requires
// KMA_ALERT_OPENAPI_KEY: with no key it is a silent no-op (fail-safe), never a
// fabricated advisory.
export function isWeatherAdvisoryEnabled(): boolean {
  return boolEnv("WEATHER_ADVISORY_ENABLED", false);
}

// Whether a fresh advisory is published automatically (true) or instead queued
// for human approval (false). Defaults to the safe, fully-gated review path: a
// relayed advisory is only as trustworthy as the upstream fetch, so a fresh one
// goes to a human unless the operator explicitly opts into auto-publish.
export function isWeatherAdvisoryAutoPublish(): boolean {
  return boolEnv("WEATHER_ADVISORY_AUTOPUBLISH", false);
}

// Circuit breaker: if more than this many FRESH advisories surface in a single
// poll, stop auto-publishing and queue them for human review instead (a storm can
// issue many at once; we never flood the feed). Operator gets a nudge.
export function weatherAdvisoryMaxPerPoll(): number {
  return Math.max(1, Math.trunc(numEnv("WEATHER_ADVISORY_MAX_PER_POLL", 3)));
}

// Whether the publish step machine-translates each post into the other locales.
export function isWeatherTranslationEnabled(): boolean {
  return boolEnv("WEATHER_TRANSLATION_ENABLED", true);
}

// Hour of day (KST) at which an approved DAILY digest is scheduled to publish.
// Evening by default: the digest is about tomorrow, posted as the day winds down.
export function weatherPublishHourKst(): number {
  const hour = Math.trunc(numEnv("WEATHER_PUBLISH_HOUR_KST", 18));
  return Math.min(23, Math.max(0, hour));
}

// Review-page deep-link target. The base URL is deployment-specific and has no
// safe default beyond localhost: set PUBLIC_DATA_ADAPTERS_BASE_URL.
export function weatherReviewUrl(): string {
  const base = (
    process.env.PUBLIC_DATA_ADAPTERS_BASE_URL?.trim() || "http://localhost:3000"
  ).replace(/\/+$/, "");
  return `${base}/admin/weather-proposals`;
}

const DATA_GO_KR_API_HOST = "apis.data.go.kr";

// data.go.kr serves this API over TLS. Never send the service key in the clear:
// upgrade an http base URL to https so a path observer cannot read the key or
// inject a forged advisory into an unauthenticated response.
function normalizeKmaBaseUrl(rawBaseUrl: string): string {
  const trimmed = rawBaseUrl.replace(/\/+$/, "");

  try {
    const url = new URL(trimmed);

    if (url.protocol === "http:" && url.hostname === DATA_GO_KR_API_HOST) {
      url.protocol = "https:";
    }

    return url.toString().replace(/\/+$/, "");
  } catch {
    return trimmed;
  }
}

// KMA special-weather-advisory OpenAPI (data.go.kr, org 1360000,
// WthrWrnInfoService). The service key lives in KMA_ALERT_OPENAPI_KEY; the base
// URL is overridable so the operator can point at whichever service their key is
// subscribed to. `hasKey` false => the advisory lane is a silent no-op.
export function getKmaAlertConfig(env: NodeJS.ProcessEnv = process.env): {
  baseUrl: string;
  key: string;
  hasKey: boolean;
} {
  const key = env.KMA_ALERT_OPENAPI_KEY?.trim() || "";
  const baseUrl = normalizeKmaBaseUrl(
    env.KMA_ALERT_API_BASE_URL?.trim() || "https://apis.data.go.kr/1360000/WthrWrnInfoService"
  );
  return { baseUrl, hasKey: key.length > 0, key };
}
