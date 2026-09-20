export function clean(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

export function getFirstString(
  record: Record<string, unknown>,
  keys: readonly string[]
) {
  for (const key of keys) {
    const value = clean(record[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

export function getNkisApiKey(env: NodeJS.ProcessEnv) {
  return env.OPEN_NKIS_API_KEY?.trim() || env.NKIS_API_KEY?.trim() || "";
}

export function getDefaultQuery(env: NodeJS.ProcessEnv) {
  return env.NKIS_POLICY_REPORT_SMOKE_QUERY?.trim() || env.NKIS_SMOKE_QUERY?.trim() || "";
}
