import type { ProviderFetchLike } from "../fetch-with-retry";

export type GameMetadataProviderStatus =
  | "OK"
  | "NOT_FOUND"
  | "INVALID_QUERY"
  | "INVALID_CREDENTIALS"
  | "MISSING_CREDENTIALS"
  | "PROVIDER_DISABLED"
  | "EXTERNAL_API_ERROR"
  | "PARSE_ERROR"
  | "RATE_LIMITED"
  | "TIMEOUT";

export type RawgGameResult = Record<string, unknown> & {
  background_image?: string | null;
  genres?: { name?: string }[];
  id?: number;
  metacritic?: number | null;
  name?: string;
  platforms?: { platform?: { name?: string } }[];
  released?: string | null;
  slug?: string;
  stores?: { store?: { name?: string } }[];
};

export type GameMetadataRawResult = {
  checkedAt?: string;
  // 글에 적혀 있던 한국어 이름. RAWG 는 영문 이름만 아는데, 카드에는 글쓴이가 쓴 표기를
  // 되돌려 준다(창업자 판단 2026-08-18). 사전에 없는 게임이면 없다.
  koreanName?: string | null;
  provider: "rawg";
  query?: string;
  result: RawgGameResult;
  status?: GameMetadataProviderStatus;
};

export type GameMetadataSearchStatusResult = {
  checkedAt: string;
  provider: "game_metadata";
  results: GameMetadataRawResult[];
  status: GameMetadataProviderStatus;
};

export type GameMetadataApiProviderOptions = {
  fetchImpl?: ProviderFetchLike;
  now?: () => Date;
};

export class GameMetadataProviderError extends Error {
  readonly status: GameMetadataProviderStatus;

  constructor(status: GameMetadataProviderStatus, message: string) {
    super(message);
    this.name = "GameMetadataProviderError";
    this.status = status;
  }
}

export const GAME_METADATA_PROVIDER_TYPE = "game_metadata" as const;
