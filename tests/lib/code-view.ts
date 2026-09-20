import { readFileSync } from "node:fs";
import { join } from "node:path";

// Shared assertion primitives for the "usage" CI gate lanes (federation /
// external-publish / public-aggregate / external-alert / discovery-visibility).
// These lanes each READ a known set of consumer files and pin that every call
// site COMPOSES its family's central predicate, not merely that the predicate
// EXISTS. (The hedge:wiring gate already pins existence; existence gave false
// confidence when isEligibleForExternalPublishing was a required export that
// nothing called.)
//
// STRUCTURAL LIMIT (by design, unchanged): every one of these gates is a PATH /
// CONSUMER ALLOWLIST: a substring scan over files it already names. It CANNOT
// catch a brand-new surface that hand-rolls its own incomplete where/select. It
// DOES catch a pinned consumer quietly DROPPING the shared predicate: the
// recurrence mode these lanes exist to bite.
//
// COMMENT / DEAD-STRING SPOOF (now rejected): the substring scan runs over a
// CODE-ONLY VIEW of the source, not the raw file text. A pinned call/predicate
// that appears ONLY inside a `//` line comment, a `/* */` block comment, or a
// dead single-/double-quoted string literal NO LONGER satisfies a gate: that
// text is blanked before the search, so a pin can only be met by live code.
//
// RESIDUAL (template-literal spoof, documented): TEMPLATE literals are preserved
// verbatim, because several lanes legitimately pin raw-SQL fragments that live
// inside `Prisma.sql`...`` tagged-template query strings (e.g. `"hedgedAt" is
// null`, `JOIN "User" u ON u."id" = f."authorId"`, `accountLifecycleStatus" =
// 'ACTIVE'`). Blanking template contents would drop those real pins, so a pin
// hidden inside a backtick template is NOT rejected. This is a narrower hole than
// the comment/quoted-string spoof it replaces.

// Blank the CONTENTS of `//` line comments, `/* */` block comments, and single-
// /double-quoted string literals (delimiters kept, offsets preserved via spaces)
// so a pin can only be satisfied by live code. Template literals are preserved
// verbatim (see RESIDUAL above); inside a template `${ }` interpolation we resume
// code scanning so nested comments/strings there are still handled. This is a
// lightweight tokenizer, not a full TS parse: it has no regex-literal awareness
// (an exotic `//` or `/*` inside a regex character class could be misread): none
// appears in the pinned consumer files, and `core:check` is the guardrail.
export type CodeViewOptions = {
  // Keep string CONTENTS. Comments are still blanked.
  //
  // The default blanks both, which is right when the needle is an identifier: a comment
  // that merely names the thing must not satisfy a pin. But some markers ARE string
  // literals -- a discriminated-union reason like "HEDGED_LOCAL_STORE_UNAVAILABLE" is
  // the value, not a description of it -- and blanking those turns a real assertion into
  // one that cannot pass. Both failures are the same failure at different ends, so the
  // caller says which kind of needle it is holding.
  keepStrings?: boolean;
};

export function toCodeView(source: string, options: CodeViewOptions = {}): string {
  const n = source.length;
  let out = "";
  let i = 0;

  // Template-interpolation brace-depth stack. A non-empty stack means we are
  // inside one or more `${ }`; the top counts unmatched `{` seen since that `${`,
  // so we know which `}` returns us to template text.
  const interp: number[] = [];

  type Mode = "code" | "line" | "block" | "single" | "double" | "template";
  let mode: Mode = "code";

  const keepStrings = options.keepStrings === true;
  const blank = (ch: string): string =>
    ch === "\n" ? "\n" : keepStrings && mode !== "line" && mode !== "block" ? ch : " ";

  while (i < n) {
    const c = source[i];
    const d = i + 1 < n ? source[i + 1] : "";

    switch (mode) {
      case "code": {
        if (c === "/" && d === "/") {
          mode = "line";
          out += "  ";
          i += 2;
          break;
        }
        if (c === "/" && d === "*") {
          mode = "block";
          out += "  ";
          i += 2;
          break;
        }
        if (c === "'") {
          mode = "single";
          out += c;
          i += 1;
          break;
        }
        if (c === '"') {
          mode = "double";
          out += c;
          i += 1;
          break;
        }
        if (c === "`") {
          mode = "template";
          out += c;
          i += 1;
          break;
        }
        if (interp.length > 0) {
          if (c === "{") {
            interp[interp.length - 1] += 1;
            out += c;
            i += 1;
            break;
          }
          if (c === "}") {
            if (interp[interp.length - 1] === 0) {
              interp.pop();
              mode = "template";
            } else {
              interp[interp.length - 1] -= 1;
            }
            out += c;
            i += 1;
            break;
          }
        }
        out += c;
        i += 1;
        break;
      }

      case "line": {
        if (c === "\n") {
          mode = "code";
          out += c;
          i += 1;
          break;
        }
        out += blank(c);
        i += 1;
        break;
      }

      case "block": {
        if (c === "*" && d === "/") {
          mode = "code";
          out += "  ";
          i += 2;
          break;
        }
        out += blank(c);
        i += 1;
        break;
      }

      case "single":
      case "double": {
        const quote = mode === "single" ? "'" : '"';
        if (c === "\\") {
          // Skip the pair so an escaped quote never closes the string. What gets EMITTED
          // depends on keepStrings, and it did not until 2026-08-06: the pair was always
          // blanked, so `\uC2E0` came back as two spaces followed by `C2E0` even
          // when the caller had asked to keep string contents. An escape IS the content.
          //
          // This repository is full of `\uXXXX` string literals on purpose: Korean is banned
          // from lib/ source, so every user-facing Korean string there is escaped. The
          // injection-defense line in lib/ai/prompts/translation.ts is one, and
          // security:public-write:check asserts its escaped text is present. Under the old
          // behaviour that needle could not match a kept-strings view at all. A positive
          // assertion fails loudly, which is how this was found; an ABSENCE assertion over
          // escaped text would have passed forever.
          out += keepStrings ? source.slice(i, i + 2) : d === "" ? " " : "  ";
          i += 2;
          break;
        }
        if (c === quote) {
          mode = "code";
          out += c;
          i += 1;
          break;
        }
        if (c === "\n") {
          // Defensive: JS strings do not span raw newlines: treat as terminated
          // rather than letting a stray quote blank the rest of the file.
          mode = "code";
          out += c;
          i += 1;
          break;
        }
        out += blank(c);
        i += 1;
        break;
      }

      case "template": {
        if (c === "\\") {
          // Preserve the escaped pair verbatim (template/SQL text is kept as-is).
          out += d === "" ? c : c + d;
          i += 2;
          break;
        }
        if (c === "`") {
          mode = "code";
          out += c;
          i += 1;
          break;
        }
        if (c === "$" && d === "{") {
          interp.push(0);
          mode = "code";
          out += "${";
          i += 2;
          break;
        }
        // Preserve template (raw-SQL) contents verbatim.
        out += c;
        i += 1;
        break;
      }
    }
  }

  return out;
}

// Fails if a required composition/call substring is ABSENT (a consumer dropped
// the shared predicate). Searches a code-only view (comments and dead quoted
// strings blanked) so a pin cannot be met by a commented-out or dead-string call.
export function assertIncludes(source: string, needle: string, message: string) {
  if (!toCodeView(source).includes(needle)) {
    throw new Error(message);
  }
}

// The inverse: fails if a FORBIDDEN substring is PRESENT: used where a surface
// must not silently revert to a leaky construct that still type-checks (e.g. a
// raw `?? *.replyToId` fallback re-emitting a vetted-away federation target id).
// Also searches the code-only view: a forbidden construct that survives only in a
// comment or a dead quoted string is genuinely dead and does not trip the gate.
export function assertExcludes(source: string, needle: string, message: string) {
  if (toCodeView(source).includes(needle)) {
    throw new Error(message);
  }
}

// Read a repo-relative source file. Defaults to process.cwd() (the repo root when
// run via `npm run <lane>` / `node --test`), matching the other scripts/lib helpers.
export function readSource(path: string, root = process.cwd()) {
  return readFileSync(join(root, path), "utf8");
}
