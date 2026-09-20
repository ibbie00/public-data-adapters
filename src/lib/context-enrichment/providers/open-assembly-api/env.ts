import { DEFAULT_BILL_SERVICE_ID } from "./constants";

export function getOpenAssemblyApiKey(env: NodeJS.ProcessEnv) {
  return env.OPEN_ASSEMBLY_API_KEY?.trim() || "";
}

export function normalizeServiceId(env: NodeJS.ProcessEnv) {
  return env.OPEN_ASSEMBLY_BILL_SERVICE_ID?.trim() || DEFAULT_BILL_SERVICE_ID;
}

export function normalizeAssemblyAge(env: NodeJS.ProcessEnv) {
  return env.OPEN_ASSEMBLY_AGE?.trim() || "22";
}
