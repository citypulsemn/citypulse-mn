import { describe, it, expect } from "vitest";
import { priceIsUnknown, displayPrice, PRICE_FALLBACK } from "../price-quality";

/**
 * Every string below came out of the database on 12 Sep 2026, with its row
 * count, not out of my head. The second list is the one doing the work: it is
 * what a reader can still use, and it keeps this guard from flattening 300+
 * informative prices into "See listing".
 */
const UNKNOWN = [
  "TBD", // 229 rows, 75 of them live — the report that started this
  "Unknown", // 85 rows
  "N/A", // 4 rows
  "TBA",
  "To be announced",
  "Price TBD",
  "Cost: unknown",
  "Not listed",
  "?",
  "—",
  "",
  "   ",
];

const USABLE = [
  // Vague, and every one of them tells a reader something true.
  "Varies", // 123 rows
  "See venue", // 49
  "See website", // 44
  "Included with admission", // 27
  "Paid admission", // 18
  "General orchard admission applies",
  "Ticketed",
  "Low cost",
  "No Cover",
  "Free (donations appreciated)",
  "Free admission; wristband required for alcohol",
  // Admits ignorance but hands over the next step. The pointer is the value.
  "TBD – see seversfestival.com",
  "See smm.org for ticket pricing",
  // Ordinary prices, which must never trip this.
  "Free",
  "$10",
  "$20-$75",
  "See listing",
];

describe("priceIsUnknown", () => {
  it("catches every bare shrug seen in the wild", () => {
    for (const p of UNKNOWN) expect(priceIsUnknown(p), JSON.stringify(p)).toBe(true);
  });

  it("leaves vague-but-useful prices alone", () => {
    for (const p of USABLE) expect(priceIsUnknown(p), JSON.stringify(p)).toBe(false);
  });

  it("does not fire on words that merely contain the letters", () => {
    for (const p of ["$12 NA members", "Unknown Pleasures tribute — $15", "Tbdress gift card"]) {
      expect(priceIsUnknown(p), p).toBe(false);
    }
  });

  it("handles null and undefined as unknown rather than throwing", () => {
    expect(priceIsUnknown(null)).toBe(true);
    expect(priceIsUnknown(undefined)).toBe(true);
  });
});

describe("displayPrice", () => {
  it("substitutes the column's own default for a shrug", () => {
    expect(displayPrice("TBD")).toBe(PRICE_FALLBACK);
    expect(displayPrice("Unknown")).toBe(PRICE_FALLBACK);
    expect(displayPrice(null)).toBe(PRICE_FALLBACK);
  });

  it("never returns an empty string — every event page keeps a Price row", () => {
    for (const p of [...UNKNOWN, ...USABLE]) expect(displayPrice(p).length).toBeGreaterThan(0);
  });

  it("passes a real price through untouched, trimmed", () => {
    expect(displayPrice("  $20-$75 ")).toBe("$20-$75");
    expect(displayPrice("Free")).toBe("Free");
  });
});
