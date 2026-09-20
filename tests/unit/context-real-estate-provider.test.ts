import assert from "node:assert/strict";
import test from "node:test";
import { createRealEstateApiProvider } from "../../src/lib/context-enrichment/providers/real-estate-api";

// The provider now enforces the same feature flag every sibling does, so the tests that
// exercise its query and credential logic have to switch it on (see
// tests/unit/context-providers-share-one-gate-order.test.ts for the gate itself).
const ENABLED = {
  CONTEXT_ENRICHMENT_ENABLED: "true",
  CONTEXT_PROVIDER_REAL_ESTATE_ENABLED: "true"
};

test("real estate provider normalizes MOLIT rent XML into official context asset", async () => {
  const provider = createRealEstateApiProvider({
    fetchImpl: async () => new Response(`
      <?xml version="1.0" encoding="utf-8"?>
      <response>
        <header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header>
        <body>
          <items>
            <item>
              <dealYear>2025</dealYear>
              <dealMonth>5</dealMonth>
              <umdNm>창신동</umdNm>
              <aptNm>창신쌍용2</aptNm>
              <excluUseAr>106.62</excluUseAr>
              <deposit>45,000</deposit>
              <monthlyRent>0</monthlyRent>
            </item>
          </items>
        </body>
      </response>
    `, { status: 200 }),
    now: () => new Date("2026-05-31T00:00:00.000Z")
  });

  const smoke = await provider.searchWithStatus("11110 아파트 전월세 202505", {
    env: {
      ...ENABLED,
      MOLIT_APARTMENT_RENT_API_KEY: "secret",
      NODE_ENV: "test"
    } as NodeJS.ProcessEnv,
    limit: 1
  });

  assert.equal(smoke.status, "OK");
  assert.equal(smoke.results.length, 1);

  const asset = provider.normalize(smoke.results[0]!);

  assert.equal(asset.providerType, "real_estate");
  assert.equal(asset.assetType, "REAL_ESTATE_CONTEXT");
  assert.equal(asset.sourceInstitution, "국토교통부");
  assert.equal(asset.sourceTitle, "아파트 전월세 실거래 흐름 (202505)");
  assert.match(asset.summary ?? "", /창신동/);
  assert.match(asset.disclaimer ?? "", /투자 판단/);
});

test("real estate provider reports missing credentials without leaking key material", async () => {
  const provider = createRealEstateApiProvider({
    fetchImpl: async () => {
      throw new Error("should not fetch without credentials");
    }
  });

  const smoke = await provider.searchWithStatus("11110 아파트 전월세 202505", {
    env: { ...ENABLED, NODE_ENV: "test" } as NodeJS.ProcessEnv,
    limit: 1
  });

  assert.equal(smoke.status, "MISSING_CREDENTIALS");
  assert.equal(smoke.results.length, 0);
});

// 창업자 판단(2026-08-18): 지역은 글이 아주 강하게 짚었을 때만 쓴다. 프로필로 추론하지
// 않는다. 그전에는 `inferLawdCode` 가 어떤 글에도 종로구(11110)를 돌려줬다. `if` 의 양쪽
// 값이 같아서, 부산 전세 글에도 종로구 실거래가가 붙는 구조였다.
test("real estate provider refuses when the post names no district", async () => {
  let called = false;
  const provider = createRealEstateApiProvider({
    fetchImpl: async () => {
      called = true;
      return new Response("", { status: 200 });
    }
  });
  const result = await provider.searchWithStatus("아파트 전월세 계약 갱신이 걱정된다", {
    env: {
      ...ENABLED,
      MOLIT_APARTMENT_RENT_API_KEY: "secret",
      NODE_ENV: "test"
    } as NodeJS.ProcessEnv,
    limit: 1
  });

  assert.equal(result.status, "INVALID_QUERY");
  assert.equal(called, false, "지역도 모르면서 밖으로 나갔다");
});

// 표가 생겨서 뜻이 옮겨졌다(2026-08-18). 이름으로 적힌 지역도 코드로 바꿔 조회한다.
// 표: data/context-region/districts.json (npm run ai:context-districts:refresh)
test("real estate provider turns a district name into the code the API wants", async () => {
  let requested: URL | null = null;
  const provider = createRealEstateApiProvider({
    fetchImpl: async (url) => {
      requested = url;
      return new Response("", { status: 200 });
    }
  });

  await provider.searchWithStatus("종로구 아파트 전월세 흐름을 봤다", {
    env: {
      ...ENABLED,
      MOLIT_APARTMENT_RENT_API_KEY: "secret",
      NODE_ENV: "test"
    } as NodeJS.ProcessEnv,
    limit: 1
  });

  assert.equal(requested!.searchParams.get("LAWD_CD"), "11110");
});

// ⚠️ 이름이 여러 시도에 겹치면 글이 시도까지 말해야 정해진다. 중구는 다섯 곳에 있다.
test("real estate provider refuses an ambiguous district name", async () => {
  let called = false;
  const provider = createRealEstateApiProvider({
    fetchImpl: async () => {
      called = true;
      return new Response("", { status: 200 });
    }
  });
  const result = await provider.searchWithStatus("중구 아파트 전월세를 봤다", {
    env: {
      ...ENABLED,
      MOLIT_APARTMENT_RENT_API_KEY: "secret",
      NODE_ENV: "test"
    } as NodeJS.ProcessEnv,
    limit: 1
  });

  assert.equal(result.status, "INVALID_QUERY");
  assert.equal(called, false);
});

// ⚠️ `selectService` 는 짐작하지 않는다. 예전에는 낱말 짝이 안 맞으면 MOLIT_SERVICES[0]
// (아파트 매매)로 떨어져서, 전세 글이 매매 엔드포인트로 가고 미세먼지 글도 물어봤다.
// 그 폴백이 이 제공자를 2026-08-10에 끄게 만든 이유의 절반이었다.
test("real estate provider declines when the post names no property or deal type", async () => {
  let called = false;
  const provider = createRealEstateApiProvider({
    fetchImpl: async () => {
      called = true;
      return new Response("", { status: 200 });
    }
  });

  for (const query of ["종로구 부동산 이야기", "종로구 아파트"]) {
    const result = await provider.searchWithStatus(query, {
      env: {
        ...ENABLED,
        MOLIT_APARTMENT_RENT_API_KEY: "secret",
        MOLIT_APARTMENT_TRADE_API_KEY: "secret",
        NODE_ENV: "test"
      } as NodeJS.ProcessEnv,
      limit: 1
    });

    assert.equal(result.status, "INVALID_QUERY", query);
  }

  assert.equal(called, false, "무엇을 물을지도 모르면서 밖으로 나갔다");
});

// 매물 종류와 거래 종류가 둘 다 있으면 그 서비스로 간다.
test("real estate provider picks the endpoint the post actually named", async () => {
  const seen: string[] = [];
  const provider = createRealEstateApiProvider({
    fetchImpl: async (url) => {
      seen.push(url.pathname);
      return new Response("", { status: 200 });
    }
  });
  const env = {
    ...ENABLED,
    MOLIT_APARTMENT_RENT_API_KEY: "secret",
    MOLIT_APARTMENT_TRADE_API_KEY: "secret",
    MOLIT_OFFICETEL_RENT_API_KEY: "secret",
    NODE_ENV: "test"
  } as NodeJS.ProcessEnv;

  await provider.searchWithStatus("종로구 아파트 전월세 흐름", { env, limit: 1 });
  await provider.searchWithStatus("종로구 오피스텔 전세", { env, limit: 1 });

  assert.ok(seen[0]?.includes("AptRent"), seen[0]);
  assert.ok(seen[1]?.includes("OffiRent"), seen[1]);
});

// ⚠️ 상세(Dev) 서비스는 일부러 안 쓴다. 더 오는 열두 칸이 전부 지번 본번·부번과
// 도로명주소라, 우리가 쓰지도 않으면서 정확한 주소를 받아 오게 된다(최소수집 원칙).
test("real estate provider asks the plain apartment-sales service, not the detailed one", async () => {
  let path = "";
  const provider = createRealEstateApiProvider({
    fetchImpl: async (url) => {
      path = url.pathname;
      return new Response("", { status: 200 });
    }
  });

  await provider.searchWithStatus("종로구 아파트 매매", {
    env: {
      ...ENABLED,
      MOLIT_APARTMENT_TRADE_API_KEY: "secret",
      NODE_ENV: "test"
    } as NodeJS.ProcessEnv,
    limit: 1
  });

  assert.ok(path.includes("RTMSDataSvcAptTrade/"), path);
  assert.equal(path.includes("Dev"), false, "상세 서비스로 갔다");
});
