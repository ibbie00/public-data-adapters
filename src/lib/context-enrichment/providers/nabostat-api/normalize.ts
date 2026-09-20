import { getContextHash } from "../../normalize";
import type { ContextAsset } from "../../types";
import {
  NABOSTAT_API_BASE_URL,
  PROVIDER_ID,
  PROVIDER_TYPE,
  SOURCE_INSTITUTION_KO,
  SOURCE_NAME_KO
} from "./constants";
import { getFirstString } from "./parse";
import type { NabostatRawResult } from "./types";

export function normalizeNabostatRawResult(input: {
  checkedAt: string;
  rawResult: NabostatRawResult;
}): ContextAsset {
  const rawResult = input.rawResult;
  const tableId = getFirstString(rawResult, ["STATBL_ID", "__tableId"]) ?? getContextHash(rawResult);
  const tableName = getFirstString(rawResult, ["STATBL_NM", "STAT_NM", "statblNm"]) ?? tableId;
  const itemName = getFirstString(rawResult, ["ITM_NM", "ITEM_NM", "itmNm"]);
  const unit = getFirstString(rawResult, ["UI_NM", "UNIT_NM", "unitNm"]) ?? "\ub2e8\uc704 \ubbf8\ud655\uc778";
  const period = getFirstString(rawResult, ["WRTTIME_IDTFR_ID", "PRD_DE", "period"]) ?? "\uae30\uac04 \ubbf8\ud655\uc778";
  const value = getFirstString(rawResult, ["DTA_VAL", "DT", "value"]);
  const sourceTitle = tableName === tableId && itemName
    ? `${itemName} \uc608\uc0b0(${period})`
    : tableName;
  const checkedAt = rawResult.__checkedAt ?? input.checkedAt;
  const sourceIdentifier = `nabostat:table:${tableId}`;
  const sourceUrl = `${NABOSTAT_API_BASE_URL}/Sttsapitbldata.do?STATBL_ID=${encodeURIComponent(tableId)}&Type=json`;

  return {
    assetType: "STATISTICS_CONTEXT",
    checkedAt,
    confidence: unit.includes("\ubbf8\ud655\uc778") || period.includes("\ubbf8\ud655\uc778") ? "low" : "medium",
    keyPoints: [
      `unit:${unit}`,
      `period:${period}`,
      itemName ? `item:${itemName}` : null,
      value ? `value:${value}` : null,
      "sourceProvider:nabostat"
    ].filter((point): point is string => Boolean(point)),
    limitations: [
      "\ucd9c\ucc98 \ud1b5\uacc4\ud45c\uc758 \ub2e8\uc704\u00b7\uae30\uac04\u00b7\ud56d\ubaa9 \uba54\ud0c0\ub370\uc774\ud130\ub97c \uc0c9\uc778\ud558\uba70, \uc815\ucc45 \ud6a8\uacfc\ub098 \uc6d0\uc778\uc744 \ud310\ub2e8\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4."
    ],
    locale: "ko",
    modelMetadata: {
      itemName,
      period,
      provider: PROVIDER_ID,
      tableId,
      tableName,
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
    sourceUrl,
    status: unit.includes("\ubbf8\ud655\uc778") || period.includes("\ubbf8\ud655\uc778") ? "needs_review" : "current",
    // No summary. What used to sit here was a fixed sentence about our own indexing
    // ("a metadata index for connecting official material"), which told a reader nothing
    // the title did not. The card now shows the values themselves; see
    // lib/context-enrichment/flint-context-meteors/facts.ts.
    summary: null
  };
}
