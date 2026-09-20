import {
  createNecCommonCodeClient,
  type NecClientOptions
} from "../../external/nec-election";
import type {
  ContextAsset,
  ContextFreshnessPolicy,
  ContextResearchProvider,
  ContextResearchProviderSearchOptions
} from "../types";
import { evaluateContextProviderBudget } from "../guards";
import { assertValidContextAsset } from "../validation";
import {
  NEC_ELECTION_CODE_SCAN_ROWS,
  PROVIDER_TYPE
} from "./nec-election-api/constants";
import {
  getNecElectionFreshnessPolicy,
  normalizeNecElectionAsset
} from "./nec-election-api/asset";
import { normalizeCommonCodeResult } from "./nec-election-api/normalize";
import { parseDate } from "./nec-election-api/query";
import type { NecElectionRawResult } from "./nec-election-api/types";

function getNecCredentials(env: NodeJS.ProcessEnv) {
  return (
    env.NEC_COMMON_CODE_API_SERVICE_KEY?.trim() ||
    env.NEC_VOTE_COUNT_API_SERVICE_KEY?.trim() ||
    env.NEC_API_SERVICE_KEY?.trim() ||
    ""
  );
}

export function createNecElectionApiProvider(
  providerOptions: Pick<NecClientOptions, "fetchImpl" | "now" | "timeoutMs"> = {}
): ContextResearchProvider<NecElectionRawResult> {
  return {
    providerType: PROVIDER_TYPE,
    async search(query: string, options: ContextResearchProviderSearchOptions = {}) {
      const env = options.env ?? process.env;
      const serviceKey = getNecCredentials(env);

      if (!serviceKey) {
        return [];
      }

      const budget = evaluateContextProviderBudget(options.budgetSnapshot, env);
      if (!budget.allowed) {
        return [];
      }

      const client = createNecCommonCodeClient({ ...providerOptions, env });
      const result = await client.fetchElectionCodes({
        numOfRows: Math.max(options.limit ?? 20, NEC_ELECTION_CODE_SCAN_ROWS),
        pageNo: 1
      });
      const referenceDate =
        parseDate(options.targetCreatedAt) ??
        providerOptions.now?.() ??
        new Date();

      return normalizeCommonCodeResult(result, query, options.limit ?? 5, referenceDate);
    },
    async fetchById(sourceIdentifier: string, options: ContextResearchProviderSearchOptions = {}) {
      const results = await this.search(sourceIdentifier, {
        ...options,
        limit: 20
      });

      return results.find((result) => result.electionId === sourceIdentifier) ?? null;
    },
    normalize(rawResult: NecElectionRawResult): ContextAsset {
      return normalizeNecElectionAsset(rawResult);
    },
    validate(normalizedAsset: ContextAsset) {
      assertValidContextAsset(normalizedAsset);
    },
    getFreshnessPolicy(asset?: ContextAsset): ContextFreshnessPolicy {
      return getNecElectionFreshnessPolicy(asset);
    }
  };
}
