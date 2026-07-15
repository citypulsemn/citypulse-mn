import { describe, it, expect } from "vitest";
import { cleanEventTitle, displayCity } from "../title-hygiene";

/**
 * GOLDEN SET (roadmap 4.7). Every input is a REAL title from the live site,
 * collected during the two full audits. This is where the judgment calls are
 * settled — strip only recognized noise, keep anything informative.
 */

describe("cleanEventTitle — strips recognized noise", () => {
  const cases: [string, string, string?][] = [
    // Schedule noise in parens / dash-suffixes
    ["Utepils Brewing Free Meat & Cheese Raffle (Weekly Tuesdays)", "Utepils Brewing Free Meat & Cheese Raffle"],
    ["Marketfest at Manitou Days — Weekly Thursdays (July 16)", "Marketfest at Manitou Days"],
    ["Como Conservatory Summer Flower Show (through Sep 22)", "Como Conservatory Summer Flower Show"],
    ["Como Little Explorers Thursday – Sep 10", "Como Little Explorers Thursday"],
    ["Guthrie Theater 2026–2027 Season Subscription Performances – Waiting for Godot (September run)",
     "Guthrie Theater 2026–2027 Season Subscription Performances – Waiting for Godot"],
    // Format tags
    ["Trail of Small Wonders (Exhibition)", "Trail of Small Wonders"],
    ["Wicked (Touring)", "Wicked"],
    ["Skyline Mini Golf (Rooftop)", "Skyline Mini Golf"],
    ["Skyline Mini Golf (Artist-Designed)", "Skyline Mini Golf"],
    ["Willow (Screening) by Ron Howard", "Willow by Ron Howard"],
    ["Monsters on Vacation – Children's Museum Immersive Exhibit",
     "Monsters on Vacation – Children's Museum Immersive Exhibit"], // dash tail is descriptive — kept
    // The event's own venue/city restated in parens
    ["In the Heights (Artistry / Bloomington Center for the Arts)", "In the Heights", "Bloomington Center for the Arts"],
    ["Stevie Ray's Comedy Cabaret (Ongoing Improv Performances)", "Stevie Ray's Comedy Cabaret"],
    // Promo riders on sports listings
    ["Minnesota Twins vs. Los Angeles Angels – Beach Tote Bag Giveaway", "Minnesota Twins vs. Los Angeles Angels"],
  ];

  for (const [input, expected, venue] of cases) {
    it(`"${input}" → "${expected}"`, () => {
      expect(cleanEventTitle(input, venue ?? "", "")).toBe(expected);
    });
  }

  it("strips a paren that just restates the city", () => {
    expect(cleanEventTitle("Leprechaun Days (Rosemount)", "", "Rosemount")).toBe("Leprechaun Days");
  });
});

describe("cleanEventTitle — KEEPS information (the prime rule)", () => {
  const keep: [string, string?, string?][] = [
    ["Explorasaurus: A Dinosaur Adventure (World Premiere)"], // premiere = information
    ["Colors of Southeast Asia Fest (COSA Fest)"], // alias/acronym = identity
    ["Sever's Fall Festival – Weekend 1"], // distinguishes two real weekends
    ["Minnesota State Fair – Opening Day"],
    ["My Ántonia (World Premiere)"],
    ["SPCO: Koh (Where Rivers Merge) with Abel Selaocoe"], // artistic subtitle
    ["Free First Saturday: Catching the Light"],
    ["Battle of the Improv All-Stars 2026"], // year in the name, no separator — kept
  ];
  for (const [title, venue, city] of keep) {
    it(`keeps "${title}" unchanged`, () => {
      expect(cleanEventTitle(title, venue ?? "", city ?? "")).toBe(title);
    });
  }

  it("a paren naming a DIFFERENT venue than the event's is kept", () => {
    // 60% token-overlap guard: unrelated place words don't trigger the strip
    expect(cleanEventTitle("In the Heights (Artistry / Bloomington Center for the Arts)", "Orpheum Theatre", "Minneapolis"))
      .toBe("In the Heights (Artistry / Bloomington Center for the Arts)");
  });
});

describe("cleanEventTitle — dash normalization & safety", () => {
  it("normalizes spaced hyphens and em dashes to en dashes", () => {
    expect(cleanEventTitle("Corn Days - Long Lake")).toBe("Corn Days – Long Lake");
    expect(cleanEventTitle("Art on Fire — Eagan Art Block")).toBe("Art on Fire – Eagan Art Block");
  });

  it("leaves hyphenated words alone", () => {
    expect(cleanEventTitle("Drop-In Art Making")).toBe("Drop-In Art Making");
  });

  it("never returns a gutted title", () => {
    expect(cleanEventTitle("(Exhibition)")).toBe("(Exhibition)");
  });

  it("cleans stacked noise in one pass", () => {
    expect(
      cleanEventTitle("Free First Saturday: Puppet Playdate (Weekly Saturdays) (Exhibition)"),
    ).toBe("Free First Saturday: Puppet Playdate");
  });
});

describe("displayCity", () => {
  it("canonicalizes the Saint/St variants seen on one live page", () => {
    expect(displayCity("Saint Paul")).toBe("St. Paul");
    expect(displayCity("St Paul")).toBe("St. Paul");
    expect(displayCity("St. Paul")).toBe("St. Paul");
    expect(displayCity("Saint Louis Park")).toBe("St. Louis Park");
  });

  it("leaves other cities alone", () => {
    expect(displayCity("Minneapolis")).toBe("Minneapolis");
    expect(displayCity("Stillwater")).toBe("Stillwater"); // "St" prefix inside a word untouched
  });
});
