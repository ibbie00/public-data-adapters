import { getContextHash } from "../../normalize";
import type { ContextAsset } from "../../types";
import {
  PROVIDER_ID,
  PROVIDER_TYPE,
  SOURCE_INSTITUTION_KO,
  SOURCE_NAME_KO
} from "./constants";
import { getFirstString } from "./parse";
import type { KosisRawResult } from "./types";

// KOSIS compilation cycles. Unknown codes fall through so a new one shows the bare period
// rather than a wrong word.
const KOSIS_CYCLE_LABELS_KO: Record<string, string> = {
  A: "연간",
  D: "일간",
  F: "부정기",
  H: "반기",
  IR: "비정기",
  M: "월간",
  Q: "분기"
};

function appendKosisCycle(period: string, cycle: string | null) {
  const label = cycle ? KOSIS_CYCLE_LABELS_KO[cycle.trim().toUpperCase()] : null;

  return label ? `${period} (${label})` : period;
}

export function normalizeKosisRawResult(input: {
  checkedAt: string;
  rawResult: KosisRawResult;
}): ContextAsset {
  const rawResult = input.rawResult;
  const orgId = getFirstString(rawResult, ["ORG_ID", "orgId", "__orgId"]) ?? "unknown";
  const tableId = getFirstString(rawResult, ["TBL_ID", "tblId", "__tableId"]) ?? getContextHash(rawResult);
  const tableName = getFirstString(rawResult, ["TBL_NM", "STAT_NM", "tblNm"]) ?? tableId;
  const itemName = getFirstString(rawResult, ["ITM_NM", "ITEM_NM", "itmNm"]);
  const categoryName = getFirstString(rawResult, ["C1_NM", "C2_NM", "C3_NM", "OBJ_NM"]);
  const unit = getFirstString(rawResult, ["UNIT_NM", "UNIT", "unitNm"]) ?? "\ub2e8\uc704 \ubbf8\ud655\uc778";
  const periodValue = getFirstString(rawResult, ["PRD_DE", "WRTTIME_IDTFR_ID", "period"]) ?? "\uae30\uac04 \ubbf8\ud655\uc778";
  // KOSIS says how often the table is compiled in PRD_SE, and we were dropping it. Without
  // it "2025" does not say whether it is the year's figure or one period inside it, which
  // is the difference between a rate and a snapshot. This is the source's own label, not a
  // reading of it.
  const periodCycle = getFirstString(rawResult, ["PRD_SE", "prdSe"]);
  const period = appendKosisCycle(periodValue, periodCycle);
  const value = getFirstString(rawResult, ["DT", "DTA_VAL", "value"]);
  const checkedAt = rawResult.__checkedAt ?? input.checkedAt;
  const sourceIdentifier = `kosis:${orgId}:${tableId}`;
  const sourceUrl = `https://kosis.kr/statHtml/statHtml.do?orgId=${encodeURIComponent(orgId)}&tblId=${encodeURIComponent(tableId)}&conn_path=I2`;
  const descriptiveParts = [itemName, categoryName].filter(Boolean);
  const sourceTitle = descriptiveParts.length > 0
    ? `${tableName} - ${descriptiveParts.join(" / ")}`
    : tableName;

  return {
    assetType: "STATISTICS_CONTEXT",
    checkedAt,
    confidence: unit.includes("\ubbf8\ud655\uc778") || period.includes("\ubbf8\ud655\uc778") ? "low" : "medium",
    keyPoints: [
      `unit:${unit}`,
      `period:${period}`,
      itemName ? `item:${itemName}` : null,
      categoryName ? `category:${categoryName}` : null,
      value ? `value:${value}` : null,
      "sourceProvider:kosis"
    ].filter((point): point is string => Boolean(point)),
    limitations: [
      "KOSIS \uacf5\uac1c \ud1b5\uacc4\ud45c\uc758 \ub2e8\uc704\u00b7\uae30\uac04\u00b7\ud56d\ubaa9 \uba54\ud0c0\ub370\uc774\ud130\ub97c \uc0c9\uc778\ud558\uba70, \uc815\ucc45 \ud6a8\uacfc\ub098 \uc6d0\uc778\uc744 \ud310\ub2e8\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4."
    ],
    locale: "ko",
    modelMetadata: {
      categoryName,
      itemName,
      orgId,
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
