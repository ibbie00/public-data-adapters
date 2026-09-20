import type { LegalizeKrAliasDefinition } from "./types";

export const PROVIDER_TYPE = "law" as const;
export const PROVIDER_NAME = "legalize-kr";
export const SOURCE_NAME_KO = PROVIDER_NAME;
export const SOURCE_INSTITUTION_KO = "\uad6d\uac00\ubc95\ub839\uc815\ubcf4\uc13c\ud130";
export const DEFAULT_SOURCE_URL_PREFIX = "https://www.law.go.kr/\ubc95\ub839/";
export const MAX_FILES_TO_SCAN = 5000;

export const CURATED_ALIASES: Record<string, LegalizeKrAliasDefinition> = {
  "\uae40\uc601\ub780\ubc95": {
    colloquialAliases: ["\uae40\uc601\ub780\ubc95"],
    officialName: "\ubd80\uc815\uccad\ud0c1 \ubc0f \uae08\ud488\ub4f1 \uc218\uc218\uc758 \uae08\uc9c0\uc5d0 \uad00\ud55c \ubc95\ub960",
    shortName: "\uccad\ud0c1\uae08\uc9c0\ubc95"
  },
  "\uccad\ud0c1\uae08\uc9c0\ubc95": {
    colloquialAliases: ["\uae40\uc601\ub780\ubc95"],
    officialName: "\ubd80\uc815\uccad\ud0c1 \ubc0f \uae08\ud488\ub4f1 \uc218\uc218\uc758 \uae08\uc9c0\uc5d0 \uad00\ud55c \ubc95\ub960",
    shortName: "\uccad\ud0c1\uae08\uc9c0\ubc95"
  }
};
