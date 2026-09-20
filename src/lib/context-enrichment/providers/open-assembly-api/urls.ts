import { OPEN_ASSEMBLY_BASE_URL } from "./constants";

export function redactOpenAssemblyUrl(url: URL | string) {
  const parsed = typeof url === "string" ? new URL(url) : new URL(url.toString());

  if (parsed.searchParams.has("KEY")) {
    parsed.searchParams.set("KEY", "REDACTED");
  }

  return parsed.toString();
}

export function buildOpenAssemblyBillUrl(input: {
  assemblyAge: string;
  key: string;
  limit: number;
  query: string;
  serviceId: string;
}) {
  const url = new URL(`${OPEN_ASSEMBLY_BASE_URL}/${input.serviceId}`);
  const query = input.query.trim();

  url.searchParams.set("KEY", input.key);
  url.searchParams.set("Type", "json");
  url.searchParams.set("pIndex", "1");
  url.searchParams.set("pSize", String(input.limit));
  if (/^\d{1,2}$/.test(query)) {
    url.searchParams.set("AGE", query);
  } else {
    url.searchParams.set("AGE", input.assemblyAge);
    url.searchParams.set("BILL_NAME", query);
  }

  return url;
}
