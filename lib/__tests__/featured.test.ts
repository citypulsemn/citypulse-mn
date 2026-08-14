import { describe, it, expect } from "vitest";
import { selectFeatured, FEATURED_CAP, type FeaturedPlacement } from "../featured";
import type { EventRecord } from "../types";

const NOW = new Date("2026-08-13T12:00:00-05:00");

function ev(id: string, overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id,
    title: `Event ${id}`,
    category: "music",
    venue: "First Avenue",
    address: "701 1st Ave N",
    city: "Minneapolis",
    lat: 44.9,
    lng: -93.2,
    start: "2026-08-20T20:00",
    end: "",
    price: "$25",
    priceTier: "$$",
    ticketUrl: "https://t.co/x",
    description: "Plenty of detail in the description field here for the card.",
    image: "",
    sourceUrl: "",
    status: "published",
    ...overrides,
  };
}

/** A placement whose window brackets NOW by default. */
function place(eventId: string, overrides: Partial<FeaturedPlacement> = {}): FeaturedPlacement {
  return {
    eventId,
    label: "Featured",
    startsAt: "2026-08-10T00:00:00-05:00",
    endsAt: "2026-08-20T00:00:00-05:00",
    ...overrides,
  };
}

describe("selectFeatured — the paid-placement selection rules", () => {
  const pool = [ev("a"), ev("b"), ev("c"), ev("d")];

  it("dormant by default: no placements ⇒ nothing featured", () => {
    expect(selectFeatured([], pool, { now: NOW, surface: "home" })).toEqual([]);
  });

  it("returns the active placement as an item with its event and label", () => {
    const out = selectFeatured([place("a", { label: "Community Partner" })], pool, {
      now: NOW,
      surface: "home",
    });
    expect(out).toHaveLength(1);
    expect(out[0].event.id).toBe("a");
    expect(out[0].label).toBe("Community Partner");
  });

  it("caps home at 2 and collection at 1 (trust rule: capped)", () => {
    const many = [place("a"), place("b"), place("c"), place("d")];
    expect(FEATURED_CAP).toEqual({ home: 2, collection: 1 });
    expect(selectFeatured(many, pool, { now: NOW, surface: "home" }).map((i) => i.event.id)).toEqual(["a", "b"]);
    expect(selectFeatured(many, pool, { now: NOW, surface: "collection" }).map((i) => i.event.id)).toEqual(["a"]);
  });

  it("excludes placements whose window hasn't started or has ended", () => {
    const future = place("a", { startsAt: "2026-09-01T00:00:00-05:00", endsAt: "2026-09-30T00:00:00-05:00" });
    const past = place("b", { startsAt: "2026-07-01T00:00:00-05:00", endsAt: "2026-07-31T00:00:00-05:00" });
    const out = selectFeatured([future, past], pool, { now: NOW, surface: "home" });
    expect(out).toEqual([]);
  });

  it("excludes placements with a malformed window", () => {
    const bad = place("a", { startsAt: "not-a-date", endsAt: "also-bad" });
    expect(selectFeatured([bad], pool, { now: NOW, surface: "home" })).toEqual([]);
  });

  it("excludes events absent from the pool (archived, drafted, or not in this collection)", () => {
    const out = selectFeatured([place("zz")], pool, { now: NOW, surface: "home" });
    expect(out).toEqual([]);
  });

  it("dedupes: two active placements for the same event count once", () => {
    const out = selectFeatured([place("a"), place("a")], pool, { now: NOW, surface: "home" });
    expect(out.map((i) => i.event.id)).toEqual(["a"]);
  });

  it("falls back to the 'Featured' label when the row's label is blank", () => {
    const out = selectFeatured([place("a", { label: "   " })], pool, { now: NOW, surface: "home" });
    expect(out[0].label).toBe("Featured");
  });

  it("preserves input order and takes the first N that qualify", () => {
    const some = [
      place("d"),
      place("zz"), // not in pool — skipped, doesn't consume a slot
      place("b"),
      place("a"),
    ];
    const out = selectFeatured(some, pool, { now: NOW, surface: "home" });
    expect(out.map((i) => i.event.id)).toEqual(["d", "b"]);
  });

  it("NEVER mutates or reorders the organic pool it was handed (no-reorder rule)", () => {
    const organic = [ev("a"), ev("b"), ev("c")];
    const snapshot = organic.map((e) => e.id);
    selectFeatured([place("c"), place("a")], organic, { now: NOW, surface: "home" });
    expect(organic.map((e) => e.id)).toEqual(snapshot); // unchanged
    expect(organic).toHaveLength(3);
  });
});
