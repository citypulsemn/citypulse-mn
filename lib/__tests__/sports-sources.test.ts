import { describe, it, expect } from "vitest";
import { SPORTS_SOURCES } from "../sports-sources";

// The registry is the only place a sports listing's ticket link comes from, so
// a typo here is 80-odd dead links a season. These URLs were each checked to
// return 200 by hand; this guards the shape, not the liveness.
describe("SPORTS_SOURCES tickets", () => {
  it("gives every team an https tickets page", () => {
    for (const s of SPORTS_SOURCES) {
      expect(s.tickets, s.key).toMatch(/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}\//i);
    }
  });

  it("points each team at its own domain, not another club's", () => {
    const hosts = SPORTS_SOURCES.map((s) => new URL(s.tickets).host);
    // Timberwolves and Lynx share Target Center but not a ticket office; every
    // other pair sharing a host would be a copy-paste slip.
    const dupes = hosts.filter((h, i) => hosts.indexOf(h) !== i);
    expect(dupes).toEqual([]);
  });
});
