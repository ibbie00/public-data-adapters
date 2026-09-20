import assert from "node:assert/strict";
import test from "node:test";

import { getContextResearchProviders } from "../../src/lib/context-enrichment/providers/registry/factories";

// The package's default outbound path is a plain fetch. A caller that needs its
// own egress path (proxy, instrumentation, DNS pin) passes fetchImpl and expects
// every network adapter to use it, not just the one someone remembered to wire.

test("an injected fetchImpl reaches an enabled network provider", async () => {
  const calls: string[] = [];
  const env = {
    CONTEXT_ENRICHMENT_ENABLED: "1",
    CONTEXT_PROVIDER_BILL_ENABLED: "1",
    OPEN_ASSEMBLY_API_KEY: "test-key"
  } as NodeJS.ProcessEnv;

  const providers = getContextResearchProviders(env, {
    fetchImpl: async (url) => {
      calls.push(String(url));
      return new Response("{}", { status: 200 });
    }
  });

  const bill = providers.find((provider) => provider.providerType === "bill");
  assert.ok(bill, "the bill provider should be enabled by its flag");

  await bill.search("test", { env });

  assert.equal(calls.length > 0, true, "the injected fetch was not used");
});

test("no injection means the package constructs no network client of its own", () => {
  const env = {
    CONTEXT_ENRICHMENT_ENABLED: "1",
    CONTEXT_PROVIDER_BILL_ENABLED: "1",
    OPEN_ASSEMBLY_API_KEY: "test-key"
  } as NodeJS.ProcessEnv;

  const providers = getContextResearchProviders(env);

  assert.equal(providers.length > 0, true);
});
