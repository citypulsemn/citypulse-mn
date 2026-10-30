import { describe, it, expect } from "vitest";
import {
  normalizeVenueName,
  slugifyVenue,
  VENUE_PAGES,
  venuePageBySlug,
  matchVenueSlug,
  dominantCoords,
  dominantAddress,
  staticMapUrl,
  directionsUrl,
  parkingUrl,
  upcomingCountsByVenue,
  venuePagesWithUpcoming,
} from "../venue-pages";
import { VENUES } from "../venues";
import type { EventRecord } from "../types";

describe("normalizeVenueName / slugifyVenue", () => {
  it("meets in the middle: articles, ampersands, punctuation, parentheticals", () => {
    expect(normalizeVenueName("The Hook & Ladder Theater")).toBe("hook and ladder theater");
    expect(normalizeVenueName("Hook and Ladder Theater")).toBe("hook and ladder theater");
    expect(normalizeVenueName("Hennepin County Library (system-wide events)")).toBe("hennepin county library");
    expect(normalizeVenueName("Minnesota Children's Museum")).toBe("minnesota children s museum");
    expect(slugifyVenue("Palace Theatre")).toBe("palace-theatre");
    expect(slugifyVenue("Como Park Zoo & Conservatory")).toBe("como-park-zoo-and-conservatory");
  });
});

describe("VENUE_PAGES — the registry surface", () => {
  it("every 4.2 registry venue gets exactly one page with a unique slug", () => {
    expect(VENUE_PAGES).toHaveLength(VENUES.length);
    const slugs = VENUE_PAGES.map((v) => v.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });

  it("awkward names get curated slugs", () => {
    expect(venuePageBySlug("first-avenue")?.name).toBe("First Avenue & 7th St Entry");
    expect(venuePageBySlug("nickelodeon-universe")?.name).toContain("Nickelodeon");
    expect(venuePageBySlug("hennepin-county-library")).not.toBeNull();
  });
});

describe("matchVenueSlug — free-text event strings find their venue", () => {
  const CASES: [string, string | null][] = [
    // The mainroom/Entry family all resolve to the First Avenue page:
    ["First Avenue", "first-avenue"],
    ["First Ave", "first-avenue"],
    ["7th St Entry", "first-avenue"],
    ["First Avenue & 7th St Entry", "first-avenue"],
    // Article/spelling variants:
    ["The Cedar", "cedar-cultural-center"],
    ["Cedar Cultural Center", "cedar-cultural-center"],
    ["Varsity Theatre", "varsity-theater"],
    ["The Fillmore", "fillmore-minneapolis"],
    ["Turf Club", "turf-club"],
    ["Icehouse", "icehouse"],
    ["The Dakota", "dakota-jazz-club"],
    ["Como Zoo", "como-park-zoo-and-conservatory"],
    ["Xcel", "xcel-energy-center"],
    // Unknown rooms stay unmatched — no venue page claims them:
    ["Some Random Basement", null],
    ["", null],
  ];
  for (const [input, expected] of CASES) {
    it(`"${input}" → ${expected ?? "null"}`, () => {
      expect(matchVenueSlug(input)).toBe(expected);
    });
  }
});

describe("dominantCoords / dominantAddress — the mode is the building", () => {
  it("picks the most common pair; one bad geocode is outvoted", () => {
    const events = [
      { lat: 44.9784, lng: -93.2762 },
      { lat: 44.9784, lng: -93.2762 },
      { lat: 44.9784, lng: -93.2762 },
      { lat: 45.2, lng: -93.9 }, // the bad geocode
    ];
    expect(dominantCoords(events)).toEqual({ lat: 44.9784, lng: -93.2762 });
  });

  it("ignores 0,0 and non-finite; empty → null", () => {
    expect(dominantCoords([{ lat: 0, lng: 0 }, { lat: NaN, lng: -93 }])).toBeNull();
    expect(dominantCoords([])).toBeNull();
  });

  it("dominantAddress: most common non-empty string wins", () => {
    expect(
      dominantAddress([
        { address: "701 First Ave N" },
        { address: "701 First Ave N" },
        { address: "" },
        { address: "701 1st Ave N" },
      ]),
    ).toBe("701 First Ave N");
    expect(dominantAddress([{ address: "" }])).toBeNull();
  });

  it("staticMapUrl: pin at TRUE coords, map center nudged north to frame the pin body", () => {
    const url = staticMapUrl(44.9784, -93.2762, "pk.test");
    // The pin is anchored at the exact coordinates — never moved:
    expect(url).toContain("pin-l+c9a961(-93.2762,44.9784)");
    expect(url).toContain("access_token=pk.test");
    // The CENTER is slightly north (pins render upward from their tip);
    // at zoom 14 near 45°N the nudge is ~0.0008° (≈ 85 m ≈ 25 style px):
    expect(url).toContain("/1280x400@2x?");
    const center = url.match(/\/(-93\.2762),([0-9.]+),14,0\//);
    expect(center).not.toBeNull();
    const centerLat = Number(center![2]);
    expect(centerLat).toBeGreaterThan(44.9784 + 0.0004);
    expect(centerLat).toBeLessThan(44.9784 + 0.0012);
  });
});

describe("directionsUrl / parkingUrl (B3)", () => {
  const coords = { lat: 44.9784, lng: -93.2762 };

  it("directions with coords are byte-identical to the inline URL this replaced", () => {
    expect(directionsUrl(coords, "First Avenue", "Minneapolis")).toBe(
      "https://www.google.com/maps/search/?api=1&query=44.9784,-93.2762",
    );
  });

  it("directions fall back to a name search when the calendar has no pin", () => {
    expect(directionsUrl(null, "Turf Club", "St Paul")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Turf%20Club%20St%20Paul%20MN",
    );
  });

  it("parking searches near the coords", () => {
    expect(parkingUrl(coords, "First Avenue", "Minneapolis")).toBe(
      "https://www.google.com/maps/search/?api=1&query=parking%20near%2044.9784%2C-93.2762",
    );
  });

  it("parking falls back to the venue name too", () => {
    expect(parkingUrl(null, "Turf Club", "St Paul")).toBe(
      "https://www.google.com/maps/search/?api=1&query=parking%20near%20Turf%20Club%20St%20Paul%20MN",
    );
  });

  it("encodes names that would otherwise break the query string", () => {
    const url = parkingUrl(null, "Bryant-Lake Bowl & Theater", "Minneapolis");
    expect(url).toContain("%26"); // the ampersand cannot escape into a new param
    expect(url).not.toContain("&query=parking near");
    expect(url.split("&").length).toBe(2); // only api=1 and query=
  });

  it("both links point at google maps and nowhere else — this earns nothing", () => {
    for (const url of [directionsUrl(coords, "X", "Y"), parkingUrl(coords, "X", "Y")]) {
      expect(url.startsWith("https://www.google.com/maps/search/?api=1&query=")).toBe(true);
      expect(url).not.toContain("spothero");
      expect(url).not.toContain("utm_");
    }
  });
});

/**
 * THE SITEMAP SUPPLY TEST (30 Oct 2026). The sitemap listed all 47 venue slugs
 * unconditionally at priority 0.7 — a HIGHER priority than the city pages twenty
 * lines above, which have had this supply test since 6.2 under the comment
 * "empty pages are spam, not SEO". The first GSC read of the /venues bucket found
 * 13 of them earning zero impressions while being advertised daily.
 *
 * These pin the predicate itself. The boundary cases are the point: this function
 * routes through isUpcoming, which was fixed the same morning for comparing a
 * naive Chicago wall string against a real instant (rule 10), so the suite has to
 * mean the same thing on a UTC server as on a Chicago laptop.
 */
describe("upcomingCountsByVenue / venuePagesWithUpcoming — the sitemap supply test", () => {
  // A real registry venue, so matchVenueSlug resolves.
  const ev = (over: Partial<EventRecord>): EventRecord => ({
    id: "e1",
    title: "A show",
    category: "music",
    venue: "First Avenue & 7th St Entry",
    address: "701 N 1st Ave",
    city: "Minneapolis",
    lat: 44.978,
    lng: -93.276,
    start: "2026-08-06T20:00",
    end: "2026-08-06T23:00",
    price: "$20",
    priceTier: "$$",
    ticketUrl: "",
    description: "",
    image: "",
    sourceUrl: "",
    status: "published",
    ...over,
  });

  // 15:00 Chicago on 6 Aug 2026, stated as an explicit instant so the block means
  // the same thing in any server zone.
  const NOW = new Date("2026-08-06T20:00:00Z");

  it("counts an upcoming event at a registry venue", () => {
    const counts = upcomingCountsByVenue([ev({ start: "2026-08-06T20:00" })], NOW);
    expect(counts.get("first-avenue")).toBe(1);
  });

  it("does not count a past event — the venue drops out entirely (honest emptiness)", () => {
    const counts = upcomingCountsByVenue(
      [ev({ start: "2026-08-04T20:00", end: "2026-08-04T23:00" })],
      NOW,
    );
    expect(counts.get("first-avenue")).toBeUndefined();
    expect(venuePagesWithUpcoming([ev({ start: "2026-08-04T20:00", end: "2026-08-04T23:00" })], NOW))
      .toEqual([]);
  });

  it("does not count a draft, archived or cancelled event", () => {
    for (const status of ["draft", "archived", "cancelled"] as const) {
      expect(upcomingCountsByVenue([ev({ status })], NOW).size, status).toBe(0);
    }
  });

  it("ignores a venue string that matches no registry page", () => {
    expect(upcomingCountsByVenue([ev({ venue: "Somebody's Garage" })], NOW).size).toBe(0);
  });

  it("sums several events at the same room, and keeps rooms apart", () => {
    const counts = upcomingCountsByVenue(
      [
        ev({ id: "a" }),
        ev({ id: "b", start: "2026-08-07T20:00", end: "2026-08-07T23:00" }),
        ev({ id: "c", venue: "Turf Club", start: "2026-08-08T20:00", end: "2026-08-08T23:00" }),
      ],
      NOW,
    );
    expect(counts.get("first-avenue")).toBe(2);
    expect(counts.get("turf-club")).toBe(1);
  });

  // ── the boundary, and the reason it is stated in UTC ──────────────────────
  it("an event earlier TODAY still counts — a 7 PM show is not gone at 7 PM", () => {
    // 20:00 Chicago on the 6th, asked at 15:00 Chicago the same day.
    expect(upcomingCountsByVenue([ev({ start: "2026-08-06T20:00" })], NOW).get("first-avenue")).toBe(1);
    // and still at 21:00 Chicago, an hour AFTER doors (02:00Z the next day)
    const afterDoors = new Date("2026-08-07T02:00:00Z");
    expect(upcomingCountsByVenue([ev({ start: "2026-08-06T20:00" })], afterDoors).get("first-avenue")).toBe(1);
  });

  it("the day rolls over at midnight Chicago, not at midnight UTC", () => {
    const show = ev({ start: "2026-08-06T20:00", end: "2026-08-06T23:00" });
    // 23:30 Chicago on the 6th = 04:30Z on the 7th. Still the 6th in Chicago.
    expect(upcomingCountsByVenue([show], new Date("2026-08-07T04:30:00Z")).get("first-avenue")).toBe(1);
    // 00:30 Chicago on the 7th = 05:30Z. Now it is yesterday's show.
    expect(upcomingCountsByVenue([show], new Date("2026-08-07T05:30:00Z")).get("first-avenue")).toBeUndefined();
  });

  it("a run still counts on its CLOSING day, from multiDayEnd or from end", () => {
    // the divergence isUpcoming's docstring is about: an end-carried span.
    const spanByEnd = ev({ start: "2026-08-01T10:00", end: "2026-08-06T17:00" });
    expect(upcomingCountsByVenue([spanByEnd], NOW).get("first-avenue")).toBe(1);

    const spanByMultiDay = ev({ start: "2026-08-01T10:00", end: "2026-08-01T17:00", multiDayEnd: "2026-08-06T17:00" });
    expect(upcomingCountsByVenue([spanByMultiDay], NOW).get("first-avenue")).toBe(1);

    // and a run that closed yesterday does not
    const finished = ev({ start: "2026-08-01T10:00", end: "2026-08-05T17:00" });
    expect(upcomingCountsByVenue([finished], NOW).get("first-avenue")).toBeUndefined();
  });

  it("an unparseable start is dropped, not counted", () => {
    expect(upcomingCountsByVenue([ev({ start: "not a date" })], NOW).size).toBe(0);
  });

  // ── what the sitemap actually asks ────────────────────────────────────────
  it("venuePagesWithUpcoming returns ONLY the rooms with something on", () => {
    const live = venuePagesWithUpcoming(
      [ev({ venue: "Turf Club" }), ev({ id: "old", venue: "Icehouse", start: "2026-07-01T20:00", end: "2026-07-01T23:00" })],
      NOW,
    );
    expect(live.map((v) => v.slug)).toEqual(["turf-club"]);
  });

  it("no events at all means NO venue URLs — never the whole registry", () => {
    // The defect this ships against: an empty supply set must not fall back to
    // advertising all 47 pages.
    expect(venuePagesWithUpcoming([], NOW)).toEqual([]);
    expect(venuePagesWithUpcoming([], NOW).length).toBeLessThan(VENUE_PAGES.length);
  });

  it("returns a subset of the registry, in registry order", () => {
    const events = [ev({ venue: "Turf Club" }), ev({ id: "x", venue: "First Avenue & 7th St Entry" })];
    const live = venuePagesWithUpcoming(events, NOW);
    const slugs = live.map((v) => v.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const v of live) expect(VENUE_PAGES).toContainEqual(v);
    const order = VENUE_PAGES.map((v) => v.slug).filter((s) => slugs.includes(s));
    expect(slugs).toEqual(order);
  });
});
