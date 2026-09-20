import type { NecElectionCode } from "../../../external/nec-election";

type ElectionMatch = {
  election: NecElectionCode;
  score: number;
};

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function includesAny(normalizedText: string, keywords: string[]) {
  return keywords.some((keyword) => normalizedText.includes(normalizeText(keyword)));
}

export function parseDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isFinite(date.getTime()) ? date : null;
}

function toVoteDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return [
    String(year),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0")
  ].join("");
}

function addVoteDate(
  dates: Set<string>,
  yearValue: string | number,
  monthValue: string | number,
  dayValue: string | number
) {
  const voteDate = toVoteDate(Number(yearValue), Number(monthValue), Number(dayValue));

  if (voteDate) {
    dates.add(voteDate);
  }
}

export function getQueryVoteDates(query: string, referenceDate: Date) {
  const dates = new Set<string>();

  for (const match of query.matchAll(/\b((?:19|20)\d{2})(0[1-9]|1[0-2])([0-2]\d|3[01])\b/g)) {
    addVoteDate(dates, match[1] ?? "", match[2] ?? "", match[3] ?? "");
  }

  for (const match of query.matchAll(/(^|[^\d])((?:19|20)\d{2})\s*(?:년|[./-])\s*(\d{1,2})\s*(?:월|[./-])\s*(\d{1,2})\s*(?:일)?(?=$|[^\d])/g)) {
    addVoteDate(dates, match[2] ?? "", match[3] ?? "", match[4] ?? "");
  }

  for (const match of query.matchAll(/(^|[^\d])(\d{1,2})\s*(?:월\s*|[./·ㆍ-])\s*(\d{1,2})(?:\s*일)?(?=$|[^\d])/g)) {
    const prefix = match[1] ?? "";
    const prefixIndex = match.index ?? 0;

    if (
      prefix &&
      /[./-]/.test(prefix) &&
      prefixIndex > 0 &&
      /\d/.test(query[prefixIndex - 1] ?? "")
    ) {
      continue;
    }

    addVoteDate(
      dates,
      referenceDate.getUTCFullYear(),
      match[2] ?? "",
      match[3] ?? ""
    );
  }

  return dates;
}

function getElectionAliasScore(election: NecElectionCode, normalizedQuery: string) {
  const electionName = normalizeText(election.electionName);
  let score = 0;

  if (
    includesAny(normalizedQuery, ["대선", "대통령선거", "대통령 선거"]) &&
    electionName.includes("대통령")
  ) {
    score += 0.45;
  }
  if (
    includesAny(normalizedQuery, [
      "지방선거",
      "지방 선거",
      "서울시장",
      "시장선거",
      "도지사",
      "시도지사",
      "광역단체장"
    ]) &&
    (electionName.includes("지방") ||
      electionName.includes("시도지사") ||
      electionName.includes("구시군") ||
      electionName.includes("교육감"))
  ) {
    score += 0.45;
  }
  if (
    includesAny(normalizedQuery, ["총선", "국회의원선거", "국회의원 선거"]) &&
    electionName.includes("국회의원")
  ) {
    score += 0.45;
  }

  return score;
}

export function getElectionQueryScore(
  election: NecElectionCode,
  query: string,
  voteDates: Set<string>
) {
  const normalized = normalizeText(query);
  const normalizedElectionName = normalizeText(election.electionName);
  let score = 0;

  if (normalized.includes(election.electionId)) {
    score += 1;
  }
  if (normalized.includes(normalizedElectionName)) {
    score += 0.8;
  }
  if (voteDates.has(election.voteDate)) {
    score += 1;
  }
  if (election.voteDate && normalized.includes(election.voteDate.slice(0, 4))) {
    score += 0.2;
  }

  return score + getElectionAliasScore(election, normalized);
}

export function isGenericElectionQuery(query: string) {
  return includesAny(normalizeText(query), [
    "선거",
    "투표",
    "개표",
    "득표",
    "후보",
    "당선"
  ]);
}

export function compareElectionMatches(left: ElectionMatch, right: ElectionMatch) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  return right.election.voteDate.localeCompare(left.election.voteDate);
}
