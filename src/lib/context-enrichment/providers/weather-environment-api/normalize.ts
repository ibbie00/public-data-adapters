import { getContextHash, getContextQueryFingerprint } from "../../normalize";
import type { ContextAsset } from "../../types";
import { WEATHER_ENVIRONMENT_CONTEXT_DISCLAIMER_KO } from "../../types";
import { PROVIDER_TYPE } from "./constants";
import type { WeatherEnvironmentRawResult } from "./types";

// 기상청 특보를 자산으로 옮긴다.
//
// ⚠️ 여기에는 지역이 없다. 전국 발효 목록에서 온 것이고 우리가 고르지 않았다. 그 사실을
// limitations 에 적는 것이 이 자료의 핵심이다. 읽는 사람이 "우리 동네 이야기" 로 읽으면
// 우리가 하지 않은 판단을 한 것이 된다.
export function normalizeWeatherEnvironmentRawResult(input: {
  checkedAt: string;
  rawResult: WeatherEnvironmentRawResult;
}): ContextAsset {
  const rawResult = input.rawResult;
  const checkedAt = rawResult.checkedAt ?? input.checkedAt;
  const advisory = rawResult.advisory;

  return {
    assetType: "WEATHER_ENVIRONMENT_CONTEXT",
    canonicalSourceKey: `weather_environment:kma_advisory:${advisory.headline}:${advisory.issuedAt}`,
    checkedAt,
    confidence: "medium",
    disclaimer: WEATHER_ENVIRONMENT_CONTEXT_DISCLAIMER_KO,
    keyPoints: [
      "contentStoragePolicy:metadata_only",
      "weatherProvider:KMA",
      `issuedAt:${advisory.issuedAt}`,
      advisory.matchedTerm ? `matchedTerm:${advisory.matchedTerm}` : null
    ].filter((item): item is string => Boolean(item)),
    limitations: [
      "전국에 발효 중인 특보이며 특정 지역을 가리키지 않습니다.",
      "기상청 발표 문구를 그대로 전하며, 개인 이동 경로나 치료 판단에는 사용하지 않습니다."
    ],
    locale: "ko",
    modelMetadata: {
      contentStoragePolicy: "metadata_only",
      provider: "KMA",
      // Fingerprint, never the query itself: on the flint-keyword path this string is
      // the author's own sentence, and modelMetadata is stored in a public asset row
      // that outlives the post. The write boundary re-derives this anyway.
      queryFingerprint: rawResult.query ? getContextQueryFingerprint(rawResult.query) : null,
      visibleInPublicUi: false
    },
    providerType: PROVIDER_TYPE,
    retrievedAt: checkedAt,
    sourceDate: checkedAt.slice(0, 10),
    sourceHash: getContextHash({ advisory }),
    sourceIdentifier: `kma_advisory:${advisory.issuedAt}`,
    sourceInstitution: "기상청",
    // ⚠️ 제목은 특보 문구 그대로다. `rawResult.query` 로 폴백하지 않는다(ecos /
    // nabo-publication / nkis-policy 정규화가 적어 둔 것과 같은 규칙): 불씨 낱말 경로에서
    // 그 문자열은 글쓴이가 쓴 문장이고, sourceTitle 은 publicSearchText 로 흘러간다.
    sourceName: "기상청 기상특보",
    sourceTitle: advisory.headline,
    sourceUrl: "https://www.weather.go.kr/w/weather/warning.do",
    status: "current"
  };
}
