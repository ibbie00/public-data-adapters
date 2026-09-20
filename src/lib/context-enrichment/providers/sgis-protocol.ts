import type {
  SgisProviderStatus,
  SgisRawResult
} from "./sgis-api";

const AUTH_URL = "https://sgisapi.kostat.go.kr/OpenAPI3/auth/authentication.json";
const POPULATION_URL = "https://sgisapi.kostat.go.kr/OpenAPI3/stats/searchpopulation.json";

export function clean(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function normalizeSgisRows(payload: unknown): SgisRawResult[] {
  const root = asObject(payload);
  if (!root) {
    return [];
  }

  const result = root.result ?? root.Result ?? root.data;
  if (Array.isArray(result)) {
    return result.filter((item): item is SgisRawResult => Boolean(asObject(item)));
  }
  if (asObject(result)) {
    return [result as SgisRawResult];
  }

  return [];
}

export function getSgisAccessToken(payload: unknown) {
  const root = asObject(payload);
  const result = asObject(root?.result);
  return clean(result?.accessToken ?? root?.accessToken);
}

export function getSgisCredentials(env: NodeJS.ProcessEnv) {
  return {
    consumerKey: env.SGIS_CONSUMER_KEY?.trim() || "",
    consumerSecret: env.SGIS_CONSUMER_SECRET?.trim() || ""
  };
}

export function buildSgisAuthUrl(input: { consumerKey: string; consumerSecret: string }) {
  const url = new URL(AUTH_URL);
  url.searchParams.set("consumer_key", input.consumerKey);
  url.searchParams.set("consumer_secret", input.consumerSecret);
  return url;
}

// SGIS numbers the provinces ITSELF, and not the way the national administrative code
// table does: Busan is 21 here and 26 there. This table was read out of the API on
// 2026-08-19 (`searchpopulation.json?low_search=1&year=2024` answers with all 17 rows,
// each carrying adm_cd and adm_nm). Do not "correct" it against another code table.
//
// Aliases include the short forms people actually write and the pre-rename names, because
// the query being matched is the author's own words. 강원도 and 전라북도 were renamed to
// 강원특별자치도 and 전북특별자치도, and posts still say the old ones.
const SGIS_PROVINCE_CODES: { code: string; names: string[] }[] = [
  { code: "11", names: ["서울특별시", "서울"] },
  { code: "21", names: ["부산광역시", "부산"] },
  { code: "22", names: ["대구광역시", "대구"] },
  { code: "23", names: ["인천광역시", "인천"] },
  { code: "24", names: ["광주광역시", "광주"] },
  { code: "25", names: ["대전광역시", "대전"] },
  { code: "26", names: ["울산광역시", "울산"] },
  { code: "29", names: ["세종특별자치시", "세종"] },
  { code: "31", names: ["경기도", "경기"] },
  { code: "32", names: ["강원특별자치도", "강원도", "강원"] },
  { code: "33", names: ["충청북도", "충북"] },
  { code: "34", names: ["충청남도", "충남"] },
  { code: "35", names: ["전북특별자치도", "전라북도", "전북"] },
  { code: "36", names: ["전라남도", "전남"] },
  { code: "37", names: ["경상북도", "경북"] },
  { code: "38", names: ["경상남도", "경남"] },
  { code: "39", names: ["제주특별자치도", "제주도", "제주"] }
];

// 2025 answers errCd=-200 (no data); 2024 is the newest year that returns rows, measured
// 2026-08-19. Population statistics land a year or two late, so this is not a stale
// constant so much as the edge of what exists.
const POPULATION_YEAR = "2024";

// The longest matching name wins, so "경기도 광주시" resolves to 경기도 rather than to
// 광주광역시. Ties go to whichever appeared first in the text.
//
// Returning null is a normal outcome, not a failure: the request then carries no region at
// all and SGIS answers nationwide. That is deliberate. Picking a province out of a post
// that never named one would be inferring where the author is, which is the same line the
// weather provider draws in its catalog note when it dropped city-keyed sources.
export function findSgisProvinceCode(query: string): string | null {
  let best: { code: string; index: number; length: number } | null = null;

  for (const province of SGIS_PROVINCE_CODES) {
    for (const name of province.names) {
      const index = query.indexOf(name);

      if (index === -1) {
        continue;
      }

      const isBetter =
        !best ||
        name.length > best.length ||
        (name.length === best.length && index < best.index);

      if (isBetter) {
        best = { code: province.code, index, length: name.length };
      }
    }
  }

  return best?.code ?? null;
}

// Only four parameters are defined here. `adm_nm` and `resultcount` are NOT among them,
// and sending either makes SGIS reject the whole request with 412 and an HTML body
// ("정의되지 않은 파라미터가 포함되어 있음") rather than a JSON error, so the failure does
// not even reach the payload-status path. Both were being sent until 2026-08-19, which
// meant this provider could never have returned a row. Row count is trimmed by the caller.
// `low_search=0` answers at the level that was asked for; `1` descends one rung. Asking
// about 경기도 and being handed 수원시 장안구 is not the same question, and the relevance
// gate reads it that way: measured 2026-08-19, the same post scored -10.92 against the
// district row and -8.50 against the province row, a swing of 2.4 points on nothing but
// which rung answered. With no region named, both values return the same 17 provinces, so
// this is `0` unconditionally rather than a branch.
export function buildSgisPopulationUrl(input: { accessToken: string; query: string }) {
  const url = new URL(POPULATION_URL);

  url.searchParams.set("accessToken", input.accessToken);
  url.searchParams.set("low_search", "0");
  url.searchParams.set("year", POPULATION_YEAR);

  const provinceCode = findSgisProvinceCode(input.query);

  if (provinceCode) {
    url.searchParams.set("adm_cd", provinceCode);
  }

  return url;
}

export function getSgisPayloadStatus(payload: unknown, results: SgisRawResult[]): SgisProviderStatus {
  const root = asObject(payload);
  const err = clean(root?.errCd ?? root?.error ?? root?.message);
  if (err && err !== "0") {
    return /401|403|invalid|auth/i.test(err) ? "INVALID_CREDENTIALS" : "EXTERNAL_API_ERROR";
  }
  return results.length > 0 ? "OK" : "NOT_FOUND";
}
