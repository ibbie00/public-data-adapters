// public-data-adapters: source-grounded adapters for public data APIs.
//
// Main entry point. Everything here is a pure adapter layer: fetch a public API,
// parse and normalize the response, and validate it into a context asset with
// provenance. No database, no queue, no LLM client, no product policy.
//
// The provider registry is the intended entry for most callers:
//   import { getContextResearchProviders } from "public-data-adapters";
//
// Callers inject their own outbound fetch (proxy, dispatcher, instrumentation),
// their own budget ledger, and their own LLM title fallback where applicable.

export * from "./lib/context-enrichment/index";
export * from "./lib/external/nec-election/index";
export * from "./lib/weather/config";
export * from "./lib/weather/source-kma";
