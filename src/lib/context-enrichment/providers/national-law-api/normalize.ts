import { getContextHash } from "../../normalize";
import type {
  ContextAsset,
  ContextProviderType,
  ContextSourceArticle
} from "../../types";
import { LEGAL_CONTEXT_DISCLAIMER_KO } from "../../types";
import {
  DEFAULT_SOURCE_INSTITUTION_KO,
  LAW_API_BASE_URL,
  PROVIDER_ID,
  SOURCE_NAME_KO
} from "./constants";
import {
  extractNationalLawArticles,
  firstString,
  normalizeCompactDate
} from "./parse";
import type { NationalLawRawResult } from "./types";
import { getTarget, redactNationalLawUrl } from "./urls";

function buildOfficialMaterialsIndex(input: {
  providerType: Extract<ContextProviderType, "law" | "ordinance">;
  sourceArticles: ContextSourceArticle[];
}) {
  const material = input.providerType === "law"
    ? "\uad6d\uac00\ubc95\ub839\uc815\ubcf4\uc13c\ud130 \ubc95\ub839 \ubcf8\ubb38"
    : "\uad6d\uac00\ubc95\ub839\uc815\ubcf4\uc13c\ud130 \uc790\uce58\ubc95\uaddc \uc790\ub8cc";
  const topics = input.sourceArticles
    .map((article) => article.articleTitle?.trim())
    .filter((title): title is string => Boolean(title))
    .slice(0, 8);

  return {
    material,
    topics
  };
}

export function normalizeNationalLawRawResult(input: {
  now: () => Date;
  providerType: Extract<ContextProviderType, "law" | "ordinance">;
  rawResult: NationalLawRawResult;
}): ContextAsset {
  const rawResult = input.rawResult;
  // The registry's own name for the row it returned wins.
  //
  // `__officialName` used to lead. It is not the row's name: it is the official name the
  // ALIAS TABLE holds for whatever alias the query contained, stamped on by
  // withProviderMetadata. So a post about "\uccad\ud0c1\uae08\uc9c0\ubc95 \uc2dc\ud589\ub839" fetched the decree correctly
  // and then had its title overwritten with the parent act, because the query mentioned an
  // alias of the act. A statute and its enforcement decree are different laws with
  // different texts and effective dates, and we published one under the other's name
  // (founder caught it on the guidance page's own screenshot, 2026-08-19).
  //
  // The alias name stays as the fallback for a row that carries no name of its own.
  const sourceTitle =
    firstString(rawResult, [
      "\ubc95\ub839\uba85\ud55c\uae00",
      "\ubc95\ub839\uba85",
      "\uc790\uce58\ubc95\uaddc\uba85",
      "lawName",
      "title"
    ]) ??
    firstString(rawResult, ["__officialName"]) ??
    "Untitled law context";
  const sourceIdentifier =
    firstString(rawResult, [
      "MST",
      "\ubc95\ub839\uc77c\ub828\ubc88\ud638",
      "\ubc95\ub839ID",
      "lawId",
      "id"
    ]) ?? getContextHash(rawResult);
  const lawId = firstString(rawResult, ["\ubc95\ub839ID", "lawId", "ID"]);
  const shortName = firstString(rawResult, [
    "__shortName",
    "\ubc95\ub839\uc57d\uce6d\uba85",
    "shortName"
  ]);
  const aliases = Array.isArray(rawResult.__colloquialAliases)
    ? rawResult.__colloquialAliases.filter(
        (value): value is string => typeof value === "string"
      )
    : [];
  const effectiveDate = normalizeCompactDate(
    firstString(rawResult, ["\uc2dc\ud589\uc77c\uc790", "effectiveDate"])
  );
  const promulgationDate = normalizeCompactDate(
    firstString(rawResult, ["\uacf5\ud3ec\uc77c\uc790", "promulgationDate"])
  );
  const rawSourceUrl =
    firstString(rawResult, [
      "\ubc95\ub839\uc0c1\uc138\ub9c1\ud06c",
      "\uc0c1\uc138\ub9c1\ud06c",
      "url"
    ]) ??
    `${LAW_API_BASE_URL}/lawSearch.do?target=${getTarget(input.providerType)}&query=${encodeURIComponent(sourceTitle)}`;
  const sourceUrl = redactNationalLawUrl(rawSourceUrl);
  const sourceArticles = extractNationalLawArticles(rawResult);
  const officialMaterialsIndex = buildOfficialMaterialsIndex({
    providerType: input.providerType,
    sourceArticles
  });

  return {
    assetType: input.providerType === "law" ? "LAW_CONTEXT" : "ORDINANCE_CONTEXT",
    checkedAt: input.now().toISOString(),
    confidence: "high",
    disclaimer: LEGAL_CONTEXT_DISCLAIMER_KO,
    effectiveDate,
    keyPoints: [
      `sourceIdentifier:${sourceIdentifier}`,
      `provider:${PROVIDER_ID}`,
      lawId ? `lawId:${lawId}` : null,
      shortName ? `shortName:${shortName}` : null,
      aliases.length > 0 ? `colloquialAliases:${aliases.join(",")}` : null,
      `officialMaterial:${officialMaterialsIndex.material}`,
      `articleCount:${sourceArticles.length}`,
      officialMaterialsIndex.topics.length > 0
        ? `sourceProvidedTopics:${officialMaterialsIndex.topics.join(",")}`
        : null
    ].filter((point): point is string => Boolean(point)),
    limitations: [
      sourceArticles.length > 0
        ? "\uc870\ubb38 \uba54\ud0c0\ub370\uc774\ud130\ub294 \uacf5\uc2dd \uc790\ub8cc\uc5d0\uc11c \ud655\uc778\ub41c \ud56d\ubaa9\ub9cc \uc0c9\uc778\ud558\uba70 \ubc95\ub960\uc801 \uacb0\ub860\uc744 \ub9cc\ub4e4\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4."
        : "\uacf5\uc2dd\uc790\ub8cc \uba54\ud0c0\ub370\uc774\ud130 \uc0c9\uc778\uc785\ub2c8\ub2e4. \uc790\ub8cc \uc81c\ubaa9\u00b7\ud45c\uc81c\uc5b4 \ud655\uc778 \uc804\uc5d0\ub294 \ub2e4\ub8e8\ub294 \ud56d\ubaa9\uc744 \ub530\ub85c \uc0dd\uc131\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4."
    ],
    locale: "ko",
    modelMetadata: {
      citationLabel: shortName ?? sourceTitle,
      colloquialAliases: aliases,
      lawId: lawId ?? null,
      lawMst: sourceIdentifier,
      officialName: sourceTitle,
      provider: PROVIDER_ID,
      rawStatus: rawResult.__status ?? "OK",
      retrievedAt: rawResult.__checkedAt ?? input.now().toISOString(),
      shortName: shortName ?? null,
      sourceKind: input.providerType === "law" ? "law" : "ordinance",
      officialMaterials: [officialMaterialsIndex.material],
      materialTopics: officialMaterialsIndex.topics,
      validationStatus: "source_metadata_normalized"
    },
    providerType: input.providerType,
    promulgationDate,
    retrievedAt: rawResult.__checkedAt
      ? String(rawResult.__checkedAt)
      : input.now().toISOString(),
    sourceHash: getContextHash(rawResult),
    sourceArticles,
    sourceIdentifier: `${input.providerType}:MST:${sourceIdentifier}`,
    sourceInstitution:
      firstString(rawResult, ["\uc18c\uad00\ubd80\ucc98\uba85", "institution"]) ??
      DEFAULT_SOURCE_INSTITUTION_KO,
    sourceName: SOURCE_NAME_KO,
    sourceTitle,
    sourceUrl,
    status: "current",
    // No summary. What used to sit here was a fixed sentence about our own indexing
    // ("a metadata index for connecting official material"), which told a reader nothing
    // the title did not. The card now shows the values themselves; see
    // lib/context-enrichment/flint-context-meteors/facts.ts.
    summary: null
  };
}
