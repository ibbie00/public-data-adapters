import { NEC_OFFICIAL_RESULT_DISCLAIMER_KO } from "../../../external/nec-election";
import { getContextAssetFreshnessPolicy } from "../../freshness";
import { getContextHash, getContextQueryFingerprint } from "../../normalize";
import type { ContextAsset, ContextFreshnessPolicy } from "../../types";
import {
  PROVIDER_TYPE,
  SOURCE_INSTITUTION_KO,
  SOURCE_NAME_KO
} from "./constants";
import type { NecElectionRawResult } from "./types";

export function normalizeNecElectionAsset(rawResult: NecElectionRawResult): ContextAsset {
  const sourceIdentifier = rawResult.electionId;
  const sourceTitle = rawResult.voteDate
    ? `${rawResult.electionName} (${rawResult.voteDate})`
    : rawResult.electionName;
  const sourceUrl = "https://info.nec.go.kr/";
  const sourceHash = getContextHash({
    electionId: rawResult.electionId,
    electionName: rawResult.electionName,
    electionTypeCode: rawResult.electionTypeCode,
    providerType: PROVIDER_TYPE,
    voteDate: rawResult.voteDate
  });

  return {
    assetType: "ELECTION_CONTEXT",
    canonicalSourceKey: `nec:election:${sourceIdentifier}`,
    checkedAt: rawResult.__checkedAt,
    confidence: rawResult.__generalFallback ? "low" : "medium",
    disclaimer: NEC_OFFICIAL_RESULT_DISCLAIMER_KO,
    keyPoints: rawResult.__generalFallback
      ? [
          "선거 맥락이 감지되었지만 정확한 선거일 또는 선거ID를 특정하지 않았습니다.",
          "선거별 투·개표 자료는 중앙선거관리위원회 선거통계 페이지에서 직접 확인할 수 있습니다.",
          "선거명, 선거일, 지역, 선거구를 함께 확인해야 합니다."
        ]
      : [
          `선거명: ${rawResult.electionName}`,
          `선거일: ${rawResult.voteDate || "공식 코드 자료 확인 필요"}`,
          `선거유형 코드: ${rawResult.electionTypeCode || "공식 코드 자료 확인 필요"}`
        ],
    locale: "ko",
    modelMetadata: rawResult.__generalFallback
      ? {
          fallbackReason: "election_context_without_exact_vote_date_match",
          searchRequired: true
        }
      : undefined,
    providerType: PROVIDER_TYPE,
    // Fingerprint, not the query: `__query` is the post's own text on the
    // flint-keyword path, and this key is stored on a public asset.
    queryKey: getContextQueryFingerprint(rawResult.__query),
    sourceHash,
    sourceIdentifier,
    sourceInstitution: SOURCE_INSTITUTION_KO,
    sourceName: SOURCE_NAME_KO,
    sourceTitle,
    sourceUrl,
    status: "current",
    summary: rawResult.__generalFallback
      ? "선거 관련 글과 함께 확인할 수 있는 중앙선거관리위원회 선거통계 공식 페이지입니다."
      : "중앙선거관리위원회 공공데이터에서 확인한 선거 코드 맥락입니다."
  };
}

export function getNecElectionFreshnessPolicy(
  asset?: ContextAsset
): ContextFreshnessPolicy {
  return getContextAssetFreshnessPolicy(
    asset ?? {
      assetType: "ELECTION_CONTEXT",
      providerType: PROVIDER_TYPE,
      sourceTitle: SOURCE_NAME_KO
    }
  );
}
