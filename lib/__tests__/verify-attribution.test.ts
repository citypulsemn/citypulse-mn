import { describe, it, expect } from "vitest";
import { feedHosts, feedVenues, isFeedStamped, hostOf } from "../verify-attribution";
import { FIRST_AVENUE_VENUES, MPLS_PARKS_VENUES, MUSEUM_SOURCES } from "../music-sources";
import { SPORTS_SOURCES } from "../sports-sources";

/**
 * The retroactive sweep (5 Sep 2026) clears `verified_at` on stamps the AGENT
 * made under the old prompt. Getting this attribution wrong is expensive in both
 * directions: leave false confidence in place, or throw away a league API's
 * evidence and replace it with a weaker agent opinion.
 *
 * The first version read `MUSEUM_SOURCES[].host` and `FIRST_AVENUE_VENUES[].url`
 * — neither field exists — so every museum source contributed NOTHING and
 * fifteen Bell Museum and Science Museum listings were about to lose feed-made
 * stamps. These tests exist so a registry reshuffle fails loudly instead.
 */

describe("feedHosts", () => {
  const hosts = feedHosts();

  it("finds a host for every music/museum/parks source", () => {
    // The regression: a silently-empty result. If a registry changes shape,
    // this is what should go red.
    expect(hosts.size).toBeGreaterThanOrEqual(6);
  });

  it("includes the museum feeds that the first version missed", () => {
    expect(hosts.has("bellmuseum.umn.edu")).toBe(true);
    expect(hosts.has("smm.org")).toBe(true);
  });

  it("includes the Park Board and First Avenue", () => {
    expect(hosts.has("minneapolisparks.org")).toBe(true);
    expect(hosts.has("first-avenue.com")).toBe(true);
  });

  it("includes the league APIs", () => {
    expect(hosts.has("statsapi.mlb.com")).toBe(true);
    expect(hosts.has("api-web.nhle.com")).toBe(true);
  });

  it("stores hosts without www., so a www source URL still matches", () => {
    for (const h of hosts) expect(h.startsWith("www.")).toBe(false);
    expect(hostOf("https://www.bellmuseum.umn.edu/event/x")).toBe("bellmuseum.umn.edu");
  });
});

describe("feedVenues", () => {
  const venues = feedVenues();

  it("covers every registry, not just the ones with a convenient shape", () => {
    const museumVenues = (MUSEUM_SOURCES as { venues?: { name: string }[] }[]).flatMap(
      (m) => m.venues ?? [],
    );
    expect(museumVenues.length).toBeGreaterThan(0); // the registry really does have them
    expect(venues.size).toBeGreaterThanOrEqual(
      FIRST_AVENUE_VENUES.length + MPLS_PARKS_VENUES.length + museumVenues.length,
    );
  });

  it("includes a sports venue and a First Avenue room", () => {
    const anySport = SPORTS_SOURCES[0].venue.name;
    expect(isFeedStamped({ venue: anySport, sourceUrl: "" })).toBe(true);
    expect(isFeedStamped({ venue: FIRST_AVENUE_VENUES[0].name, sourceUrl: "" })).toBe(true);
  });
});

describe("isFeedStamped", () => {
  it("matches on the VENUE alone", () => {
    expect(isFeedStamped({ venue: "Target Field", sourceUrl: "https://random.example/x" })).toBe(true);
  });

  it("matches on the SOURCE HOST alone", () => {
    // The 49 Park Board listings at parks that are not in the pinned list:
    // venue misses, host saves them. Requiring both would have mis-sorted them.
    expect(
      isFeedStamped({
        venue: "Bryant Square Park",
        sourceUrl: "https://www.minneapolisparks.org/events/some-movie/",
      }),
    ).toBe(true);
  });

  it("treats an agent-researched listing as NOT feed-stamped", () => {
    // The Marley listing: a real venue with no importer, sourced from a roundup.
    expect(
      isFeedStamped({
        venue: "The Fillmore Minneapolis",
        sourceUrl: "https://www.exploreminnesota.com/events/best-fall-concerts-minneapolis-st-paul",
      }),
    ).toBe(false);
  });

  it("does not fall over on a blank or malformed source URL", () => {
    expect(() => isFeedStamped({ venue: "Nowhere", sourceUrl: "" })).not.toThrow();
    expect(isFeedStamped({ venue: "Nowhere", sourceUrl: "not a url" })).toBe(false);
    expect(hostOf("")).toBe("");
    expect(hostOf("not a url")).toBe("");
  });
});
