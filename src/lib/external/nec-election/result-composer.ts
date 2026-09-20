import {
  normalizeNecCountingStatus,
  normalizeNecVoteStatus,
  NEC_OFFICIAL_RESULT_DISCLAIMER_KO,
  NEC_SOURCE,
  NEC_SOURCE_NAME_KO
} from "./normalize";
import type {
  NecCountingStatus,
  NecElectionCode,
  NecElectionResultComparison,
  NecOpenApiResult,
  NecVoteCountClient,
  NecVoteStatus
} from "./types";

export type NecTopCandidate = {
  candidateName?: string;
  index: number;
  partyName?: string;
  votes: number;
};

export type NecVoteMargin = {
  marginVotes: number;
  runnerUp?: NecTopCandidate;
  winner: NecTopCandidate;
};

export type NecElectionResultComparisonSummary = {
  basis: "official_vote_count_result";
  disclaimer: string;
  left: {
    election: NecElectionCode;
    margin: NecVoteMargin | null;
    turnout?: number;
    totalVoters?: number;
  };
  marginChangeVotes: number | null;
  right: {
    election: NecElectionCode;
    margin: NecVoteMargin | null;
    turnout?: number;
    totalVoters?: number;
  };
  source: "NEC";
  sourceNameKo: "중앙선거관리위원회";
};

export type NecResultComparisonFetchInput = {
  client: NecVoteCountClient;
  leftElection: NecElectionCode;
  params?: {
    sdName?: string;
    sggName?: string;
    wiwName?: string;
  };
  rightElection: NecElectionCode;
};

function selectFirstNormalized<T>(
  result: NecOpenApiResult,
  normalize: (record: Record<string, unknown>) => T | null
) {
  if (!result.ok) {
    return undefined;
  }

  return result.items
    .map((item) => normalize(item))
    .find((item): item is T => Boolean(item));
}

export function getNecTopCandidates(countingStatus: NecCountingStatus): NecTopCandidate[] {
  return countingStatus.candidates
    .filter((candidate): candidate is NecTopCandidate =>
      typeof candidate.votes === "number" && Number.isFinite(candidate.votes)
    )
    .sort((left, right) => right.votes - left.votes || left.index - right.index);
}

export function getNecVoteMargin(countingStatus?: NecCountingStatus): NecVoteMargin | null {
  if (!countingStatus) {
    return null;
  }

  const [winner, runnerUp] = getNecTopCandidates(countingStatus);

  if (!winner) {
    return null;
  }

  return {
    marginVotes: runnerUp ? winner.votes - runnerUp.votes : winner.votes,
    runnerUp,
    winner
  };
}

export function summarizeNecElectionResultComparison(
  comparison: NecElectionResultComparison
): NecElectionResultComparisonSummary {
  const leftMargin = getNecVoteMargin(comparison.left.countingStatus);
  const rightMargin = getNecVoteMargin(comparison.right.countingStatus);
  const marginChangeVotes =
    leftMargin && rightMargin ? rightMargin.marginVotes - leftMargin.marginVotes : null;

  return {
    basis: "official_vote_count_result",
    disclaimer: comparison.disclaimer,
    left: {
      election: comparison.left.election,
      margin: leftMargin,
      turnout: comparison.left.voteStatus?.turnout,
      totalVoters: comparison.left.voteStatus?.totalVoters ?? comparison.left.countingStatus?.votes
    },
    marginChangeVotes,
    right: {
      election: comparison.right.election,
      margin: rightMargin,
      turnout: comparison.right.voteStatus?.turnout,
      totalVoters: comparison.right.voteStatus?.totalVoters ?? comparison.right.countingStatus?.votes
    },
    source: NEC_SOURCE,
    sourceNameKo: NEC_SOURCE_NAME_KO
  };
}

async function fetchOneElectionResult(input: {
  client: NecVoteCountClient;
  election: NecElectionCode;
  params?: NecResultComparisonFetchInput["params"];
}): Promise<{
  countingStatus?: NecCountingStatus;
  voteStatus?: NecVoteStatus;
}> {
  const baseParams = {
    sdName: input.params?.sdName,
    sgId: input.election.electionId,
    sgTypecode: input.election.electionTypeCode,
    wiwName: input.params?.wiwName
  };
  const [voteResult, countingResult] = await Promise.all([
    input.client.fetchVoteStatus(baseParams),
    input.client.fetchCountingStatus({
      ...baseParams,
      sggName: input.params?.sggName
    })
  ]);

  return {
    countingStatus: selectFirstNormalized(countingResult, normalizeNecCountingStatus),
    voteStatus: selectFirstNormalized(voteResult, normalizeNecVoteStatus)
  };
}

export async function fetchNecElectionResultComparison(
  input: NecResultComparisonFetchInput
): Promise<NecElectionResultComparison> {
  const [left, right] = await Promise.all([
    fetchOneElectionResult({
      client: input.client,
      election: input.leftElection,
      params: input.params
    }),
    fetchOneElectionResult({
      client: input.client,
      election: input.rightElection,
      params: input.params
    })
  ]);

  return {
    basis: "official_vote_count_result",
    disclaimer: NEC_OFFICIAL_RESULT_DISCLAIMER_KO,
    left: {
      countingStatus: left.countingStatus,
      election: input.leftElection,
      voteStatus: left.voteStatus
    },
    right: {
      countingStatus: right.countingStatus,
      election: input.rightElection,
      voteStatus: right.voteStatus
    },
    source: NEC_SOURCE,
    sourceNameKo: NEC_SOURCE_NAME_KO
  };
}
