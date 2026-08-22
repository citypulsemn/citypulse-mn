import { chiWallClock } from "./clock";

/**
 * OFFICIAL SPORTS SCHEDULES — the primary-source importer (Aug 2026 incident).
 *
 * WHAT THIS REPLACES. The research pipeline used to learn the Twins' September
 * from *news articles about the schedule release*. Four runs read four different
 * articles and produced four Septembers that disagreed with each other. 13 of 20
 * published Twins listings were wrong, including six games on days the team was
 * out of town; the Wild were wrong at exactly the same rate. A reader found it
 * before we did. See docs/deploy-history/HOTFIX-sports-phantom-games.md.
 *
 * THE RULE IT BOUGHT: never derive a fact from prose when the primary source
 * publishes it. Every league here hands out exact opponents and start times as
 * JSON, for free. A sportswriter's paragraph is at best a hint that the feed
 * changed.
 *
 * THE HONESTY CONTRACT, and it is the whole point of the reconciler:
 *   - A feed proves things only INSIDE its own coverage window. Silence outside
 *     that window is not evidence of absence — an empty response and an offseason
 *     look identical, and treating them alike would archive a whole season.
 *   - We derive the window from the games the feed actually returned, home AND
 *     away. An away game is proof the feed knows about that date.
 *   - A failed fetch yields NO verdicts. Never a fake zero (rule 6).
 *
 * Pure: no network, no database, no clock of its own. The script does the I/O.
 */

// ── Shapes ───────────────────────────────────────────────────────────────────

export interface FeedGame {
  /** Chicago day key, "YYYY-MM-DD". */
  day: string;
  /** Chicago wall clock, "YYYY-MM-DDTHH:MM" — the frame the whole site uses. */
  start: string;
  /** The other team, as the feed names it ("Kansas City Royals"). */
  opponent: string;
  /** True when OUR team is at home. Only home games become listings. */
  home: boolean;
  /** Preseason/exhibition rather than regular season. Listed, but labelled. */
  preseason?: boolean;
  /**
   * The league has not announced a start time yet, and `start` is a placeholder
   * we must not present as a fact. See TBD_PLACEHOLDERS below.
   */
  timeTBD?: boolean;
}

export interface ExistingListing {
  id: string;
  /** Chicago day key. */
  day: string;
  /** Chicago wall clock. */
  start: string;
  title: string;
}

export type ListingVerdict =
  /** Matches the feed on day, opponent and start time. Safe to stamp verified. */
  | { kind: "ok"; id: string; title: string }
  /** Right game, wrong clock. The feed's time wins. */
  | { kind: "retime"; id: string; title: string; from: string; to: string }
  /** A game that day, but not this one. */
  | { kind: "wrong-opponent"; id: string; title: string; truth: string }
  /** No home game that day at all. The listing describes nothing. */
  | { kind: "phantom"; id: string; title: string }
  /** Outside the feed's coverage. We know nothing, so we touch nothing. */
  | { kind: "unknown"; id: string; title: string };

export interface ReconcilePlan {
  verdicts: ListingVerdict[];
  /** Real home games with no surviving listing — these get created. */
  missing: FeedGame[];
  /** The span the feed actually vouches for, or null if it returned nothing. */
  window: { from: string; to: string } | null;
}

// ── Parsers (defensive: a feed that changes shape must degrade, not throw) ────

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asRec = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/** UTC instant string → Chicago wall clock, via the one shared clock (rule 10). */
function toWall(utcISO: unknown): string | null {
  if (typeof utcISO !== "string" || !utcISO) return null;
  const d = new Date(utcISO);
  return Number.isNaN(d.getTime()) ? null : chiWallClock(d);
}

/**
 * TBD_PLACEHOLDERS — a scheduled game whose START TIME is not yet announced.
 *
 * Both feeds encode "time unknown" as a real-looking instant, and taking them at
 * face value reproduces the exact bug this module exists to kill:
 *   - MLB parks next season's games at 08:33Z and sets status.startTimeTBD.
 *     Read literally that is a 3:33 AM first pitch.
 *   - ESPN parks an unannounced kickoff at Eastern midnight and sets
 *     timeValid:false. Read literally, Michigan at Minnesota on Oct 3 becomes
 *     an 11 PM game on Oct 2 — the WRONG DAY, which is worse than a wrong clock.
 *
 * So a TBD game keeps the day its own feed states and carries no time claim at
 * all. Honest emptiness (rule 6): we know it's happening, we don't know when.
 */

/** The calendar date an ESPN placeholder denotes: Eastern midnight, by convention. */
function easternDay(utcISO: string): string | null {
  const d = new Date(utcISO);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(d);
}

/** A day with no time claim attached. */
function tbdGame(day: string, opponent: string, home: boolean, preseason?: boolean): FeedGame {
  return { day, start: `${day}T00:00`, opponent, home, preseason, timeTBD: true };
}

/**
 * Last-ditch guard for a placeholder no flag warned us about: nothing on this
 * calendar legitimately starts between midnight and 6:59 AM. Same threshold
 * lib/time-integrity.ts uses for agent-supplied times, applied to feeds.
 */
const IMPROBABLE_BEFORE_HOUR = 7;
function looksLikePlaceholder(wall: string): boolean {
  return Number(wall.slice(11, 13)) < IMPROBABLE_BEFORE_HOUR;
}

/**
 * MLB Stats API — which also serves the minors, and that is how the Saints are
 * covered (sportId 11 = Triple-A). Shape: dates[].games[].teams.{home,away}.team.
 */
export function parseMlbSchedule(json: unknown, teamId: number): FeedGame[] {
  const out: FeedGame[] = [];
  for (const day of asArray(asRec(json).dates)) {
    // The feed's own date string — authoritative for WHICH DAY, and the only
    // trustworthy field when the start time is a placeholder.
    const statedDay = String(asRec(day).date ?? "");
    for (const g of asArray(asRec(day).games)) {
      const game = asRec(g);
      const teams = asRec(game.teams);
      const home = asRec(asRec(teams.home).team);
      const away = asRec(asRec(teams.away).team);
      const isHome = home.id === teamId;
      if (!isHome && away.id !== teamId) continue;
      const opponent = String((isHome ? away.name : home.name) ?? "");
      if (!opponent) continue;
      const preseason = game.gameType === "S";
      const start = toWall(game.gameDate);
      const tbd = asRec(game.status).startTimeTBD === true;
      if (tbd || !start || looksLikePlaceholder(start)) {
        const fallbackDay = statedDay || start?.slice(0, 10);
        if (!fallbackDay) continue;
        out.push(tbdGame(fallbackDay, opponent, isHome, preseason));
        continue;
      }
      out.push({ day: start.slice(0, 10), start, opponent, home: isHome, preseason });
    }
  }
  return out;
}

/**
 * NHL club-schedule-season. Team names arrive split — placeName "Boston" plus
 * commonName "Bruins" — so we rejoin them. gameType 1 is preseason.
 */
export function parseNhlSchedule(json: unknown, abbrev: string): FeedGame[] {
  const out: FeedGame[] = [];
  const name = (t: Record<string, unknown>) => {
    const parts = [asRec(t.placeName).default, asRec(t.commonName).default].filter(
      (s): s is string => typeof s === "string" && s.length > 0,
    );
    return parts.join(" ").trim() || String(t.abbrev ?? "");
  };
  for (const g of asArray(asRec(json).games)) {
    const game = asRec(g);
    const home = asRec(game.homeTeam);
    const away = asRec(game.awayTeam);
    const isHome = home.abbrev === abbrev;
    if (!isHome && away.abbrev !== abbrev) continue;
    const start = toWall(game.startTimeUTC);
    const opponent = name(isHome ? away : home);
    if (!start || !opponent) continue;
    const preseason = game.gameType === 1;
    // The NHL publishes real times, but the placeholder guard costs nothing and
    // means one league changing its convention can't put a game on the wrong day.
    if (looksLikePlaceholder(start)) {
      out.push(tbdGame(String(game.gameDate ?? start.slice(0, 10)).slice(0, 10), opponent, isHome, preseason));
      continue;
    }
    out.push({ day: start.slice(0, 10), start, opponent, home: isHome, preseason });
  }
  return out;
}

/**
 * ESPN's public site API. Covers the NFL, NBA, WNBA, MLS and college football in
 * ONE shape — events[].competitions[0].competitors[] tagged home/away — which is
 * why five of our eight teams share a single parser. `isOurs` matches by display
 * name, because team ids differ per league.
 */
export function parseEspnSchedule(
  json: unknown,
  isOurs: (name: string) => boolean,
): FeedGame[] {
  const out: FeedGame[] = [];
  for (const e of asArray(asRec(json).events)) {
    const ev = asRec(e);
    const comp = asRec(asArray(ev.competitions)[0]);
    const competitors = asArray(comp.competitors).map(asRec);
    const home = competitors.find((c) => c.homeAway === "home");
    const away = competitors.find((c) => c.homeAway === "away");
    if (!home || !away) continue;
    const homeName = String(asRec(home.team).displayName ?? "");
    const awayName = String(asRec(away.team).displayName ?? "");
    const isHome = isOurs(homeName);
    if (!isHome && !isOurs(awayName)) continue;
    const raw = ev.date ?? comp.date;
    const opponent = isHome ? awayName : homeName;
    if (typeof raw !== "string" || !opponent) continue;
    const start = toWall(raw);
    if (!start) continue;
    // timeValid:false means "kickoff not announced", encoded as Eastern midnight.
    if (comp.timeValid === false || looksLikePlaceholder(start)) {
      const day = easternDay(raw);
      if (!day) continue;
      out.push(tbdGame(day, opponent, isHome));
      continue;
    }
    out.push({ day: start.slice(0, 10), start, opponent, home: isHome });
  }
  return out;
}

// ── Reconciliation ───────────────────────────────────────────────────────────

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Does this listing's title name the opponent the feed reports?
 *
 * Tries the full name ("chicagowhitesox"), then the last two words ("whitesox"),
 * then the bare nickname — but ONLY when the nickname is long enough to be
 * distinctive. "Sox" is not: the Twins play both the White Sox and the Red Sox,
 * and a three-letter match would happily call one the other.
 *
 * A miss is self-healing rather than destructive: the listing is hidden and the
 * feed's own version is created in the same pass, so the site converges on the
 * feed either way. This matcher exists to avoid needless churn, not to be a gate.
 */
export function titleNamesOpponent(title: string, opponent: string): boolean {
  const t = norm(title);
  const words = opponent.split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  const candidates = [norm(opponent)];
  if (words.length >= 2) candidates.push(norm(words.slice(-2).join("")));
  const nick = norm(words[words.length - 1]);
  if (nick.length >= 5) candidates.push(nick);
  // The place without the nickname: our listing may say "vs. Eastern Illinois"
  // where the feed says "Eastern Illinois Panthers". Same guard as the nickname —
  // long enough to be distinctive, so "New York" alone still qualifies but a bare
  // initial does not.
  if (words.length >= 2) {
    const place = norm(words.slice(0, -1).join(""));
    if (place.length >= 5) candidates.push(place);
  }
  return candidates.some((c) => c.length > 0 && t.includes(c));
}

/** The span a feed vouches for: first to last game it returned, home or away. */
export function feedWindow(games: FeedGame[]): { from: string; to: string } | null {
  if (!games.length) return null;
  const days = games.map((g) => g.day).sort();
  return { from: days[0], to: days[days.length - 1] };
}

/**
 * Compare what the site publishes against what the league says.
 *
 * `todayKey` scopes both directions to the future: we never re-litigate a game
 * that has already been played, and we never invent a listing for one.
 */
export function reconcile(
  games: FeedGame[],
  existing: ExistingListing[],
  todayKey: string,
): ReconcilePlan {
  const window = feedWindow(games);
  const homeByDay = new Map<string, FeedGame>();
  for (const g of games) if (g.home) homeByDay.set(g.day, g);

  const inWindow = (day: string) => !!window && day >= window.from && day <= window.to;

  const verdicts: ListingVerdict[] = [];
  const keptDays = new Set<string>();
  for (const row of existing) {
    if (row.day < todayKey) continue; // the past is not ours to correct
    const base = { id: row.id, title: row.title };
    if (!inWindow(row.day)) {
      verdicts.push({ kind: "unknown", ...base });
      continue;
    }
    const truth = homeByDay.get(row.day);
    if (!truth) {
      verdicts.push({ kind: "phantom", ...base });
    } else if (!titleNamesOpponent(row.title, truth.opponent)) {
      verdicts.push({ kind: "wrong-opponent", ...base, truth: truth.opponent });
    } else if (truth.timeTBD) {
      // Day and opponent confirmed; the league hasn't set a time. Overwriting a
      // plausible listed time with a placeholder midnight would be a downgrade,
      // so the existing time stands and the row still counts as covered.
      verdicts.push({ kind: "ok", ...base });
      keptDays.add(row.day);
    } else if (row.start !== truth.start) {
      verdicts.push({ kind: "retime", ...base, from: row.start, to: truth.start });
      keptDays.add(row.day);
    } else {
      verdicts.push({ kind: "ok", ...base });
      keptDays.add(row.day);
    }
  }

  // A day counts as covered only if a listing there SURVIVES this pass. A day
  // whose every listing is being hidden still needs the real game created — that
  // is exactly the hole the Aug 21 placeholder cleanup left on Nov 6 and Nov 7.
  const missing = games.filter(
    (g) => g.home && g.day >= todayKey && inWindow(g.day) && !keptDays.has(g.day),
  );

  return { verdicts, missing, window };
}

/** The canonical listing title for a game. One shape, so keys stay stable. */
export function gameTitle(teamName: string, game: FeedGame): string {
  return `${teamName} vs. ${game.opponent}${game.preseason ? " (Preseason)" : ""}`;
}
