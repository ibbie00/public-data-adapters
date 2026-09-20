export const MAX_SENSITIVE_FREE_TEXT_REDACTION_CHARS = 8_192;

const IPV6_ADDRESS_PATTERN =
  /(?<![\w:])(?=(?:[0-9a-f]{0,4}:){2,}[0-9a-f]{0,4}(?![\w:]))(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}(?![\w:])/gi;
const KOREAN_PHONE_PATTERN = /\b01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}\b/g;
const KOREAN_RESIDENT_REGISTRATION_NUMBER_PATTERN =
  /\b\d{6}[-\s]?[1-4]\d{6}\b/g;
const SECRET_ASSIGNMENT_PATTERN =
  /\b(?:token|api[-_ ]?key|cookie|session|password|secret|authorization)\s*[:=]\s*\S+/gi;
const BEARER_TOKEN_PATTERN = /\bbearer\s+[a-z0-9._~+/=-]+/gi;

export function redactSensitiveFreeText(
  value: string,
  options: { redactUrls?: boolean } = {}
) {
  const redactUrls = options.redactUrls ?? true;
  const boundedValue =
    value.length > MAX_SENSITIVE_FREE_TEXT_REDACTION_CHARS
      ? value.slice(0, MAX_SENSITIVE_FREE_TEXT_REDACTION_CHARS)
      : value;
  const text = redactUrls
    ? boundedValue.replace(/https?:\/\/\S+/gi, "[redacted-url]")
    : boundedValue;

  return text
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, "[redacted-email]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[redacted-ip]")
    .replace(IPV6_ADDRESS_PATTERN, "[redacted-ip]")
    .replace(KOREAN_PHONE_PATTERN, "[redacted-phone]")
    .replace(KOREAN_RESIDENT_REGISTRATION_NUMBER_PATTERN, "[redacted-rrn]")
    .replace(BEARER_TOKEN_PATTERN, "[redacted-secret]")
    .replace(SECRET_ASSIGNMENT_PATTERN, "[redacted-secret]");
}
