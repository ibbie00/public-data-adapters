/**
 * Canonical "is this a plain object (a JSON record), not null and not an array?"
 * guard. ~30 files kept byte-identical copies of this; they now import from here.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
