import { describe, it, expect } from "vitest";
import {
  padDay,
  foldTitle,
  parseFirstAvenueMonth,
  parseFirstAvenueTime,
  parseTribeEvents,
  showTitlesMatch,
  showWindow,
  reconcileShows,
  type VenueShow,
  type ExistingShow,
} from "../music-feed";
import {
  firstAvenueMonthUrls,
  mplsParksPageUrl,
  FIRST_AVENUE_VENUES,
  PROMOTED_ELSEWHERE,
  MPLS_PARKS_VENUES,
  mplsParksCategory,
  mplsParksVenuesFrom,
} from "../music-sources";

/**
 * Built from what the real First Avenue calendar and our real listings did on
 * 22 Aug 2026 — including Altın Gün, which we had in the wrong room, and the
 * four rooms that were genuinely dark on nights we advertised shows.
 */

const AUTH = {
  authoritativeVenues: new Set(["first avenue", "7th st entry", "turf club", "fine line"]),
};
const TODAY = "2026-08-22";

// A cut-down copy of their markup: day anchor, then show blocks, venue name
// duplicated per block the way the responsive layout does it.
const monthHtml = (
  days: { day: string; shows: { venue: string; title: string; slug: string }[] }[],
) =>
  days
    .map(
      (d) =>
        `<div id="day-${d.day}"></div>` +
        d.shows
          .map(
            (s) => `
  <div class="show_list_item" id="post-1">
    <div class="venue_col"><div class="venue_name"> ${s.venue} </div></div>
    <div class="venue_col d-none"><div class="venue_name"> ${s.venue} </div></div>
    <div class="show_name"><h4 class=" lg ">
      <a href="https://first-avenue.com/event/${s.slug}/"><em>presents</em> <br>${s.title}</a>
    </h4></div>
  </div>`,
          )
          .join(""),
    )
    .join("");

describe("parsing First Avenue's calendar", () => {
  it("reads day, venue, title and link — and never infers a date", () => {
    const html = monthHtml([
      { day: "2026-08-1", shows: [{ venue: "First Avenue", title: "RUDE&nbsp;AWAKENING", slug: "rude" }] },
      { day: "2026-08-22", shows: [{ venue: "Fine Line", title: "Pajama Rave", slug: "pajama" }] },
    ]);
    const shows = parseFirstAvenueMonth(html);
    expect(shows).toHaveLength(2);
    // The presenter line sits before a <br>; the show's own name follows it.
    expect(shows[0]).toMatchObject({ day: "2026-08-01", venue: "First Avenue", title: "RUDE AWAKENING" });
    expect(shows[1]).toMatchObject({ day: "2026-08-22", venue: "Fine Line", title: "Pajama Rave" });
    expect(shows[1].url).toContain("first-avenue.com/event/pajama");
  });

  it("handles several rooms on one night — a day is not a key here", () => {
    const shows = parseFirstAvenueMonth(
      monthHtml([{ day: "2026-09-04", shows: [
        { venue: "Turf Club", title: "Red Desert", slug: "a" },
        { venue: "7th St Entry", title: "PIVOT", slug: "b" },
        { venue: "Turf Club", title: "Danny Worsnop", slug: "c" },
      ] }]),
    );
    expect(shows).toHaveLength(3);
    expect(shows.filter((s) => s.venue === "Turf Club")).toHaveLength(2);
  });

  it("drops a show that appears before any day anchor rather than guessing", () => {
    const orphan = `<div class="show_list_item"><div class="venue_name"> Fine Line </div>
      <h4 class="lg"><a href="https://x/e/1">Orphan</a></h4></div>` +
      monthHtml([{ day: "2026-08-25", shows: [{ venue: "Fine Line", title: "Real", slug: "r" }] }]);
    const shows = parseFirstAvenueMonth(orphan);
    expect(shows.map((s) => s.title)).toEqual(["Real"]);
  });

  it("survives markup it doesn't recognise", () => {
    for (const junk of ["", "<html></html>", "<div id=\"day-2026-08-1\"></div>"]) {
      expect(parseFirstAvenueMonth(junk)).toEqual([]);
    }
  });

  it("zero-pads their unpadded day anchors", () => {
    expect(padDay("2026-08-1")).toBe("2026-08-01");
    expect(padDay("2026-8-1")).toBe("2026-08-01");
    expect(padDay("2026-08-22")).toBe("2026-08-22");
  });
});

describe("parsing The Events Calendar's REST feed (Minneapolis Park Board)", () => {
  const tribe = (events: unknown[]) => ({ events, total: events.length, total_pages: 1 });

  it("reads title, venue, day and time — the time is already local", () => {
    const shows = parseTribeEvents(
      tribe([
        {
          title: "Piece of Cake",
          start_date: "2026-08-26 19:30:00",
          url: "https://www.minneapolisparks.org/events/piece-of-cake/",
          venue: { venue: "Lake Harriet Bandshell" },
        },
      ]),
    );
    expect(shows[0]).toMatchObject({
      day: "2026-08-26",
      venue: "Lake Harriet Bandshell",
      title: "Piece of Cake",
      url: "https://www.minneapolisparks.org/events/piece-of-cake/",
      time: "19:30",
    });
  });

  it("carries the feed's own category tags through, verbatim", () => {
    // The tags are what let the Park Board decide the category and decide what
    // isn't an event. The parser reports them and judges nothing.
    const [s] = parseTribeEvents(
      tribe([{
        title: "Board Meeting",
        start_date: "2026-09-02 17:00:00",
        venue: { venue: "Mary Merrill Headquarters" },
        url: "u",
        categories: [{ name: "Public Meetings" }],
      }]),
    );
    expect(s.tags).toEqual(["Public Meetings"]);
  });

  it("carries venue coordinates so a source can register itself", () => {
    const [s] = parseTribeEvents(
      tribe([{
        title: "Garden Storytime",
        start_date: "2026-08-27 10:00:00",
        url: "u",
        venue: {
          venue: "Eloise Butler Wildflower Garden",
          address: "1 Theodore Wirth Pkwy",
          city: "Minneapolis",
          geo_lat: 44.9745452,
          geo_lng: -93.3183,
        },
      }]),
    );
    expect(s.venueInfo).toEqual({
      address: "1 Theodore Wirth Pkwy",
      city: "Minneapolis",
      lat: 44.9745452,
      lng: -93.3183,
    });
  });

  it("decodes entities as a CLASS, not one at a time", () => {
    // "Early Birders &#8211; May-August" reached the site with a raw entity in
    // it, because the decoder was a hand-written list that had &#038; and
    // &#8217; but not the en-dash. A title is shown verbatim to readers.
    const t = (title: string) =>
      parseTribeEvents(tribe([{ title, start_date: "2026-08-27 10:00:00", venue: { venue: "V" }, url: "u" }]))[0].title;
    expect(t("Early Birders &#8211; May-August")).toBe("Early Birders – May-August");
    expect(t("Rock &amp; Roll &#8212; Night &#x27;26")).toBe("Rock & Roll — Night '26");
    expect(t("Caf&eacute; Night")).toBe("Caf&eacute; Night"); // unknown name left visible, not mangled
  });

  it("unescapes the HTML entities their titles arrive in", () => {
    const [s] = parseTribeEvents(
      tribe([{
        title: "Matty &#038; The Subtle Validation",
        start_date: "2026-08-30 14:00:00",
        venue: { venue: "Lake Harriet Bandshell" },
        url: "u",
      }]),
    );
    expect(s.title).toBe("Matty & The Subtle Validation");
  });

  it("keeps two concerts on one evening apart", () => {
    // The bandshell really does play a 2 PM and a 5:30 PM on some Sundays.
    const shows = parseTribeEvents(
      tribe([
        { title: "Matty & The Subtle Validation", start_date: "2026-08-30 14:00:00", venue: { venue: "Lake Harriet Bandshell" }, url: "a" },
        { title: "The Long Honeymoon", start_date: "2026-08-30 17:30:00", venue: { venue: "Lake Harriet Bandshell" }, url: "b" },
      ]),
    );
    expect(shows.map((s) => s.time)).toEqual(["14:00", "17:30"]);
  });

  it("skips a row with no parseable start rather than guessing", () => {
    expect(parseTribeEvents(tribe([
      { title: "Someday", start_date: "", venue: { venue: "Lake Harriet Bandshell" }, url: "u" },
      { title: "No venue", start_date: "2026-08-30 14:00:00", venue: {}, url: "u" },
    ]))).toEqual([]);
  });

  it("degrades to empty on anything it doesn't recognise", () => {
    for (const junk of [null, undefined, 42, "nope", {}, { events: "x" }, { events: [null, 7] }]) {
      expect(parseTribeEvents(junk)).toEqual([]);
    }
  });
});

describe("show times — prefer the show, never invent one", () => {
  const page = (doors: string, show: string) =>
    `<div><span>Doors Open</span><span>${doors}</span><span>Show Starts</span><span>${show}</span></div>`;

  it("takes Show Starts over Doors Open", () => {
    expect(parseFirstAvenueTime(page("7PM", "8PM"))).toBe("20:00");
  });

  it("handles minutes and midday edges", () => {
    expect(parseFirstAvenueTime(page("6PM", "6:30PM"))).toBe("18:30");
    expect(parseFirstAvenueTime(page("11AM", "12PM"))).toBe("12:00");
    expect(parseFirstAvenueTime(page("11PM", "12AM"))).toBe("00:00");
  });

  it("falls back to doors when there is no show time", () => {
    expect(parseFirstAvenueTime("<span>Doors Open</span><span>7PM</span>")).toBe("19:00");
  });

  it("returns null rather than guessing — the caller stores all-day", () => {
    expect(parseFirstAvenueTime("<p>Tickets on sale Friday</p>")).toBeNull();
    expect(parseFirstAvenueTime(page("nope", "nope"))).toBeNull();
    expect(parseFirstAvenueTime("<span>Show Starts</span><span>25PM</span>")).toBeNull();
  });
});

describe("showTitlesMatch — generous, because a miss is never destructive", () => {
  it("sees through presenter framing", () => {
    expect(showTitlesMatch("GCW presents RUDE AWAKENING", "Rude Awakening")).toBe(true);
  });

  it("sees through support acts and night markers", () => {
    expect(showTitlesMatch("Alabama Shakes", "Alabama Shakes – Night 1")).toBe(true);
    // Our listing spelled it "Altin", the venue "Altın". Folding to ASCII makes
    // these the same show, which they are.
    expect(showTitlesMatch("Altın Gün", "Altin Gün with Ale Maes (18+)")).toBe(true);
    expect(showTitlesMatch("Mini Trees", "Mini Trees (with frown line)")).toBe(true);
  });

  it("does not match two different acts", () => {
    expect(showTitlesMatch("Kamelot", "Larry Fleet")).toBe(false);
    expect(showTitlesMatch("The Dream Syndicate", "Swervedriver")).toBe(false);
  });

  it("refuses to match on filler alone", () => {
    expect(showTitlesMatch("Live Show Night", "The Night Live Show")).toBe(false);
  });

  it("matches a headliner to its full bill — the commonest shape in live music", () => {
    // Tightening the matcher to also demand a large share of the LONGER title
    // was tried and broke every one of these, which is most of a venue calendar.
    expect(showTitlesMatch("Mastodon", "Mastodon with Deafheaven and Alcest (18+)")).toBe(true);
    expect(showTitlesMatch("Chat Pile", "Chat Pile with Soul Glo and Prize Horse")).toBe(true);
    expect(showTitlesMatch("FINICK", "FINICK (with Sallyforth, Lone Rock Bride)")).toBe(true);
    expect(showTitlesMatch("The Format", "The Format w/ Get Up Kids")).toBe(true);
    expect(showTitlesMatch("Hulvey", "Hulvey with Indie Tribe & Kijan Boone")).toBe(true);
  });

  it("matches names a naive a-z filter would destroy", () => {
    // Each of these failed to match ITSELF: "Altın Gün" folded to "alt n",
    // "Eivør" to "eiv r". They were hidden and re-added on every run.
    expect(showTitlesMatch("Altın Gün", "Altın Gün")).toBe(true);
    expect(showTitlesMatch("Eivør", "Eivør")).toBe(true);
    expect(showTitlesMatch("Mon Rovîa", "Mon Rovîa")).toBe(true);
    expect(foldTitle("Altın Gün")).toBe("altin gun");
    expect(foldTitle("Eivør")).toBe("eivor");
  });

  it("matches a short band name to itself", () => {
    // The 4-character rule alone meant L7 and RAV could not match themselves.
    expect(showTitlesMatch("L7", "L7")).toBe(true);
    expect(showTitlesMatch("RAV", "RAV")).toBe(true);
    expect(showTitlesMatch("L7", "RAV")).toBe(false);
  });

  it("needs a distinctive shared word, not a short one", () => {
    expect(showTitlesMatch("Sun", "Sun Ra Arkestra")).toBe(false);
  });
});

describe("reconcileShows", () => {
  const show = (day: string, venue: string, title: string): VenueShow => ({
    day, venue, title, url: `https://first-avenue.com/event/${title.replace(/\W/g, "")}/`,
  });
  const row = (id: string, day: string, venue: string, title: string): ExistingShow => ({
    id, day, venue, title,
  });

  it("verifies a listing the venue confirms", () => {
    const plan = reconcileShows(
      [show("2026-09-04", "Turf Club", "Red Desert")],
      [row("r1", "2026-09-04", "Turf Club", "Red Desert")],
      TODAY, AUTH,
    );
    expect(plan.verdicts[0].kind).toBe("ok");
    expect(plan.missing).toEqual([]);
  });

  it("hides a listing for a room that is dark that night", () => {
    // Garbage, advertised at First Avenue on a night they had nothing there.
    const plan = reconcileShows(
      [show("2026-10-04", "Fine Line", "Militarie Gun")],
      [row("r1", "2026-10-04", "First Avenue", "Garbage")],
      TODAY, AUTH,
    );
    expect(plan.verdicts[0].kind).toBe("phantom");
  });

  it("calls it MOVED when the show is really on, somewhere else", () => {
    // Altın Gün: our listing said First Avenue, the calendar said Fine Line,
    // same night. Positive evidence beats inferred absence.
    const plan = reconcileShows(
      [show("2026-09-15", "Fine Line", "Altin Gün")],
      [row("r1", "2026-09-15", "First Avenue", "Altin Gün with Ale Maes")],
      TODAY, AUTH,
    );
    const v = plan.verdicts[0];
    expect(v.kind).toBe("moved");
    if (v.kind === "moved") expect(v.actual).toEqual({ day: "2026-09-15", venue: "Fine Line" });
  });

  it("calls it MOVED when the date is wrong", () => {
    const plan = reconcileShows(
      [show("2026-09-01", "7th St Entry", "Steel Beans"), show("2026-09-12", "7th St Entry", "SUGAR")],
      [row("r1", "2026-09-12", "7th St Entry", "Steel Beans")],
      TODAY, AUTH,
    );
    const v = plan.verdicts[0];
    expect(v.kind).toBe("moved");
    if (v.kind === "moved") expect(v.actual.day).toBe("2026-09-01");
  });

  it("FLAGS rather than hides when the room is busy and nothing matches", () => {
    // The safety valve. Far likelier that our fuzzy matcher failed than that the
    // venue forgot a show, so a person decides and the listing stays up.
    const plan = reconcileShows(
      [show("2026-10-04", "Turf Club", "The Dream Syndicate")],
      [row("r1", "2026-10-04", "Turf Club", "Swervedriver")],
      TODAY, AUTH,
    );
    const v = plan.verdicts[0];
    expect(v.kind).toBe("unmatched");
    if (v.kind === "unmatched") expect(v.alternatives).toEqual(["The Dream Syndicate"]);
  });

  describe("rooms the promoter books into but does not run", () => {
    // The Cedar is on First Avenue's calendar because they promote there. Their
    // page is not the Cedar's schedule, so absence proves nothing — but a show
    // they DO list is still a real show.
    const KNOWN = {
      authoritativeVenues: new Set(["first avenue", "turf club"]),
      knownVenues: new Set(["first avenue", "turf club", "the cedar cultural center"]),
    };

    it("adds a show at a room it only promotes into", () => {
      const s = show("2026-09-19", "The Cedar Cultural Center", "Aldous Harding");
      expect(reconcileShows([s], [], TODAY, KNOWN).missing).toEqual([s]);
    });

    it("confirms one we already list there", () => {
      const s = show("2026-09-19", "The Cedar Cultural Center", "Aldous Harding");
      const plan = reconcileShows([s], [row("r1", "2026-09-19", "The Cedar Cultural Center", "Aldous Harding")], TODAY, KNOWN);
      expect(plan.verdicts[0].kind).toBe("ok");
      expect(plan.missing).toEqual([]);
    });

    it("NEVER hides there, even on a night it lists nothing", () => {
      // The same inputs at an authoritative room would be a phantom.
      const plan = reconcileShows(
        [show("2026-09-19", "Turf Club", "Someone Else")],
        [row("r1", "2026-09-19", "The Cedar Cultural Center", "A Show We Listed")],
        TODAY, KNOWN,
      );
      expect(plan.verdicts[0].kind).toBe("unknown");
    });

    it("never hides there even when the act appears elsewhere on the calendar", () => {
      // At an authoritative room this would be "moved".
      const plan = reconcileShows(
        [show("2026-10-01", "Turf Club", "Aldous Harding")],
        [row("r1", "2026-09-19", "The Cedar Cultural Center", "Aldous Harding")],
        TODAY, KNOWN,
      );
      expect(plan.verdicts[0].kind).toBe("unknown");
    });

    it("defaults knownVenues to the authoritative set when omitted", () => {
      const s = show("2026-09-19", "The Cedar Cultural Center", "Aldous Harding");
      expect(reconcileShows([s], [], TODAY, { authoritativeVenues: new Set(["turf club"]) }).missing).toEqual([]);
    });
  });

  it("says nothing about a room this calendar doesn't speak for", () => {
    // First Avenue promotes shows at the Armory; that page is not the Armory's
    // schedule, so its silence proves nothing about the building.
    const plan = reconcileShows(
      [show("2026-10-04", "Fine Line", "Militarie Gun")],
      [row("r1", "2026-10-04", "Armory", "Some Big Tour")],
      TODAY, AUTH,
    );
    expect(plan.verdicts[0].kind).toBe("unknown");
  });

  it("adds a show the venue lists and we don't", () => {
    const s = show("2026-08-27", "Fine Line", "Nino Paid");
    expect(reconcileShows([s], [], TODAY, AUTH).missing).toEqual([s]);
  });

  it("does not re-add a show that matched an existing listing", () => {
    const s = show("2026-08-27", "Fine Line", "Nino Paid");
    const plan = reconcileShows([s], [row("r1", "2026-08-27", "Fine Line", "Nino Paid")], TODAY, AUTH);
    expect(plan.missing).toEqual([]);
  });

  it("collapses an early and a late show of the same billing", () => {
    // Michael Che played two on 29 Aug. event_key is title|venue|day, so we
    // cannot store them separately; without this the second is "missing" every
    // run, forever.
    const a = show("2026-08-29", "First Avenue", "Michael Che");
    const b = show("2026-08-29", "First Avenue", "Michael Che");
    const plan = reconcileShows([a, b], [], TODAY, AUTH);
    expect(plan.missing).toHaveLength(1);
  });

  it("keeps both of a genuine double-header", () => {
    const a = show("2026-09-04", "Turf Club", "Red Desert");
    const b = show("2026-09-04", "Turf Club", "Danny Worsnop and Tyler Rich");
    const plan = reconcileShows([a, b], [row("r1", "2026-09-04", "Turf Club", "Red Desert")], TODAY, AUTH);
    expect(plan.verdicts[0].kind).toBe("ok");
    expect(plan.missing).toEqual([b]);
  });

  it("an EMPTY calendar changes nothing", () => {
    const plan = reconcileShows([], [row("r1", "2026-09-04", "Turf Club", "Red Desert")], TODAY, AUTH);
    expect(plan.window).toBeNull();
    expect(plan.missing).toEqual([]);
    expect(plan.verdicts[0].kind).toBe("unknown");
  });

  it("leaves listings outside the calendar's window alone", () => {
    const plan = reconcileShows(
      [show("2026-09-04", "Turf Club", "Red Desert")],
      [row("r1", "2027-03-01", "Turf Club", "Someone Else")],
      TODAY, AUTH,
    );
    expect(plan.verdicts[0].kind).toBe("unknown");
  });

  it("never judges or invents anything in the past", () => {
    const past = show("2026-08-01", "Turf Club", "Old Show");
    const plan = reconcileShows(
      [past, show("2026-09-04", "Turf Club", "Red Desert")],
      [row("r1", "2026-08-01", "Turf Club", "Something Wrong")],
      TODAY, AUTH,
    );
    expect(plan.verdicts).toEqual([]);
    expect(plan.missing.map((s) => s.day)).toEqual(["2026-09-04"]);
  });
});

describe("showWindow", () => {
  it("spans the calendar's first to last show", () => {
    const s = (day: string): VenueShow => ({ day, venue: "Turf Club", title: "x", url: "u" });
    expect(showWindow([s("2026-09-04"), s("2026-08-22"), s("2026-11-01")]))
      .toEqual({ from: "2026-08-22", to: "2026-11-01" });
    expect(showWindow([])).toBeNull();
  });
});

describe("the venue registry", () => {
  it("covers the six rooms First Avenue books", () => {
    expect(FIRST_AVENUE_VENUES.map((v) => v.feedName).sort()).toEqual([
      "7th St Entry", "Fine Line", "First Avenue", "Palace Theatre",
      "The Fitzgerald Theater", "Turf Club",
    ]);
  });

  it("pins the Fitzgerald to downtown St Paul, not the bad coordinate pair", () => {
    const fitz = FIRST_AVENUE_VENUES.find((v) => v.feedName === "The Fitzgerald Theater")!;
    expect(fitz.lat).toBeCloseTo(44.9482, 3);
    expect(fitz.lng).toBeCloseTo(-93.0916, 3);
  });

  it("keeps the Mainroom and the Entry apart", () => {
    const main = FIRST_AVENUE_VENUES.find((v) => v.feedName === "First Avenue")!;
    const entry = FIRST_AVENUE_VENUES.find((v) => v.feedName === "7th St Entry")!;
    // Same building, different rooms — the Entry's spellings must not leak into
    // the Mainroom's patterns or every Entry show reads as a Mainroom phantom.
    expect(main.titleVenuePatterns).not.toContain("7th St Entry");
    expect(entry.titleVenuePatterns).toContain("First Avenue & 7th St Entry (7th St Entry)");
  });

  it("marks promoted-elsewhere rooms non-authoritative, and excludes the Armory", () => {
    for (const v of PROMOTED_ELSEWHERE) expect(v.authoritative).toBe(false);
    for (const v of FIRST_AVENUE_VENUES) expect(v.authoritative).toBe(true);
    // First Avenue promotes nothing at the Armory, so this route cannot reach it
    // and must not pretend otherwise.
    expect(PROMOTED_ELSEWHERE.map((v) => v.name)).not.toContain("The Armory");
  });

  it("asks for one page per month across the horizon", () => {
    const urls = firstAvenueMonthUrls("2026-08-22", "2026-11-22");
    expect(urls).toHaveLength(4);
    expect(urls[0]).toContain("start_date=20260801");
    expect(urls[3]).toContain("start_date=20261101");
    for (const u of urls) expect(u).toMatch(/^https:\/\/first-avenue\.com\/shows\?/);
  });

  it("rolls over the year", () => {
    const urls = firstAvenueMonthUrls("2026-11-15", "2027-02-01");
    expect(urls.map((u) => u.split("start_date=")[1])).toEqual(
      ["20261101", "20261201", "20270101", "20270201"],
    );
  });
});

describe("the Minneapolis Park Board source", () => {
  it("claims the bandshell only — not the whole parks calendar", () => {
    // The same feed carries buckthorn-slaying mornings and park markets across
    // the city. Those are real events; they are not this importer's business,
    // and claiming them would make it authoritative over things it never read.
    expect(MPLS_PARKS_VENUES.map((v) => v.feedName)).toEqual(["Lake Harriet Bandshell"]);
    expect(MPLS_PARKS_VENUES[0].authoritative).toBe(true);
  });

  it("pages by number, because Tribe 404s past the last page", () => {
    const u1 = mplsParksPageUrl("2026-08-26", "2026-11-26", 1);
    expect(u1).toContain("start_date=2026-08-26");
    expect(u1).toContain("end_date=2026-11-26");
    expect(u1).toContain("page=1");
    expect(mplsParksPageUrl("2026-08-26", "2026-11-26", 4)).toContain("page=4");
    for (const u of [u1, mplsParksPageUrl("a", "b", 2)]) expect(u).toMatch(/^https:\/\//);
  });
});

describe("the Park Board's own taxonomy decides what to list", () => {
  it("refuses board meetings and construction open houses", () => {
    expect(mplsParksCategory(["Public Meetings"])).toBeNull();
  });

  it("refuses volunteer shifts — a deliberate, reversible call", () => {
    // 101 of the feed's 216 entries. Recurring weekly shifts, not events;
    // listing them would more than double the family category with repeats.
    expect(mplsParksCategory(["Environmental Volunteer Opportunities"])).toBeNull();
    expect(mplsParksCategory(["Environmental Volunteer Opportunities", "Events- All"])).toBeNull();
  });

  it("takes the category from the source rather than guessing at the title", () => {
    expect(mplsParksCategory(["Music & Movies in the Parks", "Music in the Parks"])).toBe("music");
    expect(mplsParksCategory(["Movies in the Parks", "Music & Movies in the Parks"])).toBe("family");
    expect(mplsParksCategory(["Events- All", "Events- MPRB"])).toBe("family");
    expect(mplsParksCategory([])).toBe("family");
  });
});

describe("registering park venues from the feed", () => {
  const show = (venue: string, info?: VenueShow["venueInfo"]): VenueShow => ({
    day: "2026-09-01", venue, title: "x", url: "u", venueInfo: info,
  });
  const INFO = { address: "1 Theodore Wirth Pkwy", city: "Minneapolis", lat: 44.97, lng: -93.31 };

  it("builds a venue from the coordinates the Board publishes", () => {
    const v = mplsParksVenuesFrom([show("Eloise Butler Wildflower Garden", INFO)]);
    const eb = v.find((x) => x.feedName === "Eloise Butler Wildflower Garden")!;
    expect(eb).toMatchObject({ lat: 44.97, lng: -93.31, city: "Minneapolis", authoritative: false });
  });

  it("keeps every derived park NON-authoritative", () => {
    // A public park is not a bookable room. The Board's calendar has no reason
    // to know about a permitted festival in Loring Park, and reading its silence
    // as "nothing on" would hide one.
    const v = mplsParksVenuesFrom([show("Loring Park", INFO), show("Boom Island Park", INFO)]);
    for (const x of v.filter((y) => y.feedName !== "Lake Harriet Bandshell")) {
      expect(x.authoritative).toBe(false);
    }
  });

  it("keeps the bandshell's pinned entry, authoritative", () => {
    const v = mplsParksVenuesFrom([show("Lake Harriet Bandshell", INFO)]);
    const bs = v.find((x) => x.feedName === "Lake Harriet Bandshell")!;
    expect(bs.authoritative).toBe(true);
    expect(bs.titleVenuePatterns).toContain("Lake Harriet Band Shell");
  });

  it("skips a venue with no coordinates rather than geocoding it", () => {
    expect(mplsParksVenuesFrom([show("Lyndale Park Peace Garden")]).map((v) => v.feedName))
      .toEqual(["Lake Harriet Bandshell"]);
  });

  it("skips a 'venue' that is just a street address", () => {
    const v = mplsParksVenuesFrom([show("4291 Queen Ave S, Minneapolis, MN 55410", INFO)]);
    expect(v.map((x) => x.feedName)).toEqual(["Lake Harriet Bandshell"]);
  });
});
