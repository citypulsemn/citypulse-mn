import type { FeedGame } from "./sports-feed";
import {
  parseMlbSchedule,
  parseNhlSchedule,
  parseEspnSchedule,
} from "./sports-feed";

/**
 * THE TEAM REGISTRY for the official-schedule importer.
 *
 * Eight local teams, three feed shapes. Each entry owns its league's quirks —
 * the season-code arithmetic, the seasontype parameter, the one league whose
 * team endpoint only ever returns the first half of its season — so the quirk
 * lives next to the team it affects instead of in a branch in the script.
 *
 * Venue coordinates are pinned here rather than geocoded. These seven buildings
 * do not move, and hardcoding them removes a Mapbox call (and a failure mode)
 * from the import path. They were taken from the rows already in the database.
 *
 * `titleMatch` is the SQL ILIKE pattern that finds this team's existing listings.
 * It is deliberately narrow: '%wild%' also matches the Harriet Alexander Wild
 * Rice Festival, and a bulk status change is exactly where a loose pattern
 * becomes an incident.
 */

export interface SportsVenue {
  name: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
}

export interface SportsSource {
  key: string;
  /** How the team is named in a listing title. */
  team: string;
  venue: SportsVenue;
  /** SQL ILIKE pattern selecting this team's listings. Narrow on purpose. */
  titleMatch: string;
  /**
   * Request URLs for a Chicago day range. An array because ESPN's team endpoints
   * split a season by "seasontype": 2 is the regular season and 3 the playoffs,
   * and asking for only the first would make a home playoff game look like a
   * phantom the moment it was scheduled. Results are merged; ALL of them must
   * succeed before we act, so a half-read season can't hide real games.
   */
  urls: (from: string, to: string) => string[];
  /** Turns the parsed JSON into games. */
  parse: (json: unknown) => FeedGame[];
  /** Human-readable attribution stored on each imported row. */
  sourceLabel: string;
}

const TARGET_FIELD: SportsVenue = {
  name: "Target Field",
  city: "Minneapolis",
  address: "1 Twins Way",
  lat: 44.981368,
  lng: -93.278505,
};
const GRAND_CASINO_ARENA: SportsVenue = {
  name: "Grand Casino Arena",
  city: "St. Paul",
  address: "199 W Kellogg Blvd",
  lat: 44.932149,
  lng: -93.112696,
};
const US_BANK_STADIUM: SportsVenue = {
  name: "U.S. Bank Stadium",
  city: "Minneapolis",
  address: "401 Chicago Ave",
  lat: 44.973556,
  lng: -93.257609,
};
const TARGET_CENTER: SportsVenue = {
  name: "Target Center",
  city: "Minneapolis",
  address: "600 First Avenue North",
  lat: 44.988908,
  lng: -93.274054,
};
const ALLIANZ_FIELD: SportsVenue = {
  name: "Allianz Field",
  city: "Saint Paul",
  address: "1000 Snelling Ave N",
  lat: 44.977107,
  lng: -93.160236,
};
const HUNTINGTON_BANK_STADIUM: SportsVenue = {
  name: "Huntington Bank Stadium",
  city: "Minneapolis",
  address: "420 SE 23rd Ave",
  lat: 44.975943,
  lng: -93.224964,
};
const CHS_FIELD: SportsVenue = {
  name: "CHS Field",
  city: "Saint Paul",
  address: "360 Broadway Street",
  lat: 44.950544,
  lng: -93.08496,
};

const ESPN = "https://site.api.espn.com/apis/site/v2/sports";

/**
 * NHL season code: "20262027". The league year rolls over in the summer, so
 * anything from July on belongs to the season that STARTS this calendar year.
 */
export function nhlSeasonCode(day: string): string {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const start = month >= 7 ? year : year - 1;
  return `${start}${start + 1}`;
}

/**
 * ESPN labels a winter season by the year it ENDS (2026-27 is "2027"), and a
 * fall/summer season by the year it starts. Same rollover month, opposite label.
 */
export function espnSeasonYear(day: string, winter: boolean): number {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  if (!winter) return year;
  return month >= 7 ? year + 1 : year;
}

const nameContains = (needle: string) => (name: string) =>
  name.toLowerCase().includes(needle);

export const SPORTS_SOURCES: SportsSource[] = [
  {
    key: "twins",
    team: "Minnesota Twins",
    venue: TARGET_FIELD,
    titleMatch: "%twins%",
    urls: (from, to) => [
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=142&startDate=${from}&endDate=${to}`,
    ],
    parse: (json) => parseMlbSchedule(json, 142),
    sourceLabel: "MLB Stats API",
  },
  {
    key: "saints",
    team: "St. Paul Saints",
    venue: CHS_FIELD,
    titleMatch: "%saints%",
    // Triple-A rides the same MLB feed, on sportId 11.
    urls: (from, to) => [
      `https://statsapi.mlb.com/api/v1/schedule?sportId=11&teamId=1960&startDate=${from}&endDate=${to}`,
    ],
    parse: (json) => parseMlbSchedule(json, 1960),
    sourceLabel: "MLB Stats API (Triple-A)",
  },
  {
    key: "wild",
    team: "Minnesota Wild",
    venue: GRAND_CASINO_ARENA,
    // NOT '%wild%' — that also catches the Wild Rice Festival.
    titleMatch: "%minnesota wild%",
    urls: (from) => [
      `https://api-web.nhle.com/v1/club-schedule-season/MIN/${nhlSeasonCode(from)}`,
    ],
    parse: (json) => parseNhlSchedule(json, "MIN"),
    sourceLabel: "NHL API",
  },
  {
    key: "vikings",
    team: "Minnesota Vikings",
    venue: US_BANK_STADIUM,
    titleMatch: "%vikings%",
    urls: (from) => [
      `${ESPN}/football/nfl/teams/min/schedule?season=${espnSeasonYear(from, false)}&seasontype=2`,
      `${ESPN}/football/nfl/teams/min/schedule?season=${espnSeasonYear(from, false)}&seasontype=3`,
    ],
    parse: (json) => parseEspnSchedule(json, nameContains("minnesota vikings")),
    sourceLabel: "ESPN",
  },
  {
    key: "timberwolves",
    team: "Minnesota Timberwolves",
    venue: TARGET_CENTER,
    titleMatch: "%timberwolves%",
    urls: (from) => [
      `${ESPN}/basketball/nba/teams/min/schedule?season=${espnSeasonYear(from, true)}&seasontype=2`,
      `${ESPN}/basketball/nba/teams/min/schedule?season=${espnSeasonYear(from, true)}&seasontype=3`,
    ],
    parse: (json) =>
      parseEspnSchedule(json, nameContains("minnesota timberwolves")),
    sourceLabel: "ESPN",
  },
  {
    key: "lynx",
    team: "Minnesota Lynx",
    venue: TARGET_CENTER,
    titleMatch: "%lynx%",
    urls: (from) => [
      `${ESPN}/basketball/wnba/teams/min/schedule?season=${espnSeasonYear(from, false)}&seasontype=2`,
      `${ESPN}/basketball/wnba/teams/min/schedule?season=${espnSeasonYear(from, false)}&seasontype=3`,
    ],
    parse: (json) => parseEspnSchedule(json, nameContains("minnesota lynx")),
    sourceLabel: "ESPN",
  },
  {
    key: "gophers-football",
    team: "Minnesota Golden Gophers Football",
    venue: HUNTINGTON_BANK_STADIUM,
    titleMatch: "%gopher%football%",
    urls: (from) => [
      `${ESPN}/football/college-football/teams/135/schedule?season=${espnSeasonYear(from, false)}&seasontype=2`,
      `${ESPN}/football/college-football/teams/135/schedule?season=${espnSeasonYear(from, false)}&seasontype=3`,
    ],
    parse: (json) => parseEspnSchedule(json, nameContains("gophers")),
    sourceLabel: "ESPN",
  },
  {
    key: "mnufc",
    team: "Minnesota United FC",
    venue: ALLIANZ_FIELD,
    titleMatch: "%united%",
    // MLS is the odd one out: the per-team endpoint only ever returns the first
    // half of the season, whatever season/half parameters you give it (checked
    // Aug 2026 — it answered with February–April every time). The league-wide
    // scoreboard honours a date range, so we filter that instead.
    urls: (from, to) => [
      `${ESPN}/soccer/usa.1/scoreboard?dates=${from.replace(/-/g, "")}-${to.replace(/-/g, "")}&limit=400`,
    ],
    parse: (json) => parseEspnSchedule(json, nameContains("minnesota united")),
    sourceLabel: "ESPN",
  },
];
