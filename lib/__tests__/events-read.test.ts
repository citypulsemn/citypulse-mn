import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// getEventsForDay is wrapped in unstable_cache (needs a Next request context);
// the read LOGIC under test is the uncached variant, so target that directly.
import { getEvent, getEventsForDayUncached as getEventsForDay } from "../events";
import { sampleEvents } from "../sample-events";
import { dayKeyOf } from "../event-view";

// With no DATABASE_URL in the test env, these read from bundled sample data.
const first = sampleEvents[0];

describe("hardening — a configured-DB read failure must NOT cache sample/empty data (Aug 15 2026 incident)", () => {
  // A transient Supabase read failure during a homepage ISR render returned the June
  // sample events, which cached a wrong "no events in August" homepage for every
  // visitor. The read paths now throw on a configured-DB failure so Next serves the
  // last-good cache instead. Source tripwires (the throw can't be exercised without a
  // live DB; tests run on the !sql path).
  const src = readFileSync(join(__dirname, "..", "events.ts"), "utf8");

  it("readAllPublished re-throws on a DB error (does not fall back to sample data)", () => {
    expect(src).toMatch(/NOT serving sample data with a DB configured[\s\S]*?throw err/);
  });

  it("readEventsForDay re-throws on a DB error (does not cache an empty day)", () => {
    expect(src).toMatch(/getEventsForDay failed[\s\S]*?throw err/);
  });

  it("the full-list read serves sample data ONLY when no DB is configured", () => {
    // exactly one `return sampleEvents` for the whole list, guarded by `if (!sql)`.
    expect(src).toContain("if (!sql) return sampleEvents;");
    expect(src).not.toMatch(/using sample data:", err\);\s*return sampleEvents/);
  });
});

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
