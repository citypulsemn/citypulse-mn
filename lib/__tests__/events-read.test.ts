import { describe, it, expect } from "vitest";
import { getEvent, getEventsForDay } from "../events";
import { sampleEvents } from "../sample-events";
import { dayKeyOf } from "../event-view";

// With no DATABASE_URL in the test env, these read from bundled sample data.
const first = sampleEvents[0];

describe("getEvent (sample fallback)", () => {
  it("returns a known event by id", async () => {
    const e = await getEvent(first.id);
    expect(e?.id).toBe(first.id);
    expect(e?.title).toBe(first.title);
  });

  it("returns null for an unknown id", async () => {
    expect(await getEvent("does-not-exist")).toBeNull();
  });
});

describe("getEventsForDay (sample fallback)", () => {
  it("returns the events on a given day, including a known one", async () => {
    const key = dayKeyOf(first);
    const events = await getEventsForDay(key);
    expect(events.length).toBeGreaterThan(0);
    expect(events.every((e) => dayKeyOf(e) === key)).toBe(true);
    expect(events.some((e) => e.id === first.id)).toBe(true);
  });

  it("returns empty for a day with no events", async () => {
    expect(await getEventsForDay("1990-01-01")).toEqual([]);
  });
});
