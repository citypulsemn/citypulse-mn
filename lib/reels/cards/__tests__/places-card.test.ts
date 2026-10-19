import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { CARD_COPY } from "../../../editorial";
import {
  KIND_COVERAGE,
  KIND_META,
  PLACES,
  type Place,
  type PlaceKind,
  type PlaceSeason,
} from "../../../places";
import { captionErrors, countWords } from "../../validate";
import { buildPlacesCard, cardNames, cardSafe, CARD_SAFE_BY_SLUG, CARD_SAFE_SEASONS, isoYearWeek } from "../places-card";
import { CARD_WEEKDAY, type PlacesCard, type PlacesCardRecord } from "../types";

const DAY_MS = 86_400_000;
const YEAR_ROUND: PlaceSeason = { type: "year-round" };
// Month bounds deliberately span the whole year: these tests prove the
// card-safe table decides, not the registry's (wider) months.
const seasonal = (label: string): PlaceSeason => ({ type: "seasonal", openMonth: 1, closeMonth: 12, label });

function fake(kind: PlaceKind, n: number, over: Partial<Place> = {}): Place[] {
  return Array.from({ length: n }, (_, i) => ({
    slug: `${kind}-${i}`,
    name: `${KIND_META[kind].label} ${i}`,
    kind,
    lat: 44.97,
    lng: -93.26,
    address: "1 Main St",
    city: "Richfield",
    neighborhood: null,
    season: YEAR_ROUND,
    cost: "free" as const,
    tags: ["lifeguards", "saturdays"],
    intro: "",
    sourceUrl: "https://example.org",
    verifiedAt: "2026-08-01",
    venueSlug: null,
    ...over,
  }));
}

const rec = (kind: PlaceKind, postDate: string): PlacesCardRecord => ({ type: "places", kind, slugs: [], postDate });
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const byHash = (keys: string[], week: string) => [...keys].sort((a, b) => (sha(a + week) < sha(b + week) ? -1 : 1));
const addDays = (ymd: string, n: number) => new Date(Date.parse(ymd) + n * DAY_MS).toISOString().slice(0, 10);
const dow = (ymd: string) => new Date(Date.parse(ymd)).getUTCDay();
const everyDayOf2027 = Array.from({ length: 365 }, (_, i) => addDays("2027-01-01", i));
const seededKinds = (Object.keys(KIND_META) as PlaceKind[]).filter((k) => PLACES.some((p) => p.kind === k));

/** The reel caption policy itself, not a copy: if it tightens, these cards are held to it the same day. */
const captionProblems = captionErrors;
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;

/**
 * Sameness judged WITHOUT the card's own naming rule: two places of one kind
 * whose names open with the same two words. The handful below really are
 * different places that happen to share an opening (a lake with three
 * beaches); anything else that shares one is a single name written twice.
 */
const firstTwo = (name: string) => name.split(/\s+/).slice(0, 2).join(" ");
const DIFFERENT_PLACES_SAME_OPENING = new Set([
  "beach|Lake Nokomis",
  "beach|Lake Harriet",
  "beach|Bde Maka",
  "beach|Cedar Lake",
  "golf-course|Theodore Wirth",
  "dog-park|Lions Park",
]);
const placeOf = (slug: string) => PLACES.find((p) => p.slug === slug)!;

/**
 * Every card each real kind can produce on any day of 2027, built with that
 * kind alone in the registry so the rotation can't hide one. A kind that never
 * reaches 10 card-safe places (ski hills: 7) honestly produces none.
 */
const producible: { kind: PlaceKind; card: PlacesCard }[] = seededKinds.flatMap((kind) => {
  const ofKind = PLACES.filter((p) => p.kind === kind);
  return everyDayOf2027
    .map((day) => buildPlacesCard(day, [], { places: ofKind }))
    .filter((card) => card.status === "built")
    .map((card) => ({ kind, card }));
});

describe("isoYearWeek", () => {
  it("names the ISO year and week of a local date", () => {
    expect(isoYearWeek("2026-10-07")).toBe("2026-W41"); // the first card Wednesday
    expect(isoYearWeek("2026-08-24")).toBe("2026-W35"); // keys.test.ts's anchor Monday
    expect(isoYearWeek("2027-03-03")).toBe("2027-W09"); // zero-padded
  });

  it("every day of one ISO week shares the value", () => {
    for (let i = 0; i < 7; i++) expect(isoYearWeek(addDays("2026-10-05", i))).toBe("2026-W41");
    expect(isoYearWeek("2026-10-04")).toBe("2026-W40"); // the Sunday before
    expect(isoYearWeek("2026-10-12")).toBe("2026-W42"); // the Monday after
  });

  it("early January can belong to the PRIOR ISO year", () => {
    expect(isoYearWeek("2026-12-30")).toBe("2026-W53"); // 2026 is a 53-week year
    expect(isoYearWeek("2027-01-01")).toBe("2026-W53"); // a Friday; its Thursday is Dec 31
    expect(isoYearWeek("2027-01-03")).toBe("2026-W53");
    expect(isoYearWeek("2027-01-04")).toBe("2027-W01");
    expect(isoYearWeek("2028-01-02")).toBe("2027-W52"); // a Sunday
    expect(isoYearWeek("2028-01-03")).toBe("2028-W01");
  });

  it("late December can belong to the NEXT ISO year", () => {
    expect(isoYearWeek("2025-12-28")).toBe("2025-W52");
    expect(isoYearWeek("2025-12-29")).toBe("2026-W01"); // Monday of the week holding Thu Jan 1
    expect(isoYearWeek("2025-12-31")).toBe("2026-W01");
  });

  it("refuses a date that is not yyyy-mm-dd rather than keying a card on garbage", () => {
    for (const bad of ["", "2026-10-7", "10/07/2026", "2026-10-07T11:45:00", "2026-13-01", "next wednesday"]) {
      expect(() => isoYearWeek(bad), bad).toThrow(/yyyy-mm-dd/);
      expect(() => buildPlacesCard(bad, []), bad).toThrow(/yyyy-mm-dd/);
    }
  });
});

describe("card-safe seasons", () => {
  const at = (label: string, monthDay: string) =>
    cardSafe(fake("park", 1, { season: seasonal(label) })[0], `2027-${monthDay}`);

  it("a year-round place is always card-safe", () => {
    const place = fake("museum", 1)[0];
    for (const day of everyDayOf2027) expect(cardSafe(place, day), day).toBe(true);
  });

  // [label, last day out, first day in, last day in, first day out]
  it.each([
    ["Memorial Day–Labor Day", "05-31", "06-01", "08-31", "09-01"],
    ["June–August", "06-14", "06-15", "08-20", "08-21"],
    ["April–October", "04-30", "05-01", "09-30", "10-01"],
    ["May–October", "05-31", "06-01", "09-30", "10-01"],
    ["September–May (closed summer)", "09-30", "10-01", "04-30", "05-01"],
    ["December–February", "12-31", "01-01", "02-14", "02-15"],
    ["December–March", "12-31", "01-01", "03-01", "03-02"],
    ["September–October", "09-14", "09-15", "10-25", "10-26"],
    ["October–March", "10-31", "11-01", "03-10", "03-11"],
    ["May–September", "05-31", "06-01", "08-31", "09-01"],
    ["June–October", "06-14", "06-15", "09-30", "10-01"],
  ])("%s: out on %s, in from %s through %s, out on %s", (label, before, first, last, after) => {
    expect(at(label, before)).toBe(false);
    expect(at(label, first)).toBe(true);
    expect(at(label, last)).toBe(true);
    expect(at(label, after)).toBe(false);
  });

  it("the table above covers every row of the real one", () => {
    expect(Object.keys(CARD_SAFE_SEASONS)).toHaveLength(11);
  });

  it("the off-season window wraps the new year", () => {
    const label = "September–May (closed summer)";
    for (const inside of ["10-01", "12-31", "01-01", "02-29", "04-30"]) expect(at(label, inside), inside).toBe(true);
    for (const outside of ["05-01", "07-04", "09-30"]) expect(at(label, outside), outside).toBe(false);
  });

  it("the ice window wraps the new year too", () => {
    for (const inside of ["11-01", "12-31", "01-01", "03-10"]) expect(at("October–March", inside), inside).toBe(true);
    for (const outside of ["10-31", "03-11", "07-04"]) expect(at("October–March", outside), outside).toBe(false);
  });

  it("the winter windows do NOT open in December, whatever the label says", () => {
    for (const label of ["December–February", "December–March"]) {
      for (const day of ["12-01", "12-15", "12-25", "12-31"]) expect(at(label, day), `${label} ${day}`).toBe(false);
    }
  });

  it("a seasonal label that is not in the table is never card-safe", () => {
    const place = fake("park", 1, { season: seasonal("March–November") })[0];
    for (const day of everyDayOf2027) expect(cardSafe(place, day), day).toBe(false);
  });

  it("drift guard: every seasonal label in the registry has a card-safe window", () => {
    const labels = new Set(PLACES.flatMap((p) => (p.season.type === "seasonal" ? [p.season.label] : [])));
    expect(labels.size).toBeGreaterThan(0);
    for (const label of labels) expect(Object.keys(CARD_SAFE_SEASONS), label).toContain(label);
  });

  it("drift guard: no card-safe day falls outside the registry's own months", () => {
    for (const place of PLACES) {
      if (place.season.type !== "seasonal") continue;
      const { openMonth, closeMonth } = place.season;
      for (const day of everyDayOf2027) {
        if (!cardSafe(place, day)) continue;
        const month = Number(day.slice(5, 7));
        const open = openMonth <= closeMonth ? month >= openMonth && month <= closeMonth : month >= openMonth || month <= closeMonth;
        expect(open, `${place.slug} on ${day}`).toBe(true);
      }
    }
  });

  describe("beaches and splash pads around Memorial Day and Labor Day 2027", () => {
    const water = PLACES.filter((p) => p.kind === "beach" || p.kind === "splash-pad");

    it("anchor sanity: the holidays and the weekdays around them", () => {
      expect(dow("2027-05-31")).toBe(1); // Memorial Day, the last Monday of May
      expect(dow("2027-09-06")).toBe(1); // Labor Day, the first Monday of September
      for (const wed of ["2027-05-26", "2027-06-02", "2027-08-25", "2027-09-01", "2027-09-08"]) expect(dow(wed), wed).toBe(3);
      for (const thu of ["2027-05-27", "2027-06-03", "2027-08-26", "2027-09-02", "2027-09-09"]) expect(dow(thu), thu).toBe(4);
      expect(water.length).toBeGreaterThanOrEqual(20);
    });

    it.each([
      ["2027-05-26", false, "Wednesday before Memorial Day"],
      ["2027-05-27", false, "Thursday before Memorial Day"],
      ["2027-05-31", false, "Memorial Day itself"],
      ["2027-06-01", true, "first card-safe day"],
      ["2027-06-02", true, "Wednesday after Memorial Day"],
      ["2027-06-03", true, "Thursday after Memorial Day"],
      ["2027-08-25", true, "last Wednesday of August"],
      ["2027-08-26", true, "last Thursday of August"],
      ["2027-08-31", true, "last card-safe day"],
      ["2027-09-01", false, "Wednesday before Labor Day"],
      ["2027-09-02", false, "Thursday before Labor Day"],
      ["2027-09-06", false, "Labor Day itself"],
      ["2027-09-08", false, "Wednesday after Labor Day"],
      ["2027-09-09", false, "Thursday after Labor Day"],
    ])("%s card-safe=%s (%s)", (day, expected) => {
      for (const place of water) expect(cardSafe(place, day), place.slug).toBe(expected);
    });

    it("with only water in the registry, the card itself follows the same edges", () => {
      for (const day of ["2027-05-26", "2027-05-27", "2027-09-01", "2027-09-02", "2027-09-08"]) {
        const card = buildPlacesCard(day, [], { places: water });
        expect(card.status, day).toBe("skipped");
        expect(card.considered, day).toEqual([
          { kind: "beach", eligible: 0, note: "out of season" },
          { kind: "splash-pad", eligible: 0, note: "out of season" },
        ]);
      }
      for (const day of ["2027-06-02", "2027-06-03", "2027-08-25", "2027-08-26"]) {
        const card = buildPlacesCard(day, [], { places: water });
        expect(card.status, day).toBe("built");
        expect(["beach", "splash-pad"], day).toContain(card.kind);
      }
    });
  });
});

describe("kind eligibility — a card is never most of the list", () => {
  it("9 card-safe places is not enough; 10 is", () => {
    const nine = buildPlacesCard("2026-10-07", [], { places: fake("museum", 9) });
    expect(nine.status).toBe("skipped");
    expect(nine.considered).toEqual([{ kind: "museum", eligible: 9, note: "below 10" }]);

    const ten = buildPlacesCard("2026-10-07", [], { places: fake("museum", 10) });
    expect(ten.status).toBe("built");
    expect(ten.kind).toBe("museum");
    expect(ten.considered).toEqual([{ kind: "museum", eligible: 10, note: "eligible" }]);
  });

  it("counts card-safe places on the post date, not the registry total", () => {
    const places = [
      ...fake("pool", 9),
      ...fake("pool", 5, { season: seasonal("June–August") }).map((p) => ({ ...p, slug: `outdoor-${p.slug}`, name: `Outdoor ${p.name}` })),
    ];
    const october = buildPlacesCard("2026-10-07", [], { places });
    expect(october.status).toBe("skipped");
    expect(october.considered).toEqual([{ kind: "pool", eligible: 9, note: "below 10" }]);

    const july = buildPlacesCard("2027-07-14", [], { places });
    expect(july.status).toBe("built");
    expect(july.considered).toEqual([{ kind: "pool", eligible: 14, note: "eligible" }]);
  });

  it("considered lists every seeded kind in registry order, and no unseeded one", () => {
    const card = buildPlacesCard("2026-10-07", [], {
      places: [...fake("museum", 10), ...fake("beach", 12, { season: seasonal("Memorial Day–Labor Day") }), ...fake("park", 3)],
    });
    expect(card.considered).toEqual([
      { kind: "beach", eligible: 0, note: "out of season" },
      { kind: "park", eligible: 3, note: "below 10" },
      { kind: "museum", eligible: 10, note: "eligible" },
    ]);
  });

  it("against the live registry, considered covers exactly the kinds that have places", () => {
    const card = buildPlacesCard("2026-10-07", []);
    expect(card.considered.map((k) => k.kind)).toEqual(seededKinds);
    for (const k of card.considered) {
      const ofKind = PLACES.filter((p) => p.kind === k.kind);
      const { nameOf } = cardNames(ofKind);
      const safe = ofKind.filter((p) => cardSafe(p, "2026-10-07"));
      expect(k.eligible, k.kind).toBe(new Set(safe.map((p) => nameOf.get(p.slug))).size);
    }
    // Counted by hand from the registry, so the rule is not grading itself:
    // 17 trampoline and climbing gyms are 7 businesses (Sky Zone x4, Urban Air
    // x3, Vertical Endeavors x4, Bouldering Project x2, Conquer Ninja x2, and
    // two one-offs), and 15 indoor playgrounds are 13 (InnerActive x2, Kids
    // Empire x2).
    expect(card.considered).toContainEqual({ kind: "trampoline-climbing", eligible: 7, note: "below 10" });
    expect(card.considered.find((k) => k.kind === "indoor-playground")!.eligible).toBe(13);
  });
});

describe("five rows are five names", () => {
  const gyms = (rows: [name: string, city: string][]) =>
    rows.map(([name, city], i) => ({ ...fake("trampoline-climbing", 1)[0], slug: `gym-${i}`, name, city }));
  const solo = (n: number): [string, string][] => Array.from({ length: n }, (_, i) => [`Solo Gym ${i}`, "Anoka"]);
  const wednesdays2027 = everyDayOf2027.filter((d) => dow(d) === CARD_WEEKDAY);

  // The three ways the registry writes a business with several locations.
  const DASHED: [string, string][] = ["Minneapolis", "Bloomington", "Duluth"].map((c) => [`Vertical Endeavors — ${c}`, c]);
  const BARE: [string, string][] = [["Sky Zone Edina", "Edina"], ["Sky Zone Eagan", "Eagan"], ["Sky Zone St. Paul", "Oakdale"]];
  const PARENS: [string, string][] = [["Blaine Market (Saturday)", "Blaine"], ["Blaine Market (Tuesday)", "Blaine"]];

  it.each([
    ["a spaced dash", DASHED, "Vertical Endeavors"],
    ["a bare trailing city, and one location named for a city it is not in", BARE, "Sky Zone"],
    ["a trailing parenthetical", PARENS, "Blaine Market"],
  ])("a multi-location name written with %s takes one row, whichever week it is", (_shape, chain, opening) => {
    const places = gyms([...chain, ...solo(9)]);
    for (const day of wednesdays2027) {
      const rows = buildPlacesCard(day, [], { places }).content!.events;
      expect(rows.filter((r) => r.name.startsWith(opening)).length, day).toBeLessThanOrEqual(1);
    }
  });

  it("the 10-place floor counts names, so a chain cannot carry a kind over it", () => {
    // 11 places, 9 names, for each way of writing the chain.
    for (const chain of [DASHED, BARE]) {
      const card = buildPlacesCard("2026-10-07", [], { places: gyms([...chain, ...solo(8)]) });
      expect(card.status).toBe("skipped");
      expect(card.considered).toEqual([{ kind: "trampoline-climbing", eligible: 9, note: "below 10" }]);
    }
  });

  it("names the registry's real chains as one, including the Sky Zone that is not in its city", () => {
    const named = (kind: PlaceKind) => {
      const ofKind = PLACES.filter((p) => p.kind === kind);
      const { nameOf } = cardNames(ofKind);
      return (opening: string) => [...new Set(ofKind.filter((p) => p.name.startsWith(opening)).map((p) => nameOf.get(p.slug)))];
    };
    const gym = named("trampoline-climbing");
    expect(PLACES.filter((p) => p.name.startsWith("Sky Zone"))).toHaveLength(4);
    expect(gym("Sky Zone")).toEqual(["Sky Zone"]);
    expect(gym("Urban Air")).toEqual(["Urban Air"]);
    expect(gym("Vertical Endeavors")).toEqual(["Vertical Endeavors"]);
    expect(named("indoor-playground")("Kids Empire")).toEqual(["Kids Empire"]);
    expect(named("farmers-market")("Blaine Farmers Market")).toEqual(["Blaine Farmers Market"]);
    // Two cities' parks that happen to share a name: not one business, but one
    // printed row name, and a card must not show the same name twice.
    expect(named("playground")("Central Park Playground")).toEqual(["Central Park Playground"]);
  });

  it("drift guard: places of one kind that open with the same two words go by one name, or are listed as different places", () => {
    const groups = new Map<string, Place[]>();
    for (const p of PLACES) {
      const key = `${p.kind}|${firstTwo(p.name)}`;
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    let checked = 0;
    for (const [key, members] of groups) {
      if (members.length < 2 || DIFFERENT_PLACES_SAME_OPENING.has(key)) continue;
      checked++;
      const { nameOf } = cardNames(PLACES.filter((p) => p.kind === members[0].kind));
      const names = new Set(members.map((p) => nameOf.get(p.slug)));
      // A new chain written a fourth way lands here: teach cardNames the shape,
      // or add the group to DIFFERENT_PLACES_SAME_OPENING if they truly differ.
      expect([...names], `${key}: ${members.map((p) => p.name).join(" / ")}`).toHaveLength(1);
    }
    expect(checked).toBeGreaterThanOrEqual(10);
    // The allow-list is not a place to hide a chain: every entry is still a real group.
    for (const key of DIFFERENT_PLACES_SAME_OPENING) expect(groups.get(key)?.length ?? 0, key).toBeGreaterThanOrEqual(2);
  });

  it("no producible card from the live registry carries one business twice", () => {
    for (const { kind, card } of producible) {
      const openings = card.record!.slugs.map((s) => firstTwo(placeOf(s).name));
      const repeated = openings.filter((o, i) => openings.indexOf(o) !== i && !DIFFERENT_PLACES_SAME_OPENING.has(`${kind}|${o}`));
      expect(repeated, `${kind} ${card.record!.postDate}: ${card.content!.events.map((r) => r.name).join(" | ")}`).toEqual([]);
    }
  });

  it("no card prints the same name and city on two rows", () => {
    for (const { kind, card } of producible) {
      const rows = card.content!.events.map((r) => `${r.name}|${r.details}`);
      expect(new Set(rows).size, `${kind} ${card.record!.postDate}: ${rows.join(" / ")}`).toBe(5);
    }
  });

  describe("the row drops a tail that only repeats the city below it", () => {
    // Ten names, five rows: find a week whose five include the place under test.
    const row = (places: Place[]) => {
      for (const day of everyDayOf2027) {
        const card = buildPlacesCard(day, [], { places });
        const at = card.record!.slugs.indexOf("gym-0");
        if (at >= 0) return card.content!.events[at];
      }
      throw new Error(`"${places[0].name}" never made a card in 2027`);
    };
    const alone = (name: string, city: string) => row(gyms([[name, city], ...solo(9)]));

    it("after a dash or in parentheses, always", () => {
      expect(alone("Bouldering Project — Minneapolis", "Minneapolis")).toEqual({ name: "Bouldering Project", details: "Minneapolis" });
      expect(alone("Lions Park Off-Leash Pet Area (Golden Valley)", "Golden Valley")).toEqual({
        name: "Lions Park Off-Leash Pet Area",
        details: "Golden Valley",
      });
    });

    it("bare, only when what is left is a chain's name", () => {
      const chained = row(gyms([["Sky Zone Edina", "Edina"], ["Sky Zone Eagan", "Eagan"], ...solo(9)]));
      expect(chained).toEqual({ name: "Sky Zone", details: "Edina" });
      // One of a kind: "Old Town Anoka" is a name, not a chain plus a city.
      expect(alone("Old Town Anoka", "Anoka").name).toBe("Old Town Anoka");
    });

    it("a tail that is not the city is the name", () => {
      expect(alone("Vertical Endeavors — Twin Cities Bouldering", "St. Paul").name).toBe("Vertical Endeavors — Twin Cities Bouldering");
      expect(alone("Lookout Ridge (Woodbury Central Park)", "Woodbury").name).toBe("Lookout Ridge (Woodbury Central Park)");
      expect(alone("St. Paul Curling Club", "St. Paul").name).toBe("St. Paul Curling Club");
      // Named for a city it is not in: nothing comes off.
      const oakdale = row(gyms([["Sky Zone St. Paul", "Oakdale"], ["Sky Zone Edina", "Edina"], ...solo(9)]));
      expect(["Sky Zone St. Paul", "Sky Zone"]).toContain(oakdale.name);
      if (oakdale.details === "Oakdale") expect(oakdale.name).toBe("Sky Zone St. Paul");
    });
  });
});

describe("single places whose registry season is wider than a card may claim", () => {
  const bySlug = (slug: string) => placeOf(slug);
  const safeOn = (slug: string, day: string) => cardSafe(bySlug(slug), day);

  it("drift guard: every corrected slug is still in the registry", () => {
    // A renamed slug would silently hand the place back its registry season.
    for (const slug of Object.keys(CARD_SAFE_BY_SLUG)) expect(PLACES.some((p) => p.slug === slug), slug).toBe(true);
  });

  it("Apple Valley Sports Arena is an ice rink only while its own entry says there is ice", () => {
    // Now the registry's own October–March season, not a line in this file.
    expect(bySlug("apple-valley-sports-arena").intro).toContain("Ice from mid-October to mid-March");
    expect(bySlug("apple-valley-sports-arena").season).toMatchObject({ label: "October–March" });
    for (const dry of ["2026-10-07", "2026-10-31", "2027-03-11", "2027-03-31", "2027-04-28", "2027-07-07"]) {
      expect(safeOn("apple-valley-sports-arena", dry), dry).toBe(false);
    }
    for (const ice of ["2026-11-01", "2027-01-20", "2027-03-10"]) expect(safeOn("apple-valley-sports-arena", ice), ice).toBe(true);
    // The water park keeps its own September–May window.
    expect(safeOn("great-river-water-park", "2027-03-31")).toBe(true);
  });

  it("Hyland Hills, 'Closed for the 2026 season' on 5 Oct, is May–September in the registry and cards June–August", () => {
    expect(bySlug("hyland-hills-disc-golf").season).toMatchObject({ label: "May–September" });
    expect(safeOn("hyland-hills-disc-golf", "2027-07-07")).toBe(true);
    for (const day of ["2026-10-07", "2027-01-20", "2027-04-14", "2027-05-31", "2027-09-01", "2027-12-22"]) {
      expect(safeOn("hyland-hills-disc-golf", day), day).toBe(false);
    }
  });

  it("disc golf on winter-sports ground cards only in the warm season", () => {
    for (const slug of ["elm-creek-disc-golf", "theodore-wirth-disc-golf"]) {
      expect(safeOn(slug, "2027-07-07"), slug).toBe(true);
      for (const cold of ["2027-02-10", "2027-04-30", "2027-10-01", "2027-12-22"]) expect(safeOn(slug, cold), `${slug} ${cold}`).toBe(false);
    }
  });

  it("a registry fix retires its correction: the South St. Paul pools now need none", () => {
    // Northview was pulled from the registry and Lorraine put on the pool
    // summer (main, 5 Oct 2026); their lines here came out the same day.
    expect(PLACES.some((p) => p.slug === "northview-pool-south-st-paul")).toBe(false);
    expect(bySlug("lorraine-splash-pool-south-st-paul").season).toMatchObject({ label: "June–August" });
    expect(Object.keys(CARD_SAFE_BY_SLUG)).not.toContain("lorraine-splash-pool-south-st-paul");
    // 6 Oct 2026: the arena and the two ski-hill disc golf courses, re-verified
    // against their own pages, are seasonal in the registry now.
    for (const slug of ["apple-valley-sports-arena", "hyland-hills-disc-golf", "elm-creek-disc-golf"]) {
      expect(Object.keys(CARD_SAFE_BY_SLUG), slug).not.toContain(slug);
      expect(bySlug(slug).season.type, slug).toBe("seasonal");
    }
  });

  it("Gibbs Farm, 'open the warm months', cards in summer only", () => {
    expect(bySlug("gibbs-farm").season).toMatchObject({ label: "May–October" }); // registry fixed 19 Oct; the card line came out
    expect(safeOn("gibbs-farm", "2027-07-07")).toBe(true);
    for (const cold of ["2026-12-23", "2027-02-17", "2027-03-31", "2027-05-05", "2027-10-06"]) {
      expect(safeOn("gibbs-farm", cold), cold).toBe(false);
    }
  });

  it("drift guard: a place that is card-safe all year does not say in its own words that it closes", () => {
    // The next Gibbs Farm fails here instead of posting in March.
    const closes = /open the warm months|closed for the \d{4} season|spring through fall|open (?:may|june) through/i;
    for (const p of PLACES) {
      const allYear = ["2027-01-20", "2027-04-20", "2027-07-20", "2027-10-20"].every((d) => cardSafe(p, d));
      if (allYear) expect(closes.test(p.intro), `${p.slug}: ${p.intro}`).toBe(false);
    }
  });

  it("a year-round place with no correction is card-safe every day", () => {
    const course = bySlug("bryant-lake-disc-golf");
    expect(course.season.type).toBe("year-round");
    for (const day of everyDayOf2027) expect(cardSafe(course, day), day).toBe(true);
  });
});

describe("a kind does not bring back the places it showed last time", () => {
  const places = fake("museum", 12);
  const first = buildPlacesCard("2026-10-07", [], { places });
  const shown = first.record!.slugs;

  it("the next card of the kind is five other places", () => {
    const next = buildPlacesCard("2026-12-02", [first.record!], { places });
    expect(next.kind).toBe("museum");
    expect(next.record!.slugs.filter((s) => shown.includes(s))).toEqual([]);
  });

  it("at the floor of ten names the next card is exactly the other five", () => {
    const ten = fake("museum", 10);
    const a = buildPlacesCard("2026-10-07", [], { places: ten });
    const b = buildPlacesCard("2026-12-02", [a.record!], { places: ten });
    expect([...a.record!.slugs, ...b.record!.slugs].sort()).toEqual(ten.map((p) => p.slug).sort());
  });

  it("a chain's other location does not stand in for the one just shown", () => {
    // Nine one-offs and a two-location chain: ten names, eleven places.
    const chain = ["Edina", "Eagan"].map((city, i) => ({ ...fake("museum", 1)[0], slug: `chain-${i}`, name: `Sky Zone ${city}`, city }));
    const all = [...fake("museum", 9), ...chain];
    for (const day of everyDayOf2027.filter((d) => dow(d) === CARD_WEEKDAY)) {
      const a = buildPlacesCard(day, [], { places: all });
      if (!a.record!.slugs.some((s) => s.startsWith("chain-"))) continue;
      const b = buildPlacesCard(addDays(day, 56), [a.record!], { places: all });
      expect(b.record!.slugs.filter((s) => s.startsWith("chain-")), day).toEqual([]);
    }
  });

  it("a record that names a place no longer in the registry is simply not matched", () => {
    const gone = { ...first.record!, slugs: ["no-such-place", ...shown.slice(1)] };
    const next = buildPlacesCard("2026-12-02", [gone], { places });
    expect(next.record!.slugs).toHaveLength(5);
    expect(next.record!.slugs.filter((s) => shown.slice(1).includes(s))).toEqual([]);
  });

  it("only the most recent card of the kind counts, and never this card's own record", () => {
    const second = buildPlacesCard("2026-12-02", [first.record!], { places });
    // An older card's places are free to return…
    const third = buildPlacesCard("2027-01-27", [first.record!, second.record!], { places });
    expect(third.record!.slugs.filter((s) => second.record!.slugs.includes(s))).toEqual([]);
    // …and a re-run on post day, with its own record already on disk, builds the same card.
    const rerun = buildPlacesCard("2026-12-02", [first.record!, second.record!], { places });
    expect(rerun.record).toEqual(second.record);
  });
});

describe("no kind within 8 weeks", () => {
  const places = fake("museum", 10);
  const post = "2026-10-07";

  it("55 days ago blocks the kind; 56 days ago (eight Wednesdays) does not", () => {
    const blocked = buildPlacesCard(post, [rec("museum", addDays(post, -55))], { places });
    expect(blocked.status).toBe("skipped");
    expect(blocked.considered).toEqual([{ kind: "museum", eligible: 10, note: "used 55 days ago" }]);

    const allowed = buildPlacesCard(post, [rec("museum", addDays(post, -56))], { places });
    expect(allowed.status).toBe("built");
    expect(allowed.kind).toBe("museum");
  });

  it("every Wednesday from last week to seven weeks back blocks it", () => {
    for (let weeks = 1; weeks <= 7; weeks++) {
      const card = buildPlacesCard(post, [rec("museum", addDays(post, -7 * weeks))], { places });
      expect(card.status, `${weeks} weeks`).toBe("skipped");
      expect(card.considered[0].note).toBe(`used ${7 * weeks} days ago`);
    }
  });

  it("the most recent use is the one that counts, wherever it sits in the list", () => {
    const recent = [rec("museum", addDays(post, -70)), rec("museum", addDays(post, -14)), rec("museum", addDays(post, -200))];
    expect(buildPlacesCard(post, recent, { places }).considered[0].note).toBe("used 14 days ago");
  });

  it("another kind's history does not block this one", () => {
    expect(buildPlacesCard(post, [rec("park", addDays(post, -7))], { places }).status).toBe("built");
  });

  it("a record dated the post date itself is this card's own: a re-run builds the same card", () => {
    const first = buildPlacesCard(post, [], { places });
    const rerun = buildPlacesCard(post, [first.record!], { places });
    expect(rerun).toEqual(first);
  });

  it("a record dated after the post date is ignored", () => {
    expect(buildPlacesCard(post, [rec("museum", addDays(post, 7))], { places }).status).toBe("built");
  });
});

describe("seasonal first", () => {
  const orchards = fake("orchard", 12, { season: seasonal("September–October") });
  const museums = fake("museum", 12);
  const places = [...orchards, ...museums];

  it("an in-season kind beats a year-round kind that has waited longer", () => {
    // Orchards ran 8 weeks ago, museums never: plain rotation would say museums.
    const card = buildPlacesCard("2026-10-07", [rec("orchard", addDays("2026-10-07", -56))], { places });
    expect(card.kind).toBe("orchard");
    expect(card.considered).toEqual([
      { kind: "museum", eligible: 12, note: "eligible" },
      { kind: "orchard", eligible: 12, note: "eligible, in season" },
    ]);
  });

  it("the day after the card-safe window closes, the year-round kind runs instead", () => {
    expect(buildPlacesCard("2026-10-25", [], { places }).kind).toBe("orchard");
    const after = buildPlacesCard("2026-10-26", [], { places });
    expect(after.kind).toBe("museum");
    expect(after.considered).toContainEqual({ kind: "orchard", eligible: 0, note: "out of season" });
  });

  it("an in-season kind inside its 8 weeks gives way to a year-round one", () => {
    const card = buildPlacesCard("2026-10-07", [rec("orchard", "2026-09-30")], { places });
    expect(card.kind).toBe("museum");
  });

  it("'seasonal' means MORE than half the card-safe places — exactly half is a year-round kind", () => {
    const pools = (seasonalCount: number) => [
      ...fake("pool", seasonalCount, { season: seasonal("June–August") }).map((p) => ({ ...p, slug: `outdoor-${p.slug}`, name: `Outdoor ${p.name}` })),
      ...fake("pool", 10 - seasonalCount),
    ];
    // Pools ran 8 weeks ago, museums never. Pools only jump the queue when seasonal.
    const recent = [rec("pool", addDays("2027-07-14", -56))];
    const half = buildPlacesCard("2027-07-14", recent, { places: [...pools(5), ...museums] });
    expect(half.kind).toBe("museum");
    expect(half.considered).toContainEqual({ kind: "pool", eligible: 10, note: "eligible" });

    const majority = buildPlacesCard("2027-07-14", recent, { places: [...pools(6), ...museums] });
    expect(majority.kind).toBe("pool");
    expect(majority.considered).toContainEqual({ kind: "pool", eligible: 10, note: "eligible, in season" });
  });

  it("the live registry opens with orchards on the first card Wednesday", () => {
    expect(dow("2026-10-07")).toBe(CARD_WEEKDAY);
    expect(buildPlacesCard("2026-10-07", []).kind).toBe("orchard");
  });
});

describe("least recently used, then the week's hash", () => {
  const places = [...fake("museum", 10), ...fake("park", 10), ...fake("playground", 10)];
  const post = "2026-10-07";

  it("a never-used kind goes before any used one", () => {
    const recent = [rec("museum", addDays(post, -300)), rec("playground", addDays(post, -400))];
    expect(buildPlacesCard(post, recent, { places }).kind).toBe("park");
  });

  it("among used kinds, the one that has waited longest goes first", () => {
    const recent = [rec("museum", addDays(post, -70)), rec("park", addDays(post, -100)), rec("playground", addDays(post, -63))];
    expect(buildPlacesCard(post, recent, { places }).kind).toBe("park");
  });

  it("ties break on sha256(kind + ISO year-week), not the alphabet or registry order", () => {
    const winners = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const day = addDays(post, 7 * i);
      const expected = byHash(["museum", "park", "playground"], isoYearWeek(day))[0];
      expect(buildPlacesCard(day, [], { places }).kind, day).toBe(expected);
      winners.add(expected);
    }
    expect([...winners].sort()).toEqual(["museum", "park", "playground"]);
  });

  it("a tie between two equally rested kinds also falls to the hash", () => {
    const recent = [rec("museum", addDays(post, -70)), rec("park", addDays(post, -70)), rec("playground", addDays(post, -63))];
    expect(buildPlacesCard(post, recent, { places }).kind).toBe(byHash(["museum", "park"], isoYearWeek(post))[0]);
  });
});

describe("which five", () => {
  const places = fake("museum", 12);

  it("the first five by sha256(slug + ISO year-week), in that order", () => {
    const card = buildPlacesCard("2026-10-07", [], { places });
    const expected = byHash(places.map((p) => p.slug), "2026-W41").slice(0, 5);
    expect(card.record!.slugs).toEqual(expected);
    expect(card.content!.events.map((e) => e.name)).toEqual(expected.map((slug) => places.find((p) => p.slug === slug)!.name));
    expect(new Set(expected).size).toBe(5);
  });

  it("is not the registry's order, and changes when the kind comes round again", () => {
    const first = buildPlacesCard("2026-10-07", [], { places }).record!.slugs;
    const next = buildPlacesCard("2026-12-02", [], { places }).record!.slugs;
    expect(first).not.toEqual(places.slice(0, 5).map((p) => p.slug));
    expect(next).not.toEqual(first);
  });

  it("only card-safe places are drawn", () => {
    const mixed = [
      ...fake("rink", 11),
      ...fake("rink", 20, { season: seasonal("December–February") }).map((p) => ({ ...p, slug: `outdoor-${p.slug}` })),
    ];
    for (let i = 0; i < 20; i++) {
      const card = buildPlacesCard(addDays("2027-03-03", 7 * i), [], { places: mixed });
      expect(card.status).toBe("built");
      for (const slug of card.record!.slugs) expect(slug.startsWith("outdoor-"), slug).toBe(false);
    }
  });
});

describe("rows and wording", () => {
  it("a row is the place's name and its city, nothing else", () => {
    const places = fake("farmers-market", 10, { city: "Stillwater", cost: "free", tags: ["saturdays", "lifeguards"] });
    const card = buildPlacesCard("2026-10-07", [], { places });
    expect(card.content!.events).toHaveLength(5);
    for (const row of card.content!.events) {
      expect(Object.keys(row).sort()).toEqual(["details", "name"]);
      expect(row.name).toMatch(/^Farmers Market \d$/);
      expect(row.details).toBe("Stillwater");
    }
    const everything = JSON.stringify([card.content, card.caption, card.altText]);
    expect(everything).not.toMatch(/saturdays|lifeguards|free|·|\$/i);
  });

  it("exhaustive kinds are 'around the metro', curated kinds 'from our list'", () => {
    expect(KIND_COVERAGE.museum).toBe("exhaustive");
    expect(KIND_COVERAGE["dog-park"]).toBe("curated");
    expect(buildPlacesCard("2026-10-07", [], { places: fake("museum", 10) }).content).toMatchObject({
      variant: "family",
      header: "FIVE MUSEUMS AROUND THE METRO",
      cta: "MORE AT CITYPULSEMN.COM/PLACES",
    });
    expect(buildPlacesCard("2026-10-07", [], { places: fake("dog-park", 10) }).content).toMatchObject({
      variant: "family",
      header: "FIVE DOG PARKS FROM OUR LIST",
      cta: "MORE AT CITYPULSEMN.COM/PLACES",
    });
  });

  it("the kind's name is CARD_COPY.kindNames when set, else the registry plural", () => {
    expect(CARD_COPY.kindNames["indoor-playground"]).toBe("Indoor Playgrounds");
    expect(buildPlacesCard("2026-10-07", [], { places: fake("indoor-playground", 10) }).content!.header).toBe(
      "FIVE INDOOR PLAYGROUNDS FROM OUR LIST",
    );
    expect(CARD_COPY.kindNames["disc-golf"]).toBeUndefined();
    expect(buildPlacesCard("2026-10-07", [], { places: fake("disc-golf", 10) }).content!.header).toBe(
      "FIVE DISC GOLF COURSES FROM OUR LIST",
    );
  });

  it("drift guard: every kindNames key is a real kind", () => {
    for (const key of Object.keys(CARD_COPY.kindNames)) expect(Object.keys(KIND_META), key).toContain(key);
  });

  it("every real kind that can produce a card does, with the header its coverage calls for", () => {
    const kinds = [...new Set(producible.map((p) => p.kind))];
    // Eight kinds can card on any day of the year. With an 8-week rule that is
    // exactly enough for a card every week, and no more: lose one and the
    // winter weeks start skipping (the rotation test below would say so).
    for (const kind of ["playground", "park", "rink", "dog-park", "disc-golf", "nature-center", "museum", "indoor-playground"] as const) {
      const days = producible.filter((p) => p.kind === kind).length;
      expect(days, kind).toBe(everyDayOf2027.length);
    }
    // Seventeen gyms, seven businesses: under the floor, so it never cards.
    expect(kinds).not.toContain("trampoline-climbing");
    for (const { kind, card } of producible) {
      const plural = (CARD_COPY.kindNames[kind] || KIND_META[kind].plural).toUpperCase();
      expect(card.content!.header).toBe(
        KIND_COVERAGE[kind] === "curated" ? `FIVE ${plural} FROM OUR LIST` : `FIVE ${plural} AROUND THE METRO`,
      );
      expect(card.content!.cta).toBe("MORE AT CITYPULSEMN.COM/PLACES");
      expect(card.content!.variant).toBe("family");
      expect(card.content!.events).toHaveLength(5);
    }
  });

  // A place's own name may contain one of these words ("Big Top Playground")
  // without the card ranking anything, so names are taken out before scanning.
  const ownWords = (card: PlacesCard) =>
    card.content!.events.reduce((text, row) => text.replace(row.name.replace(/\s*[—–]\s*|\s+-\s+/g, ", "), ""), card.caption!);
  const RANKING = /\b(best|top|favou?rites?|must)\b/i;
  const COMPLETE = /^the\b|\bthe (five|only|complete|full)\b|\ball (of )?the\b|\bevery\b|\bfull (guide|list)\b/i;

  it("never ranks and never implies the list is complete — every header and caption, every kind", () => {
    expect(producible.length).toBeGreaterThan(1000);
    const seen = new Set<string>();
    for (const { card } of producible) {
      for (const text of [card.content!.header, card.content!.cta, ownWords(card)]) {
        if (seen.has(text)) continue;
        seen.add(text);
        expect(text).not.toMatch(RANKING);
        expect(text).not.toMatch(COMPLETE);
      }
    }
  });

  it("the copy itself and every kind name pass the same scan", () => {
    const strings = [
      CARD_COPY.headerExhaustive, CARD_COPY.headerCurated, CARD_COPY.cta,
      CARD_COPY.captionExhaustive, CARD_COPY.captionCurated,
      ...Object.values(CARD_COPY.kindNames),
      ...Object.values(KIND_META).map((m) => m.plural),
    ];
    for (const text of strings) {
      expect(text).not.toMatch(RANKING);
      expect(text).not.toMatch(COMPLETE);
    }
  });

  it("curated kinds say 'from our list' in the header AND the caption", () => {
    const curated = producible.filter((p) => KIND_COVERAGE[p.kind] === "curated");
    expect(curated.length).toBeGreaterThan(0);
    for (const { card } of curated) {
      expect(card.content!.header).toContain("FROM OUR LIST");
      expect(card.caption).toContain("from our list");
      expect(card.altText).toContain("from our list");
    }
  });
});

describe("caption", () => {
  it("golden: an exhaustive kind", () => {
    const places = fake("museum", 10, { city: "St. Paul" });
    const card = buildPlacesCard("2026-10-07", [], { places });
    const [a, b, c, d, e] = card.content!.events.map((row) => row.name);
    expect(card.caption).toBe(
      `Five museums around the metro this week. ${a} in St. Paul. ${b} in St. Paul. ${c} in St. Paul. ${d} in St. Paul. ${e} in St. Paul. ` +
        "Which ones have you been to? More at citypulsemn.com/places",
    );
  });

  it("golden: a curated kind, with a short name from CARD_COPY", () => {
    const card = buildPlacesCard("2026-10-07", [], { places: fake("indoor-playground", 10) });
    const [a, b, c, d, e] = card.content!.events.map((row) => row.name);
    expect(card.caption).toBe(
      `Five indoor playgrounds from our list this week. ${a} in Richfield. ${b} in Richfield. ${c} in Richfield. ${d} in Richfield. ${e} in Richfield. ` +
        "Which ones have you been to? More at citypulsemn.com/places",
    );
  });

  it("dashes inside a name become a comma in the caption; the card keeps the real name", () => {
    const names = ["Vertical Endeavors — St. Paul", "Bouldering Project – Minneapolis", "Conquer Ninja Gyms - Blaine", "Kid-Friendly Gym", "Half—Pipe Hall"];
    // Ten names, not five twice: a repeated name takes one row.
    const all = [...names, ...names.map((name) => `North ${name}`)];
    const places = all.map((name, i) => ({
      ...fake("trampoline-climbing", 1)[0],
      slug: `gym-${i}`,
      name,
      city: "Roseville",
    }));
    const card = buildPlacesCard("2026-10-07", [], { places });
    expect(captionProblems(card.caption!)).toEqual([]);
    expect(captionProblems(card.altText!)).toEqual([]);
    for (const row of card.content!.events) {
      expect(all).toContain(row.name); // untouched on the image
      const said = row.name.replace(/\s*[—–]\s*|\s+-\s+/g, ", ");
      expect(card.caption).toContain(`${said} in Roseville.`);
    }
  });

  it("a hyphen inside a word is not a dash and stays", () => {
    const places = fake("trampoline-climbing", 10).map((p, i) => ({ ...p, name: `Kid-Friendly Off-Leash Gym ${i}` }));
    expect(buildPlacesCard("2026-10-07", [], { places }).caption).toMatch(/Kid-Friendly Off-Leash Gym \d in Richfield\./);
  });

  it("does not repeat a city the name already says", () => {
    // {i} keeps the ten names distinct: a repeated name takes one row.
    const named = (pattern: string, city: string) =>
      fake("park", 10, { city }).map((p, i) => ({ ...p, name: pattern.replace("{i}", String(i)) }));
    expect(buildPlacesCard("2026-10-07", [], { places: named("Gym {i} — St. Paul", "St. Paul") }).caption).toMatch(
      /this week\. Gym \d, St\. Paul\. Gym \d, St\. Paul\. /,
    );
    expect(buildPlacesCard("2026-10-07", [], { places: named("Central Park Playground {i} (Roseville)", "Roseville") }).caption).toMatch(
      /this week\. Central Park Playground \d \(Roseville\)\. Central/,
    );
    expect(buildPlacesCard("2026-10-07", [], { places: named("Como Regional Park {i}", "St. Paul") }).caption).toMatch(
      /this week\. Como Regional Park \d in St\. Paul\. Como/,
    );
  });

  it("a '$' in a name is copied literally, not read as a replacement pattern", () => {
    const places = fake("park", 10).map((p, i) => ({ ...p, name: `Dollar $& Park $1 No${i}` }));
    expect(buildPlacesCard("2026-10-07", [], { places }).caption).toMatch(/Dollar \$& Park \$1 No\d in Richfield\./);
  });

  it("every producible caption keeps the reel policy, names its five with their cities, and ends on the places page", () => {
    for (const { kind, card } of producible) {
      expect(captionProblems(card.caption!), card.caption).toEqual([]);
      expect(card.caption).toMatch(/citypulsemn\.com\/places\.?$/);
      expect(card.caption).toMatch(/^Five /);
      for (const row of card.content!.events) {
        expect(card.caption, kind).toContain(row.name.replace(/\s*[—–]\s*|\s+-\s+/g, ", "));
        expect(card.caption, kind).toContain(row.details);
      }
    }
  });

  it("house voice: none of the banned phrases", () => {
    const banned = ["nestled", "vibrant", "hidden gem", "whether you're", "look no further", "in the heart of"];
    const copy = [CARD_COPY.captionExhaustive, CARD_COPY.captionCurated, CARD_COPY.headerExhaustive, CARD_COPY.headerCurated, CARD_COPY.cta];
    for (const text of [...copy, ...producible.map((p) => p.card.caption!)]) {
      for (const phrase of banned) expect(text.toLowerCase()).not.toContain(phrase);
    }
  });

  it("worst case: five copies of each kind's wordiest place still fit under 100 words", () => {
    for (const kind of seededKinds) {
      const ofKind = PLACES.filter((p) => p.kind === kind);
      const wordiest = ofKind.reduce((a, b) => (countWords(`${b.name} ${b.city}`) > countWords(`${a.name} ${a.city}`) ? b : a));
      // A leading digit makes ten distinct names without adding a word.
      const clones = Array.from({ length: 10 }, (_, i) => ({ ...wordiest, slug: `clone-${i}`, name: `${i}${wordiest.name}`, season: YEAR_ROUND }));
      const card = buildPlacesCard("2026-10-07", [], { places: clones });
      expect(card.status, kind).toBe("built");
      expect(countWords(card.caption!), `${kind}: ${card.caption}`).toBeLessThan(100);
    }
  });

  it("drift guard: no registry name or city carries a hashtag or emoji the caption would inherit", () => {
    for (const p of PLACES) {
      expect(`${p.name} ${p.city}`, p.slug).not.toMatch(/#/);
      expect(EMOJI_RE.test(`${p.name} ${p.city}`), p.slug).toBe(false);
    }
  });
});

describe("alt text", () => {
  it("golden: the header as a sentence, then the five with their cities", () => {
    const places = fake("dog-park", 10, { city: "Eagan" });
    const card = buildPlacesCard("2026-10-07", [], { places });
    const [a, b, c, d, e] = card.content!.events.map((row) => row.name);
    expect(card.altText).toBe(
      `Five dog parks from our list. ${a} in Eagan; ${b} in Eagan; ${c} in Eagan; ${d} in Eagan; ${e} in Eagan.`,
    );
  });

  it("every producible alt text names the five and stays within Instagram's 1000 characters", () => {
    for (const { card } of producible) {
      expect(card.altText!.length).toBeLessThanOrEqual(1000);
      expect(card.altText).toMatch(/^Five .+\. .+\.$/);
      for (const row of card.content!.events) {
        expect(card.altText).toContain(row.name.replace(/\s*[—–]\s*|\s+-\s+/g, ", "));
        expect(card.altText).toContain(row.details);
      }
    }
  });

  it("worst case: five copies of the registry's longest name still fit whole", () => {
    const longest = PLACES.reduce((a, b) => (b.name.length + b.city.length > a.name.length + a.city.length ? b : a));
    const clones = Array.from({ length: 10 }, (_, i) => ({ ...longest, slug: `clone-${i}`, name: `${i}${longest.name}`, season: YEAR_ROUND }));
    const alt = buildPlacesCard("2026-10-07", [], { places: clones }).altText!;
    expect(alt.length).toBeLessThan(1000);
    expect(alt.endsWith(".")).toBe(true);
  });

  it("is cut at 1000 characters if names ever outgrow it", () => {
    const places = fake("park", 10).map((p, i) => ({ ...p, name: `${i} ${"Park ".repeat(60).trim()}` }));
    expect(buildPlacesCard("2026-10-07", [], { places }).altText).toHaveLength(1000);
  });
});

describe("honest skip", () => {
  it("an empty registry skips with nothing considered", () => {
    const card = buildPlacesCard("2026-10-07", [], { places: [] });
    expect(card).toEqual({
      status: "skipped",
      reason: "no kind has 10 card-safe names outside the 8-week window (0 kinds: 0 short of 10 names, 0 used in the last 8 weeks; a name with several locations counts once)",
      considered: [],
    });
  });

  it("says what was short, and never pads a card", () => {
    const places = [
      ...fake("museum", 10),
      ...fake("park", 9),
      ...fake("beach", 30, { season: seasonal("Memorial Day–Labor Day") }),
    ];
    const card = buildPlacesCard("2026-10-07", [rec("museum", "2026-09-30")], { places });
    expect(card).toEqual({
      status: "skipped",
      reason: "no kind has 10 card-safe names outside the 8-week window (3 kinds: 2 short of 10 names, 1 used in the last 8 weeks; a name with several locations counts once)",
      considered: [
        { kind: "beach", eligible: 0, note: "out of season" },
        { kind: "park", eligible: 9, note: "below 10" },
        { kind: "museum", eligible: 10, note: "used 7 days ago" },
      ],
    });
    for (const key of ["kind", "content", "caption", "altText", "record"] as const) expect(card[key]).toBeUndefined();
  });
});

describe("record", () => {
  it("is the kind, the five slugs in card order, and the post date", () => {
    const places = fake("museum", 10);
    const card = buildPlacesCard("2026-10-07", [], { places });
    expect(card.record).toEqual({
      type: "places",
      kind: "museum",
      slugs: card.content!.events.map((row) => places.find((p) => p.name === row.name)!.slug),
      postDate: "2026-10-07",
    });
    expect(card.record!.slugs).toHaveLength(5);
  });

  it("the same inputs always build the same card", () => {
    const recent = [rec("orchard", "2026-09-30")];
    expect(buildPlacesCard("2026-10-07", recent)).toEqual(buildPlacesCard("2026-10-07", recent));
  });

  it("does not mutate the history it was given", () => {
    const recent = [rec("park", "2026-09-30"), rec("museum", "2026-09-23")];
    const before = JSON.stringify(recent);
    buildPlacesCard("2026-10-07", recent);
    expect(JSON.stringify(recent)).toBe(before);
  });
});

describe("two years of Wednesdays against the live registry", () => {
  const between = (r: PlacesCardRecord, from: string, to: string) => r.postDate.slice(5) >= from && r.postDate.slice(5) <= to;

  function simulate(
    history: (all: PlacesCardRecord[], postDate: string) => PlacesCardRecord[],
    start = "2026-10-07",
    weeks = 104,
  ) {
    const records: PlacesCardRecord[] = [];
    for (let week = 0; week < weeks; week++) {
      const postDate = addDays(start, 7 * week);
      expect(dow(postDate)).toBe(CARD_WEEKDAY);
      const card = buildPlacesCard(postDate, history(records, postDate));
      expect(card.status, `${postDate}: ${card.reason}`).toBe("built");
      expect(captionProblems(card.caption!), postDate).toEqual([]);
      expect(new Set(card.record!.slugs).size).toBe(5);
      for (const slug of card.record!.slugs) {
        const place = PLACES.find((p) => p.slug === slug)!;
        expect(place.kind).toBe(card.kind);
        expect(cardSafe(place, postDate), `${slug} on ${postDate}`).toBe(true);
      }
      records.push(card.record!);
    }
    return records;
  }

  function expectHonestRotation(records: PlacesCardRecord[], weeks = 104) {
    expect(records).toHaveLength(weeks);
    for (const r of records) {
      // One business, one row — judged by the names' opening words, not by the rule under test.
      const openings = r.slugs.map((s) => firstTwo(placeOf(s).name));
      const twice = openings.filter((o, i) => openings.indexOf(o) !== i && !DIFFERENT_PLACES_SAME_OPENING.has(`${r.kind}|${o}`));
      expect(twice, `${r.kind} on ${r.postDate}`).toEqual([]);
    }
    records.forEach((r, i) => {
      for (const earlier of records.slice(Math.max(0, i - 7), i)) {
        expect(earlier.kind, `${r.kind} on ${r.postDate} repeats ${earlier.postDate}`).not.toBe(r.kind);
      }
    });
    const water = records.filter((r) => r.kind === "beach" || r.kind === "splash-pad");
    expect(water.map((r) => r.kind)).toEqual(expect.arrayContaining(["beach", "splash-pad"]));
    for (const r of water) expect(between(r, "06-01", "08-31"), `${r.kind} on ${r.postDate}`).toBe(true);
    const orchards = records.filter((r) => r.kind === "orchard");
    expect(orchards.length).toBeGreaterThanOrEqual(2); // one each autumn
    for (const r of orchards) expect(between(r, "09-15", "10-25"), r.postDate).toBe(true);
    for (const r of records.filter((x) => x.kind === "sledding")) expect(between(r, "01-01", "02-14"), r.postDate).toBe(true);
    for (const r of records.filter((x) => x.kind === "golf-course")) expect(between(r, "05-01", "09-30"), r.postDate).toBe(true);
  }

  it("the whole history fed back: a card every week, no kind inside 8 weeks, water only in summer", () => {
    expectHonestRotation(simulate((all) => all));
  });

  // The generator reads every card folder, so this is how it really runs. The
  // first build's rotation looked clean for ten weeks and put three Sky Zones
  // on week eleven, and what week two held depended on the go-live Wednesday.
  it.each(["2026-10-07", "2026-10-14", "2026-10-21", "2026-10-28"])(
    "three years from a %s go-live: never one business twice, never a place straight back, never a gym card",
    (start) => {
      const records = simulate((all) => all, start, 157);
      expectHonestRotation(records, 157);
      const last = new Map<PlaceKind, PlacesCardRecord>();
      for (const r of records) {
        const before = last.get(r.kind);
        if (before) expect(r.slugs.filter((s) => before.slugs.includes(s)), `${r.kind} on ${r.postDate}`).toEqual([]);
        last.set(r.kind, r);
        for (const slug of r.slugs) expect(Object.keys(CARD_SAFE_BY_SLUG).filter((s) => s === slug && CARD_SAFE_BY_SLUG[s] === null)).toEqual([]);
      }
      expect(records.map((r) => r.kind)).not.toContain("trampoline-climbing");
      // Apple Valley Sports Arena only while its entry says there is ice.
      for (const r of records.filter((x) => x.slugs.includes("apple-valley-sports-arena"))) {
        expect(r.postDate.slice(5) >= "11-01" || r.postDate.slice(5) <= "03-10", r.postDate).toBe(true);
      }
    },
  );

  it("the same holds when only the last eight weeks of card folders are read", () => {
    expectHonestRotation(
      simulate((all, postDate) => all.filter((r) => Date.parse(postDate) - Date.parse(r.postDate) <= 56 * DAY_MS)),
    );
  });
});
