import { cpSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const src = path.join(root, "src");
const dist = path.join(root, "dist");

function copyJson(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      copyJson(full);
    } else if (entry.endsWith(".json")) {
      const rel = path.relative(src, full);
      const target = path.join(dist, rel);
      mkdirSync(path.dirname(target), { recursive: true });
      cpSync(full, target);
    }
  }
}

copyJson(src);
console.log("copied JSON data files to dist/");
