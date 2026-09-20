import assert from "node:assert/strict";
import test from "node:test";
import {
  createSgisApiProvider,
  getContextProviderCatalog,
  getContextResearchProviders,
  runCredentialGatedProviderSmoke
} from "../../src/lib/context-enrichment/index";
import {
  buildSgisPopulationUrl,
  findSgisProvinceCode
} from "../../src/lib/context-enrichment/providers/sgis-protocol";

const enabledEnv = {
  CONTEXT_ENRICHMENT_ENABLED: "true",
  CONTEXT_PROVIDER_STATISTICS_ENABLED: "true",
  NODE_ENV: "test",
  SGIS_CONSUMER_KEY: "secret-sgis-key",
  SGIS_CONSUMER_SECRET: "secret-sgis-secret"
} as NodeJS.ProcessEnv;

test("SGIS provider is disabled by default", async () => {
  const provider = createSgisApiProvider();

  assert.equal(
    (await provider.searchWithStatus("서울 인구", { env: { NODE_ENV: "test" } as NodeJS.ProcessEnv })).status,
    "PROVIDER_DISABLED"
  );
});

test("SGIS provider requires both consumer credentials", async () => {
  const provider = createSgisApiProvider();
  const result = await provider.searchWithStatus("서울 인구", {
    env: {
      CONTEXT_ENRICHMENT_ENABLED: "true",
      CONTEXT_PROVIDER_STATISTICS_ENABLED: "true",
      NODE_ENV: "test",
      SGIS_CONSUMER_KEY: "secret-sgis-key"
    } as NodeJS.ProcessEnv
  });

  assert.equal(result.status, "MISSING_CREDENTIALS");
});

test("SGIS provider authenticates, normalizes regional statistics, and preserves unit and period", async () => {
  const calledUrls: string[] = [];
  const provider = createSgisApiProvider({
    fetchImpl: async (url) => {
      calledUrls.push(url.toString());
      if (url.pathname.includes("/auth/")) {
        return Response.json({ result: { accessToken: "access-token" } });
      }

      assert.equal(url.searchParams.get("accessToken"), "access-token");
      // The region goes as SGIS's own province code, not as a name. Until 2026-08-19 this
      // assertion read `adm_nm === "서울특별시"`, and because the fetch is a stub it passed
      // happily while the real endpoint answered 412 to every request this provider made.
      assert.equal(url.searchParams.get("adm_cd"), "11");
      // Both of these make SGIS reject the whole call with an HTML 412.
      assert.equal(url.searchParams.get("adm_nm"), null);
      assert.equal(url.searchParams.get("resultcount"), null);
      return Response.json({
        errCd: "0",
        result: [
          {
            adm_nm: "서울특별시",
            population: "9386034",
            year: "2024"
          }
        ]
      });
    },
    now: () => new Date("2026-05-31T00:00:00.000Z")
  });
  const result = await provider.searchWithStatus("서울 인구", { env: enabledEnv, limit: 1 });
  const asset = provider.normalize(result.results[0]!);

  provider.validate(asset);

  assert.equal(result.status, "OK");
  assert.equal(calledUrls.length, 2);
  assert.equal(asset.providerType, "statistics");
  assert.equal(asset.assetType, "STATISTICS_CONTEXT");
  assert.equal(asset.sourceName, "통계청 SGIS 통계지리정보서비스");
  assert.equal(asset.sourceTitle, "서울특별시 지역 인구 통계");
  assert.equal(asset.keyPoints?.includes("unit:명"), true);
  assert.equal(asset.keyPoints?.includes("period:2024"), true);
  assert.equal(asset.keyPoints?.includes("population:9386034"), true);
  assert.equal(asset.modelMetadata?.provider, "sgis");
});

test("statistics catalog and smoke accept SGIS as an alternate statistics credential", async () => {
  const catalogEntry = getContextProviderCatalog(enabledEnv).find(
    (entry) => entry.providerType === "statistics"
  );
  const provider = createSgisApiProvider({
    fetchImpl: async (url) => {
      if (url.pathname.includes("/auth/")) {
        return Response.json({ result: { accessToken: "access-token" } });
      }
      return Response.json({
        errCd: "0",
        result: [{ adm_nm: "서울특별시", population: "1", year: "2024" }]
      });
    },
    now: () => new Date("2026-05-31T00:00:00.000Z")
  });

  assert.equal(catalogEntry?.implementationStatus, "live_available");
  assert.equal(
    getContextResearchProviders(enabledEnv).some((item) => item.providerType === "statistics"),
    true
  );

  const result = await runCredentialGatedProviderSmoke({
    catalogEntry: catalogEntry!,
    env: {
      ...enabledEnv,
      CONTEXT_PROVIDER_SMOKE_ENABLED: "true"
    },
    provider,
    query: "서울 인구"
  });

  assert.equal(result.status, "PASS");
  assert.equal(result.credentialPresent, true);
  assert.equal(result.validationOk, true);
});

// The province table is SGIS's own numbering, read out of the API on 2026-08-19. These
// pin the values that would silently send the wrong region if someone "corrected" them
// against the national administrative code table, where Busan is 26 rather than 21.
test("SGIS province codes come from SGIS, not from the national code table", () => {
  assert.equal(findSgisProvinceCode("서울 인구"), "11");
  assert.equal(findSgisProvinceCode("부산 인구"), "21");
  assert.equal(findSgisProvinceCode("울산 인구"), "26");
});

test("the longest province name wins, so a city inside a province does not steal it", () => {
  assert.equal(findSgisProvinceCode("경기도 광주시 인구"), "31");
  assert.equal(findSgisProvinceCode("광주광역시 인구"), "24");
});

test("renamed provinces still resolve under the names posts actually use", () => {
  assert.equal(findSgisProvinceCode("강원도 인구"), "32");
  assert.equal(findSgisProvinceCode("강원특별자치도 인구"), "32");
  assert.equal(findSgisProvinceCode("전라북도 인구"), "35");
  assert.equal(findSgisProvinceCode("전북특별자치도 인구"), "35");
});

// Not finding a province is the ordinary case, not a failure. The request then asks for
// nationwide figures rather than guessing where the author is.
test("a query that names no province sends no region at all", () => {
  assert.equal(findSgisProvinceCode("인구 통계"), null);

  const url = buildSgisPopulationUrl({ accessToken: "t", query: "인구 통계" });

  assert.equal(url.searchParams.get("adm_cd"), null);
  assert.equal(url.searchParams.get("year"), "2024");
});

// The rung SGIS answers at has to match the rung the post asked about. `low_search=1`
// descends one level, so a post about 경기도 came back as 수원시 장안구 and the relevance
// gate scored it 2.4 points worse for that reason alone (measured 2026-08-19).
test("the population URL asks at the level named, not one rung below", () => {
  for (const query of ["경기도 인구", "인구 통계"]) {
    assert.equal(
      buildSgisPopulationUrl({ accessToken: "t", query }).searchParams.get("low_search"),
      "0"
    );
  }
});

// The two parameters that made every real call a 412. Named individually so a future
// rewrite that reintroduces either one fails here rather than in production silence.
test("the population URL never carries adm_nm or resultcount", () => {
  const url = buildSgisPopulationUrl({ accessToken: "t", query: "서울 인구" });

  assert.equal(url.searchParams.get("adm_nm"), null);
  assert.equal(url.searchParams.get("resultcount"), null);
  assert.deepEqual([...url.searchParams.keys()].sort(), [
    "accessToken",
    "adm_cd",
    "low_search",
    "year"
  ]);
});
