import { describe, it, expect } from "vitest";
import {
  PLACES,
  KIND_META,
  placesByKind,
  placesByNeighborhood,
  placeBySlug,
  kindsWithPlaces,
  openNow,
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
    for (const p of PLACES) {
      expect(p.lat, p.slug).toBeGreaterThan(44.7);
      expect(p.lat, p.slug).toBeLessThan(45.2);
      expect(p.lng, p.slug).toBeGreaterThan(-93.7);
      expect(p.lng, p.slug).toBeLessThan(-92.9);
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
    // All seed entries are free, so the tiebreak is alphabetical.
    const names = beaches.map((p) => p.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("an unseeded kind returns an empty list (honest emptiness)", () => {
    expect(placesByKind("pool" as PlaceKind)).toEqual([]);
  });

  it("placesByNeighborhood finds the in-district places and no suburb/null ones", () => {
    const swl = placesByNeighborhood("southwest-lakes");
    expect(swl.map((p) => p.slug).sort()).toEqual(["bde-maka-ska-thomas-beach", "lake-harriet-north-beach"]);
    expect(placesByNeighborhood("nonexistent-key")).toEqual([]);
  });

  it("placeBySlug resolves a known slug and null for unknown", () => {
    expect(placeBySlug("phalen-regional-park-beach")?.city).toBe("St. Paul");
    expect(placeBySlug("not-a-place")).toBeNull();
  });

  it("kindsWithPlaces lists only seeded kinds, with counts and open state", () => {
    const kinds = kindsWithPlaces(JULY);
    const bySlug = Object.fromEntries(kinds.map((k) => [k.meta.kind, k]));
    expect(Object.keys(bySlug).sort()).toEqual(["beach", "splash-pad"]);
    expect(bySlug["beach"].count).toBe(placesByKind("beach").length);
    expect(bySlug["beach"].open).toBe(true); // July → summer beaches open
    // In January the same kinds still list (page persists year-round) but closed.
    const winter = Object.fromEntries(kindsWithPlaces(JANUARY).map((k) => [k.meta.kind, k]));
    expect(winter["beach"].open).toBe(false);
  });
});
