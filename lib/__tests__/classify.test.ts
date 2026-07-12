import { describe, it, expect } from "vitest";
import { classifyEvent, scoreCategories } from "../classify";
import type { CategoryKey } from "../types";

/**
 * GOLDEN SET (roadmap 4.1).
 *
 * These are REAL events taken from citypulsemn.com's live calendar, hand-labeled
 * with the category a Twin Cities local would expect. This is the regression net
 * for the taxonomy: if a change to the classifier starts calling concerts
 * "food" again (the bug that emptied the Live Music collection), these fail.
 *
 * The `agent` field is the category of the pipeline agent that plausibly found
 * the event — deliberately WRONG in several cases, to prove the classifier
 * ignores the discovery path and reads the event itself.
 */
interface GoldenCase {
  title: string;
  venue?: string;
  description?: string;
  agent: CategoryKey; // what the finding agent would have stamped
  expect: CategoryKey; // what it actually is
}

const GOLDEN: GoldenCase[] = [
  // ── The bug this feature fixes: music found by the food/festival agents ──
  { title: "Day Block Brewing Live Music Event", venue: "Day Block Brewing", agent: "food", expect: "music" },
  { title: "Beer Choir at Elm Creek Brewing", venue: "Elm Creek Brewing", agent: "food", expect: "music" },
  { title: "Beer Choir at MetroNOME Brewery", venue: "MetroNOME Brewery", agent: "food", expect: "music" },
  { title: "Groovin' in the Garden – Salsa del Soul", venue: "Como Park", agent: "festival", expect: "music" },
  { title: "Medalist Concert Band", venue: "Lake Harriet Bandshell", agent: "festival", expect: "music" },
  { title: "Oratorio Society of Minnesota Presents", venue: "Basilica", agent: "arts", expect: "music" },
  { title: "Groovers and Makers 2026: 4 Takes on Jazz Dance", venue: "The Cowles Center", agent: "festival", expect: "music" },

  // ── Sports (incl. the "vs." pattern) ──
  { title: "Minnesota Twins vs. Cleveland Guardians", venue: "Target Field", agent: "sports", expect: "sports" },
  { title: "Minnesota Lynx vs. New York Liberty", venue: "Target Center", agent: "sports", expect: "sports" },
  { title: "St. Paul Saints vs. Louisville Bats", venue: "CHS Field", agent: "sports", expect: "sports" },
  { title: "Minnesota Lynx vs. Phoenix Mercury — Peacock Game", venue: "Target Center", agent: "sports", expect: "sports" },

  // ── Arts ──
  { title: "Christine Sun Kim: All Day All Night (Exhibition)", venue: "Walker Art Center", agent: "arts", expect: "arts" },
  { title: "Suzanne Jackson: What Is Love (Exhibition)", venue: "Mia", agent: "arts", expect: "arts" },
  { title: "In the Heights (Artistry / Bloomington Center for the Arts)", venue: "Bloomington Center for the Arts", agent: "arts", expect: "arts" },
  { title: "Willow (Screening) by Ron Howard", venue: "Trylon Cinema", agent: "arts", expect: "arts" },
  { title: "Green Roof Poetry: Curated by Cindi Martin", venue: "Central Library", agent: "arts", expect: "arts" },
  { title: "Loring Park Art Festival", venue: "Loring Park", agent: "festival", expect: "arts" },
  { title: "Minnehaha Falls Art Fair", venue: "Minnehaha Park", agent: "festival", expect: "arts" },
  { title: "Stone Arch Bridge Art Fair", venue: "Stone Arch Bridge", agent: "festival", expect: "arts" },

  // ── Food & drink ──
  { title: "Mpls.St.Paul Magazine Summer Restaurant Week 2026", agent: "food", expect: "food" },
  { title: "Slice of Shoreview — Taste of Shoreview", venue: "Shoreview", agent: "festival", expect: "food" },
  { title: "Thai Sunday Market at Wat Promwachirayan", venue: "Wat Promwachirayan", agent: "food", expect: "food" },

  // ── Family ──
  { title: "Monsters on Vacation – Children's Museum Immersive Exhibit", venue: "Minnesota Children's Museum", agent: "arts", expect: "family" },
  { title: "Toddler Storytime at the Library", venue: "Hennepin County Library", agent: "arts", expect: "family" },
  { title: "Kids' Day at the Minnesota Zoo", venue: "Minnesota Zoo", agent: "festival", expect: "family" },
  // An art class is ARTS even if it's all-ages — the subject is the event.
  // (The golden set is where we settle these judgment calls explicitly.)
  { title: "Free Drop-In Art Making at Bloomington Farmers Market", description: "All ages welcome", agent: "food", expect: "arts" },

  // ── Festivals (true catch-all cases) ──
  { title: "Ramsey County Fair", venue: "Ramsey County Fairgrounds", agent: "festival", expect: "festival" },
  { title: "Anoka County Fair", agent: "festival", expect: "festival" },
  { title: "Washington County Fair", agent: "festival", expect: "festival" },
  { title: "Chaska River City Days", agent: "festival", expect: "festival" },
  { title: "Leprechaun Days (Rosemount)", agent: "festival", expect: "festival" },

  // ── Weird / unique ──
  { title: "Utepils Brewing Free Meat & Cheese Raffle (Weekly Tuesdays)", venue: "Utepils Brewing", agent: "food", expect: "weird" },

  // ── Ambiguity traps: genre words that are ordinary English (caught in
  //    testing against the live data — "Country Club" was being filed as music).
  { title: "Minnesota Country Club Festival", agent: "festival", expect: "festival" },
  { title: "Rock Climbing Open House", venue: "Vertical Endeavors", agent: "sports", expect: "sports" },
  { title: "Soul Food Sunday", agent: "food", expect: "food" },
  { title: "Folk Art Exhibition", venue: "Mia", agent: "arts", expect: "arts" },
  // …but a real genre event in musical context is still music:
  { title: "Country Music Night at the Turf Club", venue: "Turf Club", agent: "food", expect: "music" },

  // ── Cases found by running against the LIVE database export (4.1 backfill).
  //    Every one of these was a real misclassification the classifier produced
  //    before these guards existed. They are the reason the arts-venue guard exists.
  { title: "Annie", venue: "Chanhassen Dinner Theatres", agent: "arts", expect: "arts" },          // "DINNER Theatres" ≠ food
  { title: "Guys and Dolls", venue: "Chanhassen Dinner Theatres", agent: "arts", expect: "arts" },
  { title: "Skyline Mini Golf", venue: "Walker Art Center (Rooftop)", agent: "arts", expect: "arts" }, // rooftop art installation, not sport
  { title: "Meet at Mia: Building Blocks", venue: "Minneapolis Institute of Art", agent: "arts", expect: "arts" }, // "meet" ≠ track meet
  { title: "Minnesota Fringe Festival", venue: "Various Twin Cities Venues", agent: "arts", expect: "arts" }, // theatre festival is arts
  { title: "Twin Cities Shakespeare Festival", venue: "Theatre in the Round", agent: "arts", expect: "arts" },
  // …and the corrections it SHOULD make in an arts venue:
  { title: "SPCO Opening Weekend: Beethoven's Second Symphony", venue: "Ordway Concert Hall", agent: "arts", expect: "music" },
  { title: "Cantus Vocal Ensemble Presents", venue: "Ordway Concert Hall", agent: "arts", expect: "music" },
  { title: "Mia Family Day", venue: "Minneapolis Institute of Art", agent: "arts", expect: "family" }, // explicit family beats the arts floor
  { title: "Free First Saturday: Puppet Playdate", venue: "Walker Art Center", agent: "arts", expect: "family" },

  // ── Second live-export batch (festival/food): the music hiding in the
  //    festival and food buckets — this is what fills the Live Music collection.
  { title: "Lakeside Guitar Festival", venue: "Como Lakeside Pavilion", agent: "festival", expect: "music" },
  { title: "Washington County Bluegrass Festival", venue: "Lake Elmo Park Reserve", agent: "festival", expect: "music" },
  { title: "Outlaw Music Festival", venue: "Mystic Lake Amphitheater", agent: "festival", expect: "music" },
  { title: "Uptown Porchfest", venue: "Uptown Neighborhood", agent: "festival", expect: "music" },
  { title: "Beer Choir at Forgotten Star Brewing", venue: "Forgotten Star Brewing Company", agent: "food", expect: "music" },
  { title: "Powderhorn Art Fair", venue: "Powderhorn Park", agent: "festival", expect: "arts" },
  { title: "Minnesota Food Truck Festival", venue: "Father Hennepin Bluff Park", agent: "festival", expect: "food" },
  { title: "Carver County Fair", venue: "Carver County Fairgrounds", agent: "food", expect: "festival" },
];

describe("classifyEvent — golden set of real City Pulse events", () => {
  for (const c of GOLDEN) {
    it(`"${c.title}" → ${c.expect}`, () => {
      const result = classifyEvent({
        title: c.title,
        venue: c.venue,
        description: c.description,
        category: c.agent,
      });
      expect(result.category).toBe(c.expect);
    });
  }

  it("classifies the whole golden set correctly", () => {
    const wrong = GOLDEN.filter(
      (c) =>
        classifyEvent({ title: c.title, venue: c.venue, description: c.description, category: c.agent })
          .category !== c.expect,
    );
    expect(wrong.map((w) => w.title)).toEqual([]);
  });
});

describe("classifier behavior", () => {
  it("ignores the discovery path — same event, different finding agent, same result", () => {
    const ev = { title: "Live Music at the Turf Club", venue: "Turf Club" };
    const asFood = classifyEvent({ ...ev, category: "food" });
    const asFestival = classifyEvent({ ...ev, category: "festival" });
    const asMusic = classifyEvent({ ...ev, category: "music" });
    expect(asFood.category).toBe("music");
    expect(asFestival.category).toBe("music");
    expect(asMusic.category).toBe("music");
  });

  it("reports when it overrode the agent", () => {
    const r = classifyEvent({ title: "Jazz Quartet in Concert", category: "food" });
    expect(r.category).toBe("music");
    expect(r.changed).toBe(true);

    const same = classifyEvent({ title: "Jazz Quartet in Concert", category: "music" });
    expect(same.changed).toBe(false);
  });

  it("festival is the weakest claim — a specific category beats it", () => {
    const artFest = classifyEvent({ title: "Powderhorn Art Festival", category: "festival" });
    expect(artFest.category).toBe("arts");

    const musicFest = classifyEvent({ title: "Rock the Garden Music Festival", category: "festival" });
    expect(musicFest.category).toBe("music");
  });

  it("a brewery hosting a concert is music, not food", () => {
    const r = classifyEvent({
      title: "Indie Rock Night",
      venue: "Surly Brewing Festival Field",
      category: "food",
    });
    expect(r.category).toBe("music");
  });

  it("a brewery event that IS about beer stays food", () => {
    const r = classifyEvent({
      title: "Barrel-Aged Beer Tasting",
      venue: "Surly Brewing",
      category: "music",
    });
    expect(r.category).toBe("food");
  });

  it("keeps the agent's category when nothing scores (no wild guessing)", () => {
    const r = classifyEvent({ title: "Zyzzyx Quorlan", category: "arts" });
    expect(r.category).toBe("arts");
    expect(r.confidence).toBe(0);
    expect(r.changed).toBe(false);
  });

  it("avoids substring traps ('art' must not match 'party')", () => {
    const scores = scoreCategories({ title: "Block Party" });
    expect(scores.arts).toBe(0);
  });

  it("is deterministic", () => {
    const ev = { title: "Symphony Orchestra Performs Mahler", venue: "Orchestra Hall", category: "festival" };
    expect(classifyEvent(ev)).toEqual(classifyEvent(ev));
  });
});
