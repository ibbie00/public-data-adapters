import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { test } from "node:test";

// Audit D6 round 8, slice 3/6. Fourteen context providers call out to Korean public-data
// APIs. Thirteen route their fetches through providers/fetch-with-retry.ts. One does not,
// and it is right not to: legalize-kr reads a local directory of markdown, so there is no
// network to retry.
//
// The axis slice 2 handed over -- "the neighbours all do X and this one does not" -- landed
// on the first thing it was pointed at. It was not a defect this time, and that is the
// useful outcome: the exemption has a reason, the reason is a property of the code
// (readdirSync, not fetch), and now it is checked rather than remembered.
//
// What this guards is a fifteenth provider. These sit behind a nightly job against services
// that rate-limit and time out; one that fetches without the shared retry does not fail
// loudly, it just returns nothing more often than the others and its context quietly stops
// appearing. Nobody files that.

import { toCodeView } from "../lib/code-view";

const codeOf = (file: string) => toCodeView(readFileSync(file, "utf8"), { keepStrings: true });

const providerDirs = () =>
  execFileSync("git", ["ls-files", "src/lib/context-enrichment/providers"], { encoding: "utf8" })
    .split("\n")
    .filter((path) => path.endsWith("/provider.ts"))
    .map((path) => dirname(path));

const filesIn = (dir: string) =>
  execFileSync("git", ["ls-files", dir], { encoding: "utf8" })
    .split("\n")
    .filter((path) => path.endsWith(".ts") && existsSync(path));

// A RAW fetch, which is what the invariant is actually about. Two weaker signals were tried
// first and both were wrong: "calls the retry helper" makes the test true by construction,
// and "contains an http URL" flags legalize-kr, whose URLs are source citations for the laws
// it reads off disk.
const callsFetchDirectly = (dir: string) =>
  filesIn(dir).some((file) => /(?<!fetchWith)(?<!\.)\bfetch\s*\(/.test(codeOf(file)));

const usesRetryHelper = (dir: string) =>
  filesIn(dir).some((file) => /fetch-with-retry|fetchWithRetry/.test(codeOf(file)));

const readsLocalFiles = (dir: string) =>
  filesIn(dir).some((file) => /readdirSync|readFileSync/.test(codeOf(file)));

test("every provider that reaches the network goes through the shared retry", () => {
  const dirs = providerDirs();

  assert.ok(dirs.length > 5, `only ${dirs.length} providers found; this sweep is not measuring`);

  const bare = dirs.filter(callsFetchDirectly);

  assert.deepEqual(
    bare,
    [],
    `these providers call fetch directly instead of the shared retry:\n  ${bare.join(
      "\n  "
    )}\nThese run in a nightly job against services that rate-limit and time out. A bare fetch does not fail loudly -- it returns nothing more often than its neighbours, and that provider's context quietly stops appearing`
  );

  // And the helper is actually in use, or the assertion above would hold on a tree where
  // nothing fetches at all.
  const viaHelper = dirs.filter(usesRetryHelper);

  assert.ok(
    viaHelper.length >= dirs.length - 1,
    `only ${viaHelper.length} of ${dirs.length} providers use the shared retry; the rest reach their services some other way`
  );
});

test("the one provider without retry has no network to retry", () => {
  // The exemption, checked rather than remembered. If legalize-kr ever grows a fetch, the
  // sweep above catches it -- this says why it does not need one today, so the next reader
  // does not "fix" the asymmetry by adding a retry to a directory read.
  const offline = providerDirs().filter((dir) => !usesRetryHelper(dir));

  assert.deepEqual(
    offline.map((dir) => dir.split("/").pop()),
    ["legalize-kr"],
    "the set of providers with no network changed; a new offline provider is fine, but check that an online one did not just lose its fetch"
  );

  for (const dir of offline) {
    assert.ok(
      readsLocalFiles(dir),
      `${dir} neither fetches nor reads local files. It may be doing nothing at all`
    );
  }
});

test("the retry helper is still a retry", () => {
  // Thirteen providers lean on it. If it stopped looping, all thirteen would silently become
  // single-attempt fetches and every assertion above would stay green.
  const helper = codeOf("src/lib/context-enrichment/providers/fetch-with-retry.ts");

  assert.match(helper, /for\s*\(|while\s*\(/, "the retry helper no longer loops");
  assert.match(
    helper,
    /attempt|retries|maxAttempts/i,
    "the retry helper no longer counts attempts"
  );
});
