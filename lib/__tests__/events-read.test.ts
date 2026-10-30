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

  it("list reads cap description to a preview (egress); the detail page keeps full text", () => {
    // description is ~half the getEvents payload — the 3 list reads (readAllPublished,
    // readEventsForDay, getEventsByIds) truncate it; readEvent (detail page) does not.
    expect((src.match(/left\(description, 179\) \|\| '…'/g) ?? []).length).toBe(3);
    expect(src).toContain("ticket_url, description, image"); // readEvent — the one full read
  });
});

/**
 * THE FALSE 404 (30 Oct 2026). `getEvent` caught every error and returned null,
 * and the event page reads null as "no such event" and calls notFound(). So a
 * Supabase blip told every reader — and Google, via the noindex on
 * app/not-found.tsx — that a live listing had been archived. Same shape as the
 * soft-404 fix in e09defa, from the other direction: there the page could not
 * say "gone" when it meant it, here it said "gone" when it had no idea.
 *
 * The contract now: `readEvent` throws (a blip is a 500, the honest "we don't
 * know"), `getEvent` keeps the catch for aux paths where a blank beats a break.
 */
describe("the event page must not turn a DB failure into a 404", () => {
  const src = readFileSync(join(__dirname, "..", "events.ts"), "utf8");
  const page = readFileSync(
    join(__dirname, "..", "..", "app", "event", "[id]", "page.tsx"),
    "utf8",
  );

  it("readEvent has no catch — a read failure propagates", () => {
    const body = src.slice(src.indexOf("export async function readEvent"), src.indexOf("export async function getEvent"));
    expect(body).toContain("readEvent");
    expect(body).not.toContain("catch");
  });

  it("getEvent keeps its catch, for the aux paths that need it", () => {
    expect(src).toMatch(/export async function getEvent[\s\S]*?catch[\s\S]*?return null/);
  });

  it("the event page reads through readEvent, in BOTH the page and its metadata", () => {
    expect((page.match(/await readEvent\(id\)/g) ?? []).length).toBe(2);
    expect(page).not.toMatch(/await getEvent\(/);
  });

  it("the aux paths still use the forgiving read (rule 1)", () => {
    for (const p of [
      ["app", "event", "[id]", "opengraph-image.tsx"],
      ["app", "event", "[id]", "calendar", "route.ts"],
      ["app", "content", "card", "[id]", "route.tsx"],
      ["app", "report", "page.tsx"],
    ]) {
      const aux = readFileSync(join(__dirname, "..", "..", ...p), "utf8");
      expect(aux, p.join("/")).toMatch(/getEvent\(/);
    }
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
