export type ContextValidationResult = {
  ok: boolean;
  errors: string[];
};

export function hasSource(input: { sourceName?: string | null; sourceIdentifier?: string | null; sourceUrl?: string | null }) {
  return Boolean(input.sourceName && (input.sourceIdentifier || input.sourceUrl));
}
