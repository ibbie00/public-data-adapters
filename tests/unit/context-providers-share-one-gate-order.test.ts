import assert from "node:assert/strict";
import { before, test } from "node:test";

// Audit D6 round 7, closing the bundle. Round 5 pinned the SGIS provider's gate order; this
// is its sibling, and the point of putting them in ONE file is that the property belongs to
// the family rather than to either file.
//
// Every external context provider stands in front of a rate-limited public API with the same
// four gates in the same order: feature flag, credentials, budget, then the network. Get the
// order wrong in a new provider and the failure is invisible from here -- we simply spend
// somebody's quota, and announce ourselves to an API we told the operator we had switched
// off.
//
// A third provider added tomorrow gets a row here, and that is deliberate: the alternative is
// deriving the list, which cannot work while each provider is constructed differently.

const SGIS_ENV = {
  CONTEXT_ENRICHMENT_ENABLED: "true",
  CONTEXT_PROVIDER_STATISTICS_ENABLED: "true",
  SGIS_CONSUMER_KEY: "key",
  SGIS_CONSUMER_SECRET: "secret"
};

const SEOUL_ENV = {
  CONTEXT_ENRICHMENT_ENABLED: "true",
  CONTEXT_PROVIDER_PUBLIC_INSTITUTION_ENABLED: "true",
  SEOUL_OPEN_DATA_API_KEY: "key"
};

// The query is per-provider: real estate only leaves the gate when the post names both a
// property type and a transaction type, so the Seoul query would return INVALID_QUERY
// instead and every assertion below would pass without measuring the gates at all.
const REAL_ESTATE_ENV = {
  CONTEXT_ENRICHMENT_ENABLED: "true",
  CONTEXT_PROVIDER_REAL_ESTATE_ENABLED: "true",
  MOLIT_APARTMENT_RENT_API_KEY: "key"
};

// Counts against a limit; NOT a pre-computed verdict. Read from
// evaluateContextProviderBudget after a made-up `allowed: false` fixture sailed past the
// check in round 5.
const EXHAUSTED = { dailyCallCount: 1_000_000, hourlyCallCount: 1_000_000 };

type Provider = {
  searchWithStatus: (
    query: string,
    options: unknown
  ) => Promise<{ checkedAt: string; provider: string; results: unknown[]; status: string }>;
};

let makeRealEstate: (options: unknown) => Provider;
let makeSgis: (options: unknown) => Provider;
let makeSeoul: (options: unknown) => Provider;

before(async () => {
  const realEstate = await import("../../src/lib/context-enrichment/providers/real-estate-api");
  const sgis = await import("../../src/lib/context-enrichment/providers/sgis-api");
  const seoul = await import("../../src/lib/context-enrichment/providers/seoul-open-data-api");

  makeRealEstate = realEstate.createRealEstateApiProvider as never;
  makeSgis = sgis.createSgisApiProvider as never;
  makeSeoul = seoul.createSeoulOpenDataApiProvider as never;
});

function attempt(
  make: (options: unknown) => Provider,
  env: Record<string, string>,
  query: string,
  budgetSnapshot?: unknown
) {
  const fetches: string[] = [];

  const provider = make({
    fetchImpl: async (url: unknown) => {
      fetches.push(String(url));

      return { json: async () => ({}), ok: true, status: 200, text: async () => "{}" };
    }
  });

  return { fetches, result: provider.searchWithStatus(query, { budgetSnapshot, env }) };
}

const FAMILY = () =>
  [
    {
      env: SGIS_ENV,
      flag: "CONTEXT_PROVIDER_STATISTICS_ENABLED",
      make: makeSgis,
      name: "sgis",
      query: "서울 인구"
    },
    {
      credential: "SEOUL_OPEN_DATA_API_KEY",
      env: SEOUL_ENV,
      flag: "CONTEXT_PROVIDER_PUBLIC_INSTITUTION_ENABLED",
      make: makeSeoul,
      name: "seoul-open-data",
      query: "서울 인구"
    },
    {
      credential: "MOLIT_APARTMENT_RENT_API_KEY",
      env: REAL_ESTATE_ENV,
      flag: "CONTEXT_PROVIDER_REAL_ESTATE_ENABLED",
      make: makeRealEstate,
      name: "real_estate",
      query: "11110 아파트 전월세"
    }
  ] as const;

test("every provider's own flag stops the network, not just the result", async () => {
  for (const provider of FAMILY()) {
    const off = attempt(provider.make, { ...provider.env, [provider.flag]: "false" }, provider.query);

    assert.equal((await off.result).status, "PROVIDER_DISABLED", provider.name);
    assert.deepEqual(off.fetches, [], `${provider.name} called out while switched off`);
  }
});

test("the master switch stops every provider independently of its own flag", async () => {
  for (const provider of FAMILY()) {
    const off = attempt(
      provider.make,
      { ...provider.env, CONTEXT_ENRICHMENT_ENABLED: "false" },
      provider.query
    );

    assert.equal((await off.result).status, "PROVIDER_DISABLED", provider.name);
    assert.deepEqual(off.fetches, [], `${provider.name} ignored the master switch`);
  }
});

test("an exhausted budget stops every provider BEFORE the first request", async () => {
  // The ordering is the whole property. Checked after the first fetch, a refusal still costs
  // a call against a public API's quota every time it refuses.
  for (const provider of FAMILY()) {
    const spent = attempt(provider.make, provider.env, provider.query, EXHAUSTED);

    assert.equal((await spent.result).status, "RATE_LIMITED", provider.name);
    assert.deepEqual(
      spent.fetches,
      [],
      `${provider.name} spent a request while over budget -- the budget check is in the wrong place`
    );
  }
});

test("missing credentials are caught before anything is sent", async () => {
  const seoul = attempt(makeSeoul, { ...SEOUL_ENV, SEOUL_OPEN_DATA_API_KEY: "" }, "서울 인구");

  assert.equal((await seoul.result).status, "MISSING_CREDENTIALS");
  assert.deepEqual(seoul.fetches, []);

  // SGIS needs BOTH halves, and half a pair must not become a rejected auth request upstream.
  for (const missing of ["SGIS_CONSUMER_KEY", "SGIS_CONSUMER_SECRET"]) {
    const sgis = attempt(makeSgis, { ...SGIS_ENV, [missing]: "" }, "서울 인구");

    assert.equal((await sgis.result).status, "MISSING_CREDENTIALS", missing);
    assert.deepEqual(sgis.fetches, []);
  }
});

test("no refusal throws -- each is a status the enrichment job can act on", async () => {
  for (const provider of FAMILY()) {
    const decision = await attempt(
      provider.make,
      { ...provider.env, [provider.flag]: "false" },
      provider.query
    ).result;

    assert.equal(decision.provider, provider.name);
    assert.ok(decision.checkedAt, "every answer says when it was decided");
    assert.ok(Array.isArray(decision.results));
  }
});
