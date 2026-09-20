import { getContextAssetFreshnessPolicy } from "../../freshness";
import { getContextHash } from "../../normalize";
import type { ContextAsset, ContextFreshnessPolicy } from "../../types";
import { assertValidContextAsset } from "../../validation";
import { cleanSemasValue as clean } from "./request";
import { SEMAS_PROVIDER_TYPE, type SemasRawResult } from "./types";

const SOURCE_NAME_KO = "소상공인시장진흥공단 상가(상권)정보";
const SOURCE_INSTITUTION_KO = "소상공인시장진흥공단";

export function normalizeSemasResult(rawResult: SemasRawResult, now: () => Date): ContextAsset {
  const checkedAt = rawResult.__checkedAt ?? now().toISOString();
  const storeName = clean(rawResult.bizesNm ?? rawResult.storeName) || "상가업소";
  const industry = clean(rawResult.indsSclsNm ?? rawResult.indsMclsNm ?? rawResult.indsLclsNm) || "업종 미확인";
  const address = clean(rawResult.rdnmAdr ?? rawResult.lnoAdr ?? rawResult.address);
  const dongCode = clean(rawResult.adongCd ?? rawResult.ctprvnCd) || "지역코드 미확인";
  const period = clean(rawResult.dataStdDt ?? rawResult.stdDate) || "기준일 미확인";
  const sourceIdentifier = `semas:${clean(rawResult.bizesId) || getContextHash(rawResult)}`;

  return {
    assetType: "STATISTICS_CONTEXT",
    checkedAt,
    confidence: address ? "medium" : "low",
    keyPoints: [
      "unit:업소",
      `period:${period}`,
      `industry:${industry}`,
      address ? `address:${address}` : null,
      `regionCode:${dongCode}`,
      "sourceProvider:semas"
    ].filter((point): point is string => Boolean(point)),
    limitations: [
      "상가(상권)정보는 지역·업종 배경자료로만 사용하며, 매출·평판·방문자 특성을 추론하지 않습니다."
    ],
    locale: "ko",
    modelMetadata: {
      address,
      dongCode,
      industry,
      period,
      provider: "semas",
      storeName,
      validationStatus: "commercial_area_metadata_normalized"
    },
    providerType: SEMAS_PROVIDER_TYPE,
    retrievedAt: checkedAt,
    sourceDate: period,
    sourceHash: getContextHash(rawResult),
    sourceIdentifier,
    sourceInstitution: SOURCE_INSTITUTION_KO,
    sourceName: SOURCE_NAME_KO,
    sourceTitle: `${storeName} - ${industry}`,
    sourceUrl: "https://www.data.go.kr/data/15083033/openapi.do",
    status: period.includes("미확인") ? "needs_review" : "current",
    // No summary. What used to sit here was a fixed sentence about our own indexing
    // ("a metadata index for connecting official material"), which told a reader nothing
    // the title did not. The card now shows the values themselves; see
    // lib/context-enrichment/flint-context-meteors/facts.ts.
    summary: null
  };
}

export function validateSemasAsset(normalizedAsset: ContextAsset) {
  assertValidContextAsset(normalizedAsset);
}

export function getSemasFreshnessPolicy(asset?: ContextAsset): ContextFreshnessPolicy {
  return getContextAssetFreshnessPolicy(
    asset ?? {
      assetType: "STATISTICS_CONTEXT",
      providerType: SEMAS_PROVIDER_TYPE,
      sourceTitle: ""
    }
  );
}
