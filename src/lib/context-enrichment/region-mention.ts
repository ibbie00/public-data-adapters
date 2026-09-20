// Does the post itself name a district, plainly enough to act on?
//
// Some providers (real-estate transactions, small-business districts, SGIS population)
// cannot answer without a region. The old code filled that gap by picking one: the
// real-estate client returned Jongno for every post and the small-business client returned
// a Gangnam dong for every post, whatever the writer had written.
//
// The owner ruled on 2026-08-18: use a region ONLY when the post names one strongly, and
// never infer it from the writer's profile. Choosing a region for someone is inferring
// where they are, which the data-minimisation principle rules out; and choosing WRONG is
// worse than not attaching anything (the call table's lease-post example is exactly this).
//
// "Strongly" means si/gun/gu, the unit those datasets are keyed by. A bare "서울" is not
// enough: the datasets want a district, and a city-wide mention says nothing about which.

import districtIndex from "../../data/context-region/districts.json";

// The baked district table (npm run ai:context-districts:refresh).
const DISTRICTS = districtIndex.districts as ResolvedRegion[];

// The suffix set is closed and short, which is what makes this safe to run over free text.
// `시` alone would swallow "시간", so each pattern requires the name part to look like a
// place: two or more Hangul syllables that are not themselves a common noun ending.
// The lookahead is a CLOSED set on purpose: end of string, a non-Hangul character, or one
// of the particles that follow a place name. Rejecting every Hangul that follows would drop
// "성남시와 용인시" (the first name loses to the particle); accepting every Hangul would let
// "연구실" through as a district.
const PARTICLE_LOOKAHEAD = "(?=$|[^가-힣]|와|과|의|에|는|은|이|가|를|을|도|만|랑|까지|부터|보다)";
const DISTRICT_PATTERN = new RegExp(
  `([가-힣]{2,6}(?:시|군|구))${PARTICLE_LOOKAHEAD}`,
  "g"
);

// ⚠️ The two-syllable districts (중구, 동구, 서구, 남구, 북구) cannot go through the pattern
// above: its name part needs two syllables before the suffix, and lowering that to one would
// pull in 친구/요구/지구 and every other noun ending the same way. They are a closed list of
// five, and every one of them is ambiguous anyway (중구 exists in five provinces), so the
// province test below is what actually decides them.
const SHORT_DISTRICT_PATTERN = new RegExp(`(중구|동구|서구|남구|북구)${PARTICLE_LOOKAHEAD}`, "g");

// Words that end in the same syllables but are not places. The list is short on purpose:
// anything longer is a sign the rule is too loose rather than that the list is too short.
const NOT_A_DISTRICT = new Set([
  "결식아동군", "대조군", "동호회구", "박물관구", "사물함구", "산업단지구",
  "실험군", "연구", "요구", "지구", "친구", "출입구", "탈출구", "표본군", "항구", "환승구"
]);

export type RegionMention = {
  /** The district as written, e.g. "종로구". */
  name: string;
};

export type ResolvedRegion = {
  /** Five-digit district code the region-keyed APIs ask for, e.g. "11110". */
  code: string;
  name: string;
  province: string;
};

// Every district the post names, in the order they appear.
export function findRegionMentions(text: string): RegionMention[] {
  const seen = new Set<string>();
  const mentions: RegionMention[] = [];

  for (const pattern of [DISTRICT_PATTERN, SHORT_DISTRICT_PATTERN]) {
    for (const [, name] of text.matchAll(pattern)) {
      if (!name || NOT_A_DISTRICT.has(name) || seen.has(name)) {
        continue;
      }

      seen.add(name);
      mentions.push({ name });
    }
  }

  return mentions;
}

// ⚠️ There is deliberately no `hasRegionMention` here any more. It existed for one day
// (2026-08-19) while the name-to-code table was still missing: back then `inferLawdCode`
// could only ask "did the post name a district at all", and answer null either way.
// `resolveRegionCode` below replaced it the moment the table was baked, and the two are not
// interchangeable. "중구" alone makes the mention test true but resolves to no code, because
// that name exists in five provinces. A caller gated on the mention test would have to pick
// one of the five, which is the constant fallback (Jongno for every post) coming back in a
// new shape. Ask for the code, not for the mention.

// Turn a district named in the post into the code the region-keyed APIs want.
//
// ⚠️ Seven district names are shared across provinces: 중구 alone exists in five, 동구 in
// four, 서구/남구/북구 in three each (measured 2026-08-18 over the baked table). A post that
// says only "중구" has not told us which one, so this returns null rather than guessing.
// A guess here is the same failure the constants were: attaching another city's numbers.
//
// When the name is ambiguous the post must also name the province ("서울 중구"), and the
// province may be written in short form (서울/부산/경기), which is how people write.
export function resolveRegionCode(text: string): ResolvedRegion | null {
  const mentions = findRegionMentions(text);

  for (const mention of mentions) {
    // ⚠️ Gyeonggi and the other big cities carry two-word names in the table
    // ("수원시 장안구"), while the post writes only the last word. Match on the tail.
    const matches = DISTRICTS.filter(
      (district) => district.name === mention.name || district.name.endsWith(` ${mention.name}`)
    );

    if (matches.length === 1) {
      return matches[0]!;
    }
    if (matches.length === 0) {
      continue;
    }

    // Ambiguous: only usable when the post also names the province.
    const narrowed = matches.filter((district) => text.includes(shortProvince(district.province)));

    if (narrowed.length === 1) {
      return narrowed[0]!;
    }
  }

  return null;
}

// "서울특별시" -> "서울", "경상남도" -> "경남" is NOT done here: people write both the full
// name and the short one, and the short forms of the provinces are only nine strings, so the
// prefix of the official name is enough to match either spelling.
function shortProvince(province: string) {
  return province.replace(/(특별자치)?(시|도)$/, "").replace(/광역$/, "").slice(0, 2);
}
