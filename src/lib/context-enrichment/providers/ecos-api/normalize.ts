import { getContextHash, getContextQueryFingerprint } from "../../normalize";
import type { ContextAsset } from "../../types";
import {
  PROVIDER_ID,
  PROVIDER_TYPE,
  SOURCE_INSTITUTION_KO,
  SOURCE_NAME_KO
} from "./constants";
import { getFirstString } from "./parse";
import type { EcosRawResult } from "./types";

/**
 * ECOS names a series in two parts and we were dropping the half that says what it is.
 *
 * A consumer-price row answers with STAT_NAME "4.2.1. 소비자물가지수" and ITEM_NAME1
 * "총지수". We titled the asset with the item alone, so the card read "총지수" and a
 * reader had no way to know which index it belonged to. The relevance gate could not know
 * either: scored against the query that made it, "총지수" came back at -4.75 against a
 * -2.0 line, so a CORRECT result was being thrown away (measured 2026-08-19).
 *
 * The leading table-of-contents number is dropped. It locates the series inside ECOS's own
 * menu and means nothing outside it; the name is what is left.
 */
function buildEcosTitle(input: {
  className: string | null;
  indicatorName: string;
  statName: string | null;
}) {
  const statName = input.statName?.replace(/^[\d.]+\s*/, "").trim();
  const head =
    statName && statName !== input.indicatorName
      ? `${statName} - ${input.indicatorName}`
      : input.indicatorName;

  return input.className ? `${head} / ${input.className}` : head;
}

export function normalizeEcosRawResult(input: {
  checkedAt: string;
  rawResult: EcosRawResult;
}): ContextAsset {
  const rawResult = input.rawResult;
  const mode = rawResult.__mode ?? "statistic-search";
  const statCode = getFirstString(rawResult, ["STAT_CODE", "statCode"]);
  const statName = getFirstString(rawResult, ["STAT_NAME", "statName"]);
  // `__query` is deliberately NOT a fallback here (nor in sourceIdentifier below): on
  // the flint-keyword path it is the author's own sentence, and this value becomes the
  // asset's public sourceTitle / publicSearchText.
  const indicatorName = getFirstString(rawResult, ["KEYSTAT_NAME", "ITEM_NAME", "ITEM_NAME1", "itemName"]) ?? statName ?? "ECOS";
  const className = getFirstString(rawResult, ["CLASS_NAME", "className"]);
  const unit = getFirstString(rawResult, ["UNIT_NAME", "UNIT_NM", "unitName"]) ?? "\ub2e8\uc704 \ubbf8\ud655\uc778";
  const period = getFirstString(rawResult, ["TIME", "CYCLE", "period"]) ?? "\uae30\uac04 \ubbf8\ud655\uc778";
  const value = getFirstString(rawResult, ["DATA_VALUE", "DATA_VAL", "value"]);
  const checkedAt = rawResult.__checkedAt ?? input.checkedAt;
  const sourceIdentifier = mode === "key-statistics"
    ? `ecos:key-statistics:${indicatorName}`
    : `ecos:${statCode ?? getContextHash(rawResult)}:${period}`;
  const sourceTitle = buildEcosTitle({ className, indicatorName, statName });

  return {
    assetType: "STATISTICS_CONTEXT",
    checkedAt,
    confidence: unit.includes("\ubbf8\ud655\uc778") || period.includes("\ubbf8\ud655\uc778") ? "low" : "medium",
    keyPoints: [
      `unit:${unit}`,
      `period:${period}`,
      value ? `value:${value}` : null,
      statCode ? `statCode:${statCode}` : null,
      "sourceProvider:ecos"
    ].filter((point): point is string => Boolean(point)),
    limitations: [
      "ECOS \uacf5\uac1c \ud1b5\uacc4\uc758 \ub2e8\uc704\u00b7\uae30\uac04\u00b7\ud56d\ubaa9 \uba54\ud0c0\ub370\uc774\ud130\ub97c \uc0c9\uc778\ud558\uba70, \uae08\uc735 \uc870\uc5b8\uc774\ub098 \uc815\ucc45 \ud6a8\uacfc\ub97c \ud310\ub2e8\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4."
    ],
    locale: "ko",
    modelMetadata: {
      className,
      indicatorName,
      mode,
      period,
      provider: PROVIDER_ID,
      queryFingerprint: rawResult.__query ? getContextQueryFingerprint(rawResult.__query) : null,
      statCode,
      statName,
      unit,
      validationStatus: "source_metadata_normalized",
      value
    },
    providerType: PROVIDER_TYPE,
    retrievedAt: checkedAt,
    sourceDate: period,
    sourceHash: getContextHash(rawResult),
    sourceIdentifier,
    sourceInstitution: SOURCE_INSTITUTION_KO,
    sourceName: SOURCE_NAME_KO,
    sourceTitle,
    sourceUrl: "https://ecos.bok.or.kr/",
    status: unit.includes("\ubbf8\ud655\uc778") || period.includes("\ubbf8\ud655\uc778") ? "needs_review" : "current",
    // No summary. What used to sit here was a fixed sentence about our own indexing
    // ("a metadata index for connecting official material"), which told a reader nothing
    // the title did not. The card now shows the values themselves; see
    // lib/context-enrichment/flint-context-meteors/facts.ts.
    summary: null
  };
}
