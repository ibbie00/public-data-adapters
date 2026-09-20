import { getContextHash, getContextQueryFingerprint } from "../../normalize";
import type { ContextAsset } from "../../types";
import { PROVIDER_TYPE } from "./constants";
import { clean } from "./parse";
import type { RealEstateRawResult } from "./types";

export function summarizeItem(item: Record<string, unknown>) {
  const parts = [
    clean(item.umdNm) || clean(item.법정동),
    clean(item.aptNm) || clean(item.mhouseNm) || clean(item.offiNm) || clean(item.houseType),
    clean(item.excluUseAr) ? `${clean(item.excluUseAr)}㎡` : "",
    clean(item.deposit) ? `보증금 ${clean(item.deposit)}만원` : "",
    clean(item.monthlyRent) && clean(item.monthlyRent) !== "0" ? `월세 ${clean(item.monthlyRent)}만원` : "",
    clean(item.dealAmount) ? `거래금액 ${clean(item.dealAmount)}만원` : ""
  ].filter(Boolean);

  return parts.join(" · ");
}

export function normalizeRealEstateRawResult(rawResult: RealEstateRawResult): ContextAsset {
  const firstLine = summarizeItem(rawResult.item);
  const sourceHash = getContextHash({
    item: rawResult.item,
    lawdCode: rawResult.lawdCode,
    providerType: PROVIDER_TYPE,
    service: rawResult.service.providerId
  });

  return {
    assetType: "REAL_ESTATE_CONTEXT",
    canonicalSourceKey: `molit:${rawResult.service.kind}:${rawResult.lawdCode}:${rawResult.dealMonth}`,
    checkedAt: rawResult.checkedAt,
    confidence: "medium",
    disclaimer: "이 정보는 국토교통부 공개 실거래 자료를 연결한 참고용 맥락 정보입니다. 타키비는 부동산 가격 전망, 투자 판단, 선거 결과의 원인을 판단하지 않습니다.",
    keyPoints: [
      `지역코드: ${rawResult.lawdCode}`,
      `계약월: ${rawResult.dealMonth}`,
      firstLine || "공식 실거래 항목 확인"
    ],
    limitations: [
      "신고·정정·해제 여부와 공개 시점에 따라 자료가 바뀔 수 있습니다.",
      "개별 거래 자료는 지수·시세·전망이 아니며, 선거 결과의 원인으로 해석하지 않습니다."
    ],
    locale: "ko",
    providerType: PROVIDER_TYPE,
    // Fingerprint, not the query: `query` is the post's own text on the
    // flint-keyword path, and this key is stored on a public asset.
    queryKey: getContextQueryFingerprint(rawResult.query),
    sourceHash,
    sourceIdentifier: `${rawResult.service.providerId}:${rawResult.lawdCode}:${rawResult.dealMonth}`,
    sourceInstitution: "국토교통부",
    sourceName: rawResult.service.sourceName,
    sourceTitle: `${rawResult.service.assetTitle} (${rawResult.dealMonth})`,
    sourceUrl: "https://rt.molit.go.kr/",
    status: "current",
    // The fallback used to be "<service> public material", a sentence that repeated
    // the title. Nothing rather than filler.
    summary: firstLine || null
  };
}
