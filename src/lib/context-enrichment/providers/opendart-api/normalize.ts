import { getContextHash } from "../../normalize";
import type { ContextAsset } from "../../types";
import { CORPORATE_DISCLOSURE_CONTEXT_DISCLAIMER_KO } from "../../types";
import {
  PROVIDER_ID,
  PROVIDER_TYPE,
  SOURCE_INSTITUTION_KO,
  SOURCE_NAME_KO
} from "./constants";
import { clean, getFirstString } from "./query";
import type { OpenDartRawResult } from "./types";
import { disclosureUrl } from "./urls";

function getKoreanSubjectParticle(value: string) {
  const last = value.trim().at(-1);

  if (!last) {
    return "\uc774";
  }

  const code = last.charCodeAt(0);

  if (code < 0xac00 || code > 0xd7a3) {
    return "\uc774";
  }

  return (code - 0xac00) % 28 === 0 ? "\uac00" : "\uc774";
}

export function normalizeOpenDartRawResult(input: {
  now: () => Date;
  rawResult: OpenDartRawResult;
}): ContextAsset {
  const rawResult = input.rawResult;
  const checkedAt = clean(rawResult.__checkedAt) || input.now().toISOString();
  const rceptNo = getFirstString(rawResult, ["rcept_no", "rceptNo"]);
  const corpName =
    getFirstString(rawResult, ["corp_name", "corpName"]) ??
    "\uacf5\uc2dc\ud68c\uc0ac";
  const corpCode = getFirstString(rawResult, ["corp_code", "corpCode"]);
  const stockCode = getFirstString(rawResult, ["stock_code", "stockCode"]);
  const reportName =
    getFirstString(rawResult, ["report_nm", "reportName"]) ?? "\uacf5\uc2dc";
  const filerName = getFirstString(rawResult, ["flr_nm", "filerName"]) ?? corpName;
  const receiptDate = getFirstString(rawResult, ["rcept_dt", "receiptDate"]);
  const sourceDate = receiptDate && /^\d{8}$/.test(receiptDate)
    ? `${receiptDate.slice(0, 4)}-${receiptDate.slice(4, 6)}-${receiptDate.slice(6, 8)}`
    : checkedAt;
  const sourceUrl = disclosureUrl(rceptNo);
  const sourceIdentifier = rceptNo
    ? `opendart:rcept_no:${rceptNo}`
    : corpCode
      ? `opendart:corp_code:${corpCode}:${reportName}:${receiptDate ?? "unknown"}`
      : undefined;
  const sourceTitle = `${corpName} ${reportName}`;

  return {
    assetType: "CORPORATE_DISCLOSURE_CONTEXT",
    canonicalSourceKey: [
      "opendart",
      "CORPORATE_DISCLOSURE_CONTEXT",
      rceptNo ?? corpCode ?? corpName,
      reportName,
      receiptDate ?? "unknown-date"
    ].join(":"),
    checkedAt,
    confidence: rceptNo && sourceUrl ? "high" : "medium",
    disclaimer: CORPORATE_DISCLOSURE_CONTEXT_DISCLAIMER_KO,
    keyPoints: [
      `company:${corpName}`,
      corpCode ? `corpCode:${corpCode}` : null,
      stockCode ? `stockCode:${stockCode}` : null,
      rceptNo ? `receiptNo:${rceptNo}` : null,
      receiptDate ? `receiptDate:${receiptDate}` : null,
      `filer:${filerName}`,
      "contentStoragePolicy:metadata_only"
    ].filter((item): item is string => Boolean(item)),
    limitations: [
      "\uacf5\uc2dc \ubcf8\ubb38 \uc804\ubb38\uc740 \uc800\uc7a5\ud558\uc9c0 \uc54a\uace0 \uc811\uc218 \uba54\ud0c0\ub370\uc774\ud130\uc640 \uc6d0\ubb38 \ub9c1\ud06c\ub9cc \uc5f0\uacb0\ud569\ub2c8\ub2e4.",
      "\ub9e4\ub9e4 \ud310\ub2e8, \uac00\uaca9 \uc804\ub9dd, \uae30\uc0ac \uc9c4\uc704 \ud310\ub2e8\uc744 \uc81c\uacf5\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4.",
      "\uc815\uc815\u00b7\ucca8\ubd80\u00b7\ud6c4\uc18d \uacf5\uc2dc\ub294 OpenDART \uc6d0\ubb38\uc5d0\uc11c \ud568\uaed8 \ud655\uc778\ud574\uc57c \ud569\ub2c8\ub2e4."
    ],
    locale: "ko",
    modelMetadata: {
      corpCode,
      corpName,
      contentStoragePolicy: "metadata_only",
      provider: PROVIDER_ID,
      receiptDate,
      reportName,
      rceptNo,
      stockCode,
      visibleInPublicUi: true
    },
    providerType: PROVIDER_TYPE,
    retrievedAt: checkedAt,
    sourceDate,
    sourceHash: getContextHash({
      corpCode,
      receiptDate,
      reportName,
      rceptNo
    }),
    sourceIdentifier,
    sourceInstitution: SOURCE_INSTITUTION_KO,
    sourceName: SOURCE_NAME_KO,
    sourceTitle,
    sourceUrl: sourceUrl ?? undefined,
    status: "current",
    summary: `${corpName}${getKoreanSubjectParticle(corpName)} ${sourceDate}\uc5d0 OpenDART\ub85c \uc81c\ucd9c\ud55c '${reportName}' \uacf5\uc2dc\uc785\ub2c8\ub2e4.`
  };
}
