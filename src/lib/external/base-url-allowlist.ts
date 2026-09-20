// Defence in depth for the public-data adapters' configurable endpoints.
//
// Each of these adapters takes its base URL from the environment, and Annict
// sends a bearer token to whatever that URL names. Editing the environment is
// already a privileged act, so this is not a hole an outsider walks through:
// it is the difference between a mistyped or half-copied deploy failing loudly
// and one quietly mailing a token, a service key, or a user's search terms to a
// host nobody intended.
//
// Exact hostnames, not suffixes: "ends with annict.com" would accept
// evil-annict.com. HTTPS only, no userinfo, no non-default port.

export class ExternalBaseUrlConfigError extends Error {
  constructor(
    public readonly provider: ExternalApiProvider,
    public readonly reason: string,
    message: string
  ) {
    super(message);
    this.name = "ExternalBaseUrlConfigError";
  }
}

export type ExternalApiProvider =
  | "anilist"
  | "annict"
  | "grac"
  | "jikan"
  | "nec-election";

const ALLOWED_HOSTS: Record<ExternalApiProvider, readonly string[]> = {
  anilist: ["graphql.anilist.co"],
  annict: ["api.annict.com"],
  // The GRAC rating API contract is still unconfirmed (see
  // docs/ops/context-provider-activation-plan-2026-05-31.md) and the production
  // value is empty, so this list is provisional: the government open-data
  // gateway and GRAC's own domain, the two places such an API would live.
  // Widening it is one line, and should happen when the contract is confirmed
  // rather than by loosening the rule.
  grac: ["apis.data.go.kr", "grac.or.kr", "www.grac.or.kr"],
  jikan: ["api.jikan.moe"],
  "nec-election": ["apis.data.go.kr"]
};

const ENV_VAR_HINTS: Record<ExternalApiProvider, string> = {
  anilist: "ANILIST_GRAPHQL_ENDPOINT",
  annict: "ANNICT_API_BASE_URL",
  grac: "GRAC_GAME_API_BASE_URL",
  jikan: "JIKAN_API_BASE_URL",
  "nec-election": "NEC_*_API_BASE_URL"
};

function fail(provider: ExternalApiProvider, reason: string, detail: string): never {
  throw new ExternalBaseUrlConfigError(
    provider,
    reason,
    `${provider} base URL rejected (${ENV_VAR_HINTS[provider]}): ${detail}. ` +
      `Allowed hosts: ${ALLOWED_HOSTS[provider].join(", ")}.`
  );
}

// Returns the parsed URL so callers can keep building on it. Throws
// ExternalBaseUrlConfigError: never falls back to the default, because a
// silent fallback is exactly what hides a bad deploy.
//
// The message deliberately names the host and scheme only. A configured base
// URL should not carry credentials, but if one ever did, the error text is the
// last place it should surface.
export function assertAllowedExternalBaseUrl(
  provider: ExternalApiProvider,
  value: string | URL
): URL {
  let url: URL;

  try {
    url = new URL(String(value));
  } catch {
    fail(provider, "unparseable", "not a URL");
  }

  if (url.protocol !== "https:") {
    fail(provider, "insecure_scheme", `scheme "${url.protocol}" is not https:`);
  }

  if (url.username || url.password) {
    fail(provider, "userinfo", "the URL carries userinfo");
  }

  if (url.port) {
    fail(provider, "non_default_port", `port ${url.port} is not the default HTTPS port`);
  }

  const hostname = url.hostname.toLowerCase();

  if (!ALLOWED_HOSTS[provider].includes(hostname)) {
    fail(provider, "host_not_allowed", `host "${hostname}" is not on the allowlist`);
  }

  return url;
}

export function getAllowedExternalBaseUrlHosts(provider: ExternalApiProvider) {
  return ALLOWED_HOSTS[provider];
}
