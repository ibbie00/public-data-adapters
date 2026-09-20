import type { EcosParsedQuery } from "./types";

export function getEcosApiKey(env: NodeJS.ProcessEnv) {
  return env.OPEN_ECOS_API_KEY?.trim() || env.ECOS_API_KEY?.trim() || "";
}

export function parseEcosQuery(query: string, env: NodeJS.ProcessEnv): EcosParsedQuery | null {
  const trimmed = query.trim();

  if (!trimmed || /^(key-statistics|key_statistics|indicators|main)$/i.test(trimmed)) {
    return { mode: "key-statistics" };
  }

  const parts = trimmed.split(/[/:,]/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 4) {
    return {
      cycle: parts[1]!,
      end: parts[3]!,
      itemCode: parts[4],
      mode: "statistic-search",
      start: parts[2]!,
      statCode: parts[0]!
    };
  }

  const defaultCycle = env.ECOS_DEFAULT_CYCLE?.trim();
  const defaultStart = env.ECOS_DEFAULT_START?.trim();
  const defaultEnd = env.ECOS_DEFAULT_END?.trim();
  if (/^[A-Za-z0-9_]+$/.test(trimmed) && defaultCycle && defaultStart && defaultEnd) {
    return {
      cycle: defaultCycle,
      end: defaultEnd,
      itemCode: env.ECOS_DEFAULT_ITEM_CODE?.trim() || undefined,
      mode: "statistic-search",
      start: defaultStart,
      statCode: trimmed
    };
  }

  return null;
}
