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
  it("maps a price that leads with free, and names no other amount, to Free", () => {
    expect(normalizeTier("Free entry")).toBe("Free");
    expect(normalizeTier("$0")).toBe("Free");
    expect(normalizeTier("Free admission; fee for some activities")).toBe("Free");
    expect(normalizeTier("Free (some ticketed elements)")).toBe("Free");
    expect(normalizeTier("FREE with registration")).toBe("Free");
    expect(normalizeTier("Free (parking $10)")).toBe("Free");
    expect(normalizeTier("Free general; $30–$150 for concerts")).toBe("Free");
  });

  it("a conditional free is not Free — the Free tier used to be a substring match", () => {
    // 209 of 1,337 Free-tier rows were one of these shapes (Oct 2026).
    expect(normalizeTier("$22 general; children 3 and under free")).toBe("$$");
    expect(normalizeTier("$8 per child; free for adults and children under 1")).toBe("$");
    expect(normalizeTier("Free for members; $10 others")).toBe("$");
    expect(normalizeTier("Free with museum admission ($18)")).toBe("$");
    expect(normalizeTier("$0–$25")).toBe("$$");
    expect(normalizeTier("Freestyle session $20")).toBe("$$");
  });

  it("a bare number is an age or a count, not a price", () => {
    expect(normalizeTier("$22; ages 3 and under free")).toBe("$$");
    expect(normalizeTier("2 shows, $45")).toBe("$$");
    expect(normalizeTier("Ages 21+")).toBe("$$"); // no price named: unknown, not $
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
