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
