import { DEFAULT_REFERER, LAW_API_BASE_URL } from "./constants";
import type { NationalLawTarget } from "./types";

export function getTarget(providerType: "law" | "ordinance"): NationalLawTarget {
  return providerType === "law" ? "law" : "ordin";
}

export function redactNationalLawUrl(url: URL | string) {
  const copy = new URL(String(url), `${LAW_API_BASE_URL}/`);

  if (copy.searchParams.has("OC")) {
    copy.searchParams.delete("OC");
  }

  return copy.toString();
}

export function getNationalLawReferer(env: NodeJS.ProcessEnv) {
  const referer =
    env.LAW_REFERER?.trim() ||
    env.PUBLIC_DATA_ADAPTERS_BASE_URL?.trim() ||
    env.APP_BASE_URL?.trim() ||
    env.NEXT_PUBLIC_SITE_URL?.trim() ||
    DEFAULT_REFERER;

  return referer.endsWith("/") ? referer : `${referer}/`;
}
