import { getContextHash } from "../../normalize";
import type { ContextAsset } from "../../types";
import { LEGAL_CONTEXT_DISCLAIMER_KO } from "../../types";
import { resolveLegalizeAlias } from "./aliases";
import {
  DEFAULT_SOURCE_URL_PREFIX,
  PROVIDER_NAME,
  PROVIDER_TYPE,
  SOURCE_INSTITUTION_KO,
  SOURCE_NAME_KO
} from "./constants";
import type { LegalizeKrLawRecord } from "./types";

export function getLegalizeSourceIdentifier(rawResult: LegalizeKrLawRecord) {
  if (rawResult.lawMst) {
    return `${PROVIDER_NAME}:MST:${rawResult.lawMst}`;
  }
  if (rawResult.lawId) {
    return `${PROVIDER_NAME}:ID:${rawResult.lawId}`;
  }

  return `${PROVIDER_NAME}:title:${rawResult.title}`;
}

export function matchesLegalizeSourceIdentifier(sourceIdentifier: string, record: LegalizeKrLawRecord) {
  return sourceIdentifier === `${PROVIDER_NAME}:MST:${record.lawMst}` ||
    sourceIdentifier === `${PROVIDER_NAME}:ID:${record.lawId}`;
}

export function normalizeLegalizeKrLawRecord(rawResult: LegalizeKrLawRecord, checkedAt: string): ContextAsset {
  const alias = resolveLegalizeAlias(rawResult.title) ?? resolveLegalizeAlias(rawResult.originalTitle ?? "");
  const sourceUrl = rawResult.sourceUrl ?? `${DEFAULT_SOURCE_URL_PREFIX}${encodeURIComponent(rawResult.title)}`;
  const sourceArticles = [
    rawResult.lawType ? { articleNo: "\ubc95\ub839\uad6c\ubd84", articleTitle: rawResult.lawType } : null,
    rawResult.status ? { articleNo: "\uc0c1\ud0dc", articleTitle: rawResult.status } : null
  ].filter((item): item is { articleNo: string; articleTitle: string } => Boolean(item));
  const keyPoints = [
    alias?.shortName ? `shortName:${alias.shortName}` : null,
    ...(alias?.colloquialAliases?.map((item) => `colloquialAlias:${item}`) ?? []),
    rawResult.lawMst ? `lawMst:${rawResult.lawMst}` : null,
    rawResult.lawId ? `lawId:${rawResult.lawId}` : null,
    rawResult.status ? `status:${rawResult.status}` : null,
    rawResult.lawType ? `officialMaterial:${rawResult.lawType}` : null
  ].filter((item): item is string => Boolean(item));

  return {
    assetType: "LAW_CONTEXT",
    canonicalSourceKey: getContextHash([
      PROVIDER_NAME,
      rawResult.lawMst ?? rawResult.lawId ?? rawResult.title,
      rawResult.enforcementDate ?? ""
    ]),
    checkedAt,
    confidence: "high",
    disclaimer: LEGAL_CONTEXT_DISCLAIMER_KO,
    effectiveDate: rawResult.enforcementDate,
    keyPoints,
    limitations: [
      "legalize-kr Git commit hash\ub294 \ubc95\uc801 \uc2dd\ubcc4\uc790\ub85c \uc4f0\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4.",
      "\uc774 \uc0c9\uc778\uc740 \uacf5\uc2dd\uc790\ub8cc \uc5f0\uacb0\uc6a9\uc774\uba70 \ubc95\ub960\uc801 \uacb0\ub860\uc744 \ub9cc\ub4e4\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4."
    ],
    locale: "ko",
    modelMetadata: {
      aliases: alias?.colloquialAliases ?? [],
      contentStoragePolicy: "metadata_only",
      officialMaterials: [rawResult.lawType ?? "\ubc95\ub839 \uc790\ub8cc"],
      officialName: alias?.officialName ?? rawResult.title,
      lawId: rawResult.lawId,
      lawMst: rawResult.lawMst,
      legalizeFilePath: rawResult.filePath,
      provider: PROVIDER_NAME,
      shortName: alias?.shortName,
      validationStatus: "source_grounded"
    },
    promulgationDate: rawResult.promulgationDate,
    providerType: PROVIDER_TYPE,
    retrievedAt: checkedAt,
    sourceArticles,
    sourceHash: getContextHash(rawResult.content ?? JSON.stringify(rawResult)),
    sourceIdentifier: getLegalizeSourceIdentifier(rawResult),
    sourceInstitution: rawResult.ministry?.join(", ") || SOURCE_INSTITUTION_KO,
    sourceName: SOURCE_NAME_KO,
    sourceTitle: rawResult.title,
    sourceUrl,
    status: rawResult.status === "\ud3d0\uc9c0" ? "superseded" : "current",
    // No summary. What used to sit here was a fixed sentence about our own indexing
    // ("a metadata index for connecting official material"), which told a reader nothing
    // the title did not. The card now shows the values themselves; see
    // lib/context-enrichment/flint-context-meteors/facts.ts.
    summary: null
  };
}
