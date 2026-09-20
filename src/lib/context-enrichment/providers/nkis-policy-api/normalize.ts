import { getContextHash, getContextQueryFingerprint } from "../../normalize";
import type { ContextAsset } from "../../types";
import {
  PROVIDER_ID,
  SOURCE_INSTITUTION_KO,
  SOURCE_NAME_KO
} from "./constants";
import {
  clean,
  getFirstString
} from "./env";
import type { NkisPolicyRawResult } from "./types";

export function normalizeNkisPolicyRawResult(input: {
  now: () => Date;
  rawResult: NkisPolicyRawResult;
}): ContextAsset {
  const { now, rawResult } = input;
  // `__query` is deliberately NOT a title fallback: on the flint-keyword path it is the
  // author's own sentence, and the title becomes the asset's public sourceTitle.
  const title =
    getFirstString(rawResult, ["OTP_HAN_NM", "OTP_LIST_NM", "ARTICLE_HAN_NM", "VDO_NM", "title"]) ??
    getContextHash(rawResult);
  const category = getFirstString(rawResult, ["OTP_CD_NM", "OTC_NM_STR", "OTC_CD_NM"]);
  const majorClass = getFirstString(rawResult, ["LCLA_SCS_NM"]);
  const middleClass = getFirstString(rawResult, ["MCLA_SCS_NM"]);
  const publisher = getFirstString(rawResult, ["PUBAGC", "AGC_NM", "HOST_NM"]);
  const publishedYear = getFirstString(rawResult, ["PBL_YY"]);
  const publishedDate = getFirstString(rawResult, ["PBL_YYYYMMDD", "OPEN_DATE"]);
  const sourceUrl = getFirstString(rawResult, ["ORG_LINK", "ORG_LINK_POPUP", "VDO_URL_ADDR"]);
  const otpId = getFirstString(rawResult, ["OTP_ID", "VDO_ID"]);
  const otpSeq = getFirstString(rawResult, ["OTP_SEQ"]) ?? "0";
  const otpCd = getFirstString(rawResult, ["OTP_CD"]) ?? "R";
  const checkedAt = rawResult.__checkedAt ?? now().toISOString();
  const sourceIdentifier = otpId ? `nkis:${otpCd}:${otpId}:${otpSeq}` : `nkis:search:${getContextHash(rawResult)}`;

  return {
    assetType: "POLICY_REPORT_CONTEXT",
    checkedAt,
    confidence: "medium",
    keyPoints: [
      category ? `materialType:${category}` : null,
      publisher ? `publisher:${publisher}` : null,
      publishedDate ? `publishedAt:${publishedDate}` : publishedYear ? `publishedYear:${publishedYear}` : null,
      majorClass ? `majorClass:${majorClass}` : null,
      middleClass ? `middleClass:${middleClass}` : null,
      "contentStoragePolicy:metadata_only",
      `sourceProvider:${PROVIDER_ID}`
    ].filter((point): point is string => Boolean(point)),
    limitations: [
      "\uad6d\uac00\uc815\ucc45\uc5f0\uad6c\ud3ec\ud138\uc758 \uc81c\ubaa9\u00b7\ubc1c\ud589\uae30\uad00\u00b7\ubc1c\ud589\uc5f0\ub3c4\u00b7\ubd84\ub958\u00b7\uc6d0\ubb38 \ub9c1\ud06c \uba54\ud0c0\ub370\uc774\ud130\ub9cc \uc0c9\uc778\ud558\uba70, \uc5f0\uad6c\ubcf4\uace0\uc11c \ubcf8\ubb38\uc744 \uc800\uc7a5\ud558\uac70\ub098 \uc815\ucc45 \ud310\ub2e8\uc744 \uc0dd\uc131\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4."
    ],
    locale: "ko",
    modelMetadata: {
      abstractPresent: Boolean(clean(rawResult.HAN_ABS)),
      category,
      majorClass,
      middleClass,
      otpCd,
      otpId,
      otpSeq,
      provider: PROVIDER_ID,
      publisher,
      publishedDate,
      publishedYear,
      queryFingerprint: rawResult.__query ? getContextQueryFingerprint(rawResult.__query) : null,
      validationStatus: "source_metadata_normalized"
    },
    providerType: "policy_report",
    retrievedAt: checkedAt,
    sourceDate: publishedDate ?? publishedYear ?? checkedAt,
    sourceHash: getContextHash(rawResult),
    sourceIdentifier,
    sourceInstitution: publisher ?? SOURCE_INSTITUTION_KO,
    sourceName: SOURCE_NAME_KO,
    sourceTitle: title,
    sourceUrl: sourceUrl || "https://www.nkis.re.kr/",
    status: "current",
    // No summary. What used to sit here was a fixed sentence about our own indexing
    // ("a metadata index for connecting official material"), which told a reader nothing
    // the title did not. The card now shows the values themselves; see
    // lib/context-enrichment/flint-context-meteors/facts.ts.
    summary: null
  };
}
