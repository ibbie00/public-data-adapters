import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeMediaCatalogRawResult } from "../../src/lib/context-enrichment/providers/media-catalog-api/normalize";

function title(raw: string, prodYear = "2011") {
  return normalizeMediaCatalogRawResult({
    checkedAt: "2026-08-19T00:00:00.000Z",
    rawResult: {
      provider: "kmdb",
      result: { movieId: "K", movieSeq: "1", prodYear, title: raw }
    }
  } as never).sourceTitle;
}

// Every string below is what the live KMDb API actually returned on 2026-08-19, not a
// shape someone guessed. The markers carry padding on the inside, so removing them without
// collapsing afterwards leaves " 기생충  (2019)" on the card.
test("a single matched word loses its marker padding", () => {
  assert.equal(title("  !HS 7광구 !HE "), "7광구 (2011)");
  assert.equal(title("  !HS 기생충 !HE ", "2019"), "기생충 (2019)");
});

test("two matched words keep the gap between them", () => {
  assert.equal(title("  !HS 헤어질 !HE   !HS 결심 !HE ", "2022"), "헤어질 결심 (2022)");
  assert.equal(title("  !HS 살인의 !HE   !HS 추억 !HE ", "2003"), "살인의 추억 (2003)");
});

test("an unmatched tail stays attached", () => {
  assert.equal(title("  !HS 괴물 !HE  고양이"), "괴물 고양이 (2011)");
});

// ⚠️ Why there is no test here for "widening the regex to eat the spaces outside the
// markers": that variant was tried against the live API on 2026-08-19 and returned
// "헤어질결심" and "살인의추억". Reproducing it as a unit test means reproducing the whole
// clean/stripHtml pipeline that runs before the replace, and the arithmetic changes once
// the leading spaces are trimmed. The four cases above are the guard: they are real API
// strings, and any widening that glues words together fails them.
