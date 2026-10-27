import { describe, it, expect } from "vitest";
import {
  distinctiveTokens,
  pageEntries,
  checkTitleOnPage,
  pageCoversDate,
  isTransientNetworkError,
  htmlToText,
  stalestFirst,
  pageLastChecked,
  leadSegment,
  opponentSegment,
  fixtureRow,
  venueMarks,
  pageNote,
  noteCategory,
  type SourceCheck,
  type UncheckedWhy,
} from "../source-presence";

/**
 * The programmes page covers 26 Sep, which is what licenses a negative.
 *
 * `minIndexEntries` is lowered only because the fixture below is a TRIMMED
 * extract — the real page carries 208 dated entries, comfortably past the
 * default of 50. The gate itself is exercised at its default in
 * "the default bar refuses a page this small" further down.
 */
const SEP26 = { day: "2026-09-26", minIndexEntries: 8 };

/**
 * The page below is a trimmed but VERBATIM extract of
 * threeriversparks.org/programs as it stood on 14 Sep 2026 — the page
 * "Prairie Bathing Under a Harvest Moon" cited as its source while not being on
 * it. Every real programme line here is real.
 */
const THREE_RIVERS = `
BAKER OUTDOOR LEARNING CENTER
Sunday, September 27: Campfire Cooking: Pie Iron Perfection
CLEARY LAKE REGIONAL PARK
Saturday, September 19: Fall Colors Family Canoeing
Friday, October 16: Fall Colors Guided Forest Bathing
Thursday, October 29: Moonlit Magic and Spooky Stories
CROW-HASSAN PARK RESERVE
Tuesday, September 15: Prairie Seed Collection
Saturday, September 19: Biking Through History: As the Crow Flows
EASTMAN NATURE CENTER
Saturday, September 26: Ecology of Dice & Dragons: Fury of the Elementals
Saturday, October 31: Night on the Prairie
GALE WOODS FARM
Saturday, September 26: Saturday Morning on the Farm
Sunday, October 12: Preserving the Harvest: Pickling and Fermenting
HYLAND LAKE PARK RESERVE
Saturday, September 26: Prairie Seed Collection
MISSISSIPPI GATEWAY REGIONAL PARK
Sunday, September 20: Drop-In Discoveries: Meet the Animal Ambassadors
Sunday, September 20: Watercolors at the River
RICHARDSON NATURE CENTER
Friday, October 9: My Preschooler & Me: Fall Harvest
SILVERWOOD PARK
Saturday, September 26: Fall Embroidery on Paper Workshop for Beginners
`;

describe("the fabrication this was built for", () => {
  it("catches a title whose words are all on the page but never together", () => {
    // THE WHOLE POINT. "prairie" is on that page, and so are "bathing",
    // "harvest" and "moon" — four for four. A page-level match would have
    // cleared this listing, which is how it stayed live and stamped verified.
    const r = checkTitleOnPage("Prairie Bathing Under a Harvest Moon", THREE_RIVERS, SEP26);
    expect(r.kind).toBe("absent");
    expect(r.kind === "absent" && r.score).toBeLessThan(0.5);
  });

  it("confirms every word really is somewhere on that page", () => {
    // Guards the premise of the test above: if this ever stops being true the
    // first test starts passing for the wrong reason.
    const page = THREE_RIVERS.toLowerCase();
    for (const w of ["prairie", "bathing", "harvest", "moon"]) {
      expect(page, w).toContain(w);
    }
  });

  it("still finds the real programmes on the same page", () => {
    for (const real of [
      "Fall Colors Family Canoeing",
      "Fall Colors Guided Forest Bathing",
      "Night on the Prairie",
      "Campfire Cooking: Pie Iron Perfection",
      "Drop-In Discoveries: Meet the Animal Ambassadors",
      "Watercolors at the River",
      "Biking Through History: As the Crow Flows",
    ]) {
      expect(checkTitleOnPage(real, THREE_RIVERS, SEP26).kind, real).toBe("present");
    }
  });
});

describe("distinctiveTokens", () => {
  it("keeps the words that identify and drops the ones that don't", () => {
    expect(distinctiveTokens("Prairie Bathing Under a Harvest Moon")).toEqual([
      "prairie", "bathing", "harvest", "moon",
    ]);
  });

  it("drops years, which every listing on a page shares", () => {
    expect(distinctiveTokens("Viking Fest Minnesota 2026")).toEqual(["viking", "fest", "minnesota"]);
  });

  it("keeps generic-sounding words that are doing real work", () => {
    // Strip these and "Night on the Prairie" becomes "prairie", which matches
    // half the page.
    expect(distinctiveTokens("Night on the Prairie")).toEqual(["night", "prairie"]);
    expect(distinctiveTokens("Fall Colors Family Canoeing")).toEqual([
      "fall", "colors", "family", "canoeing",
    ]);
  });

  it("de-duplicates and survives punctuation and apostrophes", () => {
    expect(distinctiveTokens("Scream Town — Scream Town's Opening Night")).toEqual([
      "scream", "town", "towns", "opening", "night",
    ]);
  });

  it("returns nothing for a title made only of noise", () => {
    expect(distinctiveTokens("The A & Of")).toEqual([]);
    expect(distinctiveTokens("")).toEqual([]);
  });
});

describe("pageEntries — one entry is the unit, never the page", () => {
  it("splits on the separators index pages actually use", () => {
    expect(pageEntries("Alpha\nBeta | Gamma • Delta")).toEqual(["Alpha", "Beta", "Gamma", "Delta"]);
  });

  it("breaks up a long prose line so several events cannot pool their words", () => {
    const prose =
      "Come to the Harvest Moon party at the barn on Friday. " +
      "Separately, our Prairie Bathing session runs in the spring and is not related at all to it. " +
      "Tickets for both are available at the front desk during opening hours every day.";
    const entries = pageEntries(prose);
    expect(entries.length).toBeGreaterThan(1);
    expect(entries.some((e) => /harvest moon/i.test(e) && /prairie bathing/i.test(e))).toBe(false);
  });
});

describe("a doubt is always `unchecked`, never an accusation", () => {
  it("refuses to judge a thin page", () => {
    const r = checkTitleOnPage("Prairie Bathing Under a Harvest Moon", "Access denied.", SEP26);
    expect(r.kind).toBe("unchecked");
    expect(r.kind === "unchecked" && r.reason).toMatch(/characters/);
  });

  it("refuses to judge a short title — one or two words prove nothing", () => {
    // A real listing. Calling it fabricated because "Sting" is not on an index
    // page would be exactly the wrong kind of confident.
    for (const t of ["Sting", "Now Now", "Kamelot"]) {
      const r = checkTitleOnPage(t, THREE_RIVERS, SEP26);
      expect(r.kind, t).toBe("unchecked");
    }
  });

  it("refuses to judge a title made only of stopwords", () => {
    expect(checkTitleOnPage("The Of And", THREE_RIVERS, SEP26).kind).toBe("unchecked");
  });

  it("puts a partial match in the grey band rather than accusing", () => {
    // We routinely embellish titles. "Fulton Brewery Oktoberfest – Weekend 1"
    // against a page that says "Fulton Oktoberfest" must not read as invented.
    const page = `
      OUR EVENTS
      Fulton Oktoberfest runs across two weekends this autumn at the NE taproom.
      Come early, the beer garden fills up fast and the lines get long by six.
      Fulton Brewery also hosts run club on Tuesdays and trivia every Thursday.
    `.repeat(3);
    const r = checkTitleOnPage("Fulton Brewery Oktoberfest – Weekend 1", page, { day: "2026-09-19" });
    expect(r.kind).not.toBe("absent");
  });

  it("never reports absent without having actually looked at entries", () => {
    const r = checkTitleOnPage("Prairie Bathing Under a Harvest Moon", THREE_RIVERS, SEP26);
    expect(r.kind === "absent" && r.best.length).toBeGreaterThan(0);
  });
});

describe("htmlToText", () => {
  it("keeps visible text and drops markup, scripts and styles", () => {
    const html =
      "<html><head><title>Programs</title><style>.a{color:red}</style>" +
      "<script>var x = 'Prairie Bathing Under a Harvest Moon';</script></head>" +
      "<body><ul><li>Saturday, September 26: Prairie Seed Collection</li>" +
      "<li>Friday, October 16: Fall Colors Guided Forest Bathing</li></ul></body></html>";
    const text = htmlToText(html);
    expect(text).toContain("Prairie Seed Collection");
    expect(text).toContain("Fall Colors Guided Forest Bathing");
    // The fabricated title sat inside a <script>. If markup stripping let that
    // through, every listing would match on its own page furniture.
    expect(text).not.toContain("Prairie Bathing");
    expect(text).not.toContain("color:red");
  });

  it("splits block elements onto their own lines so entries stay separate", () => {
    const text = htmlToText("<li>Harvest Moon party</li><li>Prairie Bathing session</li>");
    expect(pageEntries(text).length).toBe(2);
  });

  it("decodes the entities an index page actually contains", () => {
    expect(htmlToText("<p>Dice &amp; Dragons</p>")).toContain("Dice & Dragons");
    expect(htmlToText("<p>a&nbsp;b</p>")).toContain("a b");
  });
});

describe("pageCoversDate — the gate that stopped three false accusations", () => {
  it("recognises the forms an index page actually writes a date in", () => {
    for (const t of [
      "Saturday, September 26: Prairie Seed Collection",
      "Sept 26 — Fall Festival",
      "Sep. 26",
      "26 September 2026",
      "9/26/2026",
      "09-26",
      "2026-09-26",
    ]) {
      expect(pageCoversDate(t, "2026-09-26"), t).toBe(true);
    }
  });

  it("does not let a nearby date pass for the one asked about", () => {
    // "September 2" must not satisfy a query for the 26th, and vice versa.
    expect(pageCoversDate("Wednesday, September 2: Autumn Walk", "2026-09-26")).toBe(false);
    expect(pageCoversDate("Saturday, September 26: Autumn Walk", "2026-09-02")).toBe(false);
  });

  it("is false for a page that simply does not mention the day", () => {
    expect(pageCoversDate("Today at the Arb — Sunday, September 14", "2026-09-26")).toBe(false);
  });

  it("is false rather than throwing on a malformed date", () => {
    for (const d of ["", "26 Sep 2026", "2026-13-99", null as unknown as string]) {
      expect(pageCoversDate("September 26", d), String(d)).toBe(false);
    }
  });
});

describe("a windowed index can never convict", () => {
  // The three real Arboretum listings this check flagged on its first run. The
  // matching was right; the page was "Today at the Arb", which has nothing to
  // say about the 26th either way.
  const TODAY_AT_THE_ARB = `
    Today at the Arb - Arboretum Calendar of Events
    Skip to main content
    University of Minnesota Landscape Arboretum
    Sunday, September 14
    Gardens & Grounds open 8 a.m. to 8 p.m.
    Three Mile Drive is open to vehicles today.
    Visit the Marion Andrus Learning Center for family activities all afternoon.
    Members enter free; general admission is twelve dollars at the gate today.
  `.repeat(4);

  it("reports unchecked, not absent, when the page does not cover the date", () => {
    const r = checkTitleOnPage("Garden-to-Plate Evening Experience", TODAY_AT_THE_ARB, {
      day: "2026-09-26",
    });
    expect(r.kind).toBe("unchecked");
    // Two gates can refuse this page — it is neither an index nor does it cover
    // the date. Which one fires first is an implementation detail; that it
    // refuses rather than accuses is the property under test.
    expect(r.kind === "unchecked" && r.reason).toMatch(/dated entries|lists nothing on 2026-09-26/);
  });

  it("refuses to convict when no date is supplied at all", () => {
    const r = checkTitleOnPage("Garden-to-Plate Evening Experience", TODAY_AT_THE_ARB);
    expect(r.kind).toBe("unchecked");
  });

  it("still convicts on a page that DOES cover the date", () => {
    // The difference between the Arb page and the Three Rivers one is not the
    // title matching — it is whether the page speaks to that day at all.
    expect(checkTitleOnPage("Prairie Bathing Under a Harvest Moon", THREE_RIVERS, SEP26).kind).toBe(
      "absent",
    );
  });
});

describe("a page whose listings we cannot see convicts nobody", () => {
  /**
   * arb.umn.edu/events/calendar as fetched on 14 Sep 2026. It renders its
   * events with JavaScript, so the only readable text is the navigation menu —
   * and it happens to mention the date in a date-picker. The first two versions
   * of this check flagged three REAL Arboretum listings against pages like this
   * one, which is the whole reason `minDatedEntries` exists.
   */
  const JS_CALENDAR = `
    Today at the Arb - Arboretum Calendar of Events
    Skip to main content
    University of Minnesota Landscape Arboretum
    Gardens & Grounds
    Garden Highlights
    At-Home Gardening
    Urban Garden Program
    Guided Garden Tours
    Visit
    Learn
    Support
    Members enter free. General admission applies to all other visitors daily.
  `.repeat(3);

  it("reports unchecked when the date appears but no dated entries do", () => {
    const r = checkTitleOnPage("Garden-to-Plate Evening Experience", JS_CALENDAR, {
      day: "2026-09-26",
    });
    expect(r.kind).toBe("unchecked");
    expect(r.kind === "unchecked" && r.reason).toMatch(/JavaScript|only \d+ entry/);
  });

  it("is not fooled by a single dated entry either", () => {
    const one = JS_CALENDAR + "\nSaturday, September 26: Members-only morning\n";
    expect(checkTitleOnPage("Garden-to-Plate Evening Experience", one, { day: "2026-09-26" }).kind)
      .toBe("unchecked");
  });

  it("convicts once the page really does list that day", () => {
    // Three Rivers carries seven entries for 26 Sep. That is the difference.
    expect(checkTitleOnPage("Prairie Bathing Under a Harvest Moon", THREE_RIVERS, SEP26).kind)
      .toBe("absent");
  });

  it("the caller can tighten the bar but never silently loosen the date gate", () => {
    // minDatedEntries is adjustable; the requirement for a date is not.
    expect(checkTitleOnPage("Prairie Bathing Under a Harvest Moon", THREE_RIVERS, {
      ...SEP26, minDatedEntries: 99,
    }).kind).toBe("unchecked");
  });
});

describe("only an index can convict", () => {
  it("the default bar refuses a page this small", () => {
    // The trimmed fixture has ~20 dated entries. At the real default of 50 it
    // is not an index, so even the genuine fabrication goes unchecked — which
    // is the conservative direction and the whole point of the bar.
    const r = checkTitleOnPage("Prairie Bathing Under a Harvest Moon", THREE_RIVERS, {
      day: "2026-09-26",
    });
    expect(r.kind).toBe("unchecked");
    expect(r.kind === "unchecked" && r.reason).toMatch(/dated entries/);
  });

  it("a single-event page never convicts, however decorated our title is", () => {
    // hennepinarts.org/events/clue-2026, which flagged three real Clue
    // performances on the first full sweep. Our titles carry "(Broadway on
    // Hennepin) – Saturday Performance"; the page just says Clue.
    const CLUE_PAGE = `
      Clue - Hennepin Arts
      Buy Tickets  Plan Your Visit  Accessibility  Groups  Donate
      Clue comes to the Orpheum Theatre this autumn in a new touring production.
      Performances run October 9 through October 11 with evening and matinee times.
      Based on the film and the Hasbro board game, it is a madcap whodunnit.
      Run time is ninety minutes with no intermission. Recommended for ages ten and up.
    `.repeat(6);
    const r = checkTitleOnPage("Clue (Broadway on Hennepin) – Saturday Performance", CLUE_PAGE, {
      day: "2026-10-10",
    });
    expect(r.kind).toBe("unchecked");
  });
});

describe("isTransientNetworkError — what the crash guard may swallow", () => {
  it("recognises the exact error that killed the first full sweep", () => {
    // Reproduced from the crash at page 580 of 677 on 14 Sep 2026.
    const real = Object.assign(new Error("other side closed"), {
      name: "SocketError",
      code: "UND_ERR_SOCKET",
    });
    expect(isTransientNetworkError(real)).toBe(true);
  });

  it("recognises the rest of the family", () => {
    for (const [code, message] of [
      ["ECONNRESET", "read ECONNRESET"],
      ["ETIMEDOUT", "connect ETIMEDOUT"],
      ["ENOTFOUND", "getaddrinfo ENOTFOUND example.org"],
      ["EAI_AGAIN", "getaddrinfo EAI_AGAIN"],
      ["EPIPE", "write EPIPE"],
      ["", "terminated"],
      ["", "socket hang up"],
    ] as [string, string][]) {
      expect(isTransientNetworkError(Object.assign(new Error(message), { code })), message).toBe(true);
    }
  });

  it("does NOT swallow a real bug — that is the whole risk of this guard", () => {
    for (const err of [
      new TypeError("checkTitleOnPage is not a function"),
      new RangeError("Maximum call stack size exceeded"),
      Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" }),
      new Error("Cannot read properties of undefined (reading 'slice')"),
      new SyntaxError("Unexpected token < in JSON at position 0"),
    ]) {
      expect(isTransientNetworkError(err), String(err)).toBe(false);
    }
  });

  it("is false for nothing at all rather than throwing", () => {
    for (const v of [null, undefined, "boom", 42]) {
      expect(isTransientNetworkError(v), String(v)).toBe(false);
    }
  });
});

describe("stalestFirst", () => {
  it("puts never-checked pages ahead of every checked one", () => {
    expect(
      stalestFirst([
        { url: "b.com", lastChecked: "2026-09-01T00:00:00Z" },
        { url: "a.com", lastChecked: null },
      ]),
    ).toEqual(["a.com", "b.com"]);
  });

  it("orders checked pages oldest first", () => {
    expect(
      stalestFirst([
        { url: "new.com", lastChecked: "2026-09-20T00:00:00Z" },
        { url: "old.com", lastChecked: "2026-09-01T00:00:00Z" },
        { url: "mid.com", lastChecked: "2026-09-10T00:00:00Z" },
      ]),
    ).toEqual(["old.com", "mid.com", "new.com"]);
  });

  it("is deterministic when stamps tie, and does not mutate its input", () => {
    const pages = [
      { url: "z.com", lastChecked: null },
      { url: "a.com", lastChecked: null },
    ];
    expect(stalestFirst(pages)).toEqual(["a.com", "z.com"]);
    expect(pages[0].url).toBe("z.com");
  });

  it("covers every page within ceil(n/limit) runs rather than repeating one slice", () => {
    // The actual defect: an alphabetical order re-checks the same head forever.
    const LIMIT = 2;
    let pages = ["a", "b", "c", "d", "e"].map((url) => ({ url, lastChecked: null as string | null }));
    const seen = new Set<string>();
    for (let run = 1; run <= 3; run++) {
      const picked = stalestFirst(pages).slice(0, LIMIT);
      picked.forEach((u) => seen.add(u));
      const stamp = `2026-09-0${run}T00:00:00Z`;
      pages = pages.map((p) => (picked.includes(p.url) ? { ...p, lastChecked: stamp } : p));
    }
    expect([...seen].sort()).toEqual(["a", "b", "c", "d", "e"]);
  });
});

describe("pageLastChecked", () => {
  it("returns the oldest stamp on the page", () => {
    expect(
      pageLastChecked([
        { source_checked_at: "2026-09-10T00:00:00Z" },
        { source_checked_at: "2026-09-02T00:00:00Z" },
      ]),
    ).toBe("2026-09-02T00:00:00Z");
  });

  it("treats a page with any unstamped listing as never checked", () => {
    expect(
      pageLastChecked([
        { source_checked_at: "2026-09-10T00:00:00Z" },
        { source_checked_at: null },
      ]),
    ).toBeNull();
  });
});

/**
 * A verbatim trimmed extract of targetcenter.com/events/all as it stood on
 * 27 Oct 2026 — the page that produced three of the four flags in the first
 * sweep after a four-week outage, every one of them false. The act is on its
 * own line and the date on the line above it; our stored titles carry the tour
 * name that this page never prints.
 */
const TARGET_CENTER = `
TARGET CENTER
Wed, Oct 28 , 2026 - 7:00 PM
Minnesota Timberwolves vs Golden State Warriors
Buy Tickets Premium
Fri, Oct 30 , 2026 - 7:00 PM
Minnesota Timberwolves vs Los Angeles Clippers
Buy Tickets More Info
Sun, Nov 1 , 2026 - 7:00 PM
Live Nation Presents
SOMBR
with special guests The Last Dinner Party and Hannah Jadagu
Buy Tickets Premium
Mon, Nov 2 , 2026 - 7:00 PM
Minnesota Timberwolves vs Milwaukee Bucks
Buy Tickets More Info
Sat, Nov 7 , 2026 - 8:00 PM
Live Nation Presents
KATSEYE
Buy Tickets Premium
Sun, Nov 8 , 2026 - 6:00 PM
Minnesota Timberwolves vs Utah Jazz
Buy Tickets More Info
Tue, Nov 10 , 2026 - 6:30 PM
Live Nation Presents
Motionless In White
with special guests Dayseeker, The Devil Wears Prada & Dark Divine
Buy Tickets Premium
Thu, Nov 12 , 2026 - 7:00 PM
Minnesota Timberwolves vs Dallas Mavericks
Buy Tickets More Info
Sat, Nov 14 , 2026 - 7:00 PM
Minnesota Timberwolves vs Chicago Bulls
Buy Tickets More Info
Sun, Nov 15 , 2026 - 7:00 PM
Awakening Events Presents
MercyMe
with special guests Jeremy Camp and Tim Timmons + Sam Wesley
Buy Tickets Premium
`;

/**
 * Both bars are lowered because the fixture is a TRIMMED extract: the live page
 * carries 394 entries and renders each event twice, so it clears the defaults of
 * 50 index entries and 2 dated entries for the day on its own. Both gates are
 * exercised at their defaults elsewhere in this file.
 */
const tc = (day: string) => ({ day, minIndexEntries: 8, minDatedEntries: 1 });

describe("leadSegment — our title carries the tour, the venue lists the act", () => {
  it("takes the head off the decorations an index page never prints", () => {
    expect(leadSegment("SOMBR: You Are The Reason Tour")).toBe("SOMBR");
    expect(leadSegment("Motionless In White: The Sweat and Blood Tour")).toBe("Motionless In White");
    expect(leadSegment("Fulton Oktoberfest – Weekend 1")).toBe("Fulton Oktoberfest");
    expect(leadSegment("Clue - Saturday Performance")).toBe("Clue");
    expect(leadSegment("Hadestown — Opening Night")).toBe("Hadestown");
  });

  it("is empty when a title carries no decoration at all", () => {
    // The gate must not fire for these, which is what keeps the sports hole shut.
    expect(leadSegment("Minnesota Twins vs Chicago White Sox")).toBe("");
    expect(leadSegment("Prairie Bathing Under a Harvest Moon")).toBe("");
  });

  it("does not treat a hyphen inside a word as decoration", () => {
    expect(leadSegment("Drop-In Discoveries: Meet the Animal Ambassadors")).toBe("Drop-In Discoveries");
    expect(leadSegment("Drop-In Discoveries")).toBe("");
  });

  it("refuses a lead too short to identify anything", () => {
    expect(leadSegment("Q: The Quiz")).toBe("");
  });

  it("is empty rather than throwing on nothing at all", () => {
    expect(leadSegment("")).toBe("");
    expect(leadSegment(undefined as unknown as string)).toBe("");
  });
});

describe("the three false flags of 27 Oct 2026", () => {
  /**
   * Every flag the first sweep in four weeks produced against this page, and
   * all three acts are printed on it verbatim. The one-directional score
   * divides by OUR token count, so "SOMBR" matched perfectly and still read
   * 0.333 against "SOMBR: You Are The Reason Tour".
   */
  const CASES: [string, string, string][] = [
    ["SOMBR: You Are The Reason Tour", "2026-11-01", "SOMBR"],
    ["KATSEYE: THE WILDWORLD TOUR", "2026-11-07", "KATSEYE"],
    ["Motionless In White: The Sweat and Blood Tour", "2026-11-10", "Motionless In White"],
  ];

  for (const [title, day, act] of CASES) {
    it(`does not accuse "${title}" on a page that prints "${act}"`, () => {
      const r = checkTitleOnPage(title, TARGET_CENTER, tc(day));
      expect(r.kind).toBe("unchecked");
      // Assert WHICH doubt. Without this the test passes on any gate that
      // happens to fire first, and would have gone green before the fix.
      expect(r.kind === "unchecked" && r.reason).toContain(act);
    });
  }

  it("the page is convictable, so the tests above are not passing on a gate", () => {
    // Same page, same options, a title whose lead is genuinely not there.
    const r = checkTitleOnPage("Prairie Bathing: Harvest Moon Walk", TARGET_CENTER, tc("2026-11-01"));
    expect(r.kind).toBe("absent");
  });

  it("abstains rather than confirming — an act on the calendar is not a date", () => {
    // The gate may only ever turn a negative into a doubt. If it ever reports
    // `present` it is attesting a date that nothing on the page attests.
    for (const [title, day] of CASES) {
      expect(checkTitleOnPage(title, TARGET_CENTER, tc(day)).kind, title).not.toBe("present");
    }
  });
});

describe("what the lead-segment gate must never clear", () => {
  it("still catches the fabrication, whose title has no decoration to strip", () => {
    const r = checkTitleOnPage("Prairie Bathing Under a Harvest Moon", THREE_RIVERS, SEP26);
    expect(r.kind).toBe("absent");
  });

  it("still catches it when the title IS decorated and the lead is absent too", () => {
    const r = checkTitleOnPage("Prairie Bathing: Under a Harvest Moon", THREE_RIVERS, SEP26);
    expect(r.kind).toBe("absent");
  });

  it("a bare category link does not clear a real absence", () => {
    // The reason the gate reads a LEAD and not any prefix: "Music" is a prefix
    // of this title and a nav link on half the calendars we read.
    const page = `
MUSIC ON THE MALL
Music
Theater
Family
Thursday, July 2: Lake Street Brass Collective
Thursday, July 9: Powderhorn Winds
Thursday, July 16: The Brass Messengers
Thursday, July 23: Bones & Brass
Thursday, July 30: Nordeast Jazz Octet
Thursday, August 6: Mill City Brass
Thursday, August 13: Riverside Winds
Thursday, August 20: Dakota Street Brass
Thursday, July 9: Second Stage — Powderhorn Winds
Thursday, August 27: Cedar Avenue Horns
Thursday, September 3: Longfellow Brass Band
`;
    const r = checkTitleOnPage("Music on the Mall: Brass Band Night", page, {
      day: "2026-07-09",
      minIndexEntries: 8,
    });
    expect(r.kind).toBe("absent");
  });

  it("a game missing from a schedule page is not cleared by a different game", () => {
    // Scoring the page line against the title — the symmetric fix — would have
    // cleared this: "Minnesota Twins vs Detroit Tigers" is half contained in
    // our title. A sports title carries no lead segment, so the gate is silent.
    const page = `
MINNESOTA TWINS 2026 SCHEDULE
Tuesday, July 7: Minnesota Twins vs Detroit Tigers
Wednesday, July 8: Minnesota Twins vs Detroit Tigers
Thursday, July 9: Minnesota Twins vs Cleveland Guardians
Friday, July 10: Minnesota Twins vs Cleveland Guardians
Saturday, July 11: Minnesota Twins vs Kansas City Royals
Sunday, July 12: Minnesota Twins vs Kansas City Royals
Tuesday, July 14: Minnesota Twins vs Houston Astros
Wednesday, July 15: Minnesota Twins vs Houston Astros
Thursday, July 9: Gates open 90 minutes before first pitch
Friday, July 17: Minnesota Twins vs Texas Rangers
Saturday, July 18: Minnesota Twins vs Texas Rangers
`;
    const r = checkTitleOnPage("Minnesota Twins vs Chicago White Sox", page, {
      day: "2026-07-09",
      minIndexEntries: 8,
    });
    expect(r.kind).toBe("absent");
  });
});

describe("pageNote — four problems had been wearing one name", () => {
  /**
   * On 27 Oct 2026, asked to work "the 177 listings behind hosts that 403 a
   * script", a measurement of 97 hosts found something else entirely: 478
   * never-checked listings, of which 59 were blocked and **348** sat on
   * readable pages that are not dated indexes, because the venue draws its
   * calendar with JavaScript. The figure reported had been six times too large
   * on the wrong cause, and it could not be checked from data because every
   * doubt collapsed into one `unchecked` bucket.
   */
  it("calls a bot policy what it is, however it is dressed", () => {
    expect(pageNote({ status: 403 })).toBe("blocked:403");
    expect(pageNote({ status: 401 })).toBe("blocked:401");
    // new.artsmia.org answers 429 to every path including robots.txt and never
    // clears — 15s, the apex domain, three paths. A block wearing a rate
    // limit's number, so a retry there would have been dead code.
    expect(pageNote({ status: 429 })).toBe("blocked:429");
  });

  it("separates a dead link from a block, because the repair is different", () => {
    expect(pageNote({ status: 404 })).toBe("dead:404");
    expect(pageNote({ status: 410 })).toBe("dead:410");
    expect(pageNote({ status: 500 })).toBe("error:500");
    expect(pageNote({ status: 307 })).toBe("error:307");
  });

  it("separates never getting an answer from getting a refusal", () => {
    expect(pageNote({ network: "no answer in 12s" })).toBe("unreachable:no answer in 12s");
    expect(pageNote({ status: 0, network: "ECONNRESET" })).toBe("unreachable:ECONNRESET");
  });

  it("records WHICH gate refused a readable page — the bucket that was hiding 348", () => {
    const unchecked = (why: UncheckedWhy): SourceCheck => ({ kind: "unchecked", why, reason: "x" });
    expect(pageNote({ status: 200, check: unchecked("not-an-index") })).toBe("unchecked:not-an-index");
    expect(pageNote({ status: 200, check: unchecked("day-not-covered") })).toBe("unchecked:day-not-covered");
    expect(pageNote({ status: 200, check: unchecked("thin") })).toBe("unchecked:thin");
    expect(pageNote({ status: 200, check: unchecked("weak-title") })).toBe("unchecked:weak-title");
    expect(pageNote({ status: 200, check: unchecked("partial-match") })).toBe("unchecked:partial-match");
    expect(pageNote({ status: 200, check: unchecked("no-date-given") })).toBe("unchecked:no-date-given");
  });

  it("records the verdicts too, so a row always says where it stands", () => {
    expect(pageNote({ status: 200, check: { kind: "present", score: 1, matched: "x" } })).toBe("present:1");
    expect(pageNote({ status: 200, check: { kind: "absent", score: 0.25, best: "x" } })).toBe("absent:0.25");
  });

  it("never returns an empty or cheerier note when it has nothing", () => {
    // A blank note would group as "not yet attempted" and read as a page we
    // simply have not reached — the exact confusion this exists to end.
    expect(pageNote({})).toBe("error:no verdict recorded");
    expect(pageNote({ status: 200 })).toBe("error:no verdict recorded");
  });

  it("puts the category first so grouping is a prefix, not a regex over prose", () => {
    for (const note of ["blocked:403", "unchecked:not-an-index", "present:1", "unreachable:timeout"]) {
      expect(noteCategory(note)).toBe(note.split(":")[0]);
    }
    expect(noteCategory("never")).toBe("never");
    expect(noteCategory(null)).toBe("never attempted");
    expect(noteCategory("")).toBe("never attempted");
  });

  it("every gate in checkTitleOnPage produces a note, so none can go unlabelled", () => {
    // Drives the real function rather than hand-built fixtures: if a new
    // `unchecked` return ever ships without a `why`, tsc catches it — and if a
    // gate's token is wrong, this catches it.
    const index = Array.from({ length: 60 }, (_, i) => `Saturday, September ${(i % 28) + 1}: Programme ${i}`).join("\n");
    const cases: [string, string, Parameters<typeof checkTitleOnPage>[2]][] = [
      ["thin", "Some Long Distinctive Title Here", {}],
      ["weak-title", "the a an", { day: "2026-09-26" }],
      ["no-date-given", "Prairie Bathing Under a Harvest Moon", {}],
      ["not-an-index", "Prairie Bathing Under a Harvest Moon", { day: "2026-09-26" }],
    ];
    for (const [why, title, opts] of cases) {
      const page = why === "thin" ? "short" : why === "not-an-index" ? THREE_RIVERS : index;
      const check = checkTitleOnPage(title, page, opts);
      expect(pageNote({ status: 200, check }), `${why} / ${title}`).toBe(`unchecked:${why}`);
    }
  });
});

/**
 * A fixture page, in the shape gophersports.com actually writes one: the
 * opponent on its own line, then arena / TV / radio, then the date. Lines are
 * verbatim from the men's basketball schedule of 27 Oct 2026, with two games
 * added to pin the Michigan / Michigan State hazard. The heading is
 * deliberately NEUTRAL: the real page's heading carries "Minnesota Gophers
 * Men's Basketball", which scores 4 of our 6 title words all by itself, and a
 * fixture that let the heading answer would test nothing.
 */
const GOPHER_SCHEDULE = [
  "Official Athletics Site — Schedule",
  "Buy Tickets  Game Center  Watch  Listen Live  Stats  Varsity Network Audio  Game Info",
  "Season tickets, single-game tickets, parking passes and group rates are available all season.",
  "Follow the team for roster news, injury updates and postgame interviews after every contest.",
  "vs", "Southern", "The Barn by Blue Cross and Blue Shield of Minnesota",
  "Radio: KTLK (103.5FM & AM 1130)", "Nov 12 (Thu)", "7:00 PM",
  "Game Center Watch Listen Live Stats", "Game Info",
  "vs", "Western Illinois", "The Barn by Blue Cross and Blue Shield of Minnesota",
  "TV: BTN", "Radio: KFAN FM 100.3", "Nov 16 (Mon)", "7:00 PM",
  "Game Center Watch Listen Live Stats", "Game Info",
  "vs", "Michigan State", "The Barn by Blue Cross and Blue Shield of Minnesota",
  "TV: BTN", "Radio: KFAN FM 100.3", "Jan 5 (Tue)", "7:00 PM",
  "Game Center Watch Listen Live Stats", "Game Info",
  "vs", "Michigan", "The Barn by Blue Cross and Blue Shield of Minnesota",
  "TV: BTN", "Radio: KFAN FM 100.3", "Jan 14 (Thu)", "8:00 PM",
  "Game Center Watch Listen Live Stats", "Game Info",
  "vs", "Alaska-Anchorage", "3M Arena at Mariucci",
  "Radio: KFAN FM 100.3", "Fri. Nov 13, 2026 7:00 PM", "Game Info",
].join("\n");

describe("opponentSegment — the home team is the one name a schedule page omits", () => {
  it("takes what follows vs.", () => {
    expect(opponentSegment("Gophers Men's Basketball vs. Western Illinois")).toBe("Western Illinois");
    expect(opponentSegment("Gophers Men's Hockey: Minnesota vs Wisconsin")).toBe("Wisconsin");
  });

  it("drops the decoration our titles carry and schedule pages never do", () => {
    expect(opponentSegment("Minnesota Gophers Men's Hockey vs. Michigan (Game 2)")).toBe("Michigan");
    expect(opponentSegment("Gophers Men's Hockey: Minnesota vs. Wisconsin (Game 2) – Gold Out")).toBe("Wisconsin");
    expect(opponentSegment("Gophers vs. Minnesota State [Sold Out]")).toBe("Minnesota State");
  });

  it("never fires on ` at `, because that is how half this calendar is titled", () => {
    // "Holiday Market at Union Depot" would otherwise let a venue name standing
    // near the right date confirm an event the page never names.
    expect(opponentSegment("Holiday Market at Union Depot")).toBe("");
    expect(opponentSegment("Jazz at the Dakota")).toBe("");
    expect(opponentSegment("Gophers Men's Basketball at Purdue")).toBe("");
  });

  it("is empty when there is no fixture in the title", () => {
    expect(opponentSegment("Prairie Bathing Under a Harvest Moon")).toBe("");
    expect(opponentSegment("")).toBe("");
  });
});

describe("fixtureRow — a row must prove it is a fixture, by its own structure", () => {
  it("shape A: the date immediately before the opponent, as gopherpucklive writes a home game", () => {
    const e = ["Fri. Nov 13, 2026 7:00 PM 3M Arena at Mariucci", "Alaska-Anchorage", "Box Score"];
    expect(fixtureRow(e, 1, "alaska anchorage")).toMatchObject({ dateIndex: 0 });
  });

  it("shape B: a marker before the opponent, the date further down the block", () => {
    const e = ["vs", "Western Illinois", "The Barn", "TV: BTN", "Nov 16 (Mon)", "7:00 PM"];
    expect(fixtureRow(e, 1, "western illinois")).toMatchObject({ dateIndex: 4, blockStart: 0 });
  });

  it("does not care how many lines a block carries — proximity did", () => {
    // Two extra lines (a streaming line, a promo line) used to make the
    // PREVIOUS game's date nearer, and the gate then confirmed the wrong night.
    const e = ["vs", "Southern", "The Barn", "Nov 12 (Thu)", "7:00 PM", "Game Info",
      "vs", "Western Illinois", "The Barn", "TV: BTN", "Streaming: BTN+",
      "Radio: KFAN", "Promotion: Youth Jersey Giveaway", "Nov 16 (Mon)"];
    expect(fixtureRow(e, 7, "western illinois")).toMatchObject({ dateIndex: 13 });
  });

  it("stops at the next block's marker rather than borrowing its date", () => {
    const e = ["vs", "Wisconsin", "The Barn", "vs", "Purdue", "Nov 12 (Thu)"];
    expect(fixtureRow(e, 1, "wisconsin")).toBeNull();
  });

  it("refuses an away row in every shape it is written", () => {
    expect(fixtureRow(["at", "Western Illinois", "Western Hall, Macomb, Ill.", "Nov 16 (Mon)"], 1, "western illinois")).toBeNull();
    expect(fixtureRow(["boilerplate", "at Western Illinois", "Nov 16 (Mon)"], 1, "western illinois")).toBeNull();
    expect(fixtureRow(["boilerplate", "@ Western Illinois", "Nov 16 (Mon)"], 1, "western illinois")).toBeNull();
  });

  it("refuses a bare name with neither a date beside it nor a marker", () => {
    // A region nav link three lines from a dated entry. This is what let an
    // `absent` be turned into `present` by inserting " vs. " into a title.
    const e = ["Browse by region", "Denver", "Minneapolis", "Nov 16 (Mon) listings"];
    expect(fixtureRow(e, 1, "denver")).toBeNull();
  });

  it("finds a five-character date — a length floor once hid it", () => {
    // "Nov 5" is five characters. A floor of six made the true date invisible
    // and the search reached past it to the next game's.
    expect(fixtureRow(["vs", "Wisconsin", "Nov 5", "7:00 PM"], 1, "wisconsin")).toMatchObject({ dateIndex: 2 });
    expect(fixtureRow(["Nov 5", "Wisconsin", "Box Score"], 1, "wisconsin")).toMatchObject({ dateIndex: 0 });
  });

  it("will not match a different team whose name merely contains the opponent's", () => {
    expect(fixtureRow(["vs", "Michigan State", "The Barn", "Jan 5 (Tue)"], 1, "michigan")).toBeNull();
    expect(fixtureRow(["vs", "Michigan", "The Barn", "Jan 14 (Thu)"], 1, "michigan")).toMatchObject({ dateIndex: 3 });
  });
});

describe("venueMarks — the words that identify a building", () => {
  it("keeps the distinctive words and drops the ones every page carries", () => {
    expect(venueMarks("Williams Arena (The Barn)")).toEqual(["williams", "barn"]);
    expect(venueMarks("3M Arena at Mariucci")).toEqual(["3m", "mariucci"]);
    expect(venueMarks("Ridder Arena")).toEqual(["ridder"]);
  });

  it("drops 'center', because every athletics block says 'Game Center'", () => {
    // Otherwise a Target Center listing matches any Gophers fixture on the
    // strength of one generic word.
    expect(venueMarks("Target Center")).toEqual(["target"]);
    expect(venueMarks("Xcel Energy Center")).toEqual(["xcel", "energy"]);
  });
});

describe("the fixture gate — 33 listings the sweep could not read, and none of them JavaScript", () => {
  const bball = (opponent: string) => `Minnesota Gophers Men's Basketball vs. ${opponent}`;

  it("confirms a game from the row that names its opponent", () => {
    const v = checkTitleOnPage(bball("Western Illinois"), GOPHER_SCHEDULE, { day: "2026-11-16" });
    expect(v.kind).toBe("present");
    if (v.kind === "present") {
      expect(v.matched).toContain("Western Illinois");
      expect(v.matched).toContain("Nov 16");
    }
  });

  /**
   * THE LIVE ERROR THIS FOUND. We publish "Minnesota Gophers Men's Basketball
   * vs. Western Illinois" on 12 Nov 2026. The schedule page puts Western
   * Illinois on the 16th and somebody else on the 12th. A gate that accepted a
   * date on either side of the opponent would have confirmed it — "Western
   * Illinois" sits five lines after "Nov 12" and four before "Nov 16".
   */
  it("does NOT confirm the same opponent on the wrong night", () => {
    const v = checkTitleOnPage(bball("Western Illinois"), GOPHER_SCHEDULE, { day: "2026-11-12" });
    expect(v.kind).not.toBe("present");
    expect(v.kind).not.toBe("absent");
  });

  it("will not let Michigan be confirmed by the Michigan State row", () => {
    expect(checkTitleOnPage(bball("Michigan"), GOPHER_SCHEDULE, { day: "2027-01-05" }).kind).not.toBe("present");
    expect(checkTitleOnPage(bball("Michigan"), GOPHER_SCHEDULE, { day: "2027-01-14" }).kind).toBe("present");
    expect(checkTitleOnPage(bball("Michigan State"), GOPHER_SCHEDULE, { day: "2027-01-05" }).kind).toBe("present");
  });

  it("reads the row's punctuation, not ours", () => {
    // We write "Alaska Anchorage"; the row says "Alaska-Anchorage".
    const v = checkTitleOnPage("Minnesota Gophers Men's Hockey vs. Alaska Anchorage", GOPHER_SCHEDULE, { day: "2026-11-13" });
    expect(v.kind).toBe("present");
  });

  it("stays unchecked when our title carries a nickname the page omits", () => {
    // Three of the 33 are volleyball titles like this. A miss, not an accusation.
    const v = checkTitleOnPage("Minnesota Gophers Volleyball vs. Michigan State Spartans", GOPHER_SCHEDULE, { day: "2027-01-05" });
    expect(v.kind).not.toBe("present");
  });

  it("cannot fire without a date, and cannot produce an accusation", () => {
    const noDay = checkTitleOnPage(bball("Western Illinois"), GOPHER_SCHEDULE, {});
    expect(noDay.kind).toBe("unchecked");
    if (noDay.kind === "unchecked") expect(noDay.why).toBe("no-date-given");
    // Every fixture title against this page, on every date in it: never absent.
    for (const opponent of ["Western Illinois", "Michigan", "Michigan State", "Southern", "Purdue"]) {
      for (const day of ["2026-11-12", "2026-11-16", "2027-01-05", "2027-01-14", "2026-11-13"]) {
        expect(checkTitleOnPage(bball(opponent), GOPHER_SCHEDULE, { day }).kind).not.toBe("absent");
      }
    }
  });

  it("leaves a non-fixture listing exactly as it was", () => {
    // The gate must be invisible to everything that is not "X vs. Y".
    const v = checkTitleOnPage("Holiday Market at Union Depot", GOPHER_SCHEDULE, { day: "2026-11-16" });
    expect(v.kind).toBe("unchecked");
    if (v.kind === "unchecked") expect(v.why).toBe("not-an-index");
  });
});

describe("a fixture confirmation says so in its note", () => {
  it("marks the verdict `via: fixture`, because its score looks like a contradiction", () => {
    const v = checkTitleOnPage(
      "Minnesota Gophers Men's Basketball vs. Western Illinois",
      GOPHER_SCHEDULE,
      { day: "2026-11-16" },
    );
    expect(v.kind).toBe("present");
    if (v.kind === "present") {
      expect(v.via).toBe("fixture");
      // The score is the FULL TITLE's, which is below presentAt — that is the
      // whole reason the gate exists, and why `present:0.333` needed a name.
      expect(v.score).toBeLessThan(0.6);
      expect(pageNote({ status: 200, check: v })).toBe("present:fixture");
      expect(noteCategory(pageNote({ status: 200, check: v }))).toBe("present");
    }
  });

  it("an ordinary title match still records its score", () => {
    const v = checkTitleOnPage("Western Illinois", GOPHER_SCHEDULE, { day: "2026-11-16" });
    expect(v.kind).toBe("present");
    if (v.kind === "present") {
      expect(v.via).toBeUndefined();
      expect(pageNote({ status: 200, check: v })).toBe("present:1");
    }
  });
});

/**
 * Both of these came from an adversarial review of the fixture gate, and both
 * were real: the gate as first written confirmed a listing from a row that
 * described a different year, and from a row that described a game 400 miles
 * away.
 */
describe("what the fixture gate must refuse — found by review, not by me", () => {
  const filler = [
    "Official Athletics Site — Schedule",
    "Buy Tickets  Game Center  Watch  Listen Live  Stats  Varsity Network Audio  Game Info",
    "Season tickets, single-game tickets, parking passes and group rates are available all season.",
    "Follow the team for roster news, injury updates and postgame interviews after every contest.",
  ];
  const T = "Minnesota Gophers Men's Basketball vs. Western Illinois";

  describe("a row that prints its year must print ours", () => {
    // `pageCoversDate` matches on month and day alone, deliberately, because
    // index pages omit the year. An event re-dated to the wrong year is one of
    // the fabrication shapes this project has shipped.
    const dated = [...filler,
      "vs", "Alaska-Anchorage", "3M Arena at Mariucci",
      "Radio: KFAN FM 100.3", "Fri. Nov 13, 2026 7:00 PM", "Game Info",
    ].join("\n");
    const title = "Minnesota Gophers Men's Hockey vs. Alaska Anchorage";

    it("confirms the year the row names", () => {
      expect(checkTitleOnPage(title, dated, { day: "2026-11-13" }).kind).toBe("present");
    });

    it("refuses the same month and day in another year", () => {
      const v = checkTitleOnPage(title, dated, { day: "2027-11-13" });
      expect(v.kind).not.toBe("present");
      expect(v.kind).not.toBe("absent");
    });
  });

  describe("an away row names the same opponent and means somewhere else", () => {
    const pad = [
      "Group rates, season tickets and parking passes are available for every home contest.",
      "Radio affiliates carry every game statewide, and the pregame show starts an hour early.",
    ];
    const home = [...filler, "vs", "Western Illinois", "The Barn by Blue Cross and Blue Shield of Minnesota",
      "TV: BTN", "Radio: KFAN FM 100.3", "Nov 16 (Mon)", "7:00 PM", "Game Info"].join("\n");
    const awayMultiline = [...filler, "at", "Western Illinois", "Western Hall, Macomb, Ill.",
      "TV: ESPN+", "Radio: KFAN FM 100.3", "Nov 16 (Mon)", "7:00 PM", "Game Info"].join("\n");
    const awayOneLine = [...filler, ...pad, "at Western Illinois", "Nov 16 (Mon) 7:00 PM"].join("\n");
    const awayAtSign = [...filler, ...pad, "@ Western Illinois", "Nov 16 (Mon) 7:00 PM"].join("\n");

    it("confirms the home game", () => {
      const v = checkTitleOnPage(T, home, { day: "2026-11-16" });
      expect(v.kind).toBe("present");
      if (v.kind === "present") expect(v.via).toBe("fixture");
    });

    it("refuses it when the marker sits on its own line, as gophersports writes it", () => {
      // The opponent entry is IDENTICAL to a home game's; only the neighbour
      // tells them apart, which is why the line before is examined.
      expect(checkTitleOnPage(T, awayMultiline, { day: "2026-11-16" }).kind).not.toBe("present");
    });

    it("refuses the one-line and @ shapes", () => {
      expect(checkTitleOnPage(T, awayOneLine, { day: "2026-11-16" }).kind).not.toBe("present");
      expect(checkTitleOnPage(T, awayAtSign, { day: "2026-11-16" }).kind).not.toBe("present");
    });

    it("does not mistake an opponent whose name merely starts with 'at'", () => {
      const atlanta = [...filler, "vs", "Atlanta", "The Barn by Blue Cross and Blue Shield of Minnesota",
        "TV: BTN", "Radio: KFAN FM 100.3", "Nov 16 (Mon)", "7:00 PM", "Game Info"].join("\n");
      const v = checkTitleOnPage("Minnesota Gophers Men's Basketball vs. Atlanta", atlanta, { day: "2026-11-16" });
      expect(v.kind).toBe("present");
    });
  });
});

