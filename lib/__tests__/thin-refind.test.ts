import { afterEach, describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dedupeByKey } from "../upsert";
import { directionsUrl } from "../event-view";
import type { DbEventInput } from "../types";

/**
 * A session answers from pages that often print no address, time or price. The
 * 6 Nov 2026 review traced what those blanks would have done to live listings, and
 * the rehearsal numbers below are from that run.
 */
const root = join(__dirname, "..", "..");
const upsert = readFileSync(join(root, "lib", "upsert.ts"), "utf8");
const clause = upsert.slice(upsert.indexOf("on conflict (event_key) do update set"));

describe("geocode — a blank address is not a query for the city", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("does not ask, so roomPin falls through to the room's name", async () => {
    vi.resetModules();
    vi.stubEnv("MAPBOX_GEOCODING_TOKEN", "test-token");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ features: [{ center: [-93.27, 44.98] }] })));
    vi.stubGlobal("fetch", fetchMock);
    const { geocode } = await import("../geocode");
    expect(await geocode("", "Minneapolis")).toBeNull();
    expect(await geocode("   ", "Minneapolis")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await geocode("701 1st Ave N", "Minneapolis")).toEqual({ lat: 44.98, lng: -93.27 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("the conflict clause — a thin re-find cannot erase what the row knows", () => {
  it("a blank address keeps the street (72 of 92 live re-finds were blank)", () => {
    expect(clause).toMatch(/address\s*= case when events\.corrected_at is null and excluded\.address <> ''\s+then excluded\.address else events\.address end/);
  });

  it("\"See listing\" keeps a real price and its tier (85 of 92 said it)", () => {
    expect(clause).toMatch(/price\s*= case when excluded\.price = 'See listing' then events\.price else excluded\.price end/);
    expect(clause).toMatch(/price_tier\s*= case when excluded\.price = 'See listing' then events\.price_tier else excluded\.price_tier end/);
  });

  it("a blank ticket link or image only fills a gap", () => {
    expect(clause).toMatch(/ticket_url\s*= coalesce\(nullif\(excluded\.ticket_url, ''\), events\.ticket_url\)/);
    expect(clause).toMatch(/image\s*= coalesce\(nullif\(excluded\.image, ''\), events\.image\)/);
  });

  it("shorter prose does not replace longer, and a correction still wins", () => {
    expect(clause).toMatch(/description = case when events\.corrected_at is null and length\(excluded\.description\) >= length\(events\.description\)/);
  });

  it("a date-only re-find can still extend a run's end, except on a corrected row", () => {
    expect(clause).toMatch(/end_at\s*= case when events\.corrected_at is not null then events\.end_at/);
    expect(clause).toMatch(/when excluded\.end_at > coalesce\(events\.end_at, events\.start_at\) then excluded\.end_at/);
  });
});

describe("dedupeByKey — a known time beats a richer row with none", () => {
  const row = (over: Partial<DbEventInput>): DbEventInput =>
    ({ event_key: "k", title: "Humbird", description: "x", ticket_url: "t", image: "", address: "a", end_at: null, source_url: "s", all_day: false, ...over }) as DbEventInput;

  it("keeps the timed row when a date-only one arrives later, even a richer one", () => {
    const timed = row({ title: "timed", image: "" });
    const dateOnly = row({ title: "date-only", all_day: true, image: "i", end_at: "2026-11-20T23:00" });
    expect(dedupeByKey([timed, dateOnly])[0].title).toBe("timed");
    expect(dedupeByKey([dateOnly, timed])[0].title).toBe("timed");
  });

  it("two timed rows still pick the richer, tie to the later", () => {
    expect(dedupeByKey([row({ title: "rich", image: "i" }), row({ title: "thin" })])[0].title).toBe("rich");
    expect(dedupeByKey([row({ title: "first" }), row({ title: "later" })])[0].title).toBe("later");
  });
});

describe("directionsUrl — no street means use the pin, not the city", () => {
  const url = (over: object) =>
    decodeURIComponent(directionsUrl({ venue: "The Cedar", address: "", city: "Minneapolis", lat: 44.97, lng: -93.25, ...over } as never) ?? "");

  it("a blank address routes to the pin", () => {
    expect(url({})).toContain("destination=44.97,-93.25");
    expect(url({ address: "   " })).toContain("destination=44.97,-93.25");
  });

  it("a street still routes to the street", () => {
    expect(url({ address: "416 Cedar Ave S" })).toContain("destination=416 Cedar Ave S, Minneapolis, MN");
  });

  it("with no pin either, it falls back to the venue's name", () => {
    expect(url({ lat: 0, lng: 0 })).toContain("destination=The Cedar");
  });
});

describe("the wiring", () => {
  const pipeline = readFileSync(join(root, "scripts", "run-pipeline.ts"), "utf8");
  const pin = readFileSync(join(root, "lib", "room-pin.ts"), "utf8");
  const sports = readFileSync(join(root, "scripts", "import-sports.ts"), "utf8");

  it("a real apply tests the geocoder rather than the token's presence", () => {
    expect(pipeline).toMatch(/fromDir && !dryRun && !\(await geocode\("First Avenue", "Minneapolis"\)\)/);
  });

  it("dropped listings are counted where the operator and the marker can see them", () => {
    expect(pipeline).toMatch(/noGeocode\+\+/);
    expect(pipeline).toMatch(/no geocode \$\{noGeocode\}/);
    expect(pipeline).toMatch(/upserted: totalUpserted, noGeocode/);
  });

  it("a blank address reuses the room's known street", () => {
    expect(pipeline).toMatch(/ev\.address\.trim\(\) \|\| \(await knownRoomAddress\(ev\.venue\)\)/);
  });

  it("a room on the calendar reuses its pin before asking a geocoder", () => {
    expect(pin.indexOf("'existing listings'")).toBeGreaterThan(-1);
    expect(pin.indexOf("'existing listings'")).toBeLessThan(pin.indexOf("let hit = await geocode"));
  });

  it("a league retime clears the all-day flag along with the time", () => {
    expect(sports).toMatch(/at time zone 'America\/Chicago'\), all_day = false/);
  });
});
