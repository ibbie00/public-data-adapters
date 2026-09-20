import { BUILT_IN_CORP_CODES } from "./constants";
import type { OpenDartParsedQuery } from "./types";

export function clean(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

export function getFirstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = clean(record[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

export function getOpenDartApiKey(env: NodeJS.ProcessEnv) {
  return env.OPENDART_API_KEY?.trim() || "";
}

function parseJsonMap(value: string | undefined) {
  if (!value?.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, item]) => [key.trim().toLowerCase(), clean(item)])
        .filter((entry): entry is [string, string] => Boolean(entry[0] && entry[1]))
    );
  } catch {
    return {};
  }
}

function getCorpCodeMap(env: NodeJS.ProcessEnv) {
  return {
    ...BUILT_IN_CORP_CODES,
    ...parseJsonMap(env.OPENDART_CORP_CODE_MAP_JSON)
  };
}

function resolveCorpCode(query: string, env: NodeJS.ProcessEnv) {
  const explicit =
    query.match(/(?:corp[_-]?code|\uace0\uc720\ubc88\ud638)\s*[:=]\s*(\d{8})/i)?.[1];

  if (explicit) {
    return explicit;
  }

  const normalized = query.toLowerCase();
  const corpCodeMap = getCorpCodeMap(env);

  for (const [name, corpCode] of Object.entries(corpCodeMap)) {
    if (name && normalized.includes(name.toLowerCase())) {
      return corpCode;
    }
  }

  return env.OPENDART_DEFAULT_CORP_CODE?.trim() || undefined;
}

function normalizeDate(value: string) {
  const compact = value.replace(/[^\d]/g, "");

  return /^\d{8}$/.test(compact) ? compact : null;
}

function parseDateRange(
  query: string,
  env: NodeJS.ProcessEnv,
  now: Date
): Pick<OpenDartParsedQuery, "bgnDe" | "endDe"> | null {
  const explicitRange = query.match(
    /(?:date|rcept_dt|\uae30\uac04)\s*[:=]\s*(\d{4}[-.]?\d{2}[-.]?\d{2})\s*(?:\.\.|~|-)\s*(\d{4}[-.]?\d{2}[-.]?\d{2})/i
  );
  if (explicitRange) {
    const bgnDe = normalizeDate(explicitRange[1]!);
    const endDe = normalizeDate(explicitRange[2]!);

    return bgnDe && endDe ? { bgnDe, endDe } : null;
  }

  const dates = Array.from(query.matchAll(/\b(20\d{2}[-.]?\d{2}[-.]?\d{2})\b/g))
    .map((match) => normalizeDate(match[1]!))
    .filter((item): item is string => Boolean(item));

  if (dates.length >= 2) {
    return {
      bgnDe: dates[0]!,
      endDe: dates[1]!
    };
  }
  if (dates.length === 1) {
    return {
      bgnDe: dates[0]!,
      endDe: dates[0]!
    };
  }

  const defaultBgnDe = normalizeDate(env.OPENDART_DEFAULT_BGN_DE ?? "");
  const defaultEndDe = normalizeDate(env.OPENDART_DEFAULT_END_DE ?? "");
  if (defaultBgnDe && defaultEndDe) {
    return {
      bgnDe: defaultBgnDe,
      endDe: defaultEndDe
    };
  }

  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 30);

  return {
    bgnDe: start.toISOString().slice(0, 10).replace(/-/g, ""),
    endDe: end.toISOString().slice(0, 10).replace(/-/g, "")
  };
}

export function parseOpenDartQuery(
  query: string,
  env: NodeJS.ProcessEnv,
  now: Date
): OpenDartParsedQuery | null {
  const trimmed = query.trim();

  if (!trimmed) {
    return null;
  }

  const rceptNo =
    trimmed.match(/(?:rcept[_-]?no|\uc811\uc218\ubc88\ud638|rcpNo)\s*[:=]\s*(\d{14})/i)?.[1] ??
    trimmed.match(/\b(\d{14})\b/)?.[1];
  const range = parseDateRange(trimmed, env, now);

  if (!range) {
    return null;
  }

  return {
    ...range,
    corpCode: resolveCorpCode(trimmed, env),
    keyword: trimmed,
    rceptNo
  };
}
