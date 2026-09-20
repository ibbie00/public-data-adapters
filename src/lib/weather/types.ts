// Shared types for the weather house account.

export type WeatherLocale = "ko" | "en" | "ja" | "zh";

// The two lanes. DAILY is the human-approved evening "tomorrow's sky" digest;
// ADVISORY is the auto-relayed official KMA special-weather-advisory.
export type WeatherKind = "DAILY" | "ADVISORY";

export const WEATHER_KINDS: readonly WeatherKind[] = ["DAILY", "ADVISORY"];

// Qualitative, noteworthy condition tags derived from tomorrow's forecast for one
// region. Only these decide "is this worth a post?" and seed the LLM's phrasing:
// raw numbers never leak into the published digest (it is a mood note, not a
// forecast table). A calm region yields no tags and is dropped from the digest;
// if EVERY region is calm, the whole digest is skipped (the bot stays silent).
export type WeatherTag =
  | "rain"
  | "snow"
  | "heat" // heat-advisory territory
  | "cold" // cold-snap territory
  | "cold_first" // first real cold of the season-ish (sharp drop into sub-zero)
  | "wide_swing" // large day/night temperature swing
  | "strong_wind"
  | "dust"; // poor air / yellow dust

export type RegionCondition = {
  // Stable region key (see data/weather/regions.json).
  region: string;
  tags: WeatherTag[];
};

// The DAILY payload: the regions with something worth saying, each as one warm
// line, already in the per-day shuffled (un-weighted) publish order.
export type DailyPayload = {
  kind: "DAILY";
  // KST YYYY-MM-DD the digest is ABOUT (tomorrow).
  date: string;
  lines: { region: string; line: string }[];
};

// A parsed KMA advisory announcement (the ADVISORY lane). Source fields are kept
// verbatim; the post is built from these plus the fixed source/disclaimer
// strings, never re-written by an LLM.
export type AdvisoryLifecycle = "ISSUED" | "UPDATED" | "LIFTED";

export type AdvisoryPayload = {
  kind: "ADVISORY";
  // Stable dedup id for this single announcement.
  refKey: string;
  // Human title built from KMA fields (phenomenon + level), source locale ko.
  title: string;
  // Affected areas, from KMA.
  zones: string[];
  // Issue / effective time string, from KMA.
  effectiveAt: string;
  // The relayed notice text: the KMA title tidied for readability (phenomenon +
  // time; bulletin no. / markers dropped), faithful to the original meaning.
  body: string;
  // The original KMA title, kept verbatim for audit (not shown in the post).
  rawTitle?: string;
  lifecycle: AdvisoryLifecycle;
};

export type WeatherPayload = DailyPayload | AdvisoryPayload;
