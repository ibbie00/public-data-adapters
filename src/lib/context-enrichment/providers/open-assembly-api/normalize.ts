import { getContextHash } from "../../normalize";
import type { ContextAsset } from "../../types";
import {
  DEFAULT_BILL_SERVICE_ID,
  OPEN_ASSEMBLY_BASE_URL,
  PROVIDER_ID,
  PROVIDER_TYPE,
  SOURCE_INSTITUTION_KO,
  SOURCE_NAME_KO
} from "./constants";
import { getFirstString } from "./parse";
import type { OpenAssemblyBillRawResult } from "./types";

export function normalizeOpenAssemblyBillResult(input: {
  checkedAt: string;
  rawResult: OpenAssemblyBillRawResult;
}): ContextAsset {
  const rawResult = input.rawResult;
  const billId = getFirstString(rawResult, ["BILL_ID", "billId"]) ?? getContextHash(rawResult);
  const billNo = getFirstString(rawResult, ["BILL_NO", "billNo"]);
  const billName = getFirstString(rawResult, ["BILL_NAME", "billName"]) ?? billId;
  const committee = getFirstString(rawResult, ["COMMITTEE", "committee"]);
  const proposedAt = getFirstString(rawResult, ["PROPOSE_DT", "proposeDt"]);
  const result = getFirstString(rawResult, ["PROC_RESULT", "procResult"]);
  const age = getFirstString(rawResult, ["AGE", "age"]);
  const proposer = getFirstString(rawResult, ["PROPOSER", "RST_PROPOSER", "proposer"]);
  const detailLink = getFirstString(rawResult, ["DETAIL_LINK", "LINK_URL", "detailLink"]);
  const checkedAt = rawResult.__checkedAt ?? input.checkedAt;
  const sourceIdentifier = `open-assembly:bill:${billId}`;

  return {
    assetType: "BILL_CONTEXT",
    checkedAt,
    confidence: "medium",
    keyPoints: [
      billNo ? `billNo:${billNo}` : null,
      age ? `assemblyAge:${age}` : null,
      committee ? `committee:${committee}` : null,
      proposedAt ? `proposedAt:${proposedAt}` : null,
      result ? `status:${result}` : null,
      proposer ? `proposer:${proposer}` : null,
      "sourceProvider:open_assembly"
    ].filter((point): point is string => Boolean(point)),
    limitations: [
      "\uacf5\uc2dd \uc758\uc548 \uba54\ud0c0\ub370\uc774\ud130 \uc0c9\uc778\uc774\uba70, \ubc95\uc548\uc758 \ud1b5\uacfc \uac00\ub2a5\uc131\u00b7\ucc2c\ubc18\u00b7\uc704\ud5cc\uc131\uc744 \ud310\ub2e8\ud558\uc9c0 \uc54a\uc2b5\ub2c8\ub2e4."
    ],
    locale: "ko",
    modelMetadata: {
      billId,
      billNo,
      committee,
      detailLink,
      provider: PROVIDER_ID,
      proposedAt,
      proposer,
      result,
      serviceId: rawResult.__serviceId ?? DEFAULT_BILL_SERVICE_ID,
      validationStatus: "source_metadata_normalized"
    },
    providerType: PROVIDER_TYPE,
    retrievedAt: checkedAt,
    sourceDate: proposedAt ?? checkedAt,
    sourceHash: getContextHash(rawResult),
    sourceIdentifier,
    sourceInstitution: SOURCE_INSTITUTION_KO,
    sourceName: SOURCE_NAME_KO,
    sourceTitle: billName,
    sourceUrl: detailLink ?? `${OPEN_ASSEMBLY_BASE_URL}/${rawResult.__serviceId ?? DEFAULT_BILL_SERVICE_ID}`,
    status: "current",
    // No summary. What used to sit here was a fixed sentence about our own indexing
    // ("a metadata index for connecting official material"), which told a reader nothing
    // the title did not. The card now shows the values themselves; see
    // lib/context-enrichment/flint-context-meteors/facts.ts.
    summary: null
  };
}
