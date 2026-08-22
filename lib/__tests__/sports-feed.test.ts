import { describe, it, expect } from "vitest";
import {
  parseMlbSchedule,
  parseNhlSchedule,
  parseEspnSchedule,
  titleNamesOpponent,
  feedWindow,
  reconcile,
  gameTitle,
  type FeedGame,
  type ExistingListing,
} from "../sports-feed";
import { nhlSeasonCode, espnSeasonYear, SPORTS_SOURCES } from "../sports-sources";

/**
 * These tests encode the Aug 2026 incident: 13 of 20 published Twins listings
 * were wrong because the pipeline read news articles instead of the league feed.
 * The cases below are the actual bad rows, so a regression fails loudly.
 */

// ── Fixtures, shaped like the real payloads ──────────────────────────────────

const mlb = (games: { date: string; homeId: number; homeName: string; awayId: number; awayName: string; type?: string }[]) => ({
  dates: games.map((g) => ({
    date: g.date.slice(0, 10),
    games: [{
      gameDate: g.date,
      gameType: g.type ?? "R",
      teams: {
        home: { team: { id: g.homeId, name: g.homeName } },
        away: { team: { id: g.awayId, name: g.awayName } },
      },
    }],
  })),
});

const nhl = (games: { utc: string; homeAbbrev: string; awayPlace: string; awayCommon: string; type?: number }[]) => ({
  games: games.map((g) => ({
    startTimeUTC: g.utc,
    gameType: g.type ?? 2,
    homeTeam: { abbrev: g.homeAbbrev, placeName: { default: "Minnesota" }, commonName: { default: "Wild" } },
    awayTeam: { abbrev: "XXX", placeName: { default: g.awayPlace }, commonName: { default: g.awayCommon } },
  })),
});

const espn = (games: { date: string; home: string; away: string }[]) => ({
  events: games.map((g) => ({
    date: g.date,
    competitions: [{
      competitors: [
        { homeAway: "home", team: { displayName: g.home } },
        { homeAway: "away", team: { displayName: g.away } },
      ],
    }],
  })),
});

describe("parsers read the leagues' real shapes", () => {
  it("MLB: a home game keeps the away team as the opponent, in Chicago time", () => {
    // 2026-09-05T00:10Z is Sep 4, 7:10 PM in Chicago — the exact game the
    // reporter said didn't exist (it doesn't; the Twins are away). Here we only
    // check the frame conversion.
    const games = parseMlbSchedule(
      mlb([{ date: "2026-09-05T00:10:00Z", homeId: 142, homeName: "Minnesota Twins", awayId: 118, awayName: "Kansas City Royals" }]),
      142,
    );
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      day: "2026-09-04",
      start: "2026-09-04T19:10",
      opponent: "Kansas City Royals",
      home: true,
    });
  });

  it("MLB: an away game is kept (it proves the window) but marked not-home", () => {
    const games = parseMlbSchedule(
      mlb([{ date: "2026-09-04T23:40:00Z", homeId: 145, homeName: "Chicago White Sox", awayId: 142, awayName: "Minnesota Twins" }]),
      142,
    );
    expect(games[0].home).toBe(false);
    expect(games[0].opponent).toBe("Chicago White Sox");
  });

  it("MLB: a game involving neither of us is ignored", () => {
    const games = parseMlbSchedule(
      mlb([{ date: "2026-09-04T23:40:00Z", homeId: 111, homeName: "Boston Red Sox", awayId: 147, awayName: "New York Yankees" }]),
      142,
    );
    expect(games).toEqual([]);
  });

  it("MLB: spring training is flagged as preseason", () => {
    const games = parseMlbSchedule(
      mlb([{ date: "2026-03-05T18:05:00Z", homeId: 142, homeName: "Minnesota Twins", awayId: 118, awayName: "Kansas City Royals", type: "S" }]),
      142,
    );
    expect(games[0].preseason).toBe(true);
  });

  it("NHL: the split place/common names are rejoined", () => {
    const games = parseNhlSchedule(
      nhl([{ utc: "2026-10-04T00:00:00Z", homeAbbrev: "MIN", awayPlace: "Boston", awayCommon: "Bruins" }]),
      "MIN",
    );
    expect(games[0].opponent).toBe("Boston Bruins");
    expect(games[0].start).toBe("2026-10-03T19:00");
    expect(games[0].home).toBe(true);
  });

  it("NHL: gameType 1 is preseason", () => {
    const games = parseNhlSchedule(
      nhl([{ utc: "2026-09-20T00:00:00Z", homeAbbrev: "MIN", awayPlace: "Chicago", awayCommon: "Blackhawks", type: 1 }]),
      "MIN",
    );
    expect(games[0].preseason).toBe(true);
  });

  it("ESPN: one shape serves five leagues", () => {
    const games = parseEspnSchedule(
      espn([{ date: "2026-09-13T20:25Z", home: "Minnesota Vikings", away: "Green Bay Packers" }]),
      (n) => n.toLowerCase().includes("minnesota vikings"),
    );
    expect(games[0]).toMatchObject({ day: "2026-09-13", opponent: "Green Bay Packers", home: true });
  });

  it("every parser degrades to empty on garbage rather than throwing", () => {
    for (const junk of [null, undefined, 42, "nope", {}, { dates: "x" }, { games: null }, { events: {} }]) {
      expect(parseMlbSchedule(junk, 142)).toEqual([]);
      expect(parseNhlSchedule(junk, "MIN")).toEqual([]);
      expect(parseEspnSchedule(junk, () => true)).toEqual([]);
    }
  });

  it("a row missing its date or teams is skipped, not guessed at", () => {
    expect(parseMlbSchedule({ dates: [{ games: [{ teams: {} }] }] }, 142)).toEqual([]);
    expect(parseEspnSchedule({ events: [{ date: "2026-09-13T20:25Z", competitions: [{ competitors: [] }] }] }, () => true)).toEqual([]);
  });
});

describe("TBD start times — a placeholder is not a fact", () => {
  it("MLB: startTimeTBD keeps the feed's own date and makes no time claim", () => {
    // Next season's games sit at 08:33Z. Read literally that is a 3:33 AM first
    // pitch, which is how 224 fictional start times nearly shipped.
    const json = {
      dates: [{
        date: "2027-04-02",
        games: [{
          gameDate: "2027-04-02T08:33:00Z",
          gameType: "R",
          status: { startTimeTBD: true },
          teams: {
            home: { team: { id: 142, name: "Minnesota Twins" } },
            away: { team: { id: 139, name: "Tampa Bay Rays" } },
          },
        }],
      }],
    };
    const [g] = parseMlbSchedule(json, 142);
    expect(g.day).toBe("2027-04-02");
    expect(g.timeTBD).toBe(true);
    expect(g.start).toBe("2027-04-02T00:00");
  });

  it("ESPN: timeValid:false keeps the EASTERN date — the wrong-day trap", () => {
    // 2026-10-03T04:00Z is Eastern midnight on Oct 3, but 11 PM on Oct 2 in
    // Chicago. Michigan at Minnesota is an Oct 3 game; taking the Chicago
    // conversion would have moved it a day earlier.
    const json = {
      events: [{
        date: "2026-10-03T04:00Z",
        competitions: [{
          timeValid: false,
          competitors: [
            { homeAway: "home", team: { displayName: "Minnesota Golden Gophers" } },
            { homeAway: "away", team: { displayName: "Michigan Wolverines" } },
          ],
        }],
      }],
    };
    const [g] = parseEspnSchedule(json, (n) => n.toLowerCase().includes("gophers"));
    expect(g.day).toBe("2026-10-03");
    expect(g.timeTBD).toBe(true);
  });

  it("ESPN: timeValid:true is trusted as a real time", () => {
    const [g] = parseEspnSchedule(
      espn([{ date: "2026-09-12T19:30Z", home: "Minnesota Golden Gophers", away: "Mississippi State Bulldogs" }]),
      (n) => n.toLowerCase().includes("gophers"),
    );
    expect(g.timeTBD).toBeUndefined();
    expect(g.start).toBe("2026-09-12T14:30");
  });

  it("an unflagged small-hours start is caught by the backstop", () => {
    // No feed flag, but nothing here starts at 3:33 AM. Same 7 AM threshold
    // lib/time-integrity.ts uses for agent-supplied times.
    const [g] = parseMlbSchedule(
      mlb([{ date: "2027-04-02T08:33:00Z", homeId: 142, homeName: "Minnesota Twins", awayId: 139, awayName: "Tampa Bay Rays" }]),
      142,
    );
    expect(g.timeTBD).toBe(true);
    expect(g.day).toBe("2027-04-02");
  });

  it("a TBD game never overwrites a listed time with midnight", () => {
    const feed: FeedGame[] = [{
      day: "2026-10-03", start: "2026-10-03T00:00",
      opponent: "Michigan Wolverines", home: true, timeTBD: true,
    }];
    const plan = reconcile(feed, [{
      id: "r1", day: "2026-10-03", start: "2026-10-03T12:00",
      title: "Minnesota Golden Gophers Football vs. Michigan Wolverines",
    }], "2026-08-21");
    expect(plan.verdicts[0].kind).toBe("ok");
    expect(plan.missing).toEqual([]);
  });
});

describe("titleNamesOpponent — the Sox problem", () => {
  it("matches the full name and the last two words", () => {
    expect(titleNamesOpponent("Minnesota Twins vs. Kansas City Royals", "Kansas City Royals")).toBe(true);
    expect(titleNamesOpponent("Twins vs. City Royals", "Kansas City Royals")).toBe(true);
  });

  it("matches the place when our title omits the nickname", () => {
    // The Gophers case: our listing said "vs. Eastern Illinois", ESPN says
    // "Eastern Illinois Panthers". Same game — no reason to churn the row.
    expect(titleNamesOpponent("Minnesota Golden Gophers Football vs. Eastern Illinois", "Eastern Illinois Panthers")).toBe(true);
  });

  it("matches a distinctive bare nickname", () => {
    expect(titleNamesOpponent("Minnesota Wild vs. Bruins", "Boston Bruins")).toBe(true);
    expect(titleNamesOpponent("Wild vs. Golden Knights", "Vegas Golden Knights")).toBe(true);
  });

  it("REFUSES a three-letter nickname — Red Sox must not match White Sox", () => {
    expect(titleNamesOpponent("Minnesota Twins vs. Boston Red Sox", "Chicago White Sox")).toBe(false);
    expect(titleNamesOpponent("Minnesota Twins vs. Chicago White Sox", "Chicago White Sox")).toBe(true);
  });

  it("does not confuse the Blues with the Blue Jackets", () => {
    expect(titleNamesOpponent("Minnesota Wild vs. Columbus Blue Jackets", "St. Louis Blues")).toBe(false);
    expect(titleNamesOpponent("Minnesota Wild vs. St. Louis Blues", "St. Louis Blues")).toBe(true);
  });

  it("ignores punctuation and case", () => {
    expect(titleNamesOpponent("MINNESOTA WILD VS. ST LOUIS BLUES!", "St. Louis Blues")).toBe(true);
  });

  it("an empty opponent never matches", () => {
    expect(titleNamesOpponent("anything", "")).toBe(false);
  });
});

describe("feedWindow — what the feed is willing to vouch for", () => {
  const g = (day: string, home = true): FeedGame => ({ day, start: `${day}T19:00`, opponent: "X", home });

  it("spans first to last game, home or away", () => {
    expect(feedWindow([g("2026-09-04", false), g("2026-08-28"), g("2026-10-01")]))
      .toEqual({ from: "2026-08-28", to: "2026-10-01" });
  });

  it("is null when the feed returned nothing — the offseason/outage case", () => {
    expect(feedWindow([])).toBeNull();
  });
});

describe("reconcile — the whole point", () => {
  const TODAY = "2026-08-21";
  const row = (id: string, day: string, time: string, title: string): ExistingListing => ({
    id, day, start: `${day}T${time}`, title,
  });
  const home = (day: string, time: string, opponent: string): FeedGame => ({
    day, start: `${day}T${time}`, opponent, home: true,
  });
  const away = (day: string, opponent: string): FeedGame => ({
    day, start: `${day}T19:00`, opponent, home: false,
  });

  it("calls the Sep 4 Royals game a phantom — the report that started this", () => {
    const feed = [away("2026-09-04", "Chicago White Sox"), home("2026-08-30", "13:10", "Chicago White Sox")];
    const plan = reconcile(feed, [row("r1", "2026-09-04", "19:10", "Minnesota Twins vs. Kansas City Royals")], TODAY);
    expect(plan.verdicts).toEqual([{ kind: "phantom", id: "r1", title: "Minnesota Twins vs. Kansas City Royals" }]);
  });

  it("catches the wrong opponent even when a game really is on that night", () => {
    const feed = [home("2026-09-14", "18:40", "New York Yankees")];
    const plan = reconcile(feed, [row("r1", "2026-09-14", "19:10", "Minnesota Twins vs. Baltimore Orioles (Game 1)")], TODAY);
    expect(plan.verdicts[0]).toMatchObject({ kind: "wrong-opponent", truth: "New York Yankees" });
  });

  it("corrects a start time without touching anything else", () => {
    const feed = [home("2026-09-02", "18:40", "Detroit Tigers")];
    const plan = reconcile(feed, [row("r1", "2026-09-02", "12:10", "Minnesota Twins vs. Detroit Tigers")], TODAY);
    expect(plan.verdicts[0]).toMatchObject({ kind: "retime", from: "2026-09-02T12:10", to: "2026-09-02T18:40" });
    expect(plan.missing).toEqual([]); // a retimed listing still covers its day
  });

  it("leaves a correct listing alone and marks it ok", () => {
    const feed = [home("2026-08-30", "13:10", "Chicago White Sox")];
    const plan = reconcile(feed, [row("r1", "2026-08-30", "13:10", "Minnesota Twins vs. Chicago White Sox")], TODAY);
    expect(plan.verdicts[0].kind).toBe("ok");
    expect(plan.missing).toEqual([]);
  });

  it("creates the real game when a day's only listing is being hidden (the Nov 6/7 hole)", () => {
    const feed = [home("2026-11-06", "19:00", "San Jose Sharks")];
    const plan = reconcile(feed, [row("r1", "2026-11-06", "19:00", "Minnesota Wild vs. Opponent (Home Game)")], TODAY);
    expect(plan.verdicts[0].kind).toBe("wrong-opponent");
    expect(plan.missing).toEqual([feed[0]]);
  });

  it("creates a real game we never listed at all", () => {
    const feed = [home("2026-11-07", "19:00", "Tampa Bay Lightning")];
    expect(reconcile(feed, [], TODAY).missing).toEqual([feed[0]]);
  });

  // ── The safety properties ─────────────────────────────────────────────────

  it("an EMPTY feed changes nothing — an outage must not archive a season", () => {
    const existing = [
      row("r1", "2026-09-04", "19:10", "Minnesota Twins vs. Kansas City Royals"),
      row("r2", "2026-09-14", "18:40", "Minnesota Twins vs. New York Yankees"),
    ];
    const plan = reconcile([], existing, TODAY);
    expect(plan.window).toBeNull();
    expect(plan.missing).toEqual([]);
    expect(plan.verdicts.every((v) => v.kind === "unknown")).toBe(true);
  });

  it("a listing beyond the feed's window is left alone, not called a phantom", () => {
    const feed = [home("2026-09-04", "19:10", "Kansas City Royals")];
    const plan = reconcile(feed, [row("r1", "2027-04-10", "13:10", "Minnesota Twins vs. Somebody")], TODAY);
    expect(plan.verdicts[0].kind).toBe("unknown");
  });

  it("never judges or invents anything in the past", () => {
    const feed = [home("2026-08-01", "19:10", "Kansas City Royals"), home("2026-09-04", "19:10", "Detroit Tigers")];
    const plan = reconcile(feed, [row("r1", "2026-08-01", "10:00", "Minnesota Twins vs. Nobody")], TODAY);
    expect(plan.verdicts).toEqual([]);
    expect(plan.missing.map((g) => g.day)).toEqual(["2026-09-04"]);
  });

  it("an away-only feed still proves phantoms inside its window", () => {
    // The Twins are on a road trip: no home games at all, but the feed's window
    // covers those days, so a home listing in that span is provably false.
    const feed = [away("2026-09-04", "Chicago White Sox"), away("2026-09-06", "Chicago White Sox")];
    const plan = reconcile(feed, [row("r1", "2026-09-05", "19:10", "Minnesota Twins vs. Kansas City Royals")], TODAY);
    expect(plan.verdicts[0].kind).toBe("phantom");
    expect(plan.missing).toEqual([]);
  });

  it("two contradictory listings on one night: the real one survives, the other is hidden", () => {
    // Oct 3 on the live site: a real Bruins home opener beside a fictional
    // Predators one.
    const feed = [home("2026-10-03", "19:00", "Boston Bruins")];
    const plan = reconcile(feed, [
      row("r1", "2026-10-03", "19:00", "Minnesota Wild vs. Boston Bruins (Home Opener)"),
      row("r2", "2026-10-03", "19:00", "Minnesota Wild vs. Nashville Predators (NHL Regular Season Opener)"),
    ], TODAY);
    expect(plan.verdicts.find((v) => v.id === "r1")?.kind).toBe("ok");
    expect(plan.verdicts.find((v) => v.id === "r2")?.kind).toBe("wrong-opponent");
    expect(plan.missing).toEqual([]); // r1 already covers the night
  });
});

describe("gameTitle", () => {
  it("is one stable shape, so event keys don't churn", () => {
    expect(gameTitle("Minnesota Twins", { day: "2026-09-04", start: "2026-09-04T19:10", opponent: "Kansas City Royals", home: true }))
      .toBe("Minnesota Twins vs. Kansas City Royals");
  });

  it("labels preseason rather than hiding it", () => {
    expect(gameTitle("Minnesota Wild", { day: "2026-09-19", start: "2026-09-19T19:00", opponent: "Chicago Blackhawks", home: true, preseason: true }))
      .toBe("Minnesota Wild vs. Chicago Blackhawks (Preseason)");
  });
});

describe("season arithmetic — the per-league quirks", () => {
  it("NHL season code rolls over in July", () => {
    expect(nhlSeasonCode("2026-08-21")).toBe("20262027");
    expect(nhlSeasonCode("2027-03-01")).toBe("20262027");
    expect(nhlSeasonCode("2026-06-30")).toBe("20252026");
  });

  it("ESPN labels a winter season by the year it ENDS, a fall season by the year it starts", () => {
    expect(espnSeasonYear("2026-08-21", true)).toBe(2027);  // NBA 2026-27
    expect(espnSeasonYear("2027-02-01", true)).toBe(2027);
    expect(espnSeasonYear("2026-08-21", false)).toBe(2026); // NFL 2026
  });
});

describe("the source registry", () => {
  it("covers every team the Aug 2026 audit found unverified", () => {
    const keys = SPORTS_SOURCES.map((s) => s.key).sort();
    expect(keys).toEqual([
      "gophers-football", "lynx", "mnufc", "saints",
      "timberwolves", "twins", "vikings", "wild",
    ]);
  });

  it("every ESPN team source asks for the playoffs too, not just the regular season", () => {
    // seasontype=2 alone would make a home playoff game look like a phantom the
    // moment the league scheduled it.
    for (const s of SPORTS_SOURCES) {
      const urls = s.urls("2026-08-21", "2026-11-21");
      if (!urls.some((u) => u.includes("seasontype=2"))) continue;
      expect(urls.some((u) => u.includes("seasontype=3"))).toBe(true);
    }
  });

  it("the Wild pattern is narrow enough to miss the Wild Rice Festival", () => {
    const wild = SPORTS_SOURCES.find((s) => s.key === "wild")!;
    expect(wild.titleMatch).toBe("%minnesota wild%");
    // The loose pattern that would have caught a real, unrelated event.
    expect("Harriet Alexander Nature Center Wild Rice Festival".toLowerCase())
      .not.toContain(wild.titleMatch.replace(/%/g, ""));
  });

  it("every source builds a plausible https URL and pins real coordinates", () => {
    for (const s of SPORTS_SOURCES) {
      const urls = s.urls("2026-08-21", "2026-11-21");
      expect(urls.length).toBeGreaterThan(0);
      for (const u of urls) expect(u).toMatch(/^https:\/\//);
      expect(s.venue.lat).toBeGreaterThan(44.5);
      expect(s.venue.lat).toBeLessThan(45.5);
      expect(s.venue.lng).toBeLessThan(-92);
      expect(s.venue.lng).toBeGreaterThan(-94);
    }
  });
});
