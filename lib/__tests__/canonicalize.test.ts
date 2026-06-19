import { describe, it, expect } from "vitest";
import {
  canonicalizeTitle,
  canonicalizeVenue,
  normalizeKeyPart,
} from "../canonicalize";
import { computeEventKey } from "../event-key";

describe("canonicalizeVenue", () => {
  it("folds known aliases to one canonical name", () => {
    expect(canonicalizeVenue("First Ave")).toBe("first avenue");
    expect(canonicalizeVenue("First Avenue")).toBe("first avenue");
    expect(canonicalizeVenue("first avenue mainroom")).toBe("first avenue");
  });
  it("collapses 'The Armory' / 'Armory'", () => {
    expect(canonicalizeVenue("The Armory")).toBe(canonicalizeVenue("Armory"));
  });
  it("leaves unknown venues as their normalized form", () => {
    expect(canonicalizeVenue("Some New Taproom")).toBe("some new taproom");
  });
  it("relies on normalization for punctuation-only variants", () => {
    // these need no alias entry — they already normalize the same
    expect(canonicalizeVenue("U.S. Bank Stadium")).toBe(
      canonicalizeVenue("US Bank Stadium"),
    );
  });
});

describe("canonicalizeTitle", () => {
  it("strips trailing parentheticals and brackets", () => {
    expect(canonicalizeTitle("Tycho (21+)")).toBe("tycho");
    expect(canonicalizeTitle("Tycho [SOLD OUT]")).toBe("tycho");
    expect(canonicalizeTitle("Tycho (21+) (Late Show)")).toBe("tycho");
  });
  it("drops a single leading 'the'", () => {
    expect(canonicalizeTitle("The Hold Steady")).toBe("hold steady");
  });
  it("normalizes versus separators", () => {
    expect(canonicalizeTitle("Twins vs. Yankees")).toBe("twins vs yankees");
    expect(canonicalizeTitle("Twins versus Yankees")).toBe("twins vs yankees");
    expect(canonicalizeTitle("Twins v. Yankees")).toBe("twins vs yankees");
  });
  it("does not mangle ordinary titles", () => {
    expect(canonicalizeTitle("Trampled by Turtles")).toBe("trampled by turtles");
  });
});

describe("computeEventKey with canonicalization", () => {
  const day = "2026-06-20T20:00";

  it("collapses venue aliases to one key", () => {
    expect(computeEventKey("Tycho", "First Ave", day)).toBe(
      computeEventKey("Tycho", "First Avenue", day),
    );
  });
  it("collapses leading-'the' title variants", () => {
    expect(computeEventKey("The Hold Steady", "Armory", day)).toBe(
      computeEventKey("Hold Steady", "Armory", day),
    );
  });
  it("collapses versus spelling variants", () => {
    expect(computeEventKey("Twins vs Yankees", "Target Field", day)).toBe(
      computeEventKey("Twins vs. Yankees", "Target Field", day),
    );
  });
  it("still distinguishes genuinely different events", () => {
    expect(computeEventKey("Show A", "Venue", day)).not.toBe(
      computeEventKey("Show B", "Venue", day),
    );
  });
  it("normalizeKeyPart remains available via re-export", () => {
    expect(normalizeKeyPart("Café  Déjà-Vu!")).toBe("cafe dejavu");
  });
});
