export type NecElectionService =
  | "CommonCodeService"
  | "VoteXmntckInfoInqireService2"
  | "PolplcInfoInqireService2";

export type NecRawRecord = Record<string, unknown>;

export type NecRequestParams = Record<string, string | number | undefined>;

export type NecOpenApiStatus =
  | "OK"
  | "MISSING_CREDENTIALS"
  | "INVALID_QUERY"
  | "HTTP_ERROR"
  | "SERVICE_ERROR"
  | "EXTERNAL_API_ERROR"
  | "PARSE_ERROR"
  | "TIMEOUT";

export type NecElectionApiError = {
  provider: "NEC";
  service: NecElectionService;
  endpoint: string;
  code?: string;
  message: string;
  retryable: boolean;
  sanitizedParams: NecRequestParams;
};

export type NecOpenApiResult = {
  endpoint: string;
  fetchedAt: Date;
  items: NecRawRecord[];
  ok: boolean;
  rawText?: string;
  redactedUrl?: string;
  service: NecElectionService;
  status: NecOpenApiStatus;
  error?: NecElectionApiError;
};

export type NecClientOptions = {
  baseUrl?: string;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: (input: URL, init?: RequestInit) => Promise<Response>;
  now?: () => Date;
  timeoutMs?: number;
};

export type NecCommonCodeClient = {
  fetchConstituencyCodes(params: NecConstituencyCodeParams): Promise<NecOpenApiResult>;
  fetchDistrictCodes(params: NecDistrictCodeParams): Promise<NecOpenApiResult>;
  fetchEducationCodes(params: NecSgIdParams): Promise<NecOpenApiResult>;
  fetchElectionCodes(params?: NecListParams): Promise<NecOpenApiResult>;
  fetchJobCodes(params: NecSgIdParams): Promise<NecOpenApiResult>;
  fetchPartyCodes(params: NecSgIdParams): Promise<NecOpenApiResult>;
};

export type NecVoteCountClient = {
  fetchCountingStatus(params: NecCountingStatusParams): Promise<NecOpenApiResult>;
  fetchVoteStatus(params: NecVoteStatusParams): Promise<NecOpenApiResult>;
};

export type NecPollingPlaceClient = {
  fetchElectionDayPollingPlaces(params: NecPollingPlaceParams): Promise<NecOpenApiResult>;
  fetchEarlyVotingPollingPlaces(params: NecPollingPlaceParams): Promise<NecOpenApiResult>;
};

export type NecListParams = {
  numOfRows?: number;
  pageNo?: number;
};

export type NecSgIdParams = NecListParams & {
  sgId: string;
};

export type NecDistrictCodeParams = NecSgIdParams & {
  sdName?: string;
};

export type NecConstituencyCodeParams = NecSgIdParams & {
  sgTypecode: string;
};

export type NecVoteStatusParams = NecListParams & {
  sdName?: string;
  sgId: string;
  sgTypecode: string;
  wiwName?: string;
};

export type NecCountingStatusParams = NecVoteStatusParams & {
  sggName?: string;
};

export type NecPollingPlaceParams = NecListParams & {
  sdName?: string;
  sgId: string;
  wiwName?: string;
};

export type NecElectionCode = {
  electionId: string;
  electionTypeCode: string;
  electionName: string;
  voteDate: string;
  source: "NEC";
  sourceNameKo: "중앙선거관리위원회";
};

export type NecGusigunCode = {
  electionId: string;
  provinceName?: string;
  districtName: string;
  order?: number;
  source: "NEC";
  sourceNameKo: "중앙선거관리위원회";
};

export type NecConstituencyCode = {
  electionId: string;
  electionTypeCode: string;
  constituencyName: string;
  provinceName?: string;
  districtName?: string;
  seats?: number;
  order?: number;
  source: "NEC";
  sourceNameKo: "중앙선거관리위원회";
};

export type NecPartyCode = {
  electionId: string;
  partyName: string;
  order?: number;
  source: "NEC";
  sourceNameKo: "중앙선거관리위원회";
};

export type NecJobCode = {
  electionId: string;
  jobId: string;
  jobName: string;
  order?: number;
  source: "NEC";
  sourceNameKo: "중앙선거관리위원회";
};

export type NecEducationCode = {
  educationId: string;
  educationName: string;
  electionId: string;
  order?: number;
  source: "NEC";
  sourceNameKo: "중앙선거관리위원회";
};

export type NecVoteStatus = {
  electionId: string;
  electionTypeCode: string;
  provinceName?: string;
  districtName?: string;
  totalElectors?: number;
  electionDayElectors?: number;
  earlyEtcElectors?: number;
  totalVoters?: number;
  electionDayVoters?: number;
  earlyEtcVoters?: number;
  turnout?: number;
  source: "NEC";
  sourceNameKo: "중앙선거관리위원회";
};

export type NecCountingStatus = {
  electionId: string;
  electionTypeCode: string;
  constituencyName?: string;
  provinceName?: string;
  districtName?: string;
  electors?: number;
  votes?: number;
  validVotes?: number;
  invalidVotes?: number;
  abstentions?: number;
  candidates: Array<{
    index: number;
    partyName?: string;
    candidateName?: string;
    votes?: number;
  }>;
  source: "NEC";
  sourceNameKo: "중앙선거관리위원회";
};

export type NecPollingPlace = {
  electionId: string;
  provinceName?: string;
  districtName?: string;
  precinctName?: string;
  pollingPlaceName: string;
  address?: string;
  buildingName?: string;
  floor?: string;
  latitude?: number;
  longitude?: number;
  phoneNumber?: string;
  kind: "early_voting" | "election_day";
  source: "NEC";
  sourceNameKo: "중앙선거관리위원회";
};

export type NecMatchedElectionContext = {
  confidence: number;
  election?: NecElectionCode;
  electionTypeCode?: string;
  provinceName?: string;
  districtName?: string;
  constituencyName?: string;
  reasons: string[];
};

export type NecElectionResultComparison = {
  basis: "official_vote_count_result";
  disclaimer: string;
  left: {
    election: NecElectionCode;
    voteStatus?: NecVoteStatus;
    countingStatus?: NecCountingStatus;
  };
  right: {
    election: NecElectionCode;
    voteStatus?: NecVoteStatus;
    countingStatus?: NecCountingStatus;
  };
  source: "NEC";
  sourceNameKo: "중앙선거관리위원회";
};
