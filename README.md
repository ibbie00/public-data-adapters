# public-data-adapters

Source-grounded adapters for public data APIs.

Each adapter fetches a public API, parses and normalizes the response, and
validates it into a **context asset**: a small, sourced, dated record that can
sit next to user speech without becoming advice, a verdict, or a prediction.

This package was extracted from [Takibi](https://takibi.pub)'s
context-enrichment layer. The product policy layer (queue planning, operator
governance, database schema, LLM calls, rate-limit ledgers) is intentionally
**not** included. Callers inject those concerns at the few points listed under
[Dependency injection](#dependency-injection).

한국어 요약: 이 저장소는 Takibi의 맥락 확장 계층에서 떼어낸 **공공자료 어댑터**
모음입니다. 법령·의안·통계·선거·공시·부동산·날씨·미디어 카탈로그 같은 공개 API를
호출해 출처와 기준일이 붙은 맥락 자산으로 정규화합니다. DB·큐·LLM·운영 정책은
포함하지 않으며, 필요한 지점은 호출자가 주입합니다.

## Adapters

| provider type | sources | credentials |
| --- | --- | --- |
| `law` | legalize-kr local law index, National Law Information Center | `LAW_OC` (national-law-api mode) |
| `ordinance` | National Law Information Center (local ordinances) | `LAW_OC` |
| `bill` | Open Assembly (National Assembly bill metadata) | `OPEN_ASSEMBLY_API_KEY` |
| `legislative_library` | NABO periodicals | `OPEN_NABO_API_KEY` |
| `policy_report` | NABO publications, NKIS policy research | `OPEN_NABO_API_KEY`, `OPEN_NKIS_API_KEY` |
| `statistics` | NABOSTAT, KOSIS, ECOS (Bank of Korea), SGIS, SEMAS | `OPEN_NABOSTAT_API_KEY`, `OPEN_KOSIS_API_KEY`, `OPEN_ECOS_API_KEY`, `SGIS_CONSUMER_KEY` + `SGIS_CONSUMER_SECRET`, `SEMAS_STORE_API_KEY` |
| `corporate_disclosure` | OpenDART (Financial Supervisory Service) | `OPENDART_API_KEY` |
| `real_estate` | MOLIT apartment/row-house/detached-house/offcetel trade and rent listings | `MOLIT_*_API_KEY` (six services; see `real-estate-api/constants.ts`) |
| `public_institution` | Seoul Open Data Plaza | `SEOUL_OPEN_DATA_API_KEY` or `SEOUL_METRO_DATA_API_KEY` |
| `election` | National Election Commission open APIs | `NEC_COMMON_CODE_API_SERVICE_KEY`, `NEC_VOTE_COUNT_API_SERVICE_KEY`, `NEC_POLLING_PLACE_API_SERVICE_KEY` |
| `media_catalog` | KMDb (Korean Film Council), OMDb, TVMaze | `KMDB_API_KEY`, `OMDB_API_KEY` |
| `music_metadata` | Spotify, Last.fm | `SPOTIFY_CLIENT_ID` + `SPOTIFY_CLIENT_SECRET`, `LASTFM_API_KEY` |
| `game_metadata` | Steam, RAWG | `STEAM_WEB_API_KEY`, `RAWG_API_KEY` |
| `news_media` | The Guardian, The New York Times, NewsAPI | `GUARDIAN_API_KEY`, `NYT_API_KEY`, `NEWSAPI_KEY` |
| `weather_environment` | Korea Meteorological Administration advisories | `KMA_ALERT_OPENAPI_KEY` |

Every adapter is **off by default**. Each provider type has its own feature flag
(for example `CONTEXT_PROVIDER_LAW_ENABLED=1`) and every flag is read through the
`env` argument you pass in, never a global.

## Install

```bash
npm install public-data-adapters
```

Node.js 20 or later. The build output is CommonJS with type declarations.
Published at https://www.npmjs.com/package/public-data-adapters.

## Quick start

```ts
import { getContextResearchProviders } from "public-data-adapters";

const env = {
  ...process.env,
  LAW_CONTEXT_PROVIDER: "national-law-api",
  LAW_OC: process.env.LAW_OC,
  CONTEXT_PROVIDER_LAW_ENABLED: "1"
};

const providers = getContextResearchProviders(env);
const law = providers.find((provider) => provider.providerType === "law");

// Search calls take the env again: providers read flags and credentials from
// the env you hand them at call time, never from a captured global.
const results = await law.search("청탁금지법", { env });
const asset = law.normalize(results[0]);
law.validate(asset);
console.log(asset.sourceName, asset.sourceUrl, asset.checkedAt);
```

Individual adapters can be constructed directly:

```ts
import { createNewsMediaApiProvider } from "public-data-adapters";

const provider = createNewsMediaApiProvider({
  reserveExtraCall: () => myBudgetLedger.reserve("news_media") // optional
});
```

## Dependency injection

The package never reaches for a global client. The three seams are:

| seam | where | why |
| --- | --- | --- |
| Outbound fetch | `fetchImpl` in provider options, per search call, or the registry injection | route through your egress proxy, add instrumentation, or pin DNS |
| Extra-call budget | `reserveExtraCall` on `news_media` | that provider is a fallback chain; each additional API call is metered |
| LLM title extraction | `titleFallback` on `media_catalog` | the rule-based title extractor cannot read a bare title in free text; an LLM can, but the client is yours, not ours |

All three can be wired once through the registry:

```ts
import { getContextResearchProviders } from "public-data-adapters";

const providers = getContextResearchProviders(env, {
  fetchImpl: myProxiedFetch, // used by every network adapter
  reserveExtraCall: () => myBudgetLedger.reserve("news_media"),
  titleFallback: {
    enabled: (env) => env.MY_TITLE_LLM_ENABLED === "1",
    extract: async (text) => myLocalLlm.extractTitle(text)
  }
});
```

The default outbound path is a plain `fetch`. If you inject nothing, no proxy,
no LLM, and no ledger is involved, and fallback chains stop at the first API
call rather than spending unmetered budget.

## Design rules the adapters enforce

- **Provenance or nothing.** A normalized asset carries `sourceName`,
  `sourceIdentifier` or `sourceUrl`, and `checkedAt`. Validation rejects assets
  without them.
- **Freshness is per asset type.** Laws are good for 30 days, election metadata
  for 1 day, media catalog metadata for 30. `getContextAssetFreshnessPolicy`
  returns the policy; enforcement is the caller's job.
- **Metadata only.** No adapter stores article bodies, report full text, plot
  summaries, or user histories. Public catalog metadata only.
- **No verdicts.** Nothing here decides truth, legitimacy, or prediction. An
  official number is shown with its source; conclusions are not.
- **Bounded calls.** Response bodies are read with a byte ceiling (1 MiB
  default) and a deadline that covers the whole exchange, including the body.
  Transient statuses (408, 429, 5xx) are retried with backoff; an oversized body
  is not retried.
- **Visible text is sanitized.** Bidi formatting controls are stripped from any
  text that can reach a screen.
- **Fail closed.** If a provider is disabled, has no credentials, or a budget is
  exhausted, it returns a status; it does not throw and it does not call out.

## Development

```bash
npm install --ignore-scripts
npm run typecheck
npm test
npm run build
```

The test suite pins the provider contract: every network provider goes through
the shared retry helper, every response body is read through the capped reader,
feature flags stop the call (not just the result), and missing credentials are
detected before anything is sent.

## License

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

This package fetches data from third-party public APIs. Your use of those APIs
is governed by their operators' terms and by the credentials you supply.
