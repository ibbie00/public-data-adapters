import type { ContextAsset } from "../types";
import {
  CORPORATE_DISCLOSURE_CONTEXT_DISCLAIMER_KO,
  CULTURAL_METADATA_CONTEXT_DISCLAIMER_KO,
  LEGAL_CONTEXT_DISCLAIMER_KO,
  MEDIA_CONTEXT_DISCLAIMER_KO,
  NEWS_MEDIA_CONTEXT_DISCLAIMER_KO,
  WEATHER_ENVIRONMENT_CONTEXT_DISCLAIMER_KO
} from "../types";
import { hasSource, type ContextValidationResult } from "./shared";

const LEGAL_ASSET_TYPES = new Set(["LAW_CONTEXT", "ORDINANCE_CONTEXT"]);
const JUDGMENT_PATTERNS = [
  /\ud329\ud2b8\uccb4\ud06c\s*\uc644\ub8cc/i,
  /\ubd88\ubc95\s*\uac00\ub2a5\uc131\s*\ub192/i,
  /\uc2b9\uc18c\s*\uac00\ub2a5/i,
  /\ud328\uc18c\s*\uac00\ub2a5/i,
  /\ud569\ubc95\uc785\ub2c8\ub2e4/,
  /\ubd88\ubc95\uc785\ub2c8\ub2e4/,
  /\uc704\ubc95\uc785\ub2c8\ub2e4/,
  /\uc815\ub2f5/,
  /\uacb0\ub860\s*:/i
];
const ELECTION_PREDICTION_PATTERNS = [
  /\ub2f9\uc120\s*\uac00\ub2a5/i,
  /\uc2b9\ub9ac\s*\uc608\uce21/i,
  /\ucd94\ucc9c\s*(\ud6c4\ubcf4|\uc815\ub2f9)/i,
  /vote\s+for/i,
  /will\s+win/i
];
const MEDIA_ASSET_TYPES = new Set([
  "MEDIA_COVERAGE_CONTEXT",
  "MEDIA_COVERAGE_TIMELINE",
  "MEDIA_CORRECTION_STATUS"
]);
const MEDIA_FORBIDDEN_PATTERNS = [
  /outlet\s+trust\s+score/i,
  /media\s+trust\s+score/i,
  /\uc5b8\ub860\uc0ac\s*\uc2e0\ub8b0\s*\uc810\uc218/,
  /\ud5c8\uc704\s*(\ud310\uc815|\ud655\uc815)/,
  /\uc9c4\uc2e4\s*(\ud310\uc815|\ud655\uc815)/,
  /true\s*\/\s*false/i,
  /\uba85\uc608\ud6fc\uc190\s*(\ud574\ub2f9|\uc704\ud5d8|risk)/i
];
const CORPORATE_DISCLOSURE_ASSET_TYPES = new Set(["CORPORATE_DISCLOSURE_CONTEXT"]);
const CORPORATE_DISCLOSURE_FORBIDDEN_PATTERNS = [
  /\ub9e4\uc218\s*(\ucd94\ucc9c|\uc758\uacac)/,
  /\ub9e4\ub3c4\s*(\ucd94\ucc9c|\uc758\uacac)/,
  /\ud22c\uc790\s*(\ucd94\ucc9c|\uad8c\uc720)/,
  /\uc8fc\uac00\s*(\uc0c1\uc2b9|\ud558\ub77d)\s*(\ud655\uc2e4|\uc608\uc0c1|\uc804\ub9dd)/,
  /buy\s+recommendation/i,
  /sell\s+recommendation/i,
  /investment\s+advice/i
];
const CULTURAL_METADATA_ASSET_TYPES = new Set([
  "GAME_METADATA_CONTEXT",
  "MUSIC_METADATA_CONTEXT",
  "MEDIA_CATALOG_CONTEXT"
]);
const CULTURAL_METADATA_FORBIDDEN_PATTERNS = [
  /\uc0ac\uc6a9\uc790\s*(\ucde8\ud5a5|\uccad\ucde8\s*\uc774\ub825|\uc2dc\uccad\s*\uc774\ub825|\ud50c\ub808\uc774\s*\uc2dc\uac04|\ubcf4\uc720\s*\ubaa9\ub85d)/,
  /user\s+(taste|listening\s+history|watch\s+history|play\s+time|owned\s+games)/i,
  /personalized\s+(profile|inference|taste)/i
];
const WEATHER_ENVIRONMENT_ASSET_TYPES = new Set(["WEATHER_ENVIRONMENT_CONTEXT"]);
const WEATHER_ENVIRONMENT_FORBIDDEN_PATTERNS = [
  /\uc0ac\uc801\s*\uc704\uce58\s*(\ucd94\ub860|\ucd94\uc815|\ud30c\uc545)/,
  /\uac74\uac15\s*(\uc870\uc5b8|\ucc98\ubc29|\uc9c4\ub2e8)/,
  /\uc758\ub8cc\s*(\uc870\uc5b8|\ucc98\ubc29|\uc9c4\ub2e8)/,
  /private\s+location/i,
  /medical\s+(advice|diagnosis)/i
];
const NEWS_MEDIA_ASSET_TYPES = new Set(["NEWS_MEDIA_CONTEXT"]);
const NEWS_MEDIA_FORBIDDEN_PATTERNS = [
  /\uae30\uc0ac\s*\uc804\ubb38\s*(\uc800\uc7a5|\uc804\uc7ac|\ubcf5\uc0ac)/,
  /\uc5b8\ub860\uc0ac\s*\uc2e0\ub8b0\s*\uc810\uc218/,
  /\uc2e0\ub8b0\ub3c4\s*\uc810\uc218/,
  /\ud5c8\uc704\s*(\ud310\uc815|\ud655\uc815)/,
  /\uc9c4\uc2e4\s*(\ud310\uc815|\ud655\uc815)/,
  /\uba85\uc608\ud6fc\uc190\s*(\ud574\ub2f9|\uc704\ud5d8|risk)/i,
  /full\s+article\s+(body|text|copy)/i,
  /outlet\s+trust\s+score/i,
  /true\s*\/\s*false/i
];

function collectText(asset: Pick<ContextAsset, "summary" | "keyPoints" | "limitations">) {
  return [asset.summary, ...(asset.keyPoints ?? []), ...(asset.limitations ?? [])]
    .filter(Boolean)
    .join("\n");
}

// Per-field ceilings (audit 07-F6).
//
// The rest of this file checks what an asset SAYS. Nothing checked how big it is, and the
// only bound was indirect: the fetch caps a provider response at 1 MiB and at most a few
// providers run per job. That is a bound on one round, not on what lands in the database
// and then on a reader's screen.
//
// Set far above anything a real asset produces, on purpose. These exist to refuse a
// pathological response, not to trim a long one, so a legitimate asset must never meet
// them. Refusing rather than truncating keeps the same contract the rest of the validator
// has: an asset is either usable as written or it is not stored at all.
const CONTEXT_FIELD_LIMITS = {
  disclaimer: 4_000,
  keyPoint: 2_000,
  keyPoints: 50,
  limitation: 2_000,
  limitations: 20,
  sourceName: 1_000,
  sourceTitle: 1_000,
  summary: 20_000
} as const;

function collectFieldSizeErrors(asset: ContextAsset): string[] {
  const errors: string[] = [];

  if ((asset.summary?.length ?? 0) > CONTEXT_FIELD_LIMITS.summary) {
    errors.push("CONTEXT_SUMMARY_TOO_LONG");
  }
  if (asset.sourceTitle.length > CONTEXT_FIELD_LIMITS.sourceTitle) {
    errors.push("CONTEXT_SOURCE_TITLE_TOO_LONG");
  }
  if (asset.sourceName.length > CONTEXT_FIELD_LIMITS.sourceName) {
    errors.push("CONTEXT_SOURCE_NAME_TOO_LONG");
  }
  if ((asset.disclaimer?.length ?? 0) > CONTEXT_FIELD_LIMITS.disclaimer) {
    errors.push("CONTEXT_DISCLAIMER_TOO_LONG");
  }
  if ((asset.keyPoints?.length ?? 0) > CONTEXT_FIELD_LIMITS.keyPoints) {
    errors.push("CONTEXT_KEY_POINTS_TOO_MANY");
  }
  if (asset.keyPoints?.some((point) => point.length > CONTEXT_FIELD_LIMITS.keyPoint)) {
    errors.push("CONTEXT_KEY_POINT_TOO_LONG");
  }
  if ((asset.limitations?.length ?? 0) > CONTEXT_FIELD_LIMITS.limitations) {
    errors.push("CONTEXT_LIMITATIONS_TOO_MANY");
  }
  if (asset.limitations?.some((item) => item.length > CONTEXT_FIELD_LIMITS.limitation)) {
    errors.push("CONTEXT_LIMITATION_TOO_LONG");
  }

  return errors;
}

export function validateContextAsset(asset: ContextAsset): ContextValidationResult {
  const errors: string[] = [...collectFieldSizeErrors(asset)];

  if (!hasSource(asset)) {
    errors.push("CONTEXT_SOURCE_REQUIRED");
  }

  if (asset.providerType === "law" || asset.providerType === "ordinance") {
    if (!asset.disclaimer?.includes(LEGAL_CONTEXT_DISCLAIMER_KO)) {
      errors.push("LEGAL_DISCLAIMER_REQUIRED");
    }
    if (asset.effectiveDate === undefined) {
      errors.push("LEGAL_EFFECTIVE_DATE_FIELD_REQUIRED");
    }
  }

  if (String(asset.providerType) === "case_law") {
    errors.push("CASE_LAW_PROVIDER_NOT_ALLOWED_IN_THIS_PHASE");
  }

  if (asset.sourceTitle.includes("\ud310\ub840") || asset.sourceName.includes("\ud310\ub840")) {
    errors.push("CASE_LAW_SOURCE_NOT_ALLOWED_IN_THIS_PHASE");
  }

  const body = collectText(asset);
  if (LEGAL_ASSET_TYPES.has(asset.assetType) && JUDGMENT_PATTERNS.some((pattern) => pattern.test(body))) {
    errors.push("LEGAL_JUDGMENT_WORDING_NOT_ALLOWED");
  }

  if (asset.providerType === "election" && ELECTION_PREDICTION_PATTERNS.some((pattern) => pattern.test(body))) {
    errors.push("ELECTION_PREDICTION_OR_RECOMMENDATION_NOT_ALLOWED");
  }

  if (asset.providerType === "statistics") {
    const hasUnit = asset.keyPoints?.some((point) => /\ub2e8\uc704|unit/i.test(point));
    const hasPeriod = asset.keyPoints?.some((point) => /\uae30\uac04|period|\uc5f0\ub3c4|\uc6d4/i.test(point));
    if (!hasUnit) {
      errors.push("STATISTICS_UNIT_REQUIRED");
    }
    if (!hasPeriod) {
      errors.push("STATISTICS_PERIOD_REQUIRED");
    }
  }

  if (asset.providerType === "government_press") {
    const isLabeled = /\uc815\ubd80|\uae30\uad00|\ubd80\ucc98|\uacf5\uc2dd\s*(\ubc1c\ud45c|\uc785\uc7a5)|announcement|position/i.test(body);
    if (!isLabeled) {
      errors.push("GOVERNMENT_PRESS_OFFICIAL_POSITION_LABEL_REQUIRED");
    }
  }

  if (MEDIA_ASSET_TYPES.has(asset.assetType)) {
    if (!asset.disclaimer?.includes(MEDIA_CONTEXT_DISCLAIMER_KO)) errors.push("MEDIA_DISCLAIMER_REQUIRED");
    if (!asset.sourceDate) errors.push("MEDIA_SOURCE_DATE_REQUIRED");
    if (!asset.sourceTitle.trim()) errors.push("MEDIA_TITLE_REQUIRED");
    if (MEDIA_FORBIDDEN_PATTERNS.some((pattern) => pattern.test(body))) errors.push("MEDIA_JUDGMENT_WORDING_NOT_ALLOWED");
  }

  if (CORPORATE_DISCLOSURE_ASSET_TYPES.has(asset.assetType)) {
    if (!asset.disclaimer?.includes(CORPORATE_DISCLOSURE_CONTEXT_DISCLAIMER_KO)) errors.push("CORPORATE_DISCLOSURE_DISCLAIMER_REQUIRED");
    if (asset.providerType !== "corporate_disclosure") errors.push("CORPORATE_DISCLOSURE_PROVIDER_REQUIRED");
    if (!asset.sourceDate) errors.push("CORPORATE_DISCLOSURE_SOURCE_DATE_REQUIRED");
    if (!asset.sourceTitle.trim()) errors.push("CORPORATE_DISCLOSURE_TITLE_REQUIRED");
    if (CORPORATE_DISCLOSURE_FORBIDDEN_PATTERNS.some((pattern) => pattern.test(body))) errors.push("CORPORATE_DISCLOSURE_INVESTMENT_ADVICE_NOT_ALLOWED");
  }

  if (CULTURAL_METADATA_ASSET_TYPES.has(asset.assetType)) {
    if (!asset.disclaimer?.includes(CULTURAL_METADATA_CONTEXT_DISCLAIMER_KO)) errors.push("CULTURAL_METADATA_DISCLAIMER_REQUIRED");
    if (asset.providerType !== "game_metadata" && asset.providerType !== "music_metadata" && asset.providerType !== "media_catalog") errors.push("CULTURAL_METADATA_PROVIDER_REQUIRED");
    if (!asset.sourceTitle.trim()) errors.push("CULTURAL_METADATA_TITLE_REQUIRED");
    if (CULTURAL_METADATA_FORBIDDEN_PATTERNS.some((pattern) => pattern.test(body))) errors.push("CULTURAL_METADATA_PERSONAL_INFERENCE_NOT_ALLOWED");
  }

  if (WEATHER_ENVIRONMENT_ASSET_TYPES.has(asset.assetType)) {
    if (!asset.disclaimer?.includes(WEATHER_ENVIRONMENT_CONTEXT_DISCLAIMER_KO)) errors.push("WEATHER_ENVIRONMENT_DISCLAIMER_REQUIRED");
    if (asset.providerType !== "weather_environment") errors.push("WEATHER_ENVIRONMENT_PROVIDER_REQUIRED");
    if (!asset.sourceTitle.trim()) errors.push("WEATHER_ENVIRONMENT_TITLE_REQUIRED");
    if (WEATHER_ENVIRONMENT_FORBIDDEN_PATTERNS.some((pattern) => pattern.test(body))) errors.push("WEATHER_ENVIRONMENT_PRIVATE_LOCATION_OR_HEALTH_ADVICE_NOT_ALLOWED");
  }

  if (NEWS_MEDIA_ASSET_TYPES.has(asset.assetType)) {
    if (!asset.disclaimer?.includes(NEWS_MEDIA_CONTEXT_DISCLAIMER_KO)) errors.push("NEWS_MEDIA_DISCLAIMER_REQUIRED");
    if (asset.providerType !== "news_media") errors.push("NEWS_MEDIA_PROVIDER_REQUIRED");
    if (!asset.sourceDate) errors.push("NEWS_MEDIA_SOURCE_DATE_REQUIRED");
    if (!asset.sourceTitle.trim()) errors.push("NEWS_MEDIA_TITLE_REQUIRED");
    if (NEWS_MEDIA_FORBIDDEN_PATTERNS.some((pattern) => pattern.test(body))) errors.push("NEWS_MEDIA_FULL_TEXT_OR_VERDICT_NOT_ALLOWED");
  }

  return {
    errors,
    ok: errors.length === 0
  };
}

export function assertValidContextAsset(asset: ContextAsset) {
  const result = validateContextAsset(asset);

  if (!result.ok) {
    throw new Error(`CONTEXT_ASSET_VALIDATION_FAILED:${result.errors.join(",")}`);
  }
}
