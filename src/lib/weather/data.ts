// Loaders for curated weather-bot content that lives outside source code
// (data/weather/*.json): the bot account profile, the region list, and the
// framing strings (headers, source attributions, disclaimer footer, machine-
// translation note). Kept as data so non-code edits and CJK content stay out of
// the .ts source (the i18n no-Korean-source-literals rule).

import botAccountJson from "../../data/weather/bot-account.json";
import regionsJson from "../../data/weather/regions.json";
import stringsJson from "../../data/weather/strings.json";
import type { AdvisoryLifecycle } from "./types";

export type BotAccountConfig = {
  handle: string;
  displayName: string;
  name: string;
  bio: string;
  locale: string;
};

export function getBotAccountConfig(): BotAccountConfig {
  const c = botAccountJson as Record<string, unknown>;
  const displayName = String(c.displayName ?? "").trim();
  return {
    bio: String(c.bio ?? "").trim(),
    displayName,
    handle: String(c.handle ?? "").trim().toLowerCase(),
    locale: String(c.locale ?? "ko").trim(),
    name: String(c.name ?? displayName).trim()
  };
}

export type WeatherRegion = { key: string; ko: string; owmQuery: string };

export function getRegions(): WeatherRegion[] {
  const list = (regionsJson as { regions?: unknown }).regions;
  return Array.isArray(list) ? (list as WeatherRegion[]) : [];
}

export type SourceLane = "kma" | "owm";

type StringsShape = {
  dailyHeader?: string;
  dailyNote?: Record<string, string>;
  advisoryHeaderByLifecycle?: Record<string, string>;
  advisoryZonesLabel?: string;
  advisoryLiftedHints?: string[];
  sourceByLocale?: Record<string, Record<string, string>>;
  footerByLocale?: Record<string, string>;
  machineTranslationNote?: Record<string, string>;
};

export function getDailyHeader(): string {
  return ((stringsJson as StringsShape).dailyHeader ?? "").trim();
}

// Small "outlook, may change" caveat for the daily digest, per locale (part of
// the variable body, so it is machine-translated for non-ko locales, but we
// keep canonical ko/fallback strings here for the source post).
export function getDailyNote(locale: string): string {
  const map = (stringsJson as StringsShape).dailyNote ?? {};
  return (map[locale] ?? map.ko ?? "").trim();
}

export function getAdvisoryHeader(lifecycle: AdvisoryLifecycle): string {
  const map = (stringsJson as StringsShape).advisoryHeaderByLifecycle ?? {};
  return (map[lifecycle] ?? map.ISSUED ?? "").trim();
}

export function getAdvisoryZonesLabel(): string {
  return ((stringsJson as StringsShape).advisoryZonesLabel ?? "").trim();
}

// Substrings that mark a KMA notice as a "lifted" (cancellation) announcement,
// kept in data so no Korean literal lives in source. Sets the advisory lifecycle.
export function getAdvisoryLiftedHints(): string[] {
  const hints = (stringsJson as StringsShape).advisoryLiftedHints ?? [];
  return hints.map((hint) => hint.trim()).filter((hint) => hint.length > 0);
}

// The data-attribution line required by the source's terms of use, per lane
// (kma / owm) and locale. This is a FIXED string: translate.ts re-attaches the
// target-locale version rather than trusting the model, so attribution is
// guaranteed in every language. Falls back to ko, then empty.
export function getSourceLine(lane: SourceLane, locale: string): string {
  const map = (stringsJson as StringsShape).sourceByLocale ?? {};
  const byLocale = map[lane] ?? {};
  return (byLocale[locale] ?? byLocale.ko ?? "").trim();
}

// The bot signature footer, per locale (also re-attached as a fixed string).
export function getFooter(locale: string): string {
  const map = (stringsJson as StringsShape).footerByLocale ?? {};
  return (map[locale] ?? map.ko ?? "").trim();
}

export function getMachineTranslationNote(locale: string): string {
  const map = (stringsJson as StringsShape).machineTranslationNote ?? {};
  return map[locale] ?? map.ko ?? "(machine translation)";
}
