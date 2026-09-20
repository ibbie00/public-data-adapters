import type { ContextSourceArticle } from "../../types";
import {
  NationalLawProviderError,
  type NationalLawProviderStatus,
  type NationalLawRawResult,
  type NationalLawTarget
} from "./types";
import { isRecord } from "../../../api/is-record";

function asString(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : undefined;
}

export function firstString(record: NationalLawRawResult, keys: string[]) {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function normalizeCompactDate(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const digits = value.replace(/\D/g, "");
  if (digits.length !== 8) {
    return value;
  }

  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
}

function normalizeResults(
  payload: unknown,
  target: NationalLawTarget
): NationalLawRawResult[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const root = payload as Record<string, unknown>;
  const resultMessage = firstString(root, ["result", "RESULT"]);
  const detailMessage = firstString(root, ["msg", "message", "MESSAGE"]);

  if (resultMessage || detailMessage) {
    const message = [resultMessage, detailMessage].filter(Boolean).join(":");
    const status: NationalLawProviderStatus =
      message.includes("\uc0ac\uc6a9\uc790 \uc815\ubcf4 \uac80\uc99d") ||
      message.toLowerCase().includes("oc")
        ? "MISSING_CREDENTIALS"
        : "INVALID_QUERY";
    throw new NationalLawProviderError(
      status,
      `NATIONAL_LAW_API_ERROR:${message.slice(0, 160)}`
    );
  }

  const searchRoot =
    (root.LawSearch as Record<string, unknown> | undefined) ??
    (root.OrdinSearch as Record<string, unknown> | undefined) ??
    root;
  const candidate =
    searchRoot[target] ??
    searchRoot.law ??
    searchRoot.ordin ??
    searchRoot.ordinance;

  if (Array.isArray(candidate)) {
    return candidate.filter((item): item is NationalLawRawResult =>
      Boolean(item && typeof item === "object")
    );
  }

  if (candidate && typeof candidate === "object") {
    return [candidate as NationalLawRawResult];
  }

  return [];
}

function parseXmlRecords(
  text: string,
  target: NationalLawTarget
): NationalLawRawResult[] {
  const tag = target === "law" ? "law" : "ordin";
  const matches = [
    ...text.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))
  ];

  return matches.map((match) => {
    const record: NationalLawRawResult = {};
    for (const field of match[1]?.matchAll(/<([^/][^>]*)>([\s\S]*?)<\/\1>/g) ?? []) {
      const key = field[1]?.trim();
      if (key) {
        record[key] = field[2]?.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
      }
    }
    return record;
  }).filter((record) => Object.keys(record).length > 0);
}

// `text` is supplied by the caller because the fetch helper already read the
// body under one deadline and one byte cap; re-reading it here would be the
// uncapped read this replaces.
export function parseNationalLawResponse(
  response: Response,
  text: string,
  target: NationalLawTarget
) {
  const contentType = response.headers.get("content-type") ?? "";

  if (!text.trim()) {
    return [];
  }

  if (contentType.includes("json") || text.trimStart().startsWith("{")) {
    try {
      return normalizeResults(JSON.parse(text), target);
    } catch (error) {
      if (error instanceof NationalLawProviderError) {
        throw error;
      }
      throw new NationalLawProviderError(
        "PARSE_ERROR",
        "NATIONAL_LAW_JSON_PARSE_ERROR"
      );
    }
  }

  if (contentType.includes("xml") || text.trimStart().startsWith("<")) {
    return parseXmlRecords(text, target);
  }

  throw new NationalLawProviderError(
    "PARSE_ERROR",
    "NATIONAL_LAW_UNSUPPORTED_RESPONSE"
  );
}

export function getHttpErrorStatus(status: number): NationalLawProviderStatus {
  if (status === 404) return "NOT_FOUND";
  if (status === 408) return "TIMEOUT";
  if (status === 429) return "RATE_LIMITED";
  return "EXTERNAL_API_ERROR";
}

function getNestedRecord(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (isRecord(value)) {
      return value;
    }
  }

  return undefined;
}

function collectArticleRecords(value: unknown): NationalLawRawResult[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectArticleRecords);
  }

  if (!isRecord(value)) {
    return [];
  }

  const articleNo = firstString(value, [
    "\uc870\ubb38\ubc88\ud638",
    "\uc870\ubb38\ud0a4",
    "articleNo"
  ]);
  const articleTitle = firstString(value, [
    "\uc870\ubb38\uc81c\ubaa9",
    "articleTitle"
  ]);
  const hasArticleShape =
    Boolean(articleNo) ||
    Boolean(articleTitle) ||
    Object.prototype.hasOwnProperty.call(value, "\uc870\ubb38\ub0b4\uc6a9");

  if (hasArticleShape) {
    return [value];
  }

  const nested = getNestedRecord(value, ["\uc870\ubb38", "article", "articles"]);
  if (nested) {
    return collectArticleRecords(nested);
  }

  return Object.values(value).flatMap(collectArticleRecords);
}

export function extractNationalLawArticles(
  rawResult: NationalLawRawResult
): ContextSourceArticle[] {
  const articleContainer =
    rawResult["\uc870\ubb38"] ??
    rawResult["\uc870\ubb38\ub2e8\uc704"] ??
    rawResult.articles ??
    rawResult.article;
  const candidates = articleContainer === undefined
    ? collectArticleRecords(rawResult)
    : collectArticleRecords(articleContainer);
  const seen = new Set<string>();

  return candidates.flatMap((record): ContextSourceArticle[] => {
    const articleNo =
      firstString(record, [
        "\uc870\ubb38\ubc88\ud638",
        "\uc870\ubb38\ud0a4",
        "articleNo"
      ]) ??
      firstString(record, ["\uc870\ubb38\uc81c\ubaa9", "articleTitle"]);
    if (!articleNo) {
      return [];
    }

    const articleTitle = firstString(record, [
      "\uc870\ubb38\uc81c\ubaa9",
      "articleTitle"
    ]);
    const key = `${articleNo}:${articleTitle ?? ""}`;
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);

    return [{
      articleNo,
      articleTitle,
      effectiveDate: normalizeCompactDate(
        firstString(record, ["\uc2dc\ud589\uc77c\uc790", "effectiveDate"])
      ),
      sourceIdentifier: firstString(record, [
        "\uc870\ubb38\ud0a4",
        "sourceIdentifier"
      ]),
      summary: firstString(record, ["\uc870\ubb38\ub0b4\uc6a9", "summary"])
    }];
  });
}
