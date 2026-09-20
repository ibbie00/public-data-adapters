import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { MAX_FILES_TO_SCAN } from "./constants";
import { parseLegalizeKrLawMarkdown } from "./frontmatter";
import type { LegalizeKrLawRecord } from "./types";

function scanMarkdownFiles(directory: string, output: string[] = []) {
  if (output.length >= MAX_FILES_TO_SCAN) {
    return output;
  }

  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      scanMarkdownFiles(fullPath, output);
      continue;
    }
    if (entry.endsWith(".md")) {
      output.push(fullPath);
    }
    if (output.length >= MAX_FILES_TO_SCAN) {
      return output;
    }
  }

  return output;
}

export function loadLegalizeIndexFromDirectory(directory: string | undefined): LegalizeKrLawRecord[] {
  if (!directory || !existsSync(directory)) {
    return [];
  }

  return scanMarkdownFiles(directory)
    .map((filePath) => parseLegalizeKrLawMarkdown(readFileSync(filePath, "utf8"), filePath))
    .filter((record): record is LegalizeKrLawRecord => Boolean(record));
}
