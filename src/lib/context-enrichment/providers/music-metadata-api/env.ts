export function clean(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

export function getMusicSearchQuery(query: string) {
  const cleaned = query
    .replace(/\b(music|artist|album|track|song|spotify|last\.fm|lastfm|context)\b/gi, " ")
    .replace(
      /\uC74C\uC545|\uC544\uD2F0\uC2A4\uD2B8|\uC568\uBC94|\uB178\uB798|\uACE1|\uB9E5\uB77D|\uC815\uCE58\uBCF4\uB2E4|\uBD99\uB294\s*\uAC8C\s*\uB9DE\uACA0\uB2E4|\uC774\uC57C\uAE30\uAC00\s*\uB098\uC640\uC11C\s*\uB9D0\uC778\uB370/g,
      " "
    )
    .replace(/[,.!?，。！？]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || query.trim();
}

export function getSpotifyClientId(env: NodeJS.ProcessEnv) {
  return env.SPOTIFY_CLIENT_ID?.trim() || "";
}

export function getSpotifyClientSecret(env: NodeJS.ProcessEnv) {
  return env.SPOTIFY_CLIENT_SECRET?.trim() || "";
}

export function getLastfmApiKey(env: NodeJS.ProcessEnv) {
  return env.LASTFM_API_KEY?.trim() || "";
}

export function hasSpotifyCredential(env: NodeJS.ProcessEnv) {
  return Boolean(getSpotifyClientId(env) && getSpotifyClientSecret(env));
}

export function hasAnyMusicCredential(env: NodeJS.ProcessEnv) {
  return Boolean(hasSpotifyCredential(env) || getLastfmApiKey(env));
}
