// Parse a KMA status line ("o 풍랑주의보 : 남해동부..., 제주도...") into a clean zone
// list, for ANY phenomenon (호우/대설/폭염/한파/강풍/건조/풍랑/…). Drops the
// "o phenomenon :" prefix and splits on commas, but NOT commas inside parentheses,
// so land zones like "경기도(고양, 파주, 연천)" stay intact. Drops "없음" (none).
export function parseZones(line: string): string[] {
  const text = (line ?? "").trim();
  if (!text) {
    return [];
  }
  const colon = text.indexOf(" : ");
  const rest = (colon === -1 ? text : text.slice(colon + 3)).replace(/^o\s+/, "");
  const zones: string[] = [];
  let buf = "";
  let depth = 0;
  for (const ch of rest) {
    if (ch === "(" || ch === "（") {
      depth += 1;
    } else if (ch === ")" || ch === "）") {
      depth = Math.max(0, depth - 1);
    }
    if (depth === 0 && (ch === "," || ch === "\n" || ch === "\r")) {
      if (buf.trim()) {
        zones.push(buf.trim());
      }
      buf = "";
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) {
    zones.push(buf.trim());
  }
  // KMA writes "none" as 없음 / 없 음 (spaced) in various fields: drop either form.
  return zones.filter((zone) => !zone.replace(/\s+/g, "").includes("없음"));
}
