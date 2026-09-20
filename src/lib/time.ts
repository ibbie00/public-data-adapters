/**
 * Canonical time-interval constants in milliseconds.
 *
 * Many files used to keep their own `const DAY_MS = 24 * 60 * 60 * 1000` (etc.),
 * which risks the values drifting apart. These are pure constants, so gathering
 * them here changes only where they are imported from, never any behavior.
 */
export const SECOND_MS = 1000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;

export const KST_OFFSET_MS = 9 * HOUR_MS;

/**
 * KST calendar date ("YYYY-MM-DD"). Korea has no DST, so a fixed +9h offset is exact.
 *
 * This lives here rather than next to any one caller because it is a naming and
 * bucketing decision shared by everything that reports "one per Korean day": the
 * moderator queue briefing keys its snapshots by it, and the thermal sampler names
 * its per-day files by it.
 *
 * Deliberately NOT `now.getFullYear()`/`getMonth()`/`getDate()`. Those read the
 * process time zone, which happens to be Asia/Seoul on the production box, so a
 * local-time copy is indistinguishable from this one until the day it runs anywhere
 * else (a container, CI, a laptop) and silently buckets into the wrong day.
 */
export function kstDateKey(now: Date): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** KST wall clock as "YYYY-MM-DD HH:MM", for report headers that name a window. */
export function kstTimestampLabel(at: Date): string {
  return new Date(at.getTime() + KST_OFFSET_MS).toISOString().slice(0, 16).replace("T", " ");
}
