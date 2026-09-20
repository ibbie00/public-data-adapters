import assert from "node:assert/strict";
import { before, test } from "node:test";

// Audit D6 round 5. An external context provider, 238 lines, nothing running it. What makes
// it worth a pin is not the parsing -- it is the ORDER of four gates in front of a network
// call, and the fact that each of them must stop the call rather than merely discard its
// result.
//
// The provider sends two requests: one for a token, then one for data. A refusal that still
// reaches the token request has spent a credential round-trip against a rate-limited
// government API, and has told that API we are here. So "returns an empty list" is not the
// property to pin. "Never touched the network" is.
//
// Every env name below is read from the source rather than remembered, after four separate
// hand-typed fixture values went wrong earlier in this cycle.

const ENABLED_ENV = {
  CONTEXT_ENRICHMENT_ENABLED: "true",
  CONTEXT_PROVIDER_STATISTICS_ENABLED: "true",
  SGIS_CONSUMER_KEY: "key",
  SGIS_CONSUMER_SECRET: "secret"
};

let provider: typeof import("../../src/lib/context-enrichment/providers/sgis-api");

before(async () => {
  provider = await import("../../src/lib/context-enrichment/providers/sgis-api");
});

function run(env: Record<string, string>, budgetSnapshot?: unknown) {
  const fetches: string[] = [];

  const instance = provider.createSgisApiProvider({
    fetchImpl: (async (url: unknown) => {
      fetches.push(String(url));

      return {
        json: async () => ({}),
        ok: true,
        status: 200,
        text: async () => "{}"
      };
    }) as never
  });

  return {
    fetches,
    result: instance.searchWithStatus("서울 인구", { budgetSnapshot, env } as never)
  };
}

test("the feature flag stops the call, not just the result", async () => {
  const off = run({ ...ENABLED_ENV, CONTEXT_PROVIDER_STATISTICS_ENABLED: "false" });
  const decision = await off.result;

  assert.equal(decision.status, "PROVIDER_DISABLED");
  assert.deepEqual(decision.results, []);
  assert.deepEqual(off.fetches, [], "a disabled provider must not touch the network at all");

  // The master switch has to bite the same way, independently of the per-provider one.
  const masterOff = run({ ...ENABLED_ENV, CONTEXT_ENRICHMENT_ENABLED: "false" });

  assert.equal((await masterOff.result).status, "PROVIDER_DISABLED");
  assert.deepEqual(masterOff.fetches, []);
});

test("missing credentials are noticed before anything is sent", async () => {
  for (const missing of ["SGIS_CONSUMER_KEY", "SGIS_CONSUMER_SECRET"]) {
    const attempt = run({ ...ENABLED_ENV, [missing]: "" });
    const decision = await attempt.result;

    assert.equal(decision.status, "MISSING_CREDENTIALS", `${missing} empty must be caught here`);
    assert.deepEqual(
      attempt.fetches,
      [],
      "half a credential pair must not become a rejected auth request upstream"
    );
  }
});

test("an exhausted budget stops the TOKEN request, not merely the data request", async () => {
  // The ordering that matters. Checked after the token fetch, the budget would still cost a
  // credential round-trip against a rate-limited government API every time it refused -- and
  // would announce us to that API while claiming to be switched off.
  // The snapshot shape is read from evaluateContextProviderBudget, not guessed: it counts
  // calls against a limit rather than carrying a pre-computed verdict. A fixture that made
  // up an `allowed: false` field would have sailed straight past the check.
  const attempt = run(ENABLED_ENV, { dailyCallCount: 1_000_000, hourlyCallCount: 1_000_000 });
  const decision = await attempt.result;

  assert.equal(decision.status, "RATE_LIMITED");
  assert.deepEqual(attempt.fetches, [], "no auth call, no data call");
});

test("no refusal throws: each one is a status the caller can act on", async () => {
  // These run inside enrichment for an ordinary post. An exception here would surface as a
  // failed job rather than as a card that simply is not there.
  for (const env of [
    { ...ENABLED_ENV, CONTEXT_PROVIDER_STATISTICS_ENABLED: "false" },
    { ...ENABLED_ENV, SGIS_CONSUMER_KEY: "" }
  ]) {
    const decision = await run(env).result;

    assert.ok(decision.checkedAt, "every answer carries when it was decided");
    assert.equal(decision.provider, "sgis");
    assert.ok(Array.isArray(decision.results));
  }
});
