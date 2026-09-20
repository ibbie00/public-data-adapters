import { getContextAssetFreshnessPolicy } from "../../freshness";
import { getContextHash, getContextQueryFingerprint } from "../../normalize";
import type { ContextAsset, ContextFreshnessPolicy } from "../../types";
import { CULTURAL_METADATA_CONTEXT_DISCLAIMER_KO } from "../../types";
import { assertValidContextAsset } from "../../validation";
import { cleanGameMetadataValue as clean } from "./request";
import { GAME_METADATA_PROVIDER_TYPE, type GameMetadataRawResult, type RawgGameResult } from "./types";

function getGameUrl(result: RawgGameResult) {
  const slug = clean(result.slug);

  return slug ? `https://rawg.io/games/${encodeURIComponent(slug)}` : undefined;
}

function getKeyPoints(result: RawgGameResult) {
  const genres = Array.isArray(result.genres)
    ? result.genres.map((genre) => clean(genre.name)).filter(Boolean)
    : [];
  const platforms = Array.isArray(result.platforms)
    ? result.platforms.map((item) => clean(item.platform?.name)).filter(Boolean).slice(0, 6)
    : [];
  const stores = Array.isArray(result.stores)
    ? result.stores.map((item) => clean(item.store?.name)).filter(Boolean).slice(0, 6)
    : [];

  return [
    "contentStoragePolicy:metadata_only",
    "catalogProvider:RAWG",
    genres.length > 0 ? `genres:${genres.join(", ")}` : null,
    platforms.length > 0 ? `platforms:${platforms.join(", ")}` : null,
    stores.length > 0 ? `stores:${stores.join(", ")}` : null,
    clean(result.released) ? `released:${clean(result.released)}` : null
  ].filter((item): item is string => Boolean(item));
}

export function normalizeGameMetadataResult(
  rawResult: GameMetadataRawResult,
  now: () => Date
): ContextAsset {
  const result = rawResult.result;
  const checkedAt = rawResult.checkedAt ?? now().toISOString();
  // 카드에는 글쓴이가 쓴 표기를 되돌려 준다(창업자 판단 2026-08-18).
  //
  // RAWG 는 영문 이름만 아는 곳이라 그대로 두면 "스타듀 밸리" 라고 쓴 글에 "Stardew Valley"
  // 가 붙는다. 검색에 영문을 쓰는 것과 화면에 무엇을 적는지는 다른 문제다. 사전에 없는
  // 게임은 바꿔 줄 표기가 없으므로 영문 그대로 둔다.
  const englishTitle = clean(result.name);
  const title = clean(rawResult.koreanName) || englishTitle || "관련 게임";
  const sourceUrl = getGameUrl(result);

  return {
    assetType: "GAME_METADATA_CONTEXT",
    canonicalSourceKey: `game_metadata:rawg:${clean(result.id) || clean(result.slug) || title}`,
    checkedAt,
    confidence: "medium",
    disclaimer: CULTURAL_METADATA_CONTEXT_DISCLAIMER_KO,
    keyPoints: getKeyPoints(result),
    limitations: [
      "공개 게임 카탈로그 메타데이터만 저장합니다.",
      "사용자의 보유 게임, 친구, 플레이 시간, 선호 장르를 추론하거나 저장하지 않습니다."
    ],
    locale: "ko",
    modelMetadata: {
      catalogProvider: "RAWG",
      contentStoragePolicy: "metadata_only",
      imageUrl: clean(result.background_image),
      imageUrlPresent: Boolean(clean(result.background_image)),
      // Fingerprint, never the query itself: on the flint-keyword path this string is
      // the author's own sentence, and modelMetadata is stored in a public asset row
      // that outlives the post. The write boundary re-derives this anyway.
      queryFingerprint: rawResult.query ? getContextQueryFingerprint(rawResult.query) : null,
      steamKeyConfigured: false,
      visibleInPublicUi: false
    },
    providerType: GAME_METADATA_PROVIDER_TYPE,
    retrievedAt: checkedAt,
    sourceDate: clean(result.released) || undefined,
    sourceHash: getContextHash(result),
    sourceIdentifier: `rawg:${clean(result.id) || clean(result.slug) || title}`,
    sourceInstitution: "RAWG",
    sourceName: "RAWG",
    sourceTitle: title,
    sourceUrl,
    status: "current"
  };
}

export function validateGameMetadataAsset(normalizedAsset: ContextAsset): void {
  assertValidContextAsset(normalizedAsset);
}

export function getGameMetadataFreshnessPolicy(asset?: ContextAsset): ContextFreshnessPolicy {
  return getContextAssetFreshnessPolicy(asset ?? {
    assetType: "GAME_METADATA_CONTEXT",
    providerType: GAME_METADATA_PROVIDER_TYPE,
    sourceTitle: "game metadata"
  });
}
