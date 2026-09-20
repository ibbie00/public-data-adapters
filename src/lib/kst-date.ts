// Asia/Seoul (UTC+9, no DST) calendar-date parts. The house-account bots
// (fortune/weather/worldlit) each carried a byte-identical copy of this; they now
// re-export from here so the KST day boundary is defined once. fortune/dates.ts
// already flagged this extraction ("a future refactor could extract a shared
// core").
export const KST_TZ = "Asia/Seoul";

export function kstDateParts(
  now: Date = new Date()
): { date: string; mmdd: string } {
  // en-CA renders as YYYY-MM-DD.
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  return { date, mmdd: date.slice(5) };
}
