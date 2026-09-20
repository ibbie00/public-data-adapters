import type { AdvisoryLifecycle } from "../types";

export type AdvisoryAnnouncement = {
  refKey: string;
  title: string;
  zones: string[];
  effectiveAt: string;
  body: string;
  rawTitle: string;
  lifecycle: AdvisoryLifecycle;
  // Kept so the affected zones can be fetched lazily (getWthrWrnMsg) for the
  // ones we actually relay.
  stnId: string;
  tmSeq: string;
};
