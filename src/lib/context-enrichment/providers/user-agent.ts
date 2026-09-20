// How this package introduces itself to the public data sources it reads.
//
// A source operator needs three things when our requests bother them: a name,
// a version, and an address to write to. Those are the same for every provider,
// so they live here; the fourth part, what THIS request is asking for, is the
// parameter. A deployment can override the whole header with
// PUBLIC_DATA_ADAPTERS_USER_AGENT, or just the contact with
// PUBLIC_DATA_ADAPTERS_CONTACT, so that whoever runs a copy of this package is
// the one who gets the mail.

const PRODUCT = "public-data-adapters";
const VERSION = "0.1";
const REPO_URL = "https://github.com/ibbie00/public-data-adapters";

export function contextEnrichmentUserAgent(
  purpose: string,
  env: NodeJS.ProcessEnv = process.env
) {
  const override = env.PUBLIC_DATA_ADAPTERS_USER_AGENT?.trim();
  if (override) {
    return override;
  }

  const contact = env.PUBLIC_DATA_ADAPTERS_CONTACT?.trim();
  const contactPart = contact ? `; contact: ${contact}` : "";

  return `${PRODUCT}/${VERSION} (${purpose}${contactPart}; ${REPO_URL})`;
}
