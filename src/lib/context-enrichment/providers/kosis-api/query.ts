import type { KosisParsedQuery } from "./types";

export function getKosisApiKey(env: NodeJS.ProcessEnv) {
  return env.OPEN_KOSIS_API_KEY?.trim() || "";
}

export function parseKosisQuery(query: string, env: NodeJS.ProcessEnv): KosisParsedQuery | null {
  const trimmed = query.trim();
  const explicit = trimmed.match(/^([A-Za-z0-9_]+)\s*[:/]\s*([A-Za-z0-9_./-]+)$/);
  const envOrgId = env.KOSIS_DEFAULT_ORG_ID?.trim();

  if (explicit) {
    return {
      orgId: explicit[1]!,
      tableId: explicit[2]!
    };
  }
  if (envOrgId && /^[A-Za-z0-9_./-]+$/.test(trimmed)) {
    return {
      orgId: envOrgId,
      tableId: trimmed
    };
  }

  return null;
}

export function getKosisPeriodicity(env: NodeJS.ProcessEnv) {
  const candidate = env.KOSIS_DEFAULT_PRD_SE?.trim().toUpperCase();

  return candidate && /^(Y|H|Q|M|D|IR)$/.test(candidate) ? candidate : "Y";
}
