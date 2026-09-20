import assert from "node:assert/strict";
import { test } from "node:test";
import { getSearchQuery } from "../../src/lib/context-enrichment/providers/national-law-api/alias";
import { normalizeNationalLawRawResult } from "../../src/lib/context-enrichment/providers/national-law-api/normalize";

// A statute, its enforcement decree and its enforcement rule are three different laws.
// Publishing one under another's name is not a display bug; it misstates what the law says.

test("an alias with a subordinate instrument searches for that instrument", () => {
  assert.equal(
    getSearchQuery("청탁금지법 시행령"),
    "부정청탁 및 금품등 수수의 금지에 관한 법률 시행령"
  );
  assert.equal(
    getSearchQuery("김영란법 시행령"),
    "부정청탁 및 금품등 수수의 금지에 관한 법률 시행령"
  );
});

test("an alias on its own still resolves to the statute", () => {
  assert.equal(getSearchQuery("청탁금지법"), "청탁금지법");
  assert.equal(getSearchQuery("김영란법"), "청탁금지법");
});

test("a law outside the alias table goes out untouched", () => {
  assert.equal(getSearchQuery("도로교통법 시행규칙"), "도로교통법 시행규칙");
  assert.equal(getSearchQuery("저작권법"), "저작권법");
});

// The second half of the same defect: the registry answered with the decree and normalize
// overwrote its title with the alias table's name for the parent act.
test("the registry's own name for the row wins over the alias table's", () => {
  const asset = normalizeNationalLawRawResult({
    now: () => new Date("2026-08-19T00:00:00.000Z"),
    providerType: "law",
    rawResult: {
      // What withProviderMetadata stamps on: the alias in the QUERY, not this row.
      __officialName: "부정청탁 및 금품등 수수의 금지에 관한 법률",
      __shortName: "청탁금지법",
      법령ID: "002222",
      법령명한글: "부정청탁 및 금품등 수수의 금지에 관한 법률 시행령"
    }
  } as never);

  assert.equal(asset.sourceTitle, "부정청탁 및 금품등 수수의 금지에 관한 법률 시행령");
});

test("a row with no name of its own falls back to the alias table", () => {
  const asset = normalizeNationalLawRawResult({
    now: () => new Date("2026-08-19T00:00:00.000Z"),
    providerType: "law",
    rawResult: {
      __officialName: "부정청탁 및 금품등 수수의 금지에 관한 법률",
      법령ID: "002222"
    }
  } as never);

  assert.equal(asset.sourceTitle, "부정청탁 및 금품등 수수의 금지에 관한 법률");
});
