import type { LegalizeKrLawRecord } from "./types";

function normalizeDate(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseStringList(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function stripQuotes(value: string) {
  return value.trim().replace(/^["']|["']$/g, "");
}

function parseLegalizeFrontmatter(markdown: string): Record<string, string | string[]> | null {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    return null;
  }

  const data: Record<string, string | string[]> = {};
  const lines = match[1]?.split(/\r?\n/) ?? [];
  let listKey: string | null = null;

  for (const line of lines) {
    const listMatch = line.match(/^\s*-\s*(.+)$/);
    if (listKey && listMatch?.[1]) {
      const previous = Array.isArray(data[listKey]) ? data[listKey] : [];
      data[listKey] = [...previous, stripQuotes(listMatch[1])];
      continue;
    }

    const pair = line.match(/^([^:#]+):\s*(.*)$/);
    if (!pair?.[1]) {
      listKey = null;
      continue;
    }

    const key = pair[1].trim();
    const rawValue = pair[2]?.trim() ?? "";
    if (!rawValue) {
      data[key] = [];
      listKey = key;
      continue;
    }

    data[key] = stripQuotes(rawValue);
    listKey = null;
  }

  return data;
}

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseLegalizeKrLawMarkdown(markdown: string, filePath?: string): LegalizeKrLawRecord | null {
  const metadata = parseLegalizeFrontmatter(markdown);
  const title = firstString(metadata?.["\uc81c\ubaa9"]);
  if (!metadata || !title) {
    return null;
  }

  const ministryValue = metadata["\uc18c\uad00\ubd80\ucc98"];
  const ministry = Array.isArray(ministryValue)
    ? ministryValue
    : parseStringList(ministryValue);

  return {
    content: markdown,
    enforcementDate: normalizeDate(firstString(metadata["\uc2dc\ud589\uc77c\uc790"])),
    filePath,
    lawId: firstString(metadata["\ubc95\ub839ID"]),
    lawMst: firstString(metadata["\ubc95\ub839MST"]),
    lawType: firstString(metadata["\ubc95\ub839\uad6c\ubd84"]),
    ministry,
    originalTitle: firstString(metadata["\uc6d0\ubcf8\uc81c\ubaa9"]),
    promulgationDate: normalizeDate(firstString(metadata["\uacf5\ud3ec\uc77c\uc790"])),
    promulgationNumber: firstString(metadata["\uacf5\ud3ec\ubc88\ud638"]),
    sourceUrl: firstString(metadata["\ucd9c\ucc98"]),
    status: firstString(metadata["\uc0c1\ud0dc"]),
    title
  };
}
