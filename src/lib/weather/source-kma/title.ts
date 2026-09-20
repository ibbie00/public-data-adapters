import { getAdvisoryLiftedHints } from "../data";
import type { AdvisoryLifecycle } from "../types";

// Tidy a KMA advisory title into a readable line, faithfully (no meaning change).
// Shape: "[특보] 제06-47호 : 2026.06.23.18:00 / 풍랑주의보 발표 (*)"
//   -> "풍랑주의보 발표 · 2026.06.23 18:00"
// Falls back to the raw title whenever the shape is unexpected (never loses info).
export function tidyAdvisoryTitle(raw: string): string {
  const slash = raw.indexOf(" / ");
  if (slash === -1) {
    return raw;
  }
  const left = raw.slice(0, slash);
  const right = raw
    .slice(slash + 3)
    .replace(/\s*\(\*\)\s*$/, "")
    .trim();
  if (!right) {
    return raw;
  }
  const dt = left.match(/(\d{4}\.\d{2}\.\d{2})\.(\d{1,2}:\d{2})/);
  return dt ? `${right} · ${dt[1]} ${dt[2]}` : right;
}

export function detectLifecycle(text: string): AdvisoryLifecycle {
  const hints = getAdvisoryLiftedHints();
  return hints.some((hint) => hint && text.includes(hint)) ? "LIFTED" : "ISSUED";
}
