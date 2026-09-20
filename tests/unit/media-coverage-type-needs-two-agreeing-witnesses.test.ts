import assert from "node:assert/strict";
import { before, test } from "node:test";

// Audit D6 round 4. This decides what KIND of press coverage a card claims a story is --
// original report, follow-up, correction, rebuttal -- and nothing ran it.
//
// The design here is the interesting part and it is unwritten anywhere except the code: the
// model's answer is not taken at its word. It is checked against what the headline itself
// says, and where the two disagree the card says "unclear" rather than picking a side. An
// operator can override, and that override is the only way a model's unsupported claim
// becomes a label.
//
// Calling a piece a "rebuttal" or a "correction" is a claim about a newsroom, printed under
// Takibi's name. Getting it from one unverified source -- a model reading a page -- is
// exactly the kind of automated judgement this product refuses to make.

let media: typeof import("../../src/lib/context-enrichment/providers/media-coverage");

before(async () => {
  media = await import("../../src/lib/context-enrichment/providers/media-coverage");
});

test("the model's claim only stands when the headline agrees with it", () => {
  // "정정" in the title is the cue for a correction, so a model saying "correction" is
  // corroborated and the label stands.
  assert.equal(
    media.normalizeMediaCoverageType({
      coverageType: "correction",
      title: "[정정] 어제 보도에 대해"
    }),
    "correction"
  );

  // The same model claim over a headline with no such cue is NOT enough.
  assert.equal(
    media.normalizeMediaCoverageType({
      coverageType: "correction",
      title: "새로운 정책이 발표되었다"
    }),
    "unclear",
    "one unverified reader must not be able to tell readers a newsroom issued a correction"
  );
});

test("disagreement collapses to unclear, it does not pick the model's side", () => {
  // The headline says interview, the model says rebuttal. Neither wins: saying nothing is
  // the honest outcome, and it is the one a "trust the model, it read the page" refactor
  // would quietly remove.
  assert.equal(
    media.normalizeMediaCoverageType({
      coverageType: "rebuttal",
      title: "김 대표 인터뷰"
    }),
    "unclear"
  );
});

test("an operator override is the one way an uncorroborated claim becomes a label", () => {
  assert.equal(
    media.normalizeMediaCoverageType({
      coverageType: "rebuttal",
      operatorApprovedCoverageType: true,
      title: "김 대표 인터뷰"
    }),
    "rebuttal",
    "a person looked at it, which is a different kind of evidence"
  );
});

test("no claim at all falls back to the headline, and a claim of unclear is respected", () => {
  assert.equal(
    media.normalizeMediaCoverageType({ title: "[반론] 앞선 보도에 대하여" }),
    "rebuttal",
    "the headline alone can label a piece -- it is the newsroom's own word"
  );

  assert.equal(
    media.normalizeMediaCoverageType({ title: "무제" }),
    "unclear",
    "and a headline with no cue stays unclear rather than guessing original_report"
  );

  assert.equal(
    media.normalizeMediaCoverageType({ coverageType: "unclear", title: "[정정] 어제 보도" }),
    "unclear",
    "a model saying it does not know is never overridden into knowing"
  );
});

test("the canonical key keeps unknown parts visible instead of collapsing them", () => {
  // Two different stories that both lack a URL must not become one row. The placeholder is
  // what keeps a missing field from silently merging distinct coverage.
  const missing = media.buildMediaCoverageCanonicalKey({});
  const present = media.buildMediaCoverageCanonicalKey({
    canonicalUrl: "https://news.example/a",
    publishedAt: "2026-08-04",
    sourceDomain: "news.example"
  });

  assert.match(missing, /unknown-url/);
  assert.match(missing, /unknown-source/);
  assert.match(missing, /unknown-date/);
  assert.notEqual(missing, present);
  assert.ok(present.startsWith("media:MEDIA_COVERAGE_CONTEXT:"));
});
