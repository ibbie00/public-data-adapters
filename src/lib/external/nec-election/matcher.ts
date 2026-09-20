import {
  NEC_OFFICIAL_RESULT_DISCLAIMER_KO,
  normalizeNecConstituencyCode,
  normalizeNecElectionCode,
  normalizeNecGusigunCode
} from "./normalize";
import type {
  NecConstituencyCode,
  NecElectionCode,
  NecElectionResultComparison,
  NecGusigunCode,
  NecMatchedElectionContext,
  NecOpenApiResult
} from "./types";

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function contains(haystack: string, needle: string | undefined) {
  return Boolean(needle && normalizeText(haystack).includes(normalizeText(needle)));
}

export function normalizeElectionCodesResult(result: NecOpenApiResult): NecElectionCode[] {
  return result.items
    .map(normalizeNecElectionCode)
    .filter((item): item is NecElectionCode => Boolean(item));
}

export function normalizeDistrictCodesResult(result: NecOpenApiResult): NecGusigunCode[] {
  return result.items
    .map(normalizeNecGusigunCode)
    .filter((item): item is NecGusigunCode => Boolean(item));
}

export function normalizeConstituencyCodesResult(result: NecOpenApiResult): NecConstituencyCode[] {
  return result.items
    .map(normalizeNecConstituencyCode)
    .filter((item): item is NecConstituencyCode => Boolean(item));
}

export function matchNecElectionContext(input: {
  constituencies?: NecConstituencyCode[];
  districts?: NecGusigunCode[];
  elections: NecElectionCode[];
  text: string;
}): NecMatchedElectionContext {
  const reasons: string[] = [];
  const scored = input.elections.map((election) => {
    let score = 0;
    if (contains(input.text, election.electionName)) {
      score += 0.45;
      reasons.push(`electionName:${election.electionName}`);
    }
    if (election.voteDate && contains(input.text, election.voteDate.slice(0, 4))) {
      score += 0.15;
      reasons.push(`voteYear:${election.voteDate.slice(0, 4)}`);
    }
    if (election.electionTypeCode && contains(input.text, election.electionTypeCode)) {
      score += 0.05;
    }
    return { election, score };
  }).sort((a, b) => b.score - a.score);
  const election = scored[0]?.score ? scored[0].election : undefined;

  const district = input.districts?.find((item) =>
    contains(input.text, item.provinceName) || contains(input.text, item.districtName)
  );
  if (district) {
    reasons.push(`district:${district.provinceName ?? ""}/${district.districtName}`);
  }

  const constituency = input.constituencies?.find((item) =>
    contains(input.text, item.constituencyName) ||
    contains(input.text, item.provinceName) ||
    contains(input.text, item.districtName)
  );
  if (constituency) {
    reasons.push(`constituency:${constituency.constituencyName}`);
  }

  const confidence = Math.min(0.95, (scored[0]?.score ?? 0) + (district ? 0.2 : 0) + (constituency ? 0.25 : 0));

  return {
    confidence,
    constituencyName: constituency?.constituencyName,
    districtName: constituency?.districtName ?? district?.districtName,
    election,
    electionTypeCode: constituency?.electionTypeCode ?? election?.electionTypeCode,
    provinceName: constituency?.provinceName ?? district?.provinceName,
    reasons
  };
}

export function buildNecElectionResultComparison(input: Omit<NecElectionResultComparison, "basis" | "disclaimer" | "source" | "sourceNameKo">): NecElectionResultComparison {
  return {
    ...input,
    basis: "official_vote_count_result",
    disclaimer: NEC_OFFICIAL_RESULT_DISCLAIMER_KO,
    source: "NEC",
    sourceNameKo: "중앙선거관리위원회"
  };
}
