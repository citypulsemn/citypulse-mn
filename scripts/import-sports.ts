/**
 * Official sports schedule importer.
 *
 * Usage: npm run import-sports [-- --dry-run] [-- --only=twins,wild]
 *
 * For each team in lib/sports-sources.ts: fetch the league's own feed, compare it
 * with what the site publishes, and make the site agree with the league.
 *
 *   phantom / wrong opponent → hidden (status 'draft', never deleted)
 *   wrong start time         → corrected in place
 *   matches the feed         → stamped verified
 *   real game, no listing    → created
 *
 * THE SAFETY PROPERTY, which matters more than any of the above: a team whose
 * fetch fails, or whose feed returns nothing, produces NO changes at all. An
 * empty response and an offseason are indistinguishable from here, and guessing
 * between them would archive a whole season. Failure is reported, never acted on.
 */
import { sql } from "../lib/db";
import { revalidateAndReport } from "../lib/revalidate-client";
import { SPORTS_SOURCES, type SportsSource } from "../lib/sports-sources";
import { reconcile, gameTitle, type FeedGame, type ExistingListing } from "../lib/sports-feed";
import { computeEventKey } from "../lib/event-key";
import { normalizeAgentTime } from "../lib/time-integrity";
import { upsertEvents } from "../lib/upsert";
import { chiTodayKey } from "../lib/clock";
import type { DbEventInput } from "../lib/types";

const dryRun = process.argv.includes("--dry-run");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.slice("--only=".length).split(",") : null;

/**
 * How far ahead we ask each feed — matched to the site's own discovery horizon
 * (lib/horizon.ts tops out at 92 days) rather than to what the feeds will give.
 * MLB will happily hand over all of next season: 224 games nobody is browsing
 * for yet, most of them without announced start times. Override with --days=N.
 */
const DEFAULT_HORIZON_DAYS = 92;
const daysArg = process.argv.find((a) => a.startsWith("--days="));
const HORIZON_DAYS = daysArg ? Math.max(1, Number(daysArg.slice("--days=".length)) || 0) : DEFAULT_HORIZON_DAYS;

interface TeamResult {
  key: string;
  ok: boolean;
  note: string;
  hidden: number;
  retimed: number;
  verified: number;
  added: number;
  unknown: number;
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Fetch every URL a source declares and merge the results.
 *
 * ALL-OR-NOTHING on purpose. A source's URLs are halves of one schedule (ESPN
 * splits regular season and playoffs), so a partial read is a schedule with
 * holes in it — and holes are what this importer turns into "hidden as phantom".
 * One failed half means we know nothing about that team this run.
 */
async function fetchFeed(source: SportsSource, from: string, to: string): Promise<FeedGame[]> {
  const urls = source.urls(from, to);
  const merged: FeedGame[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
    for (const g of source.parse(await res.json())) {
      const id = `${g.day}|${g.opponent}|${g.home}`;
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(g);
    }
  }
  // An empty merge is not proof of an empty season, so it is an error, not a
  // result: the caller reports the team unavailable and changes nothing.
  if (!merged.length) throw new Error("feed returned no games");
  return merged;
}

function toEventInput(source: SportsSource, game: FeedGame): DbEventInput | null {
  // A TBD game is stored date-only: all_day, midnight start, no invented clock.
  const time = normalizeAgentTime(game.timeTBD ? game.day : game.start);
  if (!time) return null;
  const title = gameTitle(source.team, game);
  const v = source.venue;
  return {
    event_key: computeEventKey(title, v.name, game.start),
    title,
    category: "sports",
    venue: v.name,
    address: v.address,
    city: v.city,
    lat: v.lat,
    lng: v.lng,
    start_at: time.iso,
    all_day: game.timeTBD === true,
    // Leagues publish a start, not a finish. A three-hour guess would be an
    // invented fact; null is the honest floor (rule 6).
    end_at: null,
    price: "See listing",
    priceTier: "$$",
    // No per-game ticket URL in these feeds, so none is claimed.
    ticket_url: "",
    description: `${game.opponent} ${game.home ? "at" : "vs."} ${source.team} — ${v.name}, ${v.city}.`,
    image: "",
    source_url: source.urls(game.day, game.day)[0],
    status: "published",
  };
}

async function runTeam(source: SportsSource, today: string): Promise<TeamResult> {
  const base: TeamResult = {
    key: source.key, ok: false, note: "", hidden: 0, retimed: 0,
    verified: 0, added: 0, unknown: 0,
  };
  if (!sql) return { ...base, note: "no database connection" };

  const horizonEnd = addDays(today, HORIZON_DAYS);
  let games: FeedGame[];
  try {
    games = await fetchFeed(source, today, horizonEnd);
  } catch (err) {
    // Rule 6 + rule 1: an unreachable feed proves nothing. Report and stand down.
    return { ...base, note: err instanceof Error ? err.message : String(err) };
  }

  // ESPN ignores the date range on its team endpoints and returns the whole
  // season regardless, so the horizon has to be enforced here as well as asked
  // for. Clipping shrinks the proving window too, which is the honest outcome:
  // listings past the horizon become "unknown" and are left alone rather than
  // judged against a feed we've chosen to stop reading.
  games = games.filter((g) => g.day <= horizonEnd);
  if (!games.length) {
    return { ...base, note: `no games inside ${HORIZON_DAYS}-day horizon` };
  }

  const rows = await sql<{ id: string; day: string; start: string; title: string }[]>`
    select id::text as id,
           to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD') as day,
           to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start,
           title
    from events
    where title ilike ${source.titleMatch}
      and category = 'sports'
      and status = 'published'
      and start_at >= now()
    order by start_at
  `;

  const existing: ExistingListing[] = rows.map((r) => ({ ...r }));
  const plan = reconcile(games, existing, today);
  const homeGames = games.filter((g) => g.home).length;

  const hide = plan.verdicts.filter(
    (v) => v.kind === "phantom" || v.kind === "wrong-opponent",
  );
  const retime = plan.verdicts.filter((v) => v.kind === "retime");
  const ok = plan.verdicts.filter((v) => v.kind === "ok");
  const unknown = plan.verdicts.filter((v) => v.kind === "unknown");

  const result: TeamResult = {
    ...base,
    ok: true,
    note: `${games.length} games (${homeGames} home), window ${plan.window?.from}→${plan.window?.to}`,
    hidden: hide.length,
    retimed: retime.length,
    verified: ok.length,
    added: plan.missing.length,
    unknown: unknown.length,
  };

  for (const v of hide) {
    const why = v.kind === "phantom"
      ? `no ${source.team} home game that day per ${source.sourceLabel}`
      : `${source.sourceLabel} says the opponent is ${v.truth}`;
    console.log(`   HIDE    ${v.title.slice(0, 52).padEnd(52)} ${why}`);
  }
  for (const v of retime) {
    if (v.kind !== "retime") continue;
    console.log(`   RETIME  ${v.title.slice(0, 52).padEnd(52)} ${v.from.slice(11)} → ${v.to.slice(11)}`);
  }
  for (const g of plan.missing) {
    console.log(
      `   ADD     ${gameTitle(source.team, g).slice(0, 52).padEnd(52)} ` +
        (g.timeTBD ? `${g.day} (time TBD)` : g.start),
    );
  }
  if (unknown.length) {
    console.log(`   (${unknown.length} listing(s) outside the feed's window — left alone)`);
  }

  if (dryRun) return result;

  if (hide.length) {
    const ids = hide.map((v) => v.id);
    await sql`update events set status = 'draft' where id::text = any(${ids})`;
    for (const v of hide) {
      const why = v.kind === "phantom"
        ? `no home game that day per ${source.sourceLabel}`
        : `${source.sourceLabel} says the opponent is ${v.kind === "wrong-opponent" ? v.truth : "?"}`;
      await sql`
        insert into admin_audit (action, event_id, patch)
        values ('import_sports_hide', ${v.id}::uuid, ${sql.json({ status: "draft", why } as never)})
      `;
    }
  }

  for (const v of retime) {
    if (v.kind !== "retime") continue;
    // ::text first — postgres.js types an ISO-shaped param as timestamptz and
    // shifts it before the zone attaches (the 2026-07-20 finding).
    await sql`
      update events
      set start_at = (${v.to}::text::timestamp at time zone 'America/Chicago')
      where id::text = ${v.id}
    `;
    await sql`
      insert into admin_audit (action, event_id, patch)
      values ('import_sports_retime', ${v.id}::uuid,
              ${sql.json({ from: v.from, to: v.to, source: source.sourceLabel } as never)})
    `;
  }

  // Both the already-correct rows AND the ones we just corrected now match the
  // league's own schedule, so both are source-verified. Stamping only the first
  // group would leave a corrected row looking less trustworthy than an untouched
  // one, which is backwards.
  const verifiedIds = [...ok, ...retime].map((v) => v.id);
  if (verifiedIds.length) {
    await sql`update events set verified_at = now() where id::text = any(${verifiedIds})`;
  }

  if (plan.missing.length) {
    const inputs = plan.missing
      .map((g) => toEventInput(source, g))
      .filter((e): e is DbEventInput => e !== null);
    if (inputs.length) {
      await upsertEvents(inputs);
      const keys = inputs.map((e) => e.event_key);

      // PUBLISH what we just wrote — and this is not a formality.
      //
      // event_key is sha256(title|venue|day), so a game we import can collide
      // with a row somebody hid earlier under the same title. upsertEvents sets
      // status only on INSERT (a re-found event must keep an operator's hide),
      // so the collision UPDATES the hidden row and leaves it hidden. The game
      // then looks missing on every subsequent run and is "added" forever
      // without ever appearing: exactly what the Aug 28 White Sox game did.
      //
      // The league's own schedule outranks a stale hide, so we republish and say
      // out loud how many rows that resurrected.
      const woken = await sql`
        update events set status = 'published'
        where event_key = any(${keys}) and status in ('draft', 'archived')
      `;
      if (woken.count) {
        console.log(`   (republished ${woken.count} row(s) an earlier pass had hidden)`);
      }
      // Built from the primary source, so verified by construction — the
      // strongest evidence this site has for any listing.
      await sql`update events set verified_at = now() where event_key = any(${keys})`;
    }
    result.added = inputs.length;
  }

  return result;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const today = chiTodayKey();
  const sources = SPORTS_SOURCES.filter((s) => !only || only.includes(s.key));
  if (!sources.length) throw new Error(`--only matched no teams`);

  console.log(`[import-sports] ${today} · ${sources.length} team(s)${dryRun ? " · DRY RUN" : ""}`);

  const results: TeamResult[] = [];
  for (const source of sources) {
    console.log(`\n${source.team} (${source.sourceLabel})`);
    const r = await runTeam(source, today);
    console.log(`   ${r.ok ? r.note : `UNAVAILABLE — ${r.note} (no changes made)`}`);
    results.push(r);
  }

  const sum = (f: (r: TeamResult) => number) =>
    results.filter((r) => r.ok).reduce((n, r) => n + f(r), 0);
  const failed = results.filter((r) => !r.ok);

  console.log(`\n${"─".repeat(64)}`);
  console.log(
    `[import-sports] ${results.length - failed.length}/${results.length} feeds reachable · ` +
      `${sum((r) => r.hidden)} hidden · ${sum((r) => r.retimed)} retimed · ` +
      `${sum((r) => r.added)} added · ${sum((r) => r.verified)} verified · ` +
      `${sum((r) => r.unknown)} left alone`,
  );
  if (failed.length) {
    // Loud, but not fatal: the other teams' work is real and already applied.
    console.log(`[import-sports] UNAVAILABLE: ${failed.map((r) => `${r.key} (${r.note})`).join(", ")}`);
  }
  if (dryRun) console.log("[import-sports] dry run — nothing was written");
  else await revalidateAndReport("import-sports", `league feeds — ${sum((r) => r.hidden)} hidden, ${sum((r) => r.added)} added`);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
