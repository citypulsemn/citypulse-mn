import { describe, it, expect } from "vitest";
import { partitionCancellations } from "../cancellations";
import { parseAgentEvents, type AgentEvent } from "../agents/research-agent";
import { computeEventKey } from "../event-key";

function agentEvent(overrides: Partial<AgentEvent>): AgentEvent {
  return {
    title: "Show",
    category: "music",
    venue: "First Avenue",
    address: "701 1st Ave N",
    city: "Minneapolis",
    start: "2026-07-15T20:00",
    end: "2026-07-15T23:00",
    price: "$25",
    ticket_url: "",
    description: "",
    source_url: "https://example.com",
    ...overrides,
  };
}

describe("partitionCancellations", () => {
  it("separates cancelled events and reduces them to dedup keys", () => {
    const active = agentEvent({ title: "Live Show" });
    const cancelled = agentEvent({ title: "Called Off", cancelled: true });
    const { active: keep, cancelledKeys } = partitionCancellations([active, cancelled]);

    expect(keep).toHaveLength(1);
    expect(keep[0].title).toBe("Live Show");
    expect(cancelledKeys).toEqual([
      computeEventKey("Called Off", "First Avenue", "2026-07-15T20:00"),
    ]);
  });

  it("treats events without the flag as active", () => {
    const { active, cancelledKeys } = partitionCancellations([
      agentEvent({ cancelled: false }),
      agentEvent({}),
    ]);
    expect(active).toHaveLength(2);
    expect(cancelledKeys).toHaveLength(0);
  });
});

describe("parseAgentEvents reads the cancelled flag", () => {
  it("captures cancelled: true from the JSON block", () => {
    const text =
      '```json\n[{"title":"X","venue":"V","start":"2026-07-15T20:00","cancelled":true}]\n```';
    const out = parseAgentEvents(text, "music");
    expect(out).toHaveLength(1);
    expect(out[0].cancelled).toBe(true);
  });

  it("defaults cancelled to false when absent", () => {
    const text = '```json\n[{"title":"X","venue":"V","start":"2026-07-15T20:00"}]\n```';
    const out = parseAgentEvents(text, "music");
    expect(out[0].cancelled).toBe(false);
  });
});
