import { computeEventKey } from "./event-key";
import type { AgentEvent } from "./agents/research-agent";

/**
 * Split agent results into events to upsert vs. cancellations to remove.
 * Cancelled events are reduced to their dedup key so the pipeline can flip the
 * matching DB row to 'cancelled' (see markCancelled in upsert.ts).
 */
export function partitionCancellations(events: AgentEvent[]): {
  active: AgentEvent[];
  cancelledKeys: string[];
} {
  const active: AgentEvent[] = [];
  const cancelledKeys: string[] = [];
  for (const e of events) {
    if (e.cancelled) {
      cancelledKeys.push(computeEventKey(e.title, e.venue, e.start));
    } else {
      active.push(e);
    }
  }
  return { active, cancelledKeys };
}
