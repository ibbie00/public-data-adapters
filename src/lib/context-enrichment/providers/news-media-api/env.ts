export function getGuardianApiKey(env: NodeJS.ProcessEnv) {
  return env.GUARDIAN_API_KEY?.trim() || "";
}

export function getNytApiKey(env: NodeJS.ProcessEnv) {
  return env.NYT_API_KEY?.trim() || "";
}

export function getNewsApiKey(env: NodeJS.ProcessEnv) {
  return env.NEWSAPI_KEY?.trim() || "";
}

export function hasAnyNewsCredential(env: NodeJS.ProcessEnv) {
  return Boolean(getGuardianApiKey(env) || getNytApiKey(env) || getNewsApiKey(env));
}
