import {
  normalizeElectionCodesResult,
  type NecOpenApiResult
} from "../../../external/nec-election";
import {
  GENERAL_ELECTION_STATISTICS_ID,
  SOURCE_INSTITUTION_KO,
  SOURCE_NAME_KO
} from "./constants";
import {
  compareElectionMatches,
  getElectionQueryScore,
  getQueryVoteDates,
  isGenericElectionQuery
} from "./query";
import type { NecElectionRawResult } from "./types";

function createGeneralElectionStatisticsResult(input: {
  checkedAt: string;
  query: string;
}): NecElectionRawResult {
  return {
    __checkedAt: input.checkedAt,
    __generalFallback: true,
    __query: input.query,
    electionId: GENERAL_ELECTION_STATISTICS_ID,
    electionName: SOURCE_NAME_KO,
    electionTypeCode: "",
    source: "NEC",
    sourceNameKo: SOURCE_INSTITUTION_KO,
    voteDate: ""
  };
}

export function normalizeCommonCodeResult(
  result: NecOpenApiResult,
  query: string,
  limit: number,
  referenceDate: Date
): NecElectionRawResult[] {
  if (!result.ok) {
    return [];
  }

  const elections = normalizeElectionCodesResult(result);
  const voteDates = getQueryVoteDates(query, referenceDate);
  const scored = elections
    .map((election) => ({
      election,
      score: getElectionQueryScore(election, query, voteDates)
    }))
    .filter((item) => (voteDates.size > 0 ? voteDates.has(item.election.voteDate) : item.score > 0))
    .sort(compareElectionMatches);
  const candidates = scored.length > 0
    ? scored.map((item) => item.election)
    : voteDates.size === 0 && isGenericElectionQuery(query)
      ? [...elections].sort((left, right) => right.voteDate.localeCompare(left.voteDate))
      : [];

  const normalized = candidates.slice(0, limit).map((election) => ({
    ...election,
    __checkedAt: result.fetchedAt.toISOString(),
    __query: query
  }));

  if (normalized.length > 0) {
    return normalized;
  }

  if (isGenericElectionQuery(query)) {
    return [
      createGeneralElectionStatisticsResult({
        checkedAt: result.fetchedAt.toISOString(),
        query
      })
    ];
  }

  return [];
}
