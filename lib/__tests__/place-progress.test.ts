import { describe, it, expect } from "vitest";
import {
  placeProgress,
  progressLine,
  visitedByKind,
  visitedCount,
} from "../place-progress";
import { VISITS_CAP } from "../place-visits";
import {
  KIND_META,
  KIND_COVERAGE,
  PLACES,
  placesByKind,
  filterPlaces,
  NO_PLACE_FILTERS,
  type PlaceKind,
} from "../places";

/**
 * Places P5 — "Been there". The number on the page is never hand-typed: the
 * denominator comes from the registry, the wording from the kind's declared
 * coverage, and zero renders nothing. These goldens pin all three plus the
 * orphan rule (a slug that left the registry is ignored, never an error).
 */
const JULY = new Date("2026-07-15T12:00:00Z");
const slugsOf = (kind: PlaceKind, n: number) => placesByKind(kind).slice(0, n).map((p) => p.slug);

describe("KIND_COVERAGE — every kind says what its denominator is", () => {
  it("declares exhaustive or curated for every kind in KIND_META", () => {
    for (const kind of Object.keys(KIND_META) as PlaceKind[]) {
      expect(["exhaustive", "curated"], kind).toContain(KIND_COVERAGE[kind]);
    }
  });

  it("the documented metro sweeps are exhaustive; the picks are curated", () => {
    // The registry's own section headers say which is which — pin the anchors
    // so the wording can't quietly over-claim on a curated kind.
    expect(KIND_COVERAGE["splash-pad"]).toBe("exhaustive");
    expect(KIND_COVERAGE.beach).toBe("exhaustive");
    expect(KIND_COVERAGE["golf-course"]).toBe("exhaustive");
    expect(KIND_COVERAGE.park).toBe("curated");
    expect(KIND_COVERAGE.playground).toBe("curated");
    expect(KIND_COVERAGE["disc-golf"]).toBe("curated"); // "initial verified set — the metro has 40+"
  });
});

describe("placeProgress + progressLine", () => {
  it("counts only this kind's registry slugs", () => {
    const two = new Set(slugsOf("splash-pad", 2));
    const p = placeProgress("splash-pad", two);
    expect(p).toEqual({
      kind: "splash-pad",
      visited: 2,
      total: placesByKind("splash-pad").length,
      coverage: "exhaustive",
    });
  });

  it("exhaustive wording: 'of N <plural> in the metro'", () => {
    const p = placeProgress("splash-pad", new Set(slugsOf("splash-pad", 3)));
    expect(progressLine(p)).toBe(`Been to 3 of ${p.total} splash pads in the metro`);
  });

  it("curated wording: 'of the N <plural> on our list'", () => {
    const p = placeProgress("park", new Set(slugsOf("park", 1)));
    expect(progressLine(p)).toBe(`Been to 1 of the ${p.total} parks on our list`);
  });

  it("zero renders nothing (honest emptiness — no '0 of 50', no empty bar)", () => {
    expect(progressLine(placeProgress("splash-pad", new Set()))).toBeNull();
  });

  it("an orphan slug (left the registry) is ignored, never an error", () => {
    const p = placeProgress("splash-pad", new Set(["no-such-place-anymore"]));
    expect(p.visited).toBe(0);
    expect(progressLine(p)).toBeNull();
  });

  it("a slug of another kind is not counted toward this kind", () => {
    const beach = new Set(slugsOf("beach", 1));
    expect(placeProgress("splash-pad", beach).visited).toBe(0);
    expect(placeProgress("beach", beach).visited).toBe(1);
  });

  it("a full sweep reads N of N", () => {
    const all = new Set(placesByKind("sledding").map((p) => p.slug));
    const p = placeProgress("sledding", all);
    expect(p.visited).toBe(p.total);
    expect(progressLine(p)).toContain(`${p.total} of the ${p.total}`);
  });
});

describe("visitedByKind (the /saved section)", () => {
  it("omits kinds with no visits and orders most-complete first", () => {
    // Every ski hill → 100 %; one park is a small fraction of a curated list.
    const hills = placesByKind("ski-hill");
    const set = new Set([...hills.map((p) => p.slug), ...slugsOf("park", 1)]);
    const groups = visitedByKind(set);
    expect(groups.map((g) => g.meta.kind)).toEqual(["ski-hill", "park"]);
    expect(groups[1].places).toHaveLength(1);
    expect(progressLine(groups[0].progress)).toBe(
      `Been to ${hills.length} of ${hills.length} ski & tubing hills in the metro`,
    );
  });

  it("is empty at zero and ignores orphans", () => {
    expect(visitedByKind(new Set())).toEqual([]);
    expect(visitedByKind(new Set(["ghost-slug"]))).toEqual([]);
  });

  it("keeps each kind's places in kind-page order", () => {
    const three = slugsOf("beach", 3);
    const [g] = visitedByKind(new Set([three[2], three[0], three[1]]));
    expect(g.places.map((p) => p.slug)).toEqual(three);
  });
});

describe("visitedCount + VISITS_CAP", () => {
  it("counts distinct registry places only", () => {
    expect(visitedCount(new Set([...slugsOf("beach", 2), "ghost"]))).toBe(2);
  });

  it("the cap sits above the registry so a full sweep can finish", () => {
    expect(VISITS_CAP).toBeGreaterThan(PLACES.length);
    expect(Number.isInteger(VISITS_CAP)).toBe(true);
  });
});

describe("filterPlaces — the 'Been there / Not yet' chips", () => {
  const set = placesByKind("beach").slice(0, 4);
  const visited = new Set([set[0].slug, set[2].slug]);

  it("'been' keeps only checked-off places; 'not-yet' the rest", () => {
    expect(filterPlaces(set, { ...NO_PLACE_FILTERS, been: "been" }, JULY, visited).map((p) => p.slug)).toEqual([
      set[0].slug,
      set[2].slug,
    ]);
    expect(filterPlaces(set, { ...NO_PLACE_FILTERS, been: "not-yet" }, JULY, visited).map((p) => p.slug)).toEqual([
      set[1].slug,
      set[3].slug,
    ]);
  });

  it("no filter (undefined) and no visited set behave as before", () => {
    expect(filterPlaces(set, NO_PLACE_FILTERS, JULY)).toHaveLength(4);
    expect(filterPlaces(set, { ...NO_PLACE_FILTERS, been: "been" }, JULY)).toHaveLength(0);
    expect(filterPlaces(set, { ...NO_PLACE_FILTERS, been: "not-yet" }, JULY)).toHaveLength(4);
  });
});
