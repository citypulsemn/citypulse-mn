import { describe, it, expect } from "vitest";
import { venueIsUnknown, unknownVenueReason } from "../venue-quality";

/**
 * Every string below is real — taken from the database on 12 Sep 2026, not
 * invented. The two lists are the whole design: the first is what must be
 * caught, the second is what must NOT be, and the second list is the one that
 * keeps this guard from quietly deleting usable listings.
 */
const UNKNOWN = [
  "TBD",
  "TBD – St. Louis Park",
  "TBD (traveling expo)",
  "TBD (Minneapolis)",
  "TBD – Bloomington",
  "Saint Paul (location TBD)",
  "St. Louis Park (specific venue TBD)",
  "Minneapolis (specific venue TBD)",
  "Minneapolis (venue TBD per organizers)",
  "Minneapolis (location TBD per organizers)",
  "Nicollet Avenue (specific blocks TBD)",
  "Farmington – venue TBD",
  "Various Locations, City of Eagan",
  // Slipped past the first version of the regex — "various LOCATIONS" with one
  // word in between. A restore pass republished a live listing with this as its
  // venue on 12 Sep 2026.
  "Various named locations in Eagan's Art Block area, including Caponi Art Park, Wescott Library, Emagine Theater, Eagan Art House (3981 Lexington Ave S), and area churches",
  "Multiple locations across Northeast Minneapolis",
  "",
  "   ",
];

const USABLE = [
  // Vague, but a reader can find every one of these. Vagueness is not the defect.
  "Como Park / Como Lakeside Pavilion area",
  "Uptown (Hennepin Ave & Lake St area)",
  "Little Canada City Hall Area",
  "New Brighton Community Area",
  // NB: dropped from the usable list — "Multiple Venues" is the same hedge, and
  // a reader cannot navigate to it. The Fringe hub belongs in the venue field on
  // its own if that is where to go.
  "Downtown Excelsior",
  "Cedar Avenue S (Seward Neighborhood)",
  // Ordinary venues, which must never trip this.
  "First Avenue & 7th St Entry",
  "Target Field",
  "Guardian Angels Catholic Church",
  "Sahag-Mesrop Armenian Church",
  "Minnesota State Fairgrounds",
];

describe("venueIsUnknown", () => {
  it("catches every admission of ignorance seen in the wild", () => {
    for (const v of UNKNOWN) expect(venueIsUnknown(v), JSON.stringify(v)).toBe(true);
  });

  it("leaves vague-but-findable venues alone", () => {
    for (const v of USABLE) expect(venueIsUnknown(v), JSON.stringify(v)).toBe(false);
  });

  it("treats a venue that is merely the city as unknown", () => {
    expect(venueIsUnknown("Minneapolis", "Minneapolis")).toBe(true);
    expect(venueIsUnknown("  saint paul ", "Saint Paul")).toBe(true);
    // …but only against its OWN city. A venue named after another town is fine.
    expect(venueIsUnknown("Hopkins Center for the Arts", "Hopkins")).toBe(false);
    expect(venueIsUnknown("Minneapolis", "St. Paul")).toBe(false);
  });

  it("does not fire on words that merely contain the letters", () => {
    // The word-boundary matters: these are real places.
    for (const v of ["Tbdress Hall", "Gatba Center", "Latvian Society"]) {
      expect(venueIsUnknown(v), v).toBe(false);
    }
  });

  it("handles null and undefined as unknown rather than throwing", () => {
    expect(venueIsUnknown(null)).toBe(true);
    expect(venueIsUnknown(undefined)).toBe(true);
    expect(() => venueIsUnknown(null, null)).not.toThrow();
  });
});

describe("unknownVenueReason", () => {
  it("is null when there is nothing wrong", () => {
    expect(unknownVenueReason("Target Field", "Minneapolis")).toBeNull();
  });

  it("says which kind of nothing it is", () => {
    expect(unknownVenueReason("", "Minneapolis")).toMatch(/no venue at all/i);
    expect(unknownVenueReason("Minneapolis", "Minneapolis")).toMatch(/just the city/i);
    expect(unknownVenueReason("TBD – Bloomington", "Bloomington")).toMatch(/says it is unknown/i);
  });

  it("quotes the offending string so the log is actionable", () => {
    expect(unknownVenueReason("Saint Paul (location TBD)", "Saint Paul")).toContain(
      "Saint Paul (location TBD)",
    );
  });
});
