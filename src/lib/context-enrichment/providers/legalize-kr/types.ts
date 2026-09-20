import type { ContextResearchProviderSearchOptions } from "../../types";

export type LegalizeKrLawRecord = {
  content?: string;
  enforcementDate?: string;
  filePath?: string;
  lawId?: string;
  lawMst?: string;
  lawType?: string;
  ministry?: string[];
  originalTitle?: string;
  promulgationDate?: string;
  promulgationNumber?: string;
  sourceUrl?: string;
  status?: string;
  title: string;
};

export type LegalizeKrProviderOptions = {
  index?: LegalizeKrLawRecord[];
  now?: () => Date;
};

export type LegalizeKrSearchOptions = ContextResearchProviderSearchOptions;

export type LegalizeKrAliasDefinition = {
  officialName: string;
  shortName?: string;
  colloquialAliases?: string[];
};
