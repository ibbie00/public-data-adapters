// All scheduling for the weather bot is in KST (Asia/Seoul, UTC+9, no DST).
// The KST day-boundary helper lives in the shared lib/kst-date.ts (was a
// byte-identical copy across the bots); re-exported here for existing importers.
import { kstDateParts } from "../kst-date";
import { DAY_MS } from "../time";

export { kstDateParts };

function clampHour(hourKst: number): string {
  return String(Math.min(23, Math.max(0, Math.trunc(hourKst)))).padStart(2, "0");
}

// Tomorrow's KST date (YYYY-MM-DD): the day the evening digest is ABOUT.
export function kstTomorrow(now: Date = new Date()): string {
  const { date } = kstDateParts(now);
  const next = new Date(`${date}T00:00:00+09:00`).getTime() + DAY_MS;
  return kstDateParts(new Date(next)).date;
}

// For a "tomorrow's sky" digest, the target date is the day the forecast is
// ABOUT. The post must go out the previous evening, otherwise it becomes a same-
// day forecast with the wrong framing.
export function dailyPublishSlotKst(targetDate: string, hourKst: number): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return nextPublishSlotKst(hourKst);
  }
  const targetStart = new Date(`${targetDate}T00:00:00+09:00`).getTime();
  if (!Number.isFinite(targetStart) || kstDateParts(new Date(targetStart)).date !== targetDate) {
    return nextPublishSlotKst(hourKst);
  }
  const { date } = kstDateParts(new Date(targetStart - DAY_MS));
  return new Date(`${date}T${clampHour(hourKst)}:00:00+09:00`);
}

// The next occurrence of `hourKst` (KST), strictly in the future. Used as the
// default scheduled publish time when a proposal is approved.
export function nextPublishSlotKst(hourKst: number, now: Date = new Date()): Date {
  const { date } = kstDateParts(now);
  const hh = clampHour(hourKst);
  const today = new Date(`${date}T${hh}:00:00+09:00`);
  if (today.getTime() <= now.getTime()) {
    return new Date(today.getTime() + DAY_MS);
  }
  return today;
}

// A stable non-negative hash of a string (FNV-1a, 32-bit). Used to seed the daily
// region shuffle deterministically (no Math.random: reproducible per day).
export function stableHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// Deterministic, UN-WEIGHTED shuffle seeded by a string (e.g. the date), so the
// region order rotates day to day but is stable within a day and favors no region
// (no "Seoul first" bias). A small LCG seeded by stableHash drives Fisher-Yates.
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const out = items.slice();
  let state = stableHash(seed) || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
