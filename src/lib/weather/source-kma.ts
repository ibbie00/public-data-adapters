// KMA special-weather-advisory client (data.go.kr, org 1360000, WthrWrnInfoService).
//
// FAITHFUL RELAY: we read the official advisory list and relay each announcement's
// official `title` line, only TIDIED for readability (phenomenon + time kept; the
// bulletin number and "(*)" marker dropped): no LLM, no meaning change, and the
// raw title is preserved for audit. Other locales are machine-translated and
// clearly marked. Fail-safe: no key, a non-NORMAL result, or zero items => no
// announcements (never a fabricated one).

import { getKmaAlertConfig } from "./config";
import { kstDateStamp, nextDayStamp } from "./source-kma/dates";
import { envelopeItems, pickFirst, str } from "./source-kma/envelope";
import { buildUrl, fetchJson, type AdvisoryFetchLike } from "./source-kma/http";
import { detectLifecycle, tidyAdvisoryTitle } from "./source-kma/title";
import { parseZones } from "./source-kma/zones";
import type { AdvisoryAnnouncement } from "./source-kma/types";

const LIST_PATH = "/getWthrWrnList";
const MSG_PATH = "/getWthrWrnMsg";

export type { AdvisoryAnnouncement };
export { parseZones, tidyAdvisoryTitle };

export async function fetchActiveAdvisories(
  options: {
    env?: NodeJS.ProcessEnv;
    // 맥락 제공자가 자기 fetch 를 넘긴다(예산·재시도 정책이 붙은 쪽). 안 넘기면 전역 fetch.
    fetchImpl?: AdvisoryFetchLike;
    lookbackDays?: number;
    timeoutMs?: number;
  } = {}
): Promise<{ announcements: AdvisoryAnnouncement[]; raw: unknown }> {
  const env = options.env ?? process.env;
  const cfg = getKmaAlertConfig(env);
  if (!cfg.hasKey) {
    return { announcements: [], raw: null };
  }

  const now = new Date();
  const lookbackDays =
    options.lookbackDays ?? (Number(env.WEATHER_ADVISORY_LOOKBACK_DAYS) || 1);
  const toTmFc = kstDateStamp(now);
  const fromTmFc = kstDateStamp(new Date(now.getTime() - lookbackDays * 86400000));
  const timeoutMs = options.timeoutMs ?? 8000;

  const listUrl = buildUrl(cfg.baseUrl, LIST_PATH, cfg.key, {
    fromTmFc,
    numOfRows: "50",
    pageNo: "1",
    toTmFc
  });
  const listJson = await fetchJson(listUrl, timeoutMs, options.fetchImpl);
  if (!listJson) {
    return { announcements: [], raw: null };
  }

  const announcements: AdvisoryAnnouncement[] = [];
  for (const item of envelopeItems(listJson)) {
    const stnId = pickFirst(item, ["stnId", "STN_ID"]);
    const tmFc = pickFirst(item, ["tmFc", "TM_FC"]);
    const tmSeq = pickFirst(item, ["tmSeq", "TM_SEQ"]) || "0";
    // `title` is the official one-line advisory text (phenomenon + level + status).
    const title = pickFirst(item, ["title", "t1", "content"]);
    if (!tmFc || !title) {
      continue;
    }
    announcements.push({
      body: tidyAdvisoryTitle(title),
      effectiveAt: tmFc,
      lifecycle: detectLifecycle(title),
      rawTitle: title,
      refKey: `${stnId}:${tmFc}:${tmSeq}`,
      stnId,
      title: "",
      tmSeq,
      zones: []
    });
  }

  return { announcements, raw: listJson };
}

// Fetch the affected zones for ONE announcement via getWthrWrnMsg (t6/t7 carry the
// "phenomenon : zones" lines). Called lazily, only for advisories we actually
// relay. Fail-soft: returns [] on any error (the post then omits the zone line).
export async function fetchAdvisoryZones(
  input: { stnId: string; tmFc: string; tmSeq: string },
  options: { env?: NodeJS.ProcessEnv; timeoutMs?: number } = {}
): Promise<string[]> {
  const env = options.env ?? process.env;
  const cfg = getKmaAlertConfig(env);
  if (!cfg.hasKey || !input.stnId || !input.tmFc) {
    return [];
  }
  // getWthrWrnMsg requires a DATE WINDOW (fromTmFc/toTmFc, yyyyMMdd) + stnId; a
  // bare tmFc/tmSeq returns resultCode 03 (NO_DATA). So fetch the announcement
  // day's 통보문 for this station, then pick the item whose (tmFc, tmSeq) matches
  // this advisory and read its affected zones from t6/t7.
  const day = input.tmFc.slice(0, 8);
  const url = buildUrl(cfg.baseUrl, MSG_PATH, cfg.key, {
    fromTmFc: day,
    numOfRows: "50",
    pageNo: "1",
    stnId: input.stnId,
    toTmFc: nextDayStamp(day)
  });
  const json = await fetchJson(url, options.timeoutMs ?? 8000);
  const match = envelopeItems(json).find(
    (item) =>
      str(item.tmFc) === input.tmFc &&
      (!input.tmSeq || str(item.tmSeq) === input.tmSeq)
  );
  if (!match) {
    return [];
  }
  const zones = [...parseZones(str(match.t6)), ...parseZones(str(match.t7))];
  return Array.from(new Set(zones));
}
