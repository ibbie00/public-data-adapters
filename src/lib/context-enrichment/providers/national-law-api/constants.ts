import { contextEnrichmentUserAgent } from "../user-agent";

export const LAW_API_BASE_URL = "https://www.law.go.kr/DRF";
export const SOURCE_NAME_KO = "\uad6d\uac00\ubc95\ub839\uc815\ubcf4\uc13c\ud130";
export const DEFAULT_SOURCE_INSTITUTION_KO = "\ubc95\uc81c\ucc98";
export const DEFAULT_USER_AGENT =
  contextEnrichmentUserAgent("law provider smoke");
export const DEFAULT_REFERER =
  process.env.PUBLIC_DATA_ADAPTERS_REFERER?.trim() ||
  "https://github.com/ibbie00/public-data-adapters";
export const PROVIDER_ID = "national_law";

export type CuratedLawAlias = {
  officialName?: string;
  query: string;
  shortName?: string;
  colloquialAliases?: string[];
  ambiguous?: boolean;
  candidates?: string[];
};

export const CURATED_LAW_ALIASES: Record<string, CuratedLawAlias> = {
  "\uae40\uc601\ub780\ubc95": {
    colloquialAliases: ["\uae40\uc601\ub780\ubc95"],
    officialName: "\ubd80\uc815\uccad\ud0c1 \ubc0f \uae08\ud488\ub4f1 \uc218\uc218\uc758 \uae08\uc9c0\uc5d0 \uad00\ud55c \ubc95\ub960",
    query: "\uccad\ud0c1\uae08\uc9c0\ubc95",
    shortName: "\uccad\ud0c1\uae08\uc9c0\ubc95"
  },
  "\uccad\ud0c1\uae08\uc9c0\ubc95": {
    colloquialAliases: ["\uae40\uc601\ub780\ubc95"],
    officialName: "\ubd80\uc815\uccad\ud0c1 \ubc0f \uae08\ud488\ub4f1 \uc218\uc218\uc758 \uae08\uc9c0\uc5d0 \uad00\ud55c \ubc95\ub960",
    query: "\uccad\ud0c1\uae08\uc9c0\ubc95",
    shortName: "\uccad\ud0c1\uae08\uc9c0\ubc95"
  },
  "\ub370\uc774\ud1303\ubc95": {
    ambiguous: true,
    candidates: [
      "\uac1c\uc778\uc815\ubcf4 \ubcf4\ud638\ubc95",
      "\uc815\ubcf4\ud1b5\uc2e0\ub9dd \uc774\uc6a9\ucd09\uc9c4 \ubc0f \uc815\ubcf4\ubcf4\ud638 \ub4f1\uc5d0 \uad00\ud55c \ubc95\ub960",
      "\uc2e0\uc6a9\uc815\ubcf4\uc758 \uc774\uc6a9 \ubc0f \ubcf4\ud638\uc5d0 \uad00\ud55c \ubc95\ub960"
    ],
    query: "\ub370\uc774\ud1303\ubc95"
  },
  "\ub178\ub780\ubd09\ud22c\ubc95": {
    ambiguous: true,
    candidates: [
      "\ub178\ub3d9\uc870\ud569 \ubc0f \ub178\ub3d9\uad00\uacc4\uc870\uc815\ubc95 \uac1c\uc815\uc548 \ub9e5\ub77d"
    ],
    query: "\ub178\ub780\ubd09\ud22c\ubc95"
  }
};
