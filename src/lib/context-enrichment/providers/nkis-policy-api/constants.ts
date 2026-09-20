import { contextEnrichmentUserAgent } from "../user-agent";

export const PROVIDER_ID = "nkis_policy" as const;
export const PROVIDER_TYPE = "policy_report" as const;
export const NKIS_API_BASE_URL = "https://nkis.re.kr/nkisApi/search";
export const DEFAULT_USER_AGENT =
  contextEnrichmentUserAgent("NKIS policy smoke");
export const SOURCE_NAME_KO = "\uad6d\uac00\uc815\ucc45\uc5f0\uad6c\ud3ec\ud138";
export const SOURCE_INSTITUTION_KO = "\uacbd\uc81c\u00b7\uc778\ubb38\uc0ac\ud68c\uc5f0\uad6c\ud68c";

export const NKIS_MAP_KEYS = [
  "rn",
  "otp_id",
  "otp_seq",
  "otp_cd",
  "otp_cd_nm",
  "otp_han_nm",
  "lcla_scs_id",
  "lcla_scs_nm",
  "mcla_scs_nm",
  "pubagc_cd",
  "pubagc",
  "pbl_yy",
  "org_link"
] as const;

export const NKIS_KEY_ALIASES: Record<(typeof NKIS_MAP_KEYS)[number], string> = {
  lcla_scs_id: "LCLA_SCS_ID",
  lcla_scs_nm: "LCLA_SCS_NM",
  mcla_scs_nm: "MCLA_SCS_NM",
  org_link: "ORG_LINK",
  otp_cd: "OTP_CD",
  otp_cd_nm: "OTP_CD_NM",
  otp_han_nm: "OTP_HAN_NM",
  otp_id: "OTP_ID",
  otp_seq: "OTP_SEQ",
  pbl_yy: "PBL_YY",
  pubagc: "PUBAGC",
  pubagc_cd: "PUBAGC_CD",
  rn: "RN"
};
