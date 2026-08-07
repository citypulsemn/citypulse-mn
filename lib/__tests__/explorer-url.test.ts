import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  serializeExplorer,
  parseExplorer,
  type ExplorerState,
  type ExplorerDefaults,
} from "../explorer-url";
import { CATEGORY_KEYS } from "../categories";
import type { CategoryKey, PriceTier } from "../types";
import type { AreaKey } from "../areas";

const DEFAULTS: ExplorerDefaults = { view: "calendar", range: "month", year: 2026, month: 7 }; // Aug 2026

function state(over: Partial<ExplorerState> = {}): ExplorerState {
  return {
    view: "calendar",
    range: "month",
    year: 2026,
    month: 7,
    cats: new Set<CategoryKey>(CATEGORY_KEYS), // all = default
    prices: new Set<PriceTier>(),
    areas: new Set<AreaKey>(),
    query: "",
    day: null,
    event: null,
    ...over,
  };
}

describe("serializeExplorer", () => {
  it("the default state serializes to an empty string (clean URL)", () => {
    expect(serializeExplorer(state(), DEFAULTS)).toBe("");
  });

  it("omits categories when all are active, writes the subset otherwise", () => {
    expect(serializeExplorer(state({ cats: new Set<CategoryKey>(["music", "arts"]) }), DEFAULTS)).toBe(
      "cat=music,arts",
    );
  });

  it("writes non-default view and range", () => {
    expect(serializeExplorer(state({ view: "list", range: "week" }), DEFAULTS)).toBe("view=list&range=week");
  });

  it("writes the month only when it differs from the default", () => {
    expect(serializeExplorer(state({ year: 2026, month: 8 }), DEFAULTS)).toBe("m=2026-09");
    expect(serializeExplorer(state({ year: 2026, month: 7 }), DEFAULTS)).toBe("");
  });

  it("maps price tiers to digit tokens (no $ in the URL)", () => {
    const s = state({ prices: new Set<PriceTier>(["Free", "$$"]) });
    const out = serializeExplorer(s, DEFAULTS);
    expect(out).toBe("price=0,2");
    expect(out).not.toContain("$");
  });

  it("writes areas, query, and open overlays", () => {
    const s = state({
      areas: new Set<AreaKey>(["mpls", "west"]),
      query: "jazz trio",
      day: "2026-08-15",
      event: "abc-123",
    });
    expect(serializeExplorer(s, DEFAULTS)).toBe("area=mpls,west&q=jazz+trio&day=2026-08-15&event=abc-123");
  });

  it("orders keys canonically regardless of what is set", () => {
    const s = state({ view: "map", range: "today", query: "x", event: "e1" });
    expect(serializeExplorer(s, DEFAULTS)).toBe("view=map&range=today&q=x&event=e1");
  });
});

describe("parseExplorer", () => {
  it("parses a full query string back to typed fields", () => {
    const p = parseExplorer("view=list&range=week&m=2026-09&cat=music,arts&price=0,2&area=mpls&q=jazz&day=2026-08-15&event=e1");
    expect(p).toEqual({
      view: "list",
      range: "week",
      year: 2026,
      month: 8, // September
      cats: ["music", "arts"],
      prices: ["Free", "$$"],
      areas: ["mpls"],
      query: "jazz",
      day: "2026-08-15",
      event: "e1",
    });
  });

  it("tolerates a leading '?'", () => {
    expect(parseExplorer("?view=map").view).toBe("map");
  });

  it("drops invalid values instead of throwing", () => {
    const p = parseExplorer("view=galaxy&range=decade&cat=music,politics&price=9&area=mars&m=2026-13&day=2026-99-99");
    expect(p.view).toBeUndefined();
    expect(p.range).toBeUndefined();
    expect(p.cats).toEqual(["music"]); // only the valid key survives
    expect(p.prices).toBeUndefined(); // "9" is not a tier token
    expect(p.areas).toBeUndefined();
    expect(p.month).toBeUndefined(); // month 13 rejected
    expect(p.day).toBeUndefined();
  });

  it("an empty search yields an empty object (all defaults apply)", () => {
    expect(parseExplorer("")).toEqual({});
  });
});

describe("EventsExplorer wiring (UX11 tripwires)", () => {
  const src = readFileSync(join(__dirname, "..", "..", "components/EventsExplorer.tsx"), "utf8");

  it("serializes state to the URL and parses it back", () => {
    expect(src).toContain("serializeExplorer");
    expect(src).toContain("parseExplorer");
    expect(src).toContain("window.location.search");
  });

  it("pushes on overlay-open and replaces otherwise, and honors Back/Forward", () => {
    expect(src).toContain("window.history.pushState");
    expect(src).toContain("window.history.replaceState");
    expect(src).toContain('"popstate"');
    // overlay-stack growth is what triggers a pushed entry
    expect(src).toContain("overlayCount > prevOverlayCount.current");
  });

  it('offers "make this my default view" backed by localStorage', () => {
    expect(src).toContain("loadDefaultView");
    expect(src).toContain("saveDefaultView");
    expect(src).toContain("cp_default_view");
    expect(src).toContain("default-view-btn");
  });
});

describe("round-trip", () => {
  it("serialize → parse preserves a non-trivial state", () => {
    const s = state({
      view: "map",
      range: "weekend",
      year: 2026,
      month: 11,
      cats: new Set<CategoryKey>(["sports", "food", "weird"]),
      prices: new Set<PriceTier>(["$", "$$$"]),
      areas: new Set<AreaKey>(["stpaul"]),
      query: "night market",
      day: "2026-12-05",
      event: "xyz",
    });
    const p = parseExplorer(serializeExplorer(s, DEFAULTS));
    expect(p.view).toBe("map");
    expect(p.range).toBe("weekend");
    expect(p.year).toBe(2026);
    expect(p.month).toBe(11);
    expect(new Set(p.cats)).toEqual(new Set(["sports", "food", "weird"]));
    expect(new Set(p.prices)).toEqual(new Set(["$", "$$$"]));
    expect(p.areas).toEqual(["stpaul"]);
    expect(p.query).toBe("night market");
    expect(p.day).toBe("2026-12-05");
    expect(p.event).toBe("xyz");
  });
});
