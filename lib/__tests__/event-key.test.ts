import { describe, it, expect } from "vitest";
import { computeEventKey, normalizeKeyPart, normalizeTier } from "../event-key";

describe("computeEventKey (dedup)", () => {
  it("is deterministic — same event re-found yields the same key", () => {
    const a = computeEventKey("Trampled by Turtles", "First Avenue", "2026-06-14T20:00");
    const b = computeEventKey("Trampled by Turtles", "First Avenue", "2026-06-14T20:00");
    expect(a).toBe(b);
  });

  it("ignores case, punctuation, and whitespace differences", () => {
    const a = computeEventKey("Trampled by Turtles", "First Avenue", "2026-06-14T20:00");
    const b = computeEventKey("  trampled by turtles!! ", "first  avenue", "2026-06-14T20:00");
    expect(a).toBe(b);
  });

  it("ignores the start TIME but not the start DATE", () => {
    const sameDay = computeEventKey("Show", "Venue", "2026-06-14T19:00");
    const sameDayLater = computeEventKey("Show", "Venue", "2026-06-14T21:30");
    const nextDay = computeEventKey("Show", "Venue", "2026-06-15T19:00");
    expect(sameDay).toBe(sameDayLater); // corrected time still matches
    expect(sameDay).not.toBe(nextDay); // different day is a different event
  });

  it("distinguishes different events", () => {
    const a = computeEventKey("Show A", "Venue", "2026-06-14T20:00");
    const b = computeEventKey("Show B", "Venue", "2026-06-14T20:00");
    expect(a).not.toBe(b);
  });

  it("normalizeKeyPart strips accents and symbols", () => {
    expect(normalizeKeyPart("Café  Déjà-Vu!")).toBe("cafe dejavu");
  });
});

describe("normalizeTier", () => {
  it("passes through explicit tiers", () => {
    expect(normalizeTier("Free")).toBe("Free");
    expect(normalizeTier("$$$")).toBe("$$$");
  });
  it("maps free-ish strings to Free", () => {
    expect(normalizeTier("Free entry")).toBe("Free");
    expect(normalizeTier("$0")).toBe("Free");
  });
  it("buckets by the lowest dollar amount", () => {
    expect(normalizeTier("$15")).toBe("$"); // < 20
    expect(normalizeTier("$45")).toBe("$$"); // 20–74
    expect(normalizeTier("$18-$120")).toBe("$"); // min 18
    expect(normalizeTier("$35–$160")).toBe("$$"); // min 35
    expect(normalizeTier("$90")).toBe("$$$"); // >= 75
  });
  it("treats unknown/blank as $$ (not Free)", () => {
    expect(normalizeTier("")).toBe("$$");
    expect(normalizeTier("See listing")).toBe("$$");
  });
});
