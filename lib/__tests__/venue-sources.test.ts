import { describe, it, expect } from "vitest";
import { VENUE_CALENDARS, canonicalSourceFor } from "../venue-sources";
import { isAggregatorSource, isNonScheduleSource, isResaleSource } from "../source-trust";

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
    // derived version made: a page that does not list that room's gigs.
    const a = canonicalSourceFor("First Avenue");
    const b = canonicalSourceFor("Fine Line Music Cafe");
    const c = canonicalSourceFor("Palace Theatre");
    expect(new Set([a, b, c]).size).toBe(3);
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
