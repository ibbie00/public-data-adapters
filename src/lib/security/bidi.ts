const BIDI_FORMATTING_CONTROL_PATTERN = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu;

export function stripBidiFormattingControls(value: string) {
  return value.replace(BIDI_FORMATTING_CONTROL_PATTERN, "");
}
