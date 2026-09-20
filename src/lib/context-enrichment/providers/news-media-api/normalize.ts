import { getContextHash, getContextQueryFingerprint } from "../../normalize";
import type { ContextAsset } from "../../types";
import { NEWS_MEDIA_CONTEXT_DISCLAIMER_KO } from "../../types";
import { PROVIDER_TYPE } from "./constants";
import { clean, stripHtml } from "./parse";
import type {
  GuardianArticle,
  NewsApiArticle,
  NewsMediaRawResult,
  NytArticle
} from "./types";

function getArticleTitle(rawResult: NewsMediaRawResult) {
  if (rawResult.provider === "guardian") {
    return clean((rawResult.result as GuardianArticle).webTitle);
  }
  if (rawResult.provider === "nyt") {
    return clean((rawResult.result as NytArticle).headline?.main);
  }

  return clean((rawResult.result as NewsApiArticle).title);
}

function getArticleUrl(rawResult: NewsMediaRawResult) {
  if (rawResult.provider === "guardian") {
    return clean((rawResult.result as GuardianArticle).webUrl);
  }
  if (rawResult.provider === "nyt") {
    return clean((rawResult.result as NytArticle).web_url);
  }

  return clean((rawResult.result as NewsApiArticle).url);
}

function getArticleDate(rawResult: NewsMediaRawResult) {
  if (rawResult.provider === "guardian") {
    return clean((rawResult.result as GuardianArticle).webPublicationDate);
  }
  if (rawResult.provider === "nyt") {
    return clean((rawResult.result as NytArticle).pub_date);
  }

  return clean((rawResult.result as NewsApiArticle).publishedAt);
}

function getProviderName(rawResult: NewsMediaRawResult) {
  if (rawResult.provider === "guardian") {
    return "The Guardian";
  }
  if (rawResult.provider === "nyt") {
    return "The New York Times";
  }

  return clean((rawResult.result as NewsApiArticle).source?.name) || "NewsAPI";
}

function getArticleSummary(rawResult: NewsMediaRawResult) {
  if (rawResult.provider === "guardian") {
    return null;
  }
  if (rawResult.provider === "nyt") {
    return stripHtml(clean((rawResult.result as NytArticle).abstract)) || null;
  }

  return stripHtml(clean((rawResult.result as NewsApiArticle).description)) || null;
}

export function normalizeNewsMediaRawResult(input: {
  checkedAt: string;
  rawResult: NewsMediaRawResult;
}): ContextAsset {
  const rawResult = input.rawResult;
  const checkedAt = rawResult.checkedAt ?? input.checkedAt;
  const providerName = getProviderName(rawResult);
  const title = getArticleTitle(rawResult) || "관련 보도";
  const sourceUrl = getArticleUrl(rawResult) || undefined;
  const sourceDate = getArticleDate(rawResult) || checkedAt;
  const sourceIdentifier = sourceUrl || `${rawResult.provider}:${title}`;

  return {
    assetType: "NEWS_MEDIA_CONTEXT",
    canonicalSourceKey: `news_media:${rawResult.provider}:${sourceIdentifier}`,
    checkedAt,
    confidence: "medium",
    disclaimer: NEWS_MEDIA_CONTEXT_DISCLAIMER_KO,
    keyPoints: [
      "contentStoragePolicy:metadata_only",
      `newsProvider:${providerName}`,
      `publishedAt:${sourceDate}`
    ],
    limitations: [
      "공개 뉴스 메타데이터와 짧은 공개 설명만 저장합니다.",
      "긴 본문, 매체 평가 지표, 사실 판단 문구는 저장하거나 생성하지 않습니다."
    ],
    locale: "ko",
    modelMetadata: {
      contentStoragePolicy: "metadata_only",
      provider: providerName,
      // Fingerprint, never the query itself: on the flint-keyword path this string is
      // the author's own sentence, and modelMetadata is stored in a public asset row
      // that outlives the post. The write boundary re-derives this anyway.
      queryFingerprint: rawResult.query ? getContextQueryFingerprint(rawResult.query) : null,
      visibleInPublicUi: false
    },
    providerType: PROVIDER_TYPE,
    retrievedAt: checkedAt,
    sourceDate,
    sourceHash: getContextHash(rawResult.result),
    sourceIdentifier: `${rawResult.provider}:${sourceIdentifier}`,
    sourceInstitution: providerName,
    sourceName: providerName,
    sourceTitle: title,
    sourceUrl,
    status: "current",
    summary: getArticleSummary(rawResult)
  };
}
