export function redactMusicMetadataUrl(input: URL | string) {
  const url = new URL(String(input));

  for (const param of ["api_key"]) {
    if (url.searchParams.has(param)) {
      url.searchParams.set(param, "REDACTED");
    }
  }

  return url.toString();
}
