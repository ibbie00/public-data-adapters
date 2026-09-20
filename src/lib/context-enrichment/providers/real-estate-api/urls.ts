import type { MolitRealEstateService } from "./types";

export function buildMolitUrl(input: {
  dealYmd: string;
  lawdCode: string;
  service: MolitRealEstateService;
  serviceKey: string;
}) {
  const url = new URL(input.service.endpoint);
  url.searchParams.set("serviceKey", input.serviceKey);
  url.searchParams.set("LAWD_CD", input.lawdCode);
  url.searchParams.set("DEAL_YMD", input.dealYmd);
  url.searchParams.set("pageNo", "1");
  url.searchParams.set("numOfRows", "10");

  return url;
}
