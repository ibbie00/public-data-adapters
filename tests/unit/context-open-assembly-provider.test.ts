import assert from "node:assert/strict";
import test from "node:test";
import {
  getContextProviderCatalog,
  getContextResearchProviders,
  runCredentialGatedProviderSmoke
} from "../../src/lib/context-enrichment/index";
import {
  createOpenAssemblyApiProvider,
  redactOpenAssemblyUrl
} from "../../src/lib/context-enrichment/providers/open-assembly-api";

const enabledEnv = {
  CONTEXT_ENRICHMENT_ENABLED: "true",
  CONTEXT_PROVIDER_BILL_ENABLED: "true",
  NODE_ENV: "test",
  OPEN_ASSEMBLY_API_KEY: "secret-open-assembly-key"
} as NodeJS.ProcessEnv;

function billPayload() {
  return {
    nzmimeepazxkubdpn: [
      {
        row: [
          {
            AGE: "22",
            BILL_ID: "PRC_Z2A6B0C1D0E2F0G3H0I4J0K5",
            BILL_NAME: "AI 기본법 일부개정법률안",
            BILL_NO: "2200001",
            COMMITTEE: "과학기술정보방송통신위원회",
            DETAIL_LINK: "https://open.assembly.go.kr/bill/detail",
            PROC_RESULT: "접수",
            PROPOSE_DT: "2026-05-28",
            PROPOSER: "홍길동의원 등 10인"
          }
        ]
      }
    ]
  };
}

test("Open Assembly bill provider is disabled by default", async () => {
  const provider = createOpenAssemblyApiProvider();

  assert.equal(
    getContextResearchProviders({ NODE_ENV: "test" } as NodeJS.ProcessEnv).some(
      (item) => item.providerType === "bill"
    ),
    false
  );
  assert.equal(
    (await provider.searchWithStatus("AI 기본법", { env: { NODE_ENV: "test" } as NodeJS.ProcessEnv })).status,
    "PROVIDER_DISABLED"
  );
});

test("Open Assembly provider requires OPEN_ASSEMBLY_API_KEY and redacts KEY", async () => {
  const provider = createOpenAssemblyApiProvider();
  const result = await provider.searchWithStatus("AI 기본법", {
    env: {
      CONTEXT_ENRICHMENT_ENABLED: "true",
      CONTEXT_PROVIDER_BILL_ENABLED: "true",
      NODE_ENV: "test"
    } as NodeJS.ProcessEnv
  });

  assert.equal(result.status, "MISSING_CREDENTIALS");
  assert.equal(
    redactOpenAssemblyUrl("https://open.assembly.go.kr/portal/openapi/nzmimeepazxkubdpn?KEY=secret&Type=json"),
    "https://open.assembly.go.kr/portal/openapi/nzmimeepazxkubdpn?KEY=REDACTED&Type=json"
  );
});

test("Open Assembly provider normalizes official bill metadata", async () => {
  const calls: string[] = [];
  const provider = createOpenAssemblyApiProvider({
    fetchImpl: async (url, init) => {
      calls.push(redactOpenAssemblyUrl(url));
      assert.equal(url.pathname.endsWith("/nzmimeepazxkubdpn"), true);
      assert.equal(url.searchParams.get("KEY"), "secret-open-assembly-key");
      assert.equal(url.searchParams.get("AGE"), "22");
      assert.equal(url.searchParams.get("BILL_NAME"), "AI 기본법");
      assert.equal(init?.headers && (init.headers as Record<string, string>)["user-agent"]?.includes("public-data-adapters"), true);
      return Response.json(billPayload());
    },
    now: () => new Date("2026-05-28T00:00:00.000Z")
  });
  const result = await provider.searchWithStatus("AI 기본법", { env: enabledEnv, limit: 1 });
  const asset = provider.normalize(result.results[0]!);

  provider.validate(asset);

  assert.equal(result.status, "OK");
  assert.equal(calls[0]?.includes("KEY=REDACTED"), true);
  assert.equal(asset.providerType, "bill");
  assert.equal(asset.assetType, "BILL_CONTEXT");
  assert.equal(asset.sourceName, "열린국회정보");
  assert.equal(asset.sourceTitle, "AI 기본법 일부개정법률안");
  assert.equal(asset.keyPoints?.includes("billNo:2200001"), true);
  assert.equal(asset.keyPoints?.includes("assemblyAge:22"), true);
  assert.equal(asset.keyPoints?.includes("committee:과학기술정보방송통신위원회"), true);
  assert.equal(asset.modelMetadata?.provider, "open_assembly");
});

test("Open Assembly bill catalog and smoke accept OPEN_ASSEMBLY_API_KEY", async () => {
  const catalogEntry = getContextProviderCatalog(enabledEnv).find(
    (entry) => entry.providerType === "bill"
  );
  const provider = createOpenAssemblyApiProvider({
    fetchImpl: async () => Response.json(billPayload()),
    now: () => new Date("2026-05-28T00:00:00.000Z")
  });

  assert.equal(catalogEntry?.implementationStatus, "live_available");
  assert.deepEqual(catalogEntry?.requiredEnvVars, ["OPEN_ASSEMBLY_API_KEY"]);
  assert.equal(
    getContextResearchProviders(enabledEnv).some((item) => item.providerType === "bill"),
    true
  );

  const result = await runCredentialGatedProviderSmoke({
    catalogEntry: catalogEntry!,
    env: {
      ...enabledEnv,
      CONTEXT_PROVIDER_SMOKE_ENABLED: "true"
    },
    provider,
    query: "AI 기본법"
  });

  assert.equal(result.status, "PASS");
  assert.equal(result.credentialPresent, true);
  assert.equal(result.validationOk, true);
});
