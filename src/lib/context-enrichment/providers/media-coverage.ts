import { isContextProviderEnabled } from "../config";
import { getContextAssetFreshnessPolicy } from "../freshness";
import { getContextHash } from "../normalize";
import type {
  ContextAsset,
  ContextFreshnessPolicy,
  ContextResearchProvider,
  ContextResearchProviderSearchOptions
} from "../types";
import { MEDIA_CONTEXT_DISCLAIMER_KO } from "../types";
import { assertValidContextAsset } from "../validation";

export type MediaCoverageType =
  | "original_report"
  | "follow_up"
  | "explainer"
  | "interview"
  | "statement_based"
  | "correction"
  | "rebuttal"
  | "unclear";

export type MediaCoverageRelationshipToFlint =
  | "evidence"
  | "rebuttal_target"
  | "background"
  | "primary_source"
  | "example"
  | "issue_prompt"
  | "follow_up_report"
  | "official_position"
  | "unclear";

export type MediaCoverageSourceGroundingStatus =
  | "source_metadata"
  | "operator_curated"
  | "source_less";

export type MediaCoverageRawResult = {
  canonicalUrl?: string | null;
  checkedAt?: string | null;
  contentStoragePolicy?: "metadata_only" | string | null;
  coverageType?: MediaCoverageType | null;
  descriptionSnippet?: string | null;
  fullArticleBody?: string | null;
  language?: string | null;
  operatorApprovedCoverageType?: boolean;
  publishedAt?: string | null;
  publisherName?: string | null;
  relationshipToFlint?: MediaCoverageRelationshipToFlint | null;
  retrievedAt?: string | null;
  sourceDomain?: string | null;
  sourceGroundingStatus?: MediaCoverageSourceGroundingStatus | null;
  title?: string | null;
  trustScore?: number | null;
  truthVerdict?: string | null;
  validationStatus?: "metadata_valid" | "needs_review" | "invalid" | null;
};

const PROVIDER_TYPE = "media_coverage" as const;
const SOURCE_NAME_FALLBACK = "\ubcf4\ub3c4 \uba54\ud0c0\ub370\uc774\ud130";

function clean(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isoNow() {
  return new Date().toISOString();
}

function getDomain(url: string | null) {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function hasCue(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function inferCoverageTypeFromTitle(title: string | null): MediaCoverageType {
  if (!title) {
    return "unclear";
  }

  if (hasCue(title, [/\uc815\uc815/, /\ubc14\ub85c\uc7a1\uc2b5\ub2c8\ub2e4/i, /correction|corrected/i])) {
    return "correction";
  }
  if (hasCue(title, [/\ubc18\ub860/, /\ubc18\ubc15/, /\uc7ac\ubc18\ubc15/, /rebuttal|response/i])) {
    return "rebuttal";
  }
  if (hasCue(title, [/\ud6c4\uc18d/, /\uc774\uc5b4\uc9c4\s*\ubcf4\ub3c4/, /\ucd94\uac00\s*\ubcf4\ub3c4/, /follow[- ]?up/i])) {
    return "follow_up";
  }
  if (hasCue(title, [/\ud574\uc124/, /\ubb38\ub2f5/, /\uc124\uba85/, /q&a|faq|explainer/i])) {
    return "explainer";
  }
  if (hasCue(title, [/\uc778\ud130\ubdf0/, /interview/i])) {
    return "interview";
  }
  if (hasCue(title, [/\uacf5\uc2dd\s*\uc785\uc7a5/, /\uc785\uc7a5\ubb38/, /\uc131\uba85/, /statement/i])) {
    return "statement_based";
  }
  if (hasCue(title, [/\ub2e8\ub3c5/, /\ucd5c\ucd08\s*\ubcf4\ub3c4/, /exclusive/i])) {
    return "original_report";
  }

  return "unclear";
}

export function normalizeMediaCoverageType(input: {
  coverageType?: MediaCoverageType | null;
  operatorApprovedCoverageType?: boolean;
  title?: string | null;
}): MediaCoverageType {
  const inferred = inferCoverageTypeFromTitle(clean(input.title));
  const requested = input.coverageType ?? null;

  if (!requested) {
    return inferred;
  }
  if (requested === "unclear") {
    return "unclear";
  }
  if (input.operatorApprovedCoverageType) {
    return requested;
  }

  return requested === inferred ? requested : "unclear";
}

export function buildMediaCoverageCanonicalKey(input: {
  canonicalUrl?: string | null;
  publishedAt?: string | null;
  sourceDomain?: string | null;
}) {
  return [
    "media",
    "MEDIA_COVERAGE_CONTEXT",
    clean(input.canonicalUrl) ?? "unknown-url",
    clean(input.sourceDomain) ?? "unknown-source",
    clean(input.publishedAt) ?? "unknown-date"
  ].join(":");
}

export class MediaCoverageProvider implements ContextResearchProvider<MediaCoverageRawResult> {
  readonly providerType = PROVIDER_TYPE;

  async search(
    _query: string,
    options: ContextResearchProviderSearchOptions = {}
  ): Promise<MediaCoverageRawResult[]> {
    if (!isContextProviderEnabled(PROVIDER_TYPE, options.env ?? process.env)) {
      return [];
    }

    return [];
  }

  async fetchById(): Promise<MediaCoverageRawResult | null> {
    return null;
  }

  normalize(rawResult: MediaCoverageRawResult): ContextAsset {
    const canonicalUrl = clean(rawResult.canonicalUrl);
    const title = clean(rawResult.title) ?? "\uad00\ub828 \ubcf4\ub3c4";
    const checkedAt = clean(rawResult.checkedAt) ?? isoNow();
    const retrievedAt = clean(rawResult.retrievedAt) ?? checkedAt;
    const publishedAt = clean(rawResult.publishedAt);
    const sourceDomain = clean(rawResult.sourceDomain) ?? getDomain(canonicalUrl);
    const publisherName = clean(rawResult.publisherName) ?? sourceDomain ?? SOURCE_NAME_FALLBACK;
    const coverageType = normalizeMediaCoverageType(rawResult);
    const relationshipToFlint = rawResult.relationshipToFlint ?? "unclear";
    const sourceGroundingStatus =
      rawResult.sourceGroundingStatus ?? (canonicalUrl || sourceDomain ? "source_metadata" : "source_less");
    const validationStatus = rawResult.validationStatus ?? (
      canonicalUrl && title && (publishedAt || retrievedAt) ? "metadata_valid" : "needs_review"
    );
    const sourceDate = publishedAt ?? retrievedAt ?? checkedAt;

    return {
      assetType: "MEDIA_COVERAGE_CONTEXT",
      canonicalSourceKey: buildMediaCoverageCanonicalKey({
        canonicalUrl,
        publishedAt,
        sourceDomain
      }),
      checkedAt,
      confidence: validationStatus === "metadata_valid" ? "medium" : "low",
      disclaimer: MEDIA_CONTEXT_DISCLAIMER_KO,
      keyPoints: [
        "\ubcf4\ub3c4 \ud750\ub984 \uba54\ud0c0\ub370\uc774\ud130 \uc0c9\uc778\uc785\ub2c8\ub2e4.",
        `coverageType:${coverageType}`,
        `relationshipToFlint:${relationshipToFlint}`,
        "contentStoragePolicy:metadata_only",
        `sourceGroundingStatus:${sourceGroundingStatus}`,
        `validationStatus:${validationStatus}`
      ],
      limitations: [
        "\uae30\uc0ac \ubcf8\ubb38\uc740 \uc800\uc7a5\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4.",
        "\ubcf4\ub3c4\uc758 \uc9c4\uc704, \uc704\ubc95\uc131, \uba85\uc608\ud6fc\uc190 \uc5ec\ubd80\ub97c \ud310\ub2e8\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4.",
        "\ub9e4\uccb4 \ud3c9\uac00 \uc810\uc218\ub098 \ud329\ud2b8\uccb4\ud06c \uacb0\ub860\uc744 \ub9cc\ub4e4\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4."
      ],
      locale: clean(rawResult.language) ?? "ko",
      modelMetadata: {
        canonicalUrl,
        contentStoragePolicy: "metadata_only",
        coverageType,
        descriptionSnippet: clean(rawResult.descriptionSnippet),
        fullArticleBodyStored: false,
        language: clean(rawResult.language) ?? "ko",
        publishedAt,
        publisherName,
        relationshipToFlint,
        retrievedAt,
        sourceDomain,
        sourceGroundingStatus,
        validationStatus,
        visibleInPublicUi: false
      },
      providerType: PROVIDER_TYPE,
      retrievedAt,
      sourceDate,
      sourceHash: getContextHash({
        canonicalUrl,
        publishedAt,
        publisherName,
        title
      }),
      sourceIdentifier: canonicalUrl ? `media:url:${canonicalUrl}` : sourceDomain ? `media:domain:${sourceDomain}` : undefined,
      sourceInstitution: publisherName,
      sourceName: publisherName,
      sourceTitle: title,
      sourceUrl: canonicalUrl ?? undefined,
      status: validationStatus === "metadata_valid" ? "current" : "needs_review",
      summary: "\uc774 \ud56d\ubaa9\uc740 \uae30\uc0ac \ub9c1\ud06c\uc640 \uacf5\uac1c \uba54\ud0c0\ub370\uc774\ud130\ub97c \ubcf4\ub3c4 \ud750\ub984 \uc548\uc5d0\uc11c \ucc3e\uae30 \uc704\ud55c \uc0c9\uc778\uc785\ub2c8\ub2e4."
    };
  }

  validate(normalizedAsset: ContextAsset) {
    assertValidContextAsset(normalizedAsset);
  }

  getFreshnessPolicy(asset?: ContextAsset): ContextFreshnessPolicy {
    return getContextAssetFreshnessPolicy(
      asset ?? {
        assetType: "MEDIA_COVERAGE_CONTEXT",
        providerType: PROVIDER_TYPE,
        sourceTitle: ""
      }
    );
  }
}

export function createMediaCoverageProvider() {
  return new MediaCoverageProvider();
}
