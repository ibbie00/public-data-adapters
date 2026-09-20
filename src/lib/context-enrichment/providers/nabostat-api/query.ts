export function getNabostatApiKey(env: NodeJS.ProcessEnv) {
  return env.OPEN_NABOSTAT_API_KEY?.trim() || "";
}

export function looksLikeTableId(query: string) {
  return /^T\d{8,}$/i.test(query.trim());
}

export function getNabostatDataCycle(env: NodeJS.ProcessEnv) {
  return env.NABOSTAT_DTACYCLE_CD?.trim() || "YY";
}
