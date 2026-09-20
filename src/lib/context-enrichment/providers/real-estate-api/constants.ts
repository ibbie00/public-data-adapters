import { contextEnrichmentUserAgent } from "../user-agent";

import type { MolitRealEstateService } from "./types";

export const PROVIDER_TYPE = "real_estate" as const;
export const DEFAULT_USER_AGENT =
  contextEnrichmentUserAgent("official real estate metadata");
export const DEFAULT_TIMEOUT_MS = 8000;

export const MOLIT_SERVICES: MolitRealEstateService[] = [
  {
    apiKeyEnv: "MOLIT_APARTMENT_TRADE_API_KEY",
    assetTitle: "아파트 매매 실거래 흐름",
    // ⚠️ `...Dev` (the detailed variant) is a SEPARATE data.go.kr service with its own
    // approval. Our account is approved for the plain one, so the Dev path answered 403
    // SERVICE_KEY_IS_NOT_REGISTERED_ERROR while the other five worked (measured 2026-08-18).
    // The fields normalize.ts reads (umdNm, aptNm, excluUseAr, dealAmount) are all present
    // here too.
    endpoint: "https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade",
    kind: "apartment_trade",
    providerId: "molit-apartment-trade",
    sourceName: "국토교통부 아파트 매매 실거래가"
  },
  {
    apiKeyEnv: "MOLIT_APARTMENT_RENT_API_KEY",
    assetTitle: "아파트 전월세 실거래 흐름",
    endpoint: "https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent",
    kind: "apartment_rent",
    providerId: "molit-apartment-rent",
    sourceName: "국토교통부 아파트 전월세 실거래가"
  },
  {
    apiKeyEnv: "MOLIT_ROW_HOUSE_TRADE_API_KEY",
    assetTitle: "연립다세대 매매 실거래 흐름",
    endpoint: "https://apis.data.go.kr/1613000/RTMSDataSvcRHTrade/getRTMSDataSvcRHTrade",
    kind: "row_house_trade",
    providerId: "molit-row-house-trade",
    sourceName: "국토교통부 연립다세대 매매 실거래가"
  },
  {
    apiKeyEnv: "MOLIT_ROW_HOUSE_RENT_API_KEY",
    assetTitle: "연립다세대 전월세 실거래 흐름",
    endpoint: "https://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent",
    kind: "row_house_rent",
    providerId: "molit-row-house-rent",
    sourceName: "국토교통부 연립다세대 전월세 실거래가"
  },
  {
    apiKeyEnv: "MOLIT_DETACHED_HOUSE_RENT_API_KEY",
    assetTitle: "단독/다가구 전월세 실거래 흐름",
    endpoint: "https://apis.data.go.kr/1613000/RTMSDataSvcSHRent/getRTMSDataSvcSHRent",
    kind: "detached_house_rent",
    providerId: "molit-detached-house-rent",
    sourceName: "국토교통부 단독/다가구 전월세 실거래가"
  },
  {
    apiKeyEnv: "MOLIT_OFFICETEL_RENT_API_KEY",
    assetTitle: "오피스텔 전월세 실거래 흐름",
    endpoint: "https://apis.data.go.kr/1613000/RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent",
    kind: "officetel_rent",
    providerId: "molit-officetel-rent",
    sourceName: "국토교통부 오피스텔 전월세 실거래가"
  }
];
