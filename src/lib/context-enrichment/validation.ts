import type { ContextAlias, ContextAsset } from "./types";
import { AMBIGUOUS_ALIAS_MESSAGE_KO } from "./types";
import {
  assertValidContextAsset,
  validateContextAsset
} from "./validation/context-asset";
import { hasSource, type ContextValidationResult } from "./validation/shared";

export type { ContextValidationResult } from "./validation/shared";
export { assertValidContextAsset, validateContextAsset };

export function validateContextAliasForPublicDisplay(
  alias: ContextAlias,
  options: {
    visibleInPublicUi: boolean;
  }
): ContextValidationResult {
  const errors: string[] = [];

  if (options.visibleInPublicUi && !hasSource(alias)) {
    errors.push("PUBLIC_ALIAS_SOURCE_REQUIRED");
  }

  if (
    options.visibleInPublicUi &&
    alias.status === "ambiguous" &&
    !alias.explanation?.includes(AMBIGUOUS_ALIAS_MESSAGE_KO)
  ) {
    errors.push("AMBIGUOUS_ALIAS_WARNING_REQUIRED");
  }

  if (
    alias.status === "ambiguous" &&
    alias.canonicalTargets.length === 1 &&
    alias.canonicalTargets[0]?.relation !== "ambiguous"
  ) {
    errors.push("AMBIGUOUS_ALIAS_MUST_NOT_PICK_SINGLE_TARGET");
  }

  return {
    errors,
    ok: errors.length === 0
  };
}

export function canDisplayContextAssetPublicly(asset: ContextAsset) {
  const validation = validateContextAsset(asset);

  if (!validation.ok) {
    return {
      errors: validation.errors,
      ok: false
    };
  }

  if (asset.status === "possibly_stale") {
    return {
      errors: ["POSSIBLY_STALE_CONTEXT_REQUIRES_VISIBLE_STALE_LABEL"],
      ok: false
    };
  }

  if (asset.status === "superseded") {
    return {
      errors: ["SUPERSEDED_CONTEXT_CANNOT_DISPLAY_AS_CURRENT"],
      ok: false
    };
  }

  return {
    errors: [],
    ok: true
  };
}
