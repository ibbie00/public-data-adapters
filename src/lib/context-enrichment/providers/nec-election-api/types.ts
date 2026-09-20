import type { NecElectionCode } from "../../../external/nec-election";

export type NecElectionRawResult = NecElectionCode & {
  __checkedAt: string;
  __query: string;
  __generalFallback?: boolean;
};
