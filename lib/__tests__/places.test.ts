import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PLACES,
  KIND_META,
  placesByKind,
  placesByNeighborhood,
  placeBySlug,
  groupPlacesByKind,
  kindsWithPlaces,
  relatedKinds,
  KIND_THEMES,
  KIND_EVENT_COLLECTION,
  placeKindsForCollection,
  openNow,
  placesStaticMapUrl,
  placesSeasonBanner,
  placeOfTheWeek,
  PLACE_OF_WEEK_PIN,
  PLACES_MAP_MAX_PINS,
  filterPlaces,
  placeCities,
  placesByDistance,
  activeDetailKeys,
  PLACE_DETAIL_LABELS,
  NO_PLACE_FILTERS,
  type Place,
  type PlaceKind,
} from "../places";
import { neighborhoodByKey } from "../neighborhoods";
import { venuePageBySlug } from "../venue-pages";
import { getCollection } from "../collections";

const KINDS = new Set(Object.keys(KIND_META));
const JULY = new Date("2026-07-15T12:00:00Z");
const JANUARY = new Date("2026-01-15T12:00:00Z");

// Spread a real seed row to build a synthetic place for season-math tests.
const withSeason = (season: Place["season"]): Place => ({ ...PLACES[0], slug: "synthetic", season });

describe("places registry — drift guards (the honesty anchors)", () => {
  it("slugs are unique", () => {
    expect(new Set(PLACES.map((p) => p.slug)).size).toBe(PLACES.length);
  });

  it("every kind is a known kind with KIND_META", () => {
    for (const p of PLACES) expect(KINDS.has(p.kind)).toBe(true);
  });

  it("every non-null neighborhood key resolves against the registry", () => {
    for (const p of PLACES) {
      if (p.neighborhood !== null) {
        expect(neighborhoodByKey(p.neighborhood), `${p.slug} → ${p.neighborhood}`).not.toBeNull();
      }
    }
  });

  it("every non-null venueSlug resolves against the venue registry", () => {
    for (const p of PLACES) {
      if (p.venueSlug !== null) {
        expect(venuePageBySlug(p.venueSlug), `${p.slug} → ${p.venueSlug}`).not.toBeNull();
      }
    }
  });

  it("every entry has an https sourceUrl (the required honesty anchor)", () => {
    for (const p of PLACES) expect(p.sourceUrl, p.slug).toMatch(/^https:\/\/\S+$/);
  });

  it("every entry has a real verifiedAt date", () => {
    for (const p of PLACES) {
      expect(p.verifiedAt, p.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(p.verifiedAt)), p.slug).toBe(false);
    }
  });

  it("intros are present and house-voice length (no stubs, no essays)", () => {
    for (const p of PLACES) {
      expect(p.intro.length, p.slug).toBeGreaterThanOrEqual(20);
      expect(p.intro.length, p.slug).toBeLessThanOrEqual(300);
    }
  });

  it("intros avoid the banned brochure words", () => {
    const banned = /\b(nestled|vibrant|hidden gem|look no further)\b|in the heart of|whether you'?re/i;
    for (const p of PLACES) expect(banned.test(p.intro), `${p.slug}: "${p.intro}"`).toBe(false);
  });

  it("seasonal windows use real month numbers", () => {
    for (const p of PLACES) {
      if (p.season.type === "seasonal") {
        expect(p.season.openMonth, p.slug).toBeGreaterThanOrEqual(1);
        expect(p.season.openMonth, p.slug).toBeLessThanOrEqual(12);
        expect(p.season.closeMonth, p.slug).toBeGreaterThanOrEqual(1);
        expect(p.season.closeMonth, p.slug).toBeLessThanOrEqual(12);
        expect(p.season.label.length, p.slug).toBeGreaterThan(0);
      }
    }
  });

  it("coordinates land inside the Twin Cities metro (catches a transposed lat/lng)", () => {
    // A generous 7-county-metro box — wide enough for the far suburbs (Lakeville
    // to the south, Coon Rapids to the north) but still catches a swapped or
    // garbage lat/lng.
    for (const p of PLACES) {
      expect(p.lat, p.slug).toBeGreaterThan(44.5);
      expect(p.lat, p.slug).toBeLessThan(45.4);
      expect(p.lng, p.slug).toBeGreaterThan(-94.0);
      expect(p.lng, p.slug).toBeLessThan(-92.6);
    }
  });

  it("cost is a valid tier", () => {
    for (const p of PLACES) expect(["free", "paid", "donation"]).toContain(p.cost);
  });
});

describe("openNow — season math in the Chicago frame", () => {
  it("year-round places are always open", () => {
    const p = withSeason({ type: "year-round" });
    expect(openNow(p, JULY)).toBe(true);
    expect(openNow(p, JANUARY)).toBe(true);
  });

  it("a summer place is open in July, closed in January", () => {
    const p = withSeason({ type: "seasonal", openMonth: 5, closeMonth: 9, label: "Memorial Day–Labor Day" });
    expect(openNow(p, JULY)).toBe(true);
    expect(openNow(p, JANUARY)).toBe(false);
  });

  it("respects the season boundaries (May open, October closed)", () => {
    const p = withSeason({ type: "seasonal", openMonth: 5, closeMonth: 9, label: "summer" });
    expect(openNow(p, new Date("2026-05-15T12:00:00Z"))).toBe(true);
    expect(openNow(p, new Date("2026-09-15T12:00:00Z"))).toBe(true);
    expect(openNow(p, new Date("2026-04-15T12:00:00Z"))).toBe(false);
    expect(openNow(p, new Date("2026-10-15T12:00:00Z"))).toBe(false);
  });

  it("a winter season wraps the new year (a Dec–Feb rink): open Jan, closed July", () => {
    const p = withSeason({ type: "seasonal", openMonth: 12, closeMonth: 2, label: "winter" });
    expect(openNow(p, JANUARY)).toBe(true);
    expect(openNow(p, new Date("2026-12-15T12:00:00Z"))).toBe(true);
    expect(openNow(p, JULY)).toBe(false);
  });
});

describe("selectors", () => {
  it("placesByKind returns only that kind, free-first then alphabetical", () => {
    const beaches = placesByKind("beach");
    expect(beaches.length).toBeGreaterThan(0);
    expect(beaches.every((p) => p.kind === "beach")).toBe(true);
    // Free entries first (a paid swim pond exists in the set), then alphabetical
    // within each cost group.
    const rank = { free: 0, donation: 1, paid: 2 } as const;
    const ranks = beaches.map((p) => rank[p.cost]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b)); // non-decreasing cost rank
    const freeNames = beaches.filter((p) => p.cost === "free").map((p) => p.name);
    expect(freeNames).toEqual([...freeNames].sort((a, b) => a.localeCompare(b)));
    expect(beaches.some((p) => p.cost === "paid")).toBe(true); // the sort is actually exercised
  });

  it("an unseeded kind returns an empty list (honest emptiness)", () => {
    expect(placesByKind("music-venue" as PlaceKind)).toEqual([]);
  });

  it("placesByNeighborhood finds the in-district places and no suburb/null ones", () => {
    const swl = placesByNeighborhood("southwest-lakes");
    expect(swl.length).toBeGreaterThanOrEqual(2);
    expect(swl.every((p) => p.neighborhood === "southwest-lakes")).toBe(true);
    expect(swl.some((p) => p.slug === "lake-harriet-north-beach")).toBe(true);
    expect(placesByNeighborhood("nonexistent-key")).toEqual([]);
  });

  it("placeBySlug resolves a known slug and null for unknown", () => {
    expect(placeBySlug("phalen-regional-park-beach")?.city).toBe("St. Paul");
    expect(placeBySlug("not-a-place")).toBeNull();
  });

  it("kindsWithPlaces lists only seeded kinds, with counts and open state", () => {
    const kinds = kindsWithPlaces(JULY);
    const bySlug = Object.fromEntries(kinds.map((k) => [k.meta.kind, k]));
    expect(Object.keys(bySlug).sort()).toEqual(["beach", "disc-golf", "dog-park", "farmers-market", "garden", "golf-course", "indoor-playground", "museum", "nature-center", "orchard", "park", "playground", "pool", "rink", "ski-hill", "sledding", "splash-pad", "trampoline-climbing"]);
    expect(bySlug["beach"].count).toBe(placesByKind("beach").length);
    expect(bySlug["beach"].open).toBe(true); // July → summer beaches open
    // In January the same kinds still list (page persists year-round) but closed.
    const winter = Object.fromEntries(kindsWithPlaces(JANUARY).map((k) => [k.meta.kind, k]));
    expect(winter["beach"].open).toBe(false);
  });
});

describe("KIND_THEMES + relatedKinds — the cross-linking mesh (Tier 1.2)", () => {
  it("every theme references only known kinds", () => {
    for (const t of KIND_THEMES) {
      expect(t.kinds.length, t.key).toBeGreaterThan(0);
      for (const k of t.kinds) expect(KINDS.has(k), `${t.key} → ${k}`).toBe(true);
    }
  });

  it("every seeded kind appears in at least one theme (no dead-end leaf page)", () => {
    const themed = new Set(KIND_THEMES.flatMap((t) => t.kinds));
    for (const { meta } of kindsWithPlaces(JULY)) {
      expect(themed.has(meta.kind), `${meta.kind} is in no theme`).toBe(true);
    }
  });

  it("relatedKinds excludes self + empty kinds and returns valid, non-empty siblings", () => {
    for (const { meta } of kindsWithPlaces(JULY)) {
      const rel = relatedKinds(meta.kind);
      expect(rel, meta.kind).not.toContain(meta.kind);
      expect(new Set(rel).size, `${meta.kind} has duplicate related`).toBe(rel.length);
      for (const r of rel) {
        expect(KINDS.has(r), `${meta.kind} → ${r}`).toBe(true);
        expect(placesByKind(r).length, `${meta.kind} → empty ${r}`).toBeGreaterThan(0);
      }
      expect(rel.length, `${meta.kind} has no related guides`).toBeGreaterThan(0);
    }
  });
});

describe("KIND_EVENT_COLLECTION — the Places↔events bridge (Tier 1.2)", () => {
  it("maps only known kinds", () => {
    for (const k of Object.keys(KIND_EVENT_COLLECTION)) {
      expect(KINDS.has(k), k).toBe(true);
    }
  });

  it("every mapped slug resolves to a real collection", () => {
    for (const [k, slug] of Object.entries(KIND_EVENT_COLLECTION)) {
      expect(getCollection(slug as string), `${k} → ${slug}`).toBeDefined();
    }
  });

  it("placeKindsForCollection inverts the map, filters empties, agrees forward", () => {
    // festivals-and-markets ← farmers-market + orchard (both seeded)
    const fm = placeKindsForCollection("festivals-and-markets");
    expect(fm).toContain("farmers-market");
    expect(fm).toContain("orchard");
    for (const k of fm) expect(placesByKind(k).length).toBeGreaterThan(0);
    // live-music maps only the unseeded music-venue → empty (honest, no dead link)
    expect(placeKindsForCollection("live-music")).toEqual([]);
    // a collection with no mapped kinds → empty
    expect(placeKindsForCollection("date-night")).toEqual([]);
    // round-trip: every non-empty forward mapping shows up in the inverse
    for (const [k, slug] of Object.entries(KIND_EVENT_COLLECTION)) {
      if (placesByKind(k as PlaceKind).length > 0) {
        expect(placeKindsForCollection(slug as string), `${slug} ← ${k}`).toContain(k);
      }
    }
  });
});

describe("placesStaticMapUrl — numbered pins that match the list", () => {
  const token = "pk.test";

  it("emits gold pins numbered 1..N in list order", () => {
    const url = placesStaticMapUrl(placesByKind("beach"), token)!;
    const beaches = placesByKind("beach");
    // one pin per place, numbered by position, auto-fit — but only up to the
    // pin cap (the static builder is now unused: the interactive clustered map
    // carries the full set. Beaches passed 30 once the exhaustive sweep landed.)
    for (let i = 0; i < Math.min(beaches.length, PLACES_MAP_MAX_PINS); i++) {
      expect(url).toContain(`pin-l-${i + 1}+c9a961(${beaches[i].lng},${beaches[i].lat})`);
    }
    expect(url).toContain("/auto/");
    expect(url).toContain("access_token=pk.test");
  });

  it("null without a token or without places (honest emptiness)", () => {
    expect(placesStaticMapUrl(placesByKind("beach"), undefined)).toBeNull();
    expect(placesStaticMapUrl([], token)).toBeNull();
  });

  it("caps pin count so the URL can't blow past Mapbox's length limit", () => {
    const many = Array.from({ length: PLACES_MAP_MAX_PINS + 10 }, () => ({ lat: 44.98, lng: -93.26 }));
    const url = placesStaticMapUrl(many, token)!;
    expect((url.match(/pin-l-/g) ?? []).length).toBe(PLACES_MAP_MAX_PINS);
    expect(url).toContain(`pin-l-${PLACES_MAP_MAX_PINS}+`);
    expect(url).not.toContain(`pin-l-${PLACES_MAP_MAX_PINS + 1}+`);
  });
});

describe("placesSeasonBanner — closed-season honesty", () => {
  it("no banner when something's open (summer)", () => {
    expect(placesSeasonBanner(placesByKind("beach"), JULY)).toBeNull();
  });
  it("a plain closed banner off-season, naming the reopen point", () => {
    const banner = placesSeasonBanner(placesByKind("beach"), JANUARY);
    expect(banner).toContain("Closed for the season");
    expect(banner).toContain("Memorial Day");
  });
  it("no banner for an empty list", () => {
    expect(placesSeasonBanner([], JANUARY)).toBeNull();
  });
});

describe("kind page + components wiring (tripwires)", () => {
  const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

  it("the kind page 404s on an unknown/empty kind and is statically generated", () => {
    const src = read("app/places/[kind]/page.tsx");
    expect(src).toContain("notFound()");
    expect(src).toContain("generateStaticParams");
    expect(src).toContain("export const revalidate");
  });

  it("PlacesMap uses the numbered-pin builder; PlacesList numbers by position", () => {
    expect(read("components/PlacesMap.tsx")).toContain("placesStaticMapUrl");
    expect(read("components/PlacesList.tsx")).toContain("{i + 1}");
  });

  it("the index and kind pages set a canonical", () => {
    expect(read("app/places/page.tsx")).toContain('canonical: "/places"');
    expect(read("app/places/[kind]/page.tsx")).toContain("canonical: path");
  });
});

describe("pools (P2.1 kind)", () => {
  const pools = placesByKind("pool");

  it("the pool seed exists and is free-first (Webber's free natural pool leads)", () => {
    expect(pools.length).toBeGreaterThanOrEqual(10);
    expect(pools[0].cost).toBe("free");
    expect(pools[0].slug).toBe("webber-natural-swimming-pool");
    expect(pools.some((p) => p.cost === "paid")).toBe(true);
  });

  it("carries a season mix — summer, year-round, and an off-season (winter-wrap) pool", () => {
    const seasons = pools.map((p) => p.season.type);
    expect(seasons).toContain("year-round"); // the indoor community-center pools
    expect(seasons).toContain("seasonal");
    // the St. Paul indoor park runs Sept–May (openMonth > closeMonth = wraps)
    const gr = pools.find((p) => p.slug === "great-river-water-park")!;
    expect(gr.season.type).toBe("seasonal");
    if (gr.season.type === "seasonal") expect(gr.season.openMonth).toBeGreaterThan(gr.season.closeMonth);
  });

  it("the off-season pool reads closed in summer, open in winter (openNow wrap)", () => {
    const gr = placeBySlug("great-river-water-park")!;
    expect(openNow(gr, JULY)).toBe(false); // closed for summer
    expect(openNow(gr, JANUARY)).toBe(true); // open in the school year
  });
});

describe("winter kinds (P2.1 rinks + sledding)", () => {
  it("sledding hills all run the winter season — closed in summer, open in winter", () => {
    const sled = placesByKind("sledding");
    expect(sled.length).toBeGreaterThan(0);
    for (const p of sled) {
      expect(openNow(p, JULY), p.slug).toBe(false); // off-season now
      expect(openNow(p, JANUARY), p.slug).toBe(true); // open in winter (wrap)
    }
  });

  it("the sledding page shows a closed-season banner off-season, none in winter", () => {
    const sled = placesByKind("sledding");
    expect(placesSeasonBanner(sled, JULY)).toContain("Closed for the season");
    expect(placesSeasonBanner(sled, JANUARY)).toBeNull();
  });

  it("rinks mix winter-outdoor and year-round-indoor (Parade stays open in summer)", () => {
    const parade = placeBySlug("parade-ice-garden")!;
    expect(parade.season.type).toBe("year-round");
    expect(openNow(parade, JULY)).toBe(true); // indoor, open all year
    const oval = placeBySlug("john-rose-minnesota-oval")!;
    expect(openNow(oval, JULY)).toBe(false); // outdoor, closed in summer
  });
});

describe("groupPlacesByKind (P2.2 neighborhood strip)", () => {
  it("groups a neighborhood's places by kind, in KIND_META order, non-empty only", () => {
    const swl = placesByNeighborhood("southwest-lakes"); // all beaches
    const groups = groupPlacesByKind(swl);
    expect(groups.length).toBe(1);
    expect(groups[0].meta.kind).toBe("beach");
    expect(groups[0].places.length).toBe(swl.length);
  });

  it("keeps kinds in KIND_META order and drops empties", () => {
    const mixed = [placeBySlug("phelps-field-splash-pad")!, placeBySlug("lake-harriet-north-beach")!];
    const groups = groupPlacesByKind(mixed);
    // beach is declared before splash-pad in KIND_META
    expect(groups.map((g) => g.meta.kind)).toEqual(["beach", "splash-pad"]);
  });

  it("empty in → empty out (honest emptiness)", () => {
    expect(groupPlacesByKind([])).toEqual([]);
  });
});

describe("P2.2 wire-in (tripwires)", () => {
  const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

  it("the neighborhood page renders the Places strip", () => {
    expect(read("app/neighborhoods/[slug]/page.tsx")).toContain("<NeighborhoodPlaces");
  });

  it("the strip links each place into its kind page and honours emptiness", () => {
    const src = read("components/NeighborhoodPlaces.tsx");
    expect(src).toContain("placesByNeighborhood");
    expect(src).toContain("groupPlacesByKind");
    expect(src).toContain("/places/${p.kind}#${p.slug}");
    expect(src).toContain("if (places.length === 0) return null");
  });
});

describe("P2.3 venue bridge (tripwire)", () => {
  const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

  it("the Places index cross-links to the existing /venues (no duplicate page)", () => {
    // The venue registry is all-venues and /venues already lists them, so Places
    // points there instead of shipping a second, mislabeled venue list.
    expect(read("app/places/page.tsx")).toContain('href="/venues"');
  });
});

describe("P1.3 wire-in (tripwires)", () => {
  const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

  it("Places is in the shared nav and the footer", () => {
    expect(read("lib/nav-sections.ts")).toContain('href: "/places"');
    expect(read("components/SiteFooter.tsx")).toContain('href="/places"');
  });

  it("index + kind OG image routes use the shared OgCard shell", () => {
    expect(read("app/places/opengraph-image.tsx")).toContain("OgCard");
    expect(read("app/places/[kind]/opengraph-image.tsx")).toContain("OgCard");
  });
});

describe("placeOfTheWeek (v6 1.3 — digest depth)", () => {
  it("ships with automatic rotation (no manual pin) by default", () => {
    expect(PLACE_OF_WEEK_PIN).toBeNull();
  });

  it("always returns a real registry place while the registry is non-empty", () => {
    for (const now of [JULY, JANUARY, new Date("2026-04-15T12:00:00Z"), new Date("2026-11-15T12:00:00Z")]) {
      const p = placeOfTheWeek(now);
      expect(p, now.toISOString()).not.toBeNull();
      expect(PLACES).toContain(p);
    }
  });

  it("only ever features a place that is OPEN this week (never a closed one)", () => {
    for (const now of [JULY, JANUARY, new Date("2026-03-01T12:00:00Z"), new Date("2026-09-20T12:00:00Z")]) {
      const p = placeOfTheWeek(now)!;
      expect(openNow(p, now), `${p.slug} on ${now.toISOString()}`).toBe(true);
    }
  });

  it("prefers a seasonally in-season place when any is open (a summer spot in July, winter in January)", () => {
    // In deep summer and deep winter the metro always has an actively-seasonal
    // open kind, so the pick should be a 'seasonal' entry, not an evergreen.
    for (const now of [JULY, JANUARY]) {
      const p = placeOfTheWeek(now)!;
      expect(p.season.type, `${p.slug} on ${now.toISOString()}`).toBe("seasonal");
    }
  });

  it("is deterministic — the same week yields the same place", () => {
    // Same Chicago week (Thu→Wed) ⇒ identical pick regardless of the day/time.
    const a = placeOfTheWeek(new Date("2026-07-13T09:00:00-05:00")); // Mon
    const b = placeOfTheWeek(new Date("2026-07-15T23:30:00-05:00")); // Wed same wk
    expect(a).toBe(b);
  });

  it("rotates across weeks (not the same place every send)", () => {
    const picks = new Set<string>();
    for (let w = 0; w < 8; w++) {
      const now = new Date(JULY.getTime() + w * 7 * 86_400_000);
      picks.add(placeOfTheWeek(now)!.slug);
    }
    expect(picks.size).toBeGreaterThan(1);
  });
});

describe("filterPlaces + placeCities (P4.3 kind-page filters)", () => {
  const base = PLACES[0];
  const mk = (over: Partial<Place>): Place => ({ ...base, ...over });
  const SUMMER: Place["season"] = { type: "seasonal", openMonth: 5, closeMonth: 9, label: "summer" };
  const WINTER: Place["season"] = { type: "seasonal", openMonth: 12, closeMonth: 2, label: "winter" };

  const set: Place[] = [
    mk({ slug: "a", cost: "free", city: "Minneapolis", season: { type: "year-round" } }),
    mk({ slug: "b", cost: "paid", city: "St. Paul", season: SUMMER }),
    mk({ slug: "c", cost: "donation", city: "Minneapolis", season: WINTER }),
    mk({ slug: "d", cost: "free", city: "Edina", season: SUMMER }),
  ];

  it("NO_PLACE_FILTERS returns everything unchanged", () => {
    expect(filterPlaces(set, NO_PLACE_FILTERS, JULY).map((p) => p.slug)).toEqual(["a", "b", "c", "d"]);
  });

  it('cost "free" is strict — excludes paid AND donation', () => {
    expect(filterPlaces(set, { ...NO_PLACE_FILTERS, cost: "free" }, JULY).map((p) => p.slug)).toEqual(["a", "d"]);
  });

  it('cost "paid" matches only paid', () => {
    expect(filterPlaces(set, { ...NO_PLACE_FILTERS, cost: "paid" }, JULY).map((p) => p.slug)).toEqual(["b"]);
  });

  it("openNow uses the season in the Chicago frame (July drops the winter place)", () => {
    const julyOpen = filterPlaces(set, { ...NO_PLACE_FILTERS, openNow: true }, JULY).map((p) => p.slug);
    expect(julyOpen).toEqual(["a", "b", "d"]); // year-round + both summer; winter 'c' closed
    const janOpen = filterPlaces(set, { ...NO_PLACE_FILTERS, openNow: true }, JANUARY).map((p) => p.slug);
    expect(janOpen).toEqual(["a", "c"]); // year-round + winter; summer 'b'/'d' closed
  });

  it("city filter matches exactly", () => {
    expect(filterPlaces(set, { ...NO_PLACE_FILTERS, city: "Minneapolis" }, JULY).map((p) => p.slug)).toEqual(["a", "c"]);
  });

  it("axes are AND (free + Minneapolis + open in July)", () => {
    const out = filterPlaces(set, { ...NO_PLACE_FILTERS, cost: "free", openNow: true, city: "Minneapolis" }, JULY);
    expect(out.map((p) => p.slug)).toEqual(["a"]); // 'd' is Edina, 'c' is donation+winter
  });

  it("honest emptiness: over-constrained filters return []", () => {
    expect(filterPlaces(set, { ...NO_PLACE_FILTERS, cost: "paid", openNow: true, city: "Edina" }, JULY)).toEqual([]);
  });

  it("placeCities lists distinct cities, alphabetical", () => {
    expect(placeCities(set)).toEqual(["Edina", "Minneapolis", "St. Paul"]);
  });
});

describe("P4.3 wire-in (tripwire)", () => {
  const read = (...p: string[]) => readFileSync(join(__dirname, "..", "..", ...p), "utf8");

  it("the kind page renders the filterable browser, not the bare list", () => {
    const src = read("app", "places", "[kind]", "page.tsx");
    expect(src).toContain("PlacesBrowser");
    expect(src).not.toMatch(/<PlacesList\b/); // the list now lives inside PlacesBrowser
  });

  it("the map now lives inside the browser and is fed the FILTERED set (reacts)", () => {
    const page = read("app", "places", "[kind]", "page.tsx");
    expect(page).not.toContain("PlacesMapInteractive"); // moved out of the page
    const browser = read("components", "PlacesBrowser.tsx");
    expect(browser).toContain("PlacesMapInteractive");
    expect(browser).toMatch(/visible=\{filtered\}/); // the map gets the filtered set, not all
  });

  it("the map updates in place (setData) rather than remounting on filter change", () => {
    const map = read("components", "PlacesMapInteractive.tsx");
    expect(map).toContain('getSource("places").setData'); // in-place update, no teardown
    expect(map).toContain("placesBounds"); // refits to the visible set
  });
});

describe("placesByDistance (Near me — P4.3 follow-up)", () => {
  const base = PLACES[0];
  const at = (slug: string, lat: number, lng: number): Place => ({ ...base, slug, lat, lng });
  // Downtown Minneapolis-ish origin.
  const ORIGIN = { lat: 44.9778, lng: -93.265 };

  const set: Place[] = [
    at("far", 45.2, -93.0), // NE suburb, farthest
    at("near", 44.98, -93.27), // ~downtown, nearest
    at("mid", 44.9, -93.2), // south, middle
  ];

  it("ranks nearest-first with distance in miles attached", () => {
    const ranked = placesByDistance(set, ORIGIN);
    expect(ranked.map((r) => r.place.slug)).toEqual(["near", "mid", "far"]);
    // strictly increasing distances
    expect(ranked[0].miles).toBeLessThan(ranked[1].miles);
    expect(ranked[1].miles).toBeLessThan(ranked[2].miles);
    // the nearest is well under a mile from an almost-coincident origin
    expect(ranked[0].miles).toBeLessThan(1);
  });

  it("miles are a real distance, not meters (sanity on the unit conversion)", () => {
    // ~1 degree of latitude ≈ 69 miles.
    const [r] = placesByDistance([at("x", 45.9778, -93.265)], ORIGIN);
    expect(r.miles).toBeGreaterThan(65);
    expect(r.miles).toBeLessThan(72);
  });

  it("does not mutate the input array", () => {
    const input = [...set];
    const snapshot = input.map((p) => p.slug);
    placesByDistance(input, ORIGIN);
    expect(input.map((p) => p.slug)).toEqual(snapshot);
  });
});

describe("place details — the winning-detail moat (drift guards)", () => {
  const KNOWN = new Set(Object.keys(PLACE_DETAIL_LABELS));

  it("every entry's details use only labeled keys with boolean values (never invented)", () => {
    for (const p of PLACES) {
      if (!p.details) continue;
      for (const [k, v] of Object.entries(p.details)) {
        expect(KNOWN.has(k), `${p.slug}: unlabeled detail key "${k}"`).toBe(true);
        expect(typeof v, `${p.slug}.${k}`).toBe("boolean");
      }
    }
  });

  it("ski hills each carry at least one verified detail (the moat is populated)", () => {
    for (const p of placesByKind("ski-hill")) {
      expect(p.details, `${p.slug} missing details`).toBeDefined();
      const anyTrue = Object.values(p.details ?? {}).some((v) => v === true);
      expect(anyTrue, `${p.slug} has no true detail`).toBe(true);
    }
  });
});

describe("rink indoor badge (winning detail — moat, kind 2)", () => {
  const rinks = placesByKind("rink");

  it("exactly the year-round refrigerated arenas are badged indoor", () => {
    const indoor = rinks.filter((p) => p.details?.indoor === true).map((p) => p.slug).sort();
    expect(indoor).toEqual(
      ["bloomington-ice-garden", "braemar-arena", "parade-ice-garden", "schwan-super-rink", "tria-rink"].sort(),
    );
  });

  it("no seasonal (outdoor) rink is mislabeled indoor — honesty", () => {
    for (const p of rinks) {
      if (p.season.type !== "year-round") {
        expect(p.details?.indoor, `${p.slug} is seasonal but claims indoor`).not.toBe(true);
      }
    }
  });
});

describe("rink warming-house badge (winning detail — verified, universal)", () => {
  const rinks = placesByKind("rink");
  const withWH = rinks.filter((p) => p.details?.warmingHouse === true);

  it("all 22 outdoor rinks carry a verified warming house", () => {
    expect(withWH.length).toBe(22);
  });

  it("never on an enclosed indoor arena — a warming house is an outdoor-rink amenity", () => {
    expect(withWH.every((p) => p.season.type !== "year-round")).toBe(true);
    // and the 5 indoor arenas never claim one
    for (const p of rinks) {
      if (p.season.type === "year-round") expect(p.details?.warmingHouse, p.slug).not.toBe(true);
    }
  });
});

describe("splash-pad amenities (winning detail — moat, kind 4; source-verified)", () => {
  const pads = placesByKind("splash-pad");
  const withPlay = pads.filter((p) => p.details?.adjacentPlayground === true);
  const withRest = pads.filter((p) => p.details?.restrooms === true);

  it("exactly the source-confirmed pads carry each fact (locks the verified counts)", () => {
    expect(pads.length).toBe(49);
    expect(withPlay.length).toBe(43); // 6 unconfirmed → honestly no badge
    expect(withRest.length).toBe(39); // 10 unconfirmed → honestly no badge
  });

  it("splash-pad details use ONLY the two family facts — no ski/rink keys leaked in", () => {
    const allowed = new Set(["adjacentPlayground", "restrooms"]);
    for (const p of pads) {
      for (const k of Object.keys(p.details ?? {})) {
        expect(allowed.has(k), `${p.slug}: unexpected detail "${k}"`).toBe(true);
      }
    }
  });

  it("honest emptiness: a pad with neither fact confirmed carries no details at all", () => {
    // Cologne + Ramsey Waterfront: sources couldn't confirm either amenity.
    for (const slug of ["cologne-city-square-splash-pad", "ramsey-waterfront-splash-pad"]) {
      const p = pads.find((x) => x.slug === slug);
      expect(p, slug).toBeDefined();
      expect(p!.details, `${slug} should have no badges`).toBeUndefined();
    }
  });

  it("the two audited restrooms tags were resolved honestly (drop vs promote)", () => {
    // Both carried a hand 'restrooms' tag. On re-check: Conway's official page is
    // silent (a listing even says none) → tag DROPPED, no badge. Boulevard's
    // official facilities page explicitly lists Restrooms → PROMOTED to a badge.
    const conway = pads.find((x) => x.slug === "conway-park-splash-pad")!;
    expect(conway.tags).not.toContain("restrooms"); // unconfirmed → dropped
    expect(conway.details?.restrooms).not.toBe(true); // and never badged

    const boulevard = pads.find((x) => x.slug === "boulevard-plaza-splash-pad")!;
    expect(boulevard.details?.restrooms).toBe(true); // official source confirmed
    expect(boulevard.sourceUrl).toContain("facilities/facility/details"); // cites the page that lists it
  });

  it("the filter surfaces both facts and is strict", () => {
    expect(activeDetailKeys(pads)).toEqual(["adjacentPlayground", "restrooms"]);
    const play = filterPlaces(pads, { ...NO_PLACE_FILTERS, details: ["adjacentPlayground"] }, JULY);
    expect(play.length).toBe(43);
    expect(play.every((p) => p.details?.adjacentPlayground === true)).toBe(true);
  });
});

describe("pool features (winning detail — moat, kind 5; source-verified)", () => {
  const pools = placesByKind("pool");

  it("locks the source-confirmed counts (indoor reuses the shared field)", () => {
    expect(pools.length).toBe(25);
    expect(pools.filter((p) => p.details?.waterSlide === true).length).toBe(22);
    expect(pools.filter((p) => p.details?.zeroDepth === true).length).toBe(20);
    expect(pools.filter((p) => p.details?.indoor === true).length).toBe(6);
  });

  it("offers exactly indoor / water slide / zero-depth as filters", () => {
    expect(activeDetailKeys(pools)).toEqual(["indoor", "waterSlide", "zeroDepth"]);
  });

  it("honest emptiness: the unverifiable Eagan CC pool carries no badges", () => {
    // Its official page lists no pool at all — nothing to assert.
    const eagan = pools.find((p) => p.slug === "eagan-community-center-pool");
    expect(eagan?.details).toBeUndefined();
  });

  it("pool details use only aquatic facts — no dog/ski keys leaked in", () => {
    const allowed = new Set(["indoor", "waterSlide", "zeroDepth"]);
    for (const p of pools) {
      for (const k of Object.keys(p.details ?? {})) {
        expect(allowed.has(k), `${p.slug}: unexpected pool detail "${k}"`).toBe(true);
      }
    }
  });
});

describe("dog-park features (winning detail — moat, kind 6; safety-strict)", () => {
  const parks = placesByKind("dog-park");

  it("locks the source-confirmed counts", () => {
    expect(parks.length).toBe(58);
    expect(parks.filter((p) => p.details?.fenced === true).length).toBe(45);
    expect(parks.filter((p) => p.details?.smallDogArea === true).length).toBe(31);
  });

  it("fenced is a strict safety claim — big unfenced trail areas never carry it", () => {
    // Crow-Hassan (40-acre unfenced), Meeker Island (explicitly 'no fence').
    for (const slug of ["crow-hassan-dog-off-leash-area", "meeker-island-off-leash-dog-park"]) {
      const p = parks.find((x) => x.slug === slug);
      expect(p?.details?.fenced, `${slug} is unfenced`).not.toBe(true);
    }
  });

  it("audit fix: a park mistagged 'unfenced' but officially enclosed now reads fenced", () => {
    const arlington = parks.find((p) => p.slug === "arlington-arkwright-off-leash-dog-area");
    expect(arlington?.details?.fenced).toBe(true); // stpaul.gov: 'completely enclosed'
  });

  it("dog-park details use only fenced / small-dog-area", () => {
    const allowed = new Set(["fenced", "smallDogArea"]);
    for (const p of parks) {
      for (const k of Object.keys(p.details ?? {})) {
        expect(allowed.has(k), `${p.slug}: unexpected dog-park detail "${k}"`).toBe(true);
      }
    }
  });
});

describe("playground features (winning detail — moat, kind 7; fenced is rare+strict)", () => {
  const playgrounds = placesByKind("playground");

  it("locks the counts — fenced is rare (only the one that's actually enclosed)", () => {
    expect(playgrounds.length).toBe(15);
    expect(playgrounds.filter((p) => p.details?.fenced === true).length).toBe(1);
    expect(playgrounds.filter((p) => p.details?.restrooms === true).length).toBe(10);
  });

  it("the single fenced playground is the one a source confirms enclosed", () => {
    const fenced = playgrounds.filter((p) => p.details?.fenced === true).map((p) => p.slug);
    expect(fenced).toEqual(["teddy-bear-park-playground"]);
  });

  it("offers fenced / restrooms as filters (fenced first)", () => {
    expect(activeDetailKeys(playgrounds)).toEqual(["fenced", "restrooms"]);
  });
});

describe("orchard features (winning detail — moat, kind 8; fall outing)", () => {
  const orchards = placesByKind("orchard");

  it("locks the source-confirmed counts", () => {
    expect(orchards.length).toBe(12);
    expect(orchards.filter((p) => p.details?.uPick === true).length).toBe(7);
    expect(orchards.filter((p) => p.details?.ciderDonuts === true).length).toBe(5);
    expect(orchards.filter((p) => p.details?.pumpkinPatch === true).length).toBe(10);
    expect(orchards.filter((p) => p.details?.cornMaze === true).length).toBe(7);
  });

  it("u-pick is strict — a pre-picked/farm-stand-only orchard never claims it", () => {
    // Pine Tree + Sweetland sell apples pre-picked from the barn, not u-pick.
    for (const slug of ["pine-tree-apple-orchard", "sweetland-orchard"]) {
      const p = orchards.find((x) => x.slug === slug);
      expect(p?.details?.uPick, `${slug} is pre-picked`).not.toBe(true);
    }
  });

  it("offers the four fall facts as filters, in label order", () => {
    expect(activeDetailKeys(orchards)).toEqual(["uPick", "ciderDonuts", "pumpkinPatch", "cornMaze"]);
  });

  it("orchard details use only the four orchard facts", () => {
    const allowed = new Set(["uPick", "ciderDonuts", "pumpkinPatch", "cornMaze"]);
    for (const p of orchards) {
      for (const k of Object.keys(p.details ?? {})) {
        expect(allowed.has(k), `${p.slug}: unexpected orchard detail "${k}"`).toBe(true);
      }
    }
  });
});

describe("nature-center features (winning detail — moat, kind 8)", () => {
  const centers = placesByKind("nature-center");

  it("locks the source-confirmed counts (live animals came back universal)", () => {
    expect(centers.length).toBe(12);
    expect(centers.filter((p) => p.details?.liveAnimals === true).length).toBe(12);
    expect(centers.filter((p) => p.details?.indoorExhibits === true).length).toBe(10);
    expect(centers.filter((p) => p.details?.naturePlayArea === true).length).toBe(8);
  });

  it("the trail-only outliers carry no indoor-exhibits badge (honest differentiation)", () => {
    // Dodge (no public indoor visitor center) + Belwin (bison prairie, no exhibit building).
    for (const slug of ["dodge-nature-center", "belwin-conservancy"]) {
      const p = centers.find((x) => x.slug === slug);
      expect(p?.details?.indoorExhibits, `${slug}`).not.toBe(true);
    }
  });

  it("offers the three nature facts as filters, in label order", () => {
    expect(activeDetailKeys(centers)).toEqual(["liveAnimals", "indoorExhibits", "naturePlayArea"]);
  });

  it("nature-center details use only the three nature facts", () => {
    const allowed = new Set(["liveAnimals", "indoorExhibits", "naturePlayArea"]);
    for (const p of centers) {
      for (const k of Object.keys(p.details ?? {})) {
        expect(allowed.has(k), `${p.slug}: unexpected nature detail "${k}"`).toBe(true);
      }
    }
  });
});

describe("indoor-playground features (winning detail — moat)", () => {
  const venues = placesByKind("indoor-playground");

  it("locks the source-confirmed counts", () => {
    expect(venues.length).toBe(13);
    expect(venues.filter((p) => p.details?.toddlerArea === true).length).toBe(8);
    expect(venues.filter((p) => p.details?.cafe === true).length).toBe(3);
    expect(venues.filter((p) => p.details?.socksRequired === true).length).toBe(10);
  });

  it("Café is a real café — vending machines don't earn the badge", () => {
    // The three real cafés (Peak Cafe + the two play-cafés); vending-only venues excluded.
    const cafes = venues.filter((p) => p.details?.cafe === true).map((p) => p.slug).sort();
    expect(cafes).toEqual(["adventure-peak-edinborough", "rebes-play-cafe", "sovereign-grounds"]);
    // InnerActive (vending only) must NOT carry the café badge.
    for (const slug of ["inneractive-mounds-view", "inneractive-plymouth", "good-times-park-eagan"]) {
      expect(venues.find((p) => p.slug === slug)?.details?.cafe).not.toBe(true);
    }
  });

  it("offers toddler-area / café / socks-required as filters, in order", () => {
    expect(activeDetailKeys(venues)).toEqual(["toddlerArea", "cafe", "socksRequired"]);
  });

  it("details use only the three indoor-playground facts", () => {
    const allowed = new Set(["toddlerArea", "cafe", "socksRequired"]);
    for (const p of venues) {
      for (const k of Object.keys(p.details ?? {})) {
        expect(allowed.has(k), `${p.slug}: unexpected detail "${k}"`).toBe(true);
      }
    }
  });
});

describe("trampoline/climbing features (winning detail — activity-type moat)", () => {
  const venues = placesByKind("trampoline-climbing");

  it("locks the source-confirmed activity counts", () => {
    expect(venues.length).toBe(17);
    expect(venues.filter((p) => p.details?.trampolines === true).length).toBe(8);
    expect(venues.filter((p) => p.details?.ninjaCourse === true).length).toBe(10);
    expect(venues.filter((p) => p.details?.rockClimbing === true).length).toBe(10);
    expect(venues.filter((p) => p.details?.socksRequired === true).length).toBe(8);
  });

  it("activity badges split the kind correctly — a bouldering gym is climbing-only", () => {
    const bp = venues.find((p) => p.slug === "bouldering-project-minneapolis");
    expect(bp?.details?.rockClimbing).toBe(true);
    expect(bp?.details?.trampolines).not.toBe(true);
    expect(bp?.details?.ninjaCourse).not.toBe(true);
    // Climbing gyms want climbing shoes, not grip socks.
    expect(bp?.details?.socksRequired).not.toBe(true);
  });

  it("every venue carries at least one activity badge (kind is fully differentiated)", () => {
    for (const p of venues) {
      const anyTrue = Object.values(p.details ?? {}).some((v) => v === true);
      expect(anyTrue, `${p.slug} has no activity badge`).toBe(true);
    }
  });

  it("offers the activity filters in order (socks last)", () => {
    expect(activeDetailKeys(venues)).toEqual([
      "trampolines",
      "ninjaCourse",
      "rockClimbing",
      "socksRequired",
    ]);
  });
});

describe("museum features (winning detail — moat)", () => {
  const museums = placesByKind("museum");

  it("locks the source-confirmed counts", () => {
    expect(museums.length).toBe(20);
    expect(museums.filter((p) => p.details?.handsOn === true).length).toBe(12);
    expect(museums.filter((p) => p.details?.cafe === true).length).toBe(5);
    expect(museums.filter((p) => p.details?.planetarium === true).length).toBe(2);
  });

  it("planetarium is exactly the two dome-theater museums", () => {
    const planetariums = museums.filter((p) => p.details?.planetarium === true).map((p) => p.slug).sort();
    expect(planetariums).toEqual(["bell-museum", "science-museum-of-minnesota"]);
  });

  it("honest emptiness: a look-only art gallery with no café carries no badge", () => {
    // Weisman + Museum of Russian Art: no hands-on, no confirmed café, no planetarium.
    for (const slug of ["weisman-art-museum", "museum-of-russian-art"]) {
      expect(museums.find((p) => p.slug === slug)?.details).toBeUndefined();
    }
  });

  it("museum details use only hands-on / café / planetarium", () => {
    const allowed = new Set(["handsOn", "cafe", "planetarium"]);
    for (const p of museums) {
      for (const k of Object.keys(p.details ?? {})) {
        expect(allowed.has(k), `${p.slug}: unexpected museum detail "${k}"`).toBe(true);
      }
    }
  });
});

describe("filter by detail (winning-detail filters — P4.3 follow-on)", () => {
  const rinks = placesByKind("rink");
  const skiHills = placesByKind("ski-hill");

  it("activeDetailKeys offers only the facts a set actually carries, in label order", () => {
    // Rinks carry indoor + warming house (nothing ski-specific).
    expect(activeDetailKeys(rinks)).toEqual(["indoor", "warmingHouse"]);
    // Ski hills carry the ski facts (no indoor/warming house).
    expect(activeDetailKeys(skiHills)).toEqual([
      "tubing",
      "nightSkiing",
      "terrainPark",
      "rentals",
      "lessons",
    ]);
  });

  it("a kind with no verified details offers no detail filters (honest emptiness)", () => {
    expect(activeDetailKeys(placesByKind("beach"))).toEqual([]);
  });

  it('detail filter is strict — "indoor" returns exactly the 5 arenas', () => {
    const out = filterPlaces(rinks, { ...NO_PLACE_FILTERS, details: ["indoor"] }, JULY);
    expect(out.length).toBe(5);
    expect(out.every((p) => p.season.type === "year-round")).toBe(true);
  });

  it("detail filters AND together — indoor + warming house is impossible, returns []", () => {
    const out = filterPlaces(rinks, { ...NO_PLACE_FILTERS, details: ["indoor", "warmingHouse"] }, JULY);
    expect(out).toEqual([]); // no rink is both an enclosed arena and an outdoor warming-house rink
  });

  it("a detail filter never matches an unverified (absent) fact", () => {
    // Every ski hill with tubing must actually carry tubing: true — never absent.
    const tubers = filterPlaces(skiHills, { ...NO_PLACE_FILTERS, details: ["tubing"] }, JULY);
    expect(tubers.length).toBeGreaterThan(0);
    expect(tubers.every((p) => p.details?.tubing === true)).toBe(true);
  });
});
