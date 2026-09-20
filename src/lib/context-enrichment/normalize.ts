import { createHash } from "node:crypto";

import { stripBidiFormattingControls } from "../security/bidi";

import type { ContextAsset } from "./types";

export function normalizeContextText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function getContextHash(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function getContextAliasKey(input: { alias: string; locale?: string }) {
  const locale = input.locale ?? "ko";
  return `alias:${locale}:${normalizeContextText(input.alias)}`;
}

export function getContextCanonicalSourceKey(input: {
  providerType: string;
  sourceIdentifier?: string | null;
  sourceUrl?: string | null;
  sourceHash?: string | null;
  sourceRevisionKey?: string | null;
}) {
  const sourceKey =
    input.sourceRevisionKey ?? input.sourceHash ?? input.sourceIdentifier ?? input.sourceUrl;

  return `${input.providerType}:${normalizeContextText(sourceKey ?? "missing-source")}`;
}

// A context "query" is FREE TEXT, and on the flint-keyword path it is the author's own
// sentence: lib/context-enrichment/context-need-planner/planner.ts hands the post body
// through (whitespace-collapsed, cut at 240 chars) and that string reaches the
// providers. Fingerprint it before it can be written anywhere: the same sentence still
// maps to the same token, so grouping/dedupe by "same lookup" is unchanged, but the
// sentence itself cannot be read back out of an asset row.
export function getContextQueryFingerprint(query: string) {
  return `q${createHash("sha256")
    .update(normalizeContextText(query))
    .digest("hex")
    .slice(0, 16)}`;
}

// Free-text query keys a provider may drop into `modelMetadata`. The value behind any
// of these is the same string getContextQueryFingerprint exists for (on the
// flint-keyword path, the author's own sentence), so it must never be stored verbatim.
// Add a name here rather than only fixing the provider that used it: the store is the
// guarantee, the normalizers are hygiene.
const RAW_QUERY_METADATA_KEYS: readonly string[] = [
  "__query",
  "query",
  "queryText",
  "rawQuery",
  "searchQuery",
  "searchTerm",
  "userQuery"
];

// The name the fingerprint is stored under, matching what the ecos / nabo-publication /
// nkis-policy normalizers already emit by hand.
export const CONTEXT_QUERY_FINGERPRINT_KEY = "queryFingerprint";

export function isRawContextQueryMetadataKey(key: string) {
  return RAW_QUERY_METADATA_KEYS.includes(key);
}

// `queryKey` is fingerprinted by getContextAssetQueryKey no matter what a provider hands
// it (lib/context-enrichment/assets.ts), but `modelMetadata` was passed straight through,
// so a provider that put the raw query in there published the author's sentence anyway:
// in a row written with accessScope=public that outlives the post it was fetched for.
// Apply the same "the store never has to trust its callers" rule to the whole metadata
// object: walk it recursively and drop every free-text query key. Everything else
// (catalogProvider, contentStoragePolicy, image URLs, providerRuntime, sourceUrl
// verification results, ...) is preserved untouched.
//
// keepFingerprint (default true) leaves one stable `queryFingerprint` per object so the
// provenance stays debuggable, which is what a live write wants. The one-off repair of
// rows written before this boundary existed passes false: those rows belong to posts
// that are already gone, and there is nothing left to debug against.
export function sanitizeContextAssetModelMetadata<T>(
  metadata: T,
  options: { keepFingerprint?: boolean } = {}
): T {
  return sanitizeContextMetadataValue(metadata, options.keepFingerprint !== false) as T;
}

// The raw query keys actually present in a metadata object, with the LENGTH of each
// value and never the value itself: the repair script reports through this, and its
// output is meant to be safe to paste into a chat.
export function findRawContextQueryMetadata(metadata: unknown) {
  const found: { key: string; length: number; path: string }[] = [];

  const walk = (value: unknown, path: string) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }

    if (!value || typeof value !== "object") {
      return;
    }

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const childPath = path ? `${path}.${key}` : key;

      if (isRawContextQueryMetadataKey(key)) {
        if (typeof item === "string" && item.length > 0) {
          found.push({ key, length: item.length, path: childPath });
        }

        continue;
      }

      walk(item, childPath);
    }
  };

  walk(metadata, "");

  return found;
}

// The visible text of a context asset is external bytes: a provider title, a news
// headline, a summary built from a post. Bidi formatting controls must be stripped
// from any such text that reaches a screen, because U+202E reorders what a reader
// sees around it, which lets a title read as a different sentence or consume the
// card's own chrome. A context asset is a public row that outlives the post it was
// fetched for, so the strip happens where the row is written: one place, whatever
// a provider hands us.
export function stripBidiFromContextAssetText(asset: ContextAsset): ContextAsset {
  const clean = (value: string) => stripBidiFormattingControls(value);

  return {
    ...asset,
    ...(typeof asset.disclaimer === "string" ? { disclaimer: clean(asset.disclaimer) } : {}),
    ...(asset.keyPoints ? { keyPoints: asset.keyPoints.map(clean) } : {}),
    ...(asset.limitations ? { limitations: asset.limitations.map(clean) } : {}),
    ...(typeof asset.sourceInstitution === "string"
      ? { sourceInstitution: clean(asset.sourceInstitution) }
      : {}),
    ...(typeof asset.summary === "string" ? { summary: clean(asset.summary) } : {}),
    sourceName: clean(asset.sourceName),
    sourceTitle: clean(asset.sourceTitle)
  };
}

function sanitizeContextMetadataValue(value: unknown, keepFingerprint: boolean): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeContextMetadataValue(item, keepFingerprint));
  }

  if (!value || typeof value !== "object" || value instanceof Date) {
    return value;
  }

  const record = value as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};
  let fingerprint: string | null = null;

  for (const key of Object.keys(record)) {
    if (isRawContextQueryMetadataKey(key)) {
      const raw = record[key];

      if (!fingerprint && typeof raw === "string" && raw.trim()) {
        fingerprint = getContextQueryFingerprint(raw);
      }

      continue;
    }

    sanitized[key] = sanitizeContextMetadataValue(record[key], keepFingerprint);
  }

  if (
    keepFingerprint &&
    fingerprint &&
    typeof sanitized[CONTEXT_QUERY_FINGERPRINT_KEY] !== "string"
  ) {
    sanitized[CONTEXT_QUERY_FINGERPRINT_KEY] = fingerprint;
  }

  return sanitized;
}

// The stored query key. `aliasKey` is a resolved PUBLIC entity (built from a
// ContextAlias row, never from what the author typed) so it stays readable; anything
// else is treated as free text and fingerprinted.
export function getContextCanonicalQueryKey(input: {
  providerType: string;
  query: string;
  locale?: string;
  aliasKey?: string | null;
}) {
  const locale = input.locale ?? "ko";
  const base = input.aliasKey ?? getContextQueryFingerprint(input.query);

  return `query:${input.providerType}:${locale}:${base}`;
}
