import type {
  NecConstituencyCode,
  NecCountingStatus,
  NecEducationCode,
  NecElectionCode,
  NecGusigunCode,
  NecJobCode,
  NecPartyCode,
  NecPollingPlace,
  NecRawRecord,
  NecVoteStatus
} from "./types";

export const NEC_SOURCE = "NEC" as const;
export const NEC_SOURCE_NAME_KO = "중앙선거관리위원회" as const;
export const NEC_OFFICIAL_RESULT_DISCLAIMER_KO =
  "이 정보는 중앙선거관리위원회 공공데이터를 바탕으로 정리한 공식 투·개표 참고자료입니다. 타키비는 선거의 승패 원인, 여론 흐름, 부정선거 여부를 판단하지 않으며, 선거 종료 후 갱신될 수 있는 공식 데이터만 표시합니다.";

function clean(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function first(record: NecRawRecord, keys: string[]) {
  for (const key of keys) {
    const value = clean(record[key]);
    if (value) {
      return value;
    }
  }
  return "";
}

function parseNumber(value: unknown) {
  const text = clean(value).replace(/,/g, "");
  if (!text) {
    return undefined;
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function optionalNumber(record: NecRawRecord, keys: string[]) {
  for (const key of keys) {
    const value = parseNumber(record[key]);
    if (typeof value === "number") {
      return value;
    }
  }
  return undefined;
}

function optionalCoordinate(record: NecRawRecord, keys: string[]) {
  const value = optionalNumber(record, keys);

  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function normalizeNecElectionCode(record: NecRawRecord): NecElectionCode | null {
  const electionId = first(record, ["sgId", "SG_ID"]);
  const electionTypeCode = first(record, ["sgTypecode", "sgTypeCode", "SG_TYPECODE"]);
  const electionName = first(record, ["sgName", "SG_NAME"]);
  const voteDate = first(record, ["sgVotedate", "sgVoteDate", "SG_VOTEDATE"]);

  if (!electionId || !electionName) {
    return null;
  }

  return {
    electionId,
    electionName,
    electionTypeCode,
    source: NEC_SOURCE,
    sourceNameKo: NEC_SOURCE_NAME_KO,
    voteDate
  };
}

export function normalizeNecGusigunCode(record: NecRawRecord): NecGusigunCode | null {
  const electionId = first(record, ["sgId", "SG_ID"]);
  const districtName = first(record, ["wiwName", "gusigunName", "WIW_NAME"]);

  if (!electionId || !districtName) {
    return null;
  }

  return {
    districtName,
    electionId,
    order: optionalNumber(record, ["wOrder", "W_ORDER"]),
    provinceName: first(record, ["sdName", "SD_NAME"]) || undefined,
    source: NEC_SOURCE,
    sourceNameKo: NEC_SOURCE_NAME_KO
  };
}

export function normalizeNecConstituencyCode(record: NecRawRecord): NecConstituencyCode | null {
  const electionId = first(record, ["sgId", "SG_ID"]);
  const electionTypeCode = first(record, ["sgTypecode", "sgTypeCode", "SG_TYPECODE"]);
  const constituencyName = first(record, ["sggName", "SGG_NAME"]);

  if (!electionId || !electionTypeCode || !constituencyName) {
    return null;
  }

  return {
    constituencyName,
    districtName: first(record, ["wiwName", "WIW_NAME"]) || undefined,
    electionId,
    electionTypeCode,
    order: optionalNumber(record, ["sOrder", "S_ORDER"]),
    provinceName: first(record, ["sdName", "SD_NAME"]) || undefined,
    seats: optionalNumber(record, ["sggJungsu", "SGG_JUNGSU"]),
    source: NEC_SOURCE,
    sourceNameKo: NEC_SOURCE_NAME_KO
  };
}

export function normalizeNecPartyCode(record: NecRawRecord): NecPartyCode | null {
  const electionId = first(record, ["sgId", "SG_ID"]);
  const partyName = first(record, ["jdName", "JD_NAME"]);

  if (!electionId || !partyName) {
    return null;
  }

  return {
    electionId,
    order: optionalNumber(record, ["pOrder", "P_ORDER"]),
    partyName,
    source: NEC_SOURCE,
    sourceNameKo: NEC_SOURCE_NAME_KO
  };
}

export function normalizeNecJobCode(record: NecRawRecord): NecJobCode | null {
  const electionId = first(record, ["sgId", "SG_ID"]);
  const jobId = first(record, ["jobId", "JOB_ID"]);
  const jobName = first(record, ["jobName", "JOB_NAME"]);

  if (!electionId || !jobId || !jobName) {
    return null;
  }

  return {
    electionId,
    jobId,
    jobName,
    order: optionalNumber(record, ["jOrder", "J_ORDER"]),
    source: NEC_SOURCE,
    sourceNameKo: NEC_SOURCE_NAME_KO
  };
}

export function normalizeNecEducationCode(record: NecRawRecord): NecEducationCode | null {
  const electionId = first(record, ["sgId", "SG_ID"]);
  const educationId = first(record, ["eduId", "EDU_ID"]);
  const educationName = first(record, ["eduName", "EDU_NAME"]);

  if (!electionId || !educationId || !educationName) {
    return null;
  }

  return {
    educationId,
    educationName,
    electionId,
    order: optionalNumber(record, ["eOrder", "E_ORDER"]),
    source: NEC_SOURCE,
    sourceNameKo: NEC_SOURCE_NAME_KO
  };
}

export function normalizeNecVoteStatus(record: NecRawRecord): NecVoteStatus | null {
  const electionId = first(record, ["sgId", "SG_ID"]);
  const electionTypeCode = first(record, ["sgTypecode", "sgTypeCode", "SG_TYPECODE"]);

  if (!electionId || !electionTypeCode) {
    return null;
  }

  return {
    districtName: first(record, ["wiwName", "WIW_NAME"]) || undefined,
    earlyEtcElectors: optionalNumber(record, ["psEtcSunsu", "PS_ETC_SUNSU"]),
    earlyEtcVoters: optionalNumber(record, ["psEtcTusu", "PS_ETC_TUSU"]),
    electionDayElectors: optionalNumber(record, ["psSunsu", "PS_SUNSU"]),
    electionDayVoters: optionalNumber(record, ["psTusu", "PS_TUSU"]),
    electionId,
    electionTypeCode,
    provinceName: first(record, ["sdName", "SD_NAME"]) || undefined,
    source: NEC_SOURCE,
    sourceNameKo: NEC_SOURCE_NAME_KO,
    totalElectors: optionalNumber(record, ["totSunsu", "TOT_SUNSU"]),
    totalVoters: optionalNumber(record, ["totTusu", "TOT_TUSU"]),
    turnout: optionalNumber(record, ["turnout", "TURNO_UT", "TURNO UT"])
  };
}

export function normalizeNecCountingStatus(record: NecRawRecord): NecCountingStatus | null {
  const electionId = first(record, ["sgId", "SG_ID"]);
  const electionTypeCode = first(record, ["sgTypecode", "sgTypeCode", "SG_TYPECODE"]);

  if (!electionId || !electionTypeCode) {
    return null;
  }

  const candidates = Array.from({ length: 50 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    const partyName = first(record, [`jd${number}`, `JD${number}`]) || undefined;
    const candidateName = first(record, [`hbj${number}`, `HBJ${number}`]) || undefined;
    const votes = optionalNumber(record, [`dugsu${number}`, `DUGSU${number}`]);

    return partyName || candidateName || typeof votes === "number"
      ? {
          candidateName,
          index: index + 1,
          partyName,
          votes
        }
      : null;
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    abstentions: optionalNumber(record, ["gigwonsu", "GIGWONSU"]),
    candidates,
    constituencyName: first(record, ["sggName", "SGG_NAME"]) || undefined,
    districtName: first(record, ["wiwName", "WIW_NAME"]) || undefined,
    electionId,
    electionTypeCode,
    electors: optionalNumber(record, ["sunsu", "SUNSU"]),
    invalidVotes: optionalNumber(record, ["mutusu", "MUTUSU"]),
    provinceName: first(record, ["sdName", "SD_NAME"]) || undefined,
    source: NEC_SOURCE,
    sourceNameKo: NEC_SOURCE_NAME_KO,
    validVotes: optionalNumber(record, ["yutusu", "YUTUSU"]),
    votes: optionalNumber(record, ["tusu", "TUSU"])
  };
}

export function normalizeNecPollingPlace(
  record: NecRawRecord,
  kind: NecPollingPlace["kind"]
): NecPollingPlace | null {
  const electionId = first(record, ["sgId", "SG_ID"]);
  const pollingPlaceName = first(record, [
    "placeName",
    "polplcName",
    "polplcNm",
    "pollingPlaceName",
    "votplcName",
    "VOTPLC_NAME",
    "POLPLC_NM"
  ]);

  if (!electionId || !pollingPlaceName) {
    return null;
  }

  return {
    address: first(record, [
      "addr",
      "address",
      "polplcAddr",
      "votplcAddr",
      "ADDR",
      "POLPLC_ADDR",
      "VOTPLC_ADDR"
    ]) || undefined,
    buildingName: first(record, ["bldngName", "buildingName", "BULDNG_NAME", "BLDNG_NAME"]) || undefined,
    districtName: first(record, ["wiwName", "gusigunName", "districtName", "WIW_NAME"]) || undefined,
    electionId,
    floor: first(record, ["floor", "flr", "placeFloor", "FLOOR", "FLR"]) || undefined,
    kind,
    latitude: optionalCoordinate(record, ["lat", "latitude", "LAT", "Y", "y"]),
    longitude: optionalCoordinate(record, ["lng", "lon", "longitude", "LNG", "LON", "X", "x"]),
    phoneNumber: first(record, ["telNo", "phoneNumber", "TELNO", "TEL_NO"]) || undefined,
    pollingPlaceName,
    precinctName: first(record, ["emdName", "precinctName", "votplcOrderName", "EMD_NAME"]) || undefined,
    provinceName: first(record, ["sdName", "provinceName", "SD_NAME"]) || undefined,
    source: NEC_SOURCE,
    sourceNameKo: NEC_SOURCE_NAME_KO
  };
}
