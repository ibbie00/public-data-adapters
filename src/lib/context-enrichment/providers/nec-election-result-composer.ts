import {
  summarizeNecElectionResultComparison,
  type NecElectionResultComparison,
  type NecElectionResultComparisonSummary,
  type NecVoteMargin
} from "../../external/nec-election";
import { getContextHash, getContextQueryFingerprint } from "../normalize";
import type { ContextAsset } from "../types";

const PROVIDER_TYPE = "election" as const;
const SOURCE_NAME_KO = "중앙선거관리위원회 투·개표 결과";
const SOURCE_INSTITUTION_KO = "중앙선거관리위원회";
const SOURCE_URL = "https://info.nec.go.kr/";

function formatNumber(value: number | undefined | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("ko-KR")
    : "확인 불가";
}

function formatCandidate(candidate: NecVoteMargin["winner"] | undefined) {
  if (!candidate) {
    return "확인 불가";
  }

  return [
    candidate.candidateName ?? "후보명 미확인",
    candidate.partyName ? `(${candidate.partyName})` : null
  ].filter(Boolean).join(" ");
}

function getMarginPoint(label: string, margin: NecVoteMargin | null) {
  if (!margin) {
    return `${label}: 공식 개표 결과에서 후보별 득표수를 확인하지 못했습니다.`;
  }

  return `${label}: ${formatCandidate(margin.winner)} ${formatNumber(margin.winner.votes)}표, ` +
    `2위 ${formatCandidate(margin.runnerUp)} ${formatNumber(margin.runnerUp?.votes)}표, ` +
    `표차 ${formatNumber(margin.marginVotes)}표`;
}

function getTurnoutPoint(label: string, summary: NecElectionResultComparisonSummary["left"]) {
  const parts = [
    `${label} 투표자 수 ${formatNumber(summary.totalVoters)}명`
  ];

  if (typeof summary.turnout === "number") {
    parts.push(`투표율 ${summary.turnout}%`);
  }

  return parts.join(", ");
}

function getSummaryText(summary: NecElectionResultComparisonSummary) {
  if (summary.marginChangeVotes === null) {
    return "두 선거의 공식 투·개표 자료를 비교하려 했지만, 표차 변화를 계산할 만큼의 후보별 득표수가 모두 확인되지는 않았습니다.";
  }

  const direction = summary.marginChangeVotes === 0
    ? "같았습니다"
    : summary.marginChangeVotes > 0
      ? "커졌습니다"
      : "줄었습니다";

  return `${summary.left.election.electionName}와 ${summary.right.election.electionName}의 1·2위 표차를 중앙선거관리위원회 공개자료 기준으로 비교하면, 오른쪽 선거의 표차가 ${formatNumber(Math.abs(summary.marginChangeVotes))}표 ${direction}.`;
}

export function buildNecElectionComparisonContextAsset(input: {
  checkedAt?: Date | string;
  comparison: NecElectionResultComparison;
  query: string;
}): ContextAsset {
  const checkedAt = input.checkedAt
    ? new Date(input.checkedAt).toISOString()
    : new Date().toISOString();
  const summary = summarizeNecElectionResultComparison(input.comparison);
  const sourceIdentifier = [
    "nec-election-comparison",
    summary.left.election.electionId,
    summary.right.election.electionId
  ].join(":");
  const sourceTitle = `${summary.left.election.electionName} vs ${summary.right.election.electionName} 표차 비교`;
  const keyPoints = [
    getMarginPoint(summary.left.election.electionName, summary.left.margin),
    getMarginPoint(summary.right.election.electionName, summary.right.margin),
    getTurnoutPoint(summary.left.election.electionName, summary.left),
    getTurnoutPoint(summary.right.election.electionName, summary.right)
  ];

  if (summary.marginChangeVotes !== null) {
    keyPoints.push(`표차 변화: ${formatNumber(Math.abs(summary.marginChangeVotes))}표 ${summary.marginChangeVotes > 0 ? "증가" : summary.marginChangeVotes < 0 ? "감소" : "동일"}`);
  }

  return {
    assetType: "ELECTION_CONTEXT",
    canonicalSourceKey: sourceIdentifier,
    checkedAt,
    confidence:
      summary.left.margin && summary.right.margin
        ? "high"
        : "medium",
    disclaimer: summary.disclaimer,
    keyPoints,
    limitations: [
      "이 자료는 중앙선거관리위원회 공개 투·개표 데이터를 정리한 참고용 맥락입니다.",
      "타키비는 선거의 승패 원인, 민심 변화, 부정선거 여부를 판단하지 않습니다.",
      "동명이거나 범위가 다른 선거구가 있을 수 있으므로 선거명, 선거일, 선거유형 코드를 함께 확인해야 합니다."
    ],
    locale: "ko",
    modelMetadata: {
      basis: summary.basis,
      leftElectionId: summary.left.election.electionId,
      marginChangeVotes: summary.marginChangeVotes,
      rightElectionId: summary.right.election.electionId,
      source: summary.source
    },
    providerType: PROVIDER_TYPE,
    // Fingerprint, not the query: `input.query` is the post's own text on the
    // flint-keyword path, and this key is stored on a public asset.
    queryKey: getContextQueryFingerprint(input.query),
    sourceHash: getContextHash({
      keyPoints,
      providerType: PROVIDER_TYPE,
      sourceIdentifier,
      summary: getSummaryText(summary)
    }),
    sourceIdentifier,
    sourceInstitution: SOURCE_INSTITUTION_KO,
    sourceName: SOURCE_NAME_KO,
    sourceTitle,
    sourceUrl: SOURCE_URL,
    status: "current",
    summary: getSummaryText(summary)
  };
}
