import { CURATED_LAW_ALIASES, PROVIDER_ID } from "./constants";
import type { NationalLawRawResult } from "./types";

function normalizeLawQuery(query: string) {
  return query.replace(/\s+/g, "").trim();
}

export function resolveLawAlias(query: string) {
  const normalized = normalizeLawQuery(query);
  const direct = CURATED_LAW_ALIASES[normalized];
  if (direct) {
    return direct;
  }

  const embedded = Object.entries(CURATED_LAW_ALIASES).find(([alias]) =>
    normalized.includes(alias)
  );

  return embedded?.[1];
}

/**
 * A statute, its enforcement decree and its enforcement rule are THREE different laws with
 * their own texts, their own effective dates and their own article numbers.
 *
 * `resolveLawAlias` matches an alias anywhere inside the query, so "청탁금지법 시행령"
 * matched the alias for the statute and `alias.query` then replaced the WHOLE query --
 * dropping the word that said which of the three was meant. We answered a post about the
 * decree with the parent act (founder caught it on the guidance page's own screenshot,
 * 2026-08-19).
 *
 * Only aliased laws were affected: "도로교통법 시행규칙" is not in the alias table, so it
 * went out unchanged and came back correct.
 *
 * ⚠️ Keeping the word is not enough. The registry does not recognise a SHORT name with a
 * subordinate instrument attached: asked for "청탁금지법 시행령" it answers with the
 * statute and nothing else (one row, measured 2026-08-19). Given the FULL name it answers
 * with the decree. So a subordinate instrument switches the search to the official name.
 */
const SUBORDINATE_INSTRUMENTS = ["시행규칙", "시행령"] as const;

export function getSearchQuery(query: string) {
  const alias = resolveLawAlias(query);

  if (!alias || alias.ambiguous) {
    return query;
  }

  const normalized = normalizeLawQuery(query);
  const instrument = SUBORDINATE_INSTRUMENTS.find(
    (word) => normalized.endsWith(word) && !alias.query.endsWith(word)
  );

  if (!instrument) {
    return alias.query;
  }

  return `${alias.officialName ?? alias.query} ${instrument}`;
}

export function withProviderMetadata(
  result: NationalLawRawResult,
  query: string,
  checkedAt: string
): NationalLawRawResult {
  const alias = resolveLawAlias(query);

  return {
    ...result,
    __checkedAt: checkedAt,
    __colloquialAliases: alias?.colloquialAliases,
    __officialName: alias?.officialName,
    __provider: PROVIDER_ID,
    __shortName: alias?.shortName,
    __status: "OK"
  };
}
