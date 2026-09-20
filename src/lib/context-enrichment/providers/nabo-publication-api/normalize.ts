import { getContextHash, getContextQueryFingerprint } from "../../normalize";
import type { ContextAsset } from "../../types";
import {
  PROVIDER_ID,
  SOURCE_INSTITUTION_KO,
  SOURCE_NAME_KO
} from "./constants";
import { clean, getFirstString } from "./parse";
import { getAssetType, getEndpoint } from "./policy";
import type {
  NaboPublicationProviderType,
  NaboPublicationRawResult
} from "./types";

export function normalizeNaboPublicationRawResult(input: {
  checkedAt: string;
  providerType: NaboPublicationProviderType;
  rawResult: NaboPublicationRawResult;
}): ContextAsset {
  const rawResult = input.rawResult;
  // `__query` is deliberately NOT a title fallback: on the flint-keyword path it is the
  // author's own sentence, and the title becomes the asset's public sourceTitle.
  const title = getFirstString(rawResult, ["subj", "title", "subject"]) ?? getContextHash(rawResult);
  const department = getFirstString(rawResult, ["cdNm", "deptNm", "department", "author"]);
  const publishedAt = getFirstString(rawResult, ["pubDt", "publishedAt", "date"]);
  const detailUrl = getFirstString(rawResult, ["detailUrl", "detailURL", "urlDetail"]);
  const fileName = getFirstString(rawResult, ["name", "fileName"]);
  const fileUrl = getFirstString(rawResult, ["url", "fileUrl"]);
  const checkedAt = rawResult.__checkedAt ?? input.checkedAt;
  const endpoint = rawResult.__endpoint ?? getEndpoint(input.providerType);
  const sourceIdentifier = `nabo:${endpoint}:${getContextHash({
    detailUrl,
    fileName,
    fileUrl,
    publishedAt,
    title
  })}`;

  return {
    assetType: getAssetType(input.providerType),
    checkedAt,
    confidence: "medium",
    keyPoints: [
      department ? `department:${department}` : null,
      publishedAt ? `publishedAt:${publishedAt}` : null,
      fileName ? `attachment:${fileName}` : null,
      "contentStoragePolicy:metadata_only",
      `sourceProvider:${PROVIDER_ID}`
    ].filter((point): point is string => Boolean(point)),
    limitations: [
      "\uad6d\ud68c\uc608\uc0b0\uc815\ucc45\ucc98 \uacf5\uac1c \uc790\ub8cc\uc758 \uc81c\ubaa9\u00b7\ubd80\uc11c\u00b7\uac8c\uc2dc\uc77c\u00b7\ucca8\ubd80\ud30c\uc77c \uba54\ud0c0\ub370\uc774\ud130\ub9cc \uc0c9\uc778\ud558\uba70, \ubcf4\uace0\uc11c \ubcf8\ubb38\uc744 \uc800\uc7a5\ud558\uac70\ub098 \uc815\ucc45 \ud310\ub2e8\uc744 \uc0dd\uc131\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4."
    ],
    locale: "ko",
    modelMetadata: {
      contentTextPresent: Boolean(clean(rawResult.text)),
      department,
      detailUrl,
      endpoint,
      fileName,
      fileUrl,
      provider: PROVIDER_ID,
      publishedAt,
      queryFingerprint: rawResult.__query ? getContextQueryFingerprint(rawResult.__query) : null,
      validationStatus: "source_metadata_normalized"
    },
    providerType: input.providerType,
    retrievedAt: checkedAt,
    sourceDate: publishedAt ?? checkedAt,
    sourceHash: getContextHash(rawResult),
    sourceIdentifier,
    sourceInstitution: SOURCE_INSTITUTION_KO,
    sourceName: SOURCE_NAME_KO,
    sourceTitle: title,
    sourceUrl: detailUrl || fileUrl || `https://www.nabo.go.kr/ko/content.do?key=251217000${endpoint === "report" ? "1" : "2"}`,
    status: "current",
    // No summary. What used to sit here was a fixed sentence about our own indexing
    // ("a metadata index for connecting official material"), which told a reader nothing
    // the title did not. The card now shows the values themselves; see
    // lib/context-enrichment/flint-context-meteors/facts.ts.
    summary: null
  };
}
