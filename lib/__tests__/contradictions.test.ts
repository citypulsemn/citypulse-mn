import { describe, it, expect } from "vitest";
import {
  findContradictions,
  looksLikeSameEvent,
  formatFinding,
  CLASH_WINDOW_MINUTES,
  CONCURRENT_VENUES,
  isPlaceholderTitle,
  findPlaceholderTitles,
  type CalendarRow,
} from "../contradictions";

/**
 * Cases taken from the real calendar on 22 Aug 2026, plus the September 2026
 * Target Field pair that started all of this.
 */

const row = (
  id: string,
  venue: string,
  start: string,
  title: string,
  category = "music",
): CalendarRow => ({ id, venue, start, title, category });

describe("the case this exists for", () => {
  it("catches the Target Field pair that no feed was needed to disprove", () => {
    // 14 Sep 2026: the site showed a real Yankees game at 6:40 and a fictional
    // Orioles game at 7:10, same stadium. Thirty minutes apart, so an
    // exact-time check would have sailed straight past it.
    const r = findContradictions([
      row("a", "Target Field", "2026-09-14T18:40", "Minnesota Twins vs. New York Yankees", "sports"),
      row("b", "Target Field", "2026-09-14T19:10", "Minnesota Twins vs. Baltimore Orioles (Game 1)", "sports"),
    ]);
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0]).toMatchObject({ venue: "Target Field", day: "2026-09-14", minutesApart: 30 });
    expect(r.duplicates).toEqual([]);
  });

  it("catches three different acts in one room on one night", () => {
    // First Avenue, 14 Sep: Kamelot is the real show; Larry Fleet and The
    // Rapture are not. Three rows, three pairs, all conflicts.
    const r = findContradictions([
      row("a", "First Avenue", "2026-09-14T19:00", "Kamelot"),
      row("b", "First Avenue", "2026-09-14T20:00", "Larry Fleet"),
      row("c", "First Avenue", "2026-09-14T20:00", "The Rapture"),
    ]);
    expect(r.conflicts).toHaveLength(3);
    // Tightest clash first — the two at the same minute are least deniable.
    expect(r.conflicts[0].minutesApart).toBe(0);
  });
});

describe("duplicate vs conflict — two different jobs", () => {
  it("calls one title containing the other a duplicate", () => {
    const r = findContradictions([
      row("a", "Lake Harriet Bandshell", "2026-09-04T19:30", "Dan Israel"),
      row("b", "Lake Harriet Bandshell", "2026-09-04T19:30", "Free Music in the Parks – Dan Israel"),
    ]);
    expect(r.duplicates).toHaveLength(1);
    expect(r.conflicts).toEqual([]);
  });

  it("files an ABBREVIATED duplicate under conflict — the known cost of erring safe", () => {
    // The real Allianz Field pair. These are one match written two ways, but
    // "MNUFC vs. LA Galaxy" and "Minnesota United FC vs. Los Angeles Galaxy"
    // share only "galaxy" once the abbreviations are expanded, so the matcher
    // can't tell. It lands in `conflicts`, which is the direction we chose: a
    // human reads conflicts, glances at these two, and resolves it in seconds.
    // Calling it a duplicate on thin evidence is what would be dangerous.
    const r = findContradictions([
      row("a", "Allianz Field", "2026-09-19T19:30", "MNUFC vs. LA Galaxy", "sports"),
      row("b", "Allianz Field", "2026-09-19T19:30", "Minnesota United FC vs. Los Angeles Galaxy", "sports"),
    ]);
    expect(r.conflicts).toHaveLength(1);
    expect(r.duplicates).toEqual([]);
  });

  it("calls two genuinely different shows a conflict", () => {
    const r = findContradictions([
      row("a", "Hopkins Center for the Arts", "2026-09-01T20:00", "John Jorgenson Quintet"),
      row("b", "Hopkins Center for the Arts", "2026-09-01T20:00", "Ruthie Foster"),
    ]);
    expect(r.conflicts).toHaveLength(1);
  });

  it("errs toward CONFLICT when it can't tell — a conflict gets read, a duplicate doesn't", () => {
    const r = findContradictions([
      row("a", "Fitzgerald Theater", "2026-10-08T19:30", "Fitzgerald Theater Concert Event"),
      row("b", "Fitzgerald Theater", "2026-10-08T20:00", "ZOSO — The Ultimate LED ZEPPELIN Experience"),
    ]);
    expect(r.conflicts).toHaveLength(1);
  });
});

describe("looksLikeSameEvent", () => {
  it("matches identical and contained titles", () => {
    expect(looksLikeSameEvent("Apple Festival at Carpenter Nature Center", "Apple Festival at Carpenter Nature Center")).toBe(true);
    expect(looksLikeSameEvent("Dan Israel", "Free Music in the Parks – Dan Israel")).toBe(true);
    expect(looksLikeSameEvent("Fulton Oktoberfest – Weekend 2", "Fulton Brewery Oktoberfest – Weekend 2")).toBe(true);
  });

  it("does not match two different acts", () => {
    expect(looksLikeSameEvent("Kamelot", "Larry Fleet")).toBe(false);
    expect(looksLikeSameEvent("Guys and Dolls", "Irving Berlin's White Christmas")).toBe(false);
    expect(looksLikeSameEvent("John Jorgenson Quintet", "Ruthie Foster")).toBe(false);
  });

  it("refuses to let a short title dissolve into a longer one", () => {
    // Both directions must agree, so a single shared word in a long bill is not
    // enough to file a real clash under housekeeping.
    expect(looksLikeSameEvent("Sugar", "Fall Harvest Sugar Beet Festival and Parade Day")).toBe(false);
  });

  it("a SERIES is not a duplicate — same prefix, different act", () => {
    // The Lake Harriet bandshell runs "Free Music in the Parks" all summer. Three
    // of these were being filed as duplicates of each other and would have had a
    // real, distinct concert archived.
    expect(looksLikeSameEvent(
      "Free Music in the Parks – The Roundabouts",
      "Free Music in the Parks – Hurricane Blaze",
    )).toBe(false);
    expect(looksLikeSameEvent(
      "First Free Sunday — Minnesota Children's Museum",
      "First Free Sunday – Securian Financial",
    )).toBe(false);
  });

  it("…but the same act with and without the series prefix still is one", () => {
    expect(looksLikeSameEvent("Dan Israel", "Free Music in the Parks – Dan Israel")).toBe(true);
    expect(looksLikeSameEvent(
      "Free Music in the Parks – Dred I Dread",
      "Free Music in the Parks – Dred I Dread",
    )).toBe(true);
  });

  it("ignores the venue's own name inside a title", () => {
    // Two unrelated performances at the Walker looked alike purely on the
    // strength of the building they share.
    expect(looksLikeSameEvent(
      "Walker Art Center – Dorothée Munyaneza: Tituba",
      "Moriah Evans – Walker Art Center",
      "Walker Art Center – McGuire Theater",
    )).toBe(false);
    // The same two titles with no venue supplied would have matched.
    expect(looksLikeSameEvent(
      "Walker Art Center – Dorothée Munyaneza: Tituba",
      "Moriah Evans – Walker Art Center",
    )).toBe(true);
  });

  it("ignores accents, punctuation and filler words", () => {
    expect(looksLikeSameEvent("Altın Gün", "ALTIN GUN!")).toBe(true);
    expect(looksLikeSameEvent("The Show Night Live", "Show Live Night")).toBe(false); // all filler, no identity
  });
});

describe("the four-hour window", () => {
  it("leaves a real matinee and evening performance alone", () => {
    const r = findContradictions([
      row("a", "Guthrie Theater – Wurtele Thrust Stage", "2026-09-23T13:00", "Waiting for Godot – Matinee", "arts"),
      row("b", "Guthrie Theater – Wurtele Thrust Stage", "2026-09-23T19:30", "Waiting for Godot", "arts"),
    ]);
    expect(r.conflicts).toEqual([]);
    expect(r.duplicates).toEqual([]);
  });

  it("leaves an early show and a late one alone", () => {
    const r = findContradictions([
      row("a", "Parkway Theater", "2026-09-04T16:30", "Early Show"),
      row("b", "Parkway Theater", "2026-09-04T21:00", "Late Night Set"),
    ]);
    expect(r.conflicts).toEqual([]);
  });

  it("is exactly four hours", () => {
    expect(CLASH_WINDOW_MINUTES).toBe(240);
    const at = (t: string) => findContradictions([
      row("a", "V", `2026-09-04T19:00`, "One"),
      row("b", "V", `2026-09-04T${t}`, "Two"),
    ]).conflicts.length;
    expect(at("23:00")).toBe(1); // 240 minutes — still a clash
    expect(at("23:01")).toBe(0); // 241 — out of scope
  });

  it("never pairs across days", () => {
    const r = findContradictions([
      row("a", "First Avenue", "2026-09-14T22:00", "One Band"),
      row("b", "First Avenue", "2026-09-15T01:00", "Another Band"),
    ]);
    expect(r.conflicts).toEqual([]);
  });
});

describe("venues that really do run several things at once", () => {
  it("skips them — and says so, rather than dropping them silently", () => {
    const r = findContradictions([
      row("a", "Como Park Zoo & Conservatory", "2026-09-03T10:00", "General Admission", "family"),
      row("b", "Como Park Zoo & Conservatory", "2026-09-03T10:00", "Little Explorers Thursday", "family"),
    ]);
    expect(r.conflicts).toEqual([]);
    expect(r.duplicates).toEqual([]);
    expect(r.skipped).toEqual([{ venue: "Como Park Zoo & Conservatory", pairs: 1 }]);
  });

  it("matches the allowlist through punctuation and case", () => {
    const r = findContradictions([
      row("a", "CHANHASSEN DINNER THEATRES", "2026-10-24T18:00", "Guys and Dolls", "arts"),
      row("b", "CHANHASSEN DINNER THEATRES", "2026-10-24T18:00", "Irving Berlin's White Christmas", "arts"),
    ]);
    expect(r.conflicts).toEqual([]);
    expect(r.skipped[0].pairs).toBe(1);
  });

  it("every allowlist entry carries a reason", () => {
    for (const [venue, why] of Object.entries(CONCURRENT_VENUES)) {
      expect(why.length, `${venue} needs a justification`).toBeGreaterThan(8);
    }
  });
});

describe("placeholder venues", () => {
  it("flags a listing whose venue names no place", () => {
    const r = findContradictions([
      row("a", "TBD", "2026-09-11T00:00", "Carver Steamboat Days", "festival"),
      row("b", "Various Locations", "2026-09-11T00:00", "St. Paul Oktoberfest", "festival"),
    ]);
    expect(r.placeholderVenues.map((p) => p.title)).toEqual(["Carver Steamboat Days", "St. Paul Oktoberfest"]);
    // A non-place cannot clash with anything, so it produces no pair findings.
    expect(r.conflicts).toEqual([]);
  });

  it("leaves real venues alone", () => {
    const r = findContradictions([row("a", "Turf Club", "2026-09-04T19:00", "Red Desert")]);
    expect(r.placeholderVenues).toEqual([]);
  });
});

describe("placeholder titles — listings that name no event", () => {
  const ph = (title: string, venue = "") => isPlaceholderTitle(title, venue);

  it("catches the class the self-check only found by luck", () => {
    // Each of these was live, beside a real show, with a perfectly valid date,
    // venue and time — invisible to every other check.
    expect(ph("Turf Club Show (Sep 3)", "Turf Club")).toBe(true);
    expect(ph("Show (Aug 26)", "Amsterdam Bar and Hall (St Paul)")).toBe(true);
    expect(ph("Live Show – Berlin Minneapolis", "Berlin (Minneapolis)")).toBe(true);
    expect(ph("Early Evening Show (Sep 4)", "Berlin (Minneapolis)")).toBe(true);
    expect(ph("Concert at Ordway Concert Hall (The Ordway Presents)", "Ordway Concert Hall")).toBe(true);
    expect(ph("Hopkins Center for the Arts – Concert (September 26)", "Hopkins Center for the Arts")).toBe(true);
    expect(ph("Fitzgerald Theater Concert Event", "Fitzgerald Theater")).toBe(true);
    expect(ph("Bloomington Center for the Arts – Performance Series", "Bloomington Center for the Arts")).toBe(true);
  });

  it("spares events whose NAME is the venue's name", () => {
    // The false-positive class, and the reason a Tier A noun must be present.
    // Strip the venue words from these and nothing is left either — but that is
    // because the venue name IS the event name.
    expect(ph("Mill City Farmers Market (Saturday Market)", "Mill City Farmers Market")).toBe(false);
    expect(ph("Dead End Hayride", "Dead End Hayride")).toBe(false);
    expect(ph("Trail of Terror", "Trail of Terror Grounds")).toBe(false);
    expect(ph("Sever's Fall Festival (Weekend V)", "Sever's Fall Festival Grounds")).toBe(false);
    expect(ph("Scream Town — Opening Night 2026", "Scream Town")).toBe(false);
    expect(ph("Utepils Brewing Friday Night Live", "Utepils Brewing")).toBe(false);
    expect(ph("Minnesota Zoo – Daily General Admission", "Minnesota Zoo")).toBe(false);
  });

  it("spares a real event that merely contains a generic word", () => {
    expect(ph("Como Zoo & Conservatory Fall Flower Show (General Admission)", "Como Park Zoo & Conservatory")).toBe(false);
    expect(ph("Museum Nights", "Science Museum of Minnesota")).toBe(false);
    expect(ph("Late Night Lounge – DJ Set", "Berlin (Minneapolis)")).toBe(false);
    expect(ph("Emo Nite", "Fine Line")).toBe(false);
  });

  it("catches an unfilled slot outright", () => {
    expect(ph("Minnesota United FC vs. [Western Conference Opponent]", "Allianz Field")).toBe(true);
    expect(ph("Minnesota Gophers Football vs. Big Ten Opponent", "Huntington Bank Stadium")).toBe(true);
    expect(ph("Headliner TBA", "First Avenue")).toBe(true);
  });

  it("does NOT treat punctuation in a real title as an unfilled slot", () => {
    // The Walker programmes a piece literally called "}[…/+*^%<>€£¥$&@!!!^^^]{",
    // and a Lara Somogyi work called "a [time] pattern". A bare bracket rule
    // flags both. Only a bracket naming a SLOT counts.
    expect(ph("Moriah Evans: }[…/+*^%<>€£¥$&@!!!^^^]{", "Walker Art Center – McGuire Theater")).toBe(false);
    expect(ph("Minneapolis Premiere: Lara Somogyi – 'a [time] pattern'", "Berlin (Minneapolis)")).toBe(false);
  });

  it("reports what it found, sorted by day, with the reason", () => {
    const found = findPlaceholderTitles([
      row("a", "Turf Club", "2026-09-05T20:00", "Turf Club Show (Sep 5)"),
      row("b", "Turf Club", "2026-09-03T20:00", "Clung Tight"),
      row("c", "Allianz Field", "2026-09-19T19:30", "MNUFC vs. Opponent", "sports"),
    ]);
    expect(found.map((f) => f.title)).toEqual(["Turf Club Show (Sep 5)", "MNUFC vs. Opponent"]);
    expect(found[0].reason).toBe("names nothing");
    expect(found[1].reason).toBe("explicit");
  });

  it("an empty calendar finds nothing", () => {
    expect(findPlaceholderTitles([])).toEqual([]);
  });
});

describe("grouping", () => {
  it("does NOT fold two spellings of one venue together", () => {
    // "Turf Club" and "Turf Club (St Paul)" being different strings is its own
    // bug, for the dedupe pass. Folding them here would hide it inside a clash
    // report and fix neither.
    const r = findContradictions([
      row("a", "Turf Club", "2026-09-04T19:00", "Red Desert"),
      row("b", "Turf Club (St Paul)", "2026-09-04T19:00", "Something Else"),
    ]);
    expect(r.conflicts).toEqual([]);
  });

  it("a lone event at a venue is never a finding", () => {
    expect(findContradictions([row("a", "First Avenue", "2026-09-14T20:00", "Kamelot")]).conflicts).toEqual([]);
  });

  it("handles an empty calendar", () => {
    const r = findContradictions([]);
    expect(r).toEqual({ duplicates: [], conflicts: [], placeholderVenues: [], skipped: [] });
  });
});

describe("formatFinding", () => {
  it("says 'both' when the clash is on the same minute", () => {
    const r = findContradictions([
      row("a", "First Avenue", "2026-09-14T20:00", "Larry Fleet"),
      row("b", "First Avenue", "2026-09-14T20:00", "The Rapture"),
    ]);
    expect(formatFinding(r.conflicts[0])).toBe(
      '2026-09-14 · First Avenue (both 20:00): "Larry Fleet" / "The Rapture"',
    );
  });

  it("shows both clocks when they differ, and trims long titles", () => {
    const r = findContradictions([
      row("a", "Target Field", "2026-09-14T18:40", "Minnesota Twins vs. New York Yankees", "sports"),
      row("b", "Target Field", "2026-09-14T19:10", "Minnesota Twins vs. Baltimore Orioles (Game 1)", "sports"),
    ]);
    const line = formatFinding(r.conflicts[0]);
    expect(line).toContain("18:40 vs 19:10");
    expect(line).toContain("…"); // the Orioles title is over the limit
  });
});
