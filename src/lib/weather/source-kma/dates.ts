// Add one day to a yyyyMMdd stamp (handles month/year rollover) for an inclusive
// getWthrWrnMsg search window. Pure calendar-day math (UTC) on a date-only value.
export function nextDayStamp(day: string): string {
  const y = Number(day.slice(0, 4));
  const m = Number(day.slice(4, 6));
  const d = Number(day.slice(6, 8));
  const next = new Date(Date.UTC(y, m - 1, d) + 86400000);
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${next.getUTCFullYear()}${mm}${dd}`;
}

// KST yyyyMMdd: the date-only window format getWthrWrnList expects.
export function kstDateStamp(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric"
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}`;
}
