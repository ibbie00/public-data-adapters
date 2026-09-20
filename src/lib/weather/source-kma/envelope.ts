export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export function str(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

export function pickFirst(item: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = str(item[key]);
    if (value) {
      return value;
    }
  }
  return "";
}

// data.go.kr standard envelope: response.body.items.item (array or single object).
// Returns [] for any non-NORMAL response (body absent), which is the fail-safe.
export function envelopeItems(json: unknown): Record<string, unknown>[] {
  const body = asRecord(asRecord(asRecord(json).response).body);
  const items = asRecord(body.items).item;
  if (Array.isArray(items)) {
    return items.map(asRecord);
  }
  if (items && typeof items === "object") {
    return [asRecord(items)];
  }
  return [];
}
