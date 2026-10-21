import { describe, it, expect } from "vitest";
import { VENUE_CALENDARS, canonicalSourceFor } from "../venue-sources";
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
