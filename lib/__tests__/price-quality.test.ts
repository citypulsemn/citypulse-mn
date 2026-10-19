import { describe, it, expect } from "vitest";
import { priceIsUnknown, displayPrice, PRICE_FALLBACK, isStrictlyFree, isFreeToAttend, dollarAmounts } from "../price-quality";

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

describe("isFreeToAttend — the Free price tier", () => {
  it("leads with free: extras may cost, attending does not", () => {
    // Every shape read off the live table.
    for (const p of [
      "Free", "free", "Free admission", "$0", "$0.00",
      "Free admission; fee for some activities", "Free (some ticketed elements)", "FREE with registration",
      "Free (parking $10)", "Free; $10 parking", "Free admission; pumpkin patch $5/pumpkin; corn maze $7/person",
      "Free general; $30–$150 for concerts", "Free (buttons $20/family for select events)",
      "Free / RSVP", "Free / Donation", "Free (donations appreciated: $2/child, $3/adult suggested)",
      "Free to the public", "Free for all ages", "Free for everyone", "Free (tickets required; limited capacity)",
      "Free (last Tuesday of each month)", "Free (21+ wristband for alcohol)",
    ]) {
      expect(isFreeToAttend(p), p).toBe(true);
    }
  });

  it("is false when free is taken back: a priced event with a free exception, a limit on who or when, or a range", () => {
    for (const p of [
      "$22 general; children 3 and under free", "$8 per child; free for adults", "$15 (free Thursdays & first Saturday)",
      "Included with Zoo admission ($25.95 adults, free 2 & under)", "Members Free", "Paid admission; children 4 & under free",
      "Free for members; $10 others", "Free with museum admission ($18)", "Free (with Arboretum admission)", "Free with State Fair admission",
      "Free (Como Friends donors/members)", "Free kids; $5 adults", "Free under 12", "Free Fri; $8 adv/$10 door Sat",
      "Free (Fri); $5–$10 (Sat, 13+)", "Free (Sat & Sun)", "Free on Thursdays",
      "Free–$20", "Free-$15", "Free–varies", "Free–Low cost", "Free / Low cost", "Free or low cost", "Free to $20", "$0–$25", "Free–$TBD",
      "Free (outdoor) / Ticketed (venue events)",
      "Freestyle session $20", "Freedom Fest $5", "", "See listing", "Donations welcome",
    ]) {
      expect(isFreeToAttend(p), p).toBe(false);
    }
  });

  it("is looser than isStrictlyFree, never stricter", () => {
    for (const p of ["Free", "Free admission", "Free entry (donations welcome)", "Free admission; fee for some activities"]) {
      if (isStrictlyFree(p)) expect(isFreeToAttend(p), p).toBe(true);
    }
    expect(isStrictlyFree("Free admission; fee for some activities")).toBe(false);
    expect(isFreeToAttend("Free admission; fee for some activities")).toBe(true);
  });
});

describe("dollarAmounts", () => {
  it("reads only amounts with a dollar sign", () => {
    expect(dollarAmounts("$22 general; children 3 and under free")).toEqual([22]);
    expect(dollarAmounts("$18-$120, ages 2+")).toEqual([18, 120]);
    expect(dollarAmounts("$ 15 and $7.50")).toEqual([15, 7.5]);
    expect(dollarAmounts("Ages 21+")).toEqual([]);
  });
});
