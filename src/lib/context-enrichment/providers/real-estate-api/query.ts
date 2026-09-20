import { resolveRegionCode } from "../../region-mention";
import { MOLIT_SERVICES } from "./constants";
import type { MolitRealEstateService } from "./types";

export function getServiceKey(service: MolitRealEstateService, env: NodeJS.ProcessEnv) {
  return env[service.apiKeyEnv]?.trim() || "";
}

// Which district's transactions to ask for, or null when the post does not say.
//
// This used to return Jongno (11110) for EVERY post: both branches of the old `if` held the
// same value, so a lease post about Busan got Jongno apartment prices. That is the failure
// the call table describes, and the owner ruled on 2026-08-18 that we do not pick a region
// for the writer at all.
//
// Returning null makes the provider report INVALID_QUERY instead of fetching the wrong
// city, which is the honest answer until the name-to-code table exists (see
// lib/context-enrichment/region-mention.ts for the mention test itself).
export function inferLawdCode(query: string): string | null {
  const explicit = query.match(/\b(\d{5})\b/)?.[1];

  if (explicit) {
    return explicit;
  }

  // The baked district table turns "종로구" into 11110. Ambiguous names (중구 exists in five
  // provinces) resolve only when the post also names the province, and stay null otherwise.
  return resolveRegionCode(query)?.code ?? null;
}

export function inferDealYmd(query: string, now: Date) {
  const explicit = query.match(/20\d{2}[.-]?(0[1-9]|1[0-2])/);
  if (explicit) {
    return explicit[0].replace(/[.-]/g, "").slice(0, 6);
  }

  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  return `${month.getUTCFullYear()}${String(month.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function selectService(query: string): MolitRealEstateService | null {
  const service = MOLIT_SERVICES.find((candidate) => {
    if (candidate.kind === "apartment_trade") {
      return query.includes("아파트") && (query.includes("매매") || query.includes("실거래"));
    }
    if (candidate.kind === "apartment_rent") {
      return query.includes("아파트") && (query.includes("전월세") || query.includes("전세") || query.includes("월세"));
    }
    if (candidate.kind === "row_house_trade") {
      return (query.includes("연립") || query.includes("다세대") || query.includes("빌라")) && query.includes("매매");
    }
    if (candidate.kind === "row_house_rent") {
      return (query.includes("연립") || query.includes("다세대") || query.includes("빌라")) && (query.includes("전월세") || query.includes("전세") || query.includes("월세"));
    }
    if (candidate.kind === "detached_house_rent") {
      return (query.includes("단독") || query.includes("다가구") || query.includes("원룸")) && (query.includes("전월세") || query.includes("전세") || query.includes("월세"));
    }
    if (candidate.kind === "officetel_rent") {
      return query.includes("오피스텔") && (query.includes("전월세") || query.includes("전세") || query.includes("월세"));
    }

    return false;
  });

  // ⚠️ No fallback. This used to end with `service ?? MOLIT_SERVICES[0]`, so a post that
  // named no property type and no transaction type was asked of the apartment-SALES endpoint
  // anyway: a jeonse post got sales rows, and a fine-dust post got asked too. That fallback
  // is half of why this provider was switched off on 2026-08-10 (the other half was
  // inferLawdCode always returning Jongno, fixed 2026-08-18).
  //
  // Declining is the honest answer. The post has to name BOTH a property type (아파트,
  // 연립/다세대/빌라, 단독/다가구/원룸, 오피스텔) and what happened (매매/실거래, or
  // 전세/월세/전월세). Anything less and we do not know what to ask for.
  return service ?? null;
}
