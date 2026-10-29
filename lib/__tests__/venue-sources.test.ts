import { describe, it, expect } from "vitest";
import { VENUE_CALENDARS, canonicalSourceFor, officialCalendars } from "../venue-sources";
import { isAggregatorSource, isNonScheduleSource, isResaleSource } from "../source-trust";
import { roomKey } from "../contradictions";

describe("VENUE_CALENDARS", () => {
  it("never points a room at a roundup, reseller or social page", () => {
    // The whole purpose. A curated entry that is itself weak would launder
    // the exact problem this table exists to fix.
    for (const [room, url] of Object.entries(VENUE_CALENDARS)) {
      expect(isAggregatorSource(url), `${room} -> ${url}`).toBe(false);
      expect(isNonScheduleSource(url), `${room} -> ${url}`).toBe(false);
      expect(isResaleSource(url), `${room} -> ${url}`).toBe(false);
    }
  });

  it("is keyed by roomKey, so a city suffix still finds it", () => {
    expect(canonicalSourceFor("Palace Theatre")).toBe("https://first-avenue.com/venue/palace-theatre/");
    expect(canonicalSourceFor("Palace Theatre (St Paul)")).toBe("https://first-avenue.com/venue/palace-theatre/");
    expect(canonicalSourceFor("Orchestra Hall (Minneapolis)")).toBe("https://www.minnesotaorchestra.org/tickets/calendar/");
  });

  it("gives each First Avenue room its own page rather than the group's", () => {
    // Pointing Fine Line at first-avenue.com/shows/ would be the mistake the
    // derived version made: a page that does not list that room's gigs. All SIX
    // rooms, each distinct — three were missing until 21 Oct 2026, and they were
    // the biggest: 7th St Entry, Turf Club and the Fitzgerald.
    const rooms = ["First Avenue", "7th St Entry", "Fine Line Music Cafe", "Turf Club", "Palace Theatre", "Fitzgerald Theater"];
    const urls = rooms.map((r) => canonicalSourceFor(r));
    for (const [i, u] of urls.entries()) expect(u, rooms[i]).not.toBeNull();
    expect(new Set(urls).size).toBe(rooms.length);
    // And none of them is the all-rooms calendar.
    for (const [i, u] of urls.entries()) expect(u, rooms[i]).not.toBe("https://first-avenue.com/shows/");
  });

  it("keys rooms by what roomKey returns, not by how the venue spells itself", () => {
    // The venue writes "7th St Entry"; canonicalizeVenue expands St to Street,
    // so the key is `7th street entry`. Getting this wrong is silent — the
    // lookup just returns null and the agent goes back to searching.
    expect(canonicalSourceFor("7th St Entry")).toBe("https://first-avenue.com/venue/7th-st-entry/");
    expect(canonicalSourceFor("7th Street Entry")).toBe("https://first-avenue.com/venue/7th-st-entry/");
    expect(canonicalSourceFor("Turf Club (St Paul)")).toBe("https://first-avenue.com/venue/turf-club/");
    expect(canonicalSourceFor("Fitzgerald Theater")).toBe("https://first-avenue.com/venue/the-fitzgerald-theater/");
  });

  it("every key is one roomKey already produces for itself", () => {
    // A key roomKey can never generate is dead weight that reads as coverage.
    for (const key of Object.keys(VENUE_CALENDARS)) {
      expect(roomKey(key), `${key} is not a roomKey fixed point`).toBe(key);
    }
  });

  it("returns null for a room nobody has curated, rather than guessing", () => {
    expect(canonicalSourceFor("Some Bar Nobody Listed")).toBeNull();
    expect(canonicalSourceFor("")).toBeNull();
  });

  it("holds only absolute https URLs", () => {
    for (const [room, url] of Object.entries(VENUE_CALENDARS)) {
      expect(url, room).toMatch(/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}\//i);
    }
  });
});

/**
 * C2 — the official-calendar row on a venue page.
 *
 * The table above was already guarded; what is new is handing it to a reader,
 * so these tests cover the grouping and the one principle C2 has: presentation
 * only, never placement.
 */
describe("officialCalendars", () => {
  const ev = (venue: string) => ({ venue });

  it("is honestly empty rather than guessing", () => {
    expect(officialCalendars([])).toEqual([]);
    expect(officialCalendars([ev("Some Bar Nobody Listed")])).toEqual([]);
    expect(officialCalendars([ev("")])).toEqual([]);
  });

  it("gives one entry per room, with its listing count", () => {
    const out = officialCalendars([ev("Turf Club"), ev("Turf Club"), ev("Turf Club (St Paul)")]);
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe("https://first-avenue.com/venue/turf-club/");
    expect(out[0].listings).toBe(3);
    // Label is the most common spelling, not the last one seen.
    expect(out[0].label).toBe("Turf Club");
  });

  it("keeps two rooms apart on a page that shows both", () => {
    // /venues/first-avenue carries Mainroom AND 7th St Entry events, and First
    // Avenue publishes a separate calendar per room. Collapsing them would send
    // an Entry ticket-buyer to the wrong schedule.
    const out = officialCalendars([
      ev("7th St Entry"),
      ev("7th St Entry"),
      ev("7th St Entry"),
      ev("First Avenue"),
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((c) => c.url)).toEqual([
      "https://first-avenue.com/venue/7th-st-entry/",
      "https://first-avenue.com/venue/first-avenue/",
    ]);
    // Most-listed room first, so the busier calendar leads.
    expect(out[0].listings).toBe(3);
    expect(out[1].listings).toBe(1);
  });

  it("drops the uncurated rooms and keeps the rest", () => {
    const out = officialCalendars([
      ev("Palace Theatre"),
      ev("Some Bar Nobody Listed"),
      ev("Another Unlisted Room"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe("https://first-avenue.com/venue/palace-theatre/");
    expect(out[0].listings).toBe(1);
  });

  it("is deterministic when two rooms are tied", () => {
    const a = officialCalendars([ev("Turf Club"), ev("Palace Theatre")]);
    const b = officialCalendars([ev("Palace Theatre"), ev("Turf Club")]);
    expect(a).toEqual(b);
  });

  /**
   * THE NEVER-PLACEMENT INSTRUMENT. The venue page hands this the very array it
   * is about to render, already sorted by start time. A `.sort()` or a `.pop()`
   * in here would reorder a venue's public schedule from a function whose whole
   * job is decoration — C2's principle broken in the most literal way the
   * codebase allows. A frozen input makes the attempt throw.
   */
  it("never mutates or reorders the listings it is given", () => {
    const input = Object.freeze([ev("First Avenue"), ev("7th St Entry"), ev("First Avenue")]);
    const before = input.map((e) => e.venue);
    expect(() => officialCalendars(input)).not.toThrow();
    expect(input.map((e) => e.venue)).toEqual(before);
    expect(before).toEqual(["First Avenue", "7th St Entry", "First Avenue"]);
  });

  it("returns the same rows whether or not a room has a calendar", () => {
    // Stated the other way round: adding a curated calendar for a room changes
    // what the page SAYS and nothing about which events it holds or their order.
    const listings = [ev("Palace Theatre"), ev("Some Bar Nobody Listed")];
    const order = listings.map((e) => e.venue);
    officialCalendars(listings);
    expect(listings.map((e) => e.venue)).toEqual(order);
  });
});
