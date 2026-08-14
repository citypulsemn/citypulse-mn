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
  openNow,
  placesStaticMapUrl,
  placesSeasonBanner,
  PLACES_MAP_MAX_PINS,
  type Place,
  type PlaceKind,
} from "../places";
import { neighborhoodByKey } from "../neighborhoods";
import { venuePageBySlug } from "../venue-pages";

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
    expect(Object.keys(bySlug).sort()).toEqual(["beach", "disc-golf", "dog-park", "farmers-market", "golf-course", "park", "playground", "pool", "rink", "sledding", "splash-pad"]);
    expect(bySlug["beach"].count).toBe(placesByKind("beach").length);
    expect(bySlug["beach"].open).toBe(true); // July → summer beaches open
    // In January the same kinds still list (page persists year-round) but closed.
    const winter = Object.fromEntries(kindsWithPlaces(JANUARY).map((k) => [k.meta.kind, k]));
    expect(winter["beach"].open).toBe(false);
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
    expect(read("components/TopBar.tsx")).toContain('href: "/places"');
    expect(read("components/SiteFooter.tsx")).toContain('href="/places"');
  });

  it("index + kind OG image routes use the shared OgCard shell", () => {
    expect(read("app/places/opengraph-image.tsx")).toContain("OgCard");
    expect(read("app/places/[kind]/opengraph-image.tsx")).toContain("OgCard");
  });
});
