import { CURATED_ALIASES } from "./constants";
import type { LegalizeKrLawRecord } from "./types";

export function normalizeLegalizeQuery(value: string) {
  return value.replace(/\s+/g, "").trim();
}

export function resolveLegalizeAlias(query: string) {
  const normalized = normalizeLegalizeQuery(query);

  return Object.entries(CURATED_ALIASES).find(([alias, value]) =>
    normalized.includes(alias) ||
    normalized.includes(normalizeLegalizeQuery(value.officialName)) ||
    Boolean(value.shortName && normalized.includes(normalizeLegalizeQuery(value.shortName)))
  )?.[1];
}

export function matchesLegalizeQuery(record: LegalizeKrLawRecord, query: string) {
  const normalizedQuery = normalizeLegalizeQuery(query);
  const alias = resolveLegalizeAlias(query);
  const candidates = [
    record.title,
    record.originalTitle,
    alias?.officialName,
    alias?.shortName,
    ...(alias?.colloquialAliases ?? [])
  ].filter((value): value is string => Boolean(value));

  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeLegalizeQuery(candidate);
    return normalizedCandidate.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedCandidate) ||
      (alias && normalizeLegalizeQuery(alias.officialName) === normalizeLegalizeQuery(record.title));
  });
}
