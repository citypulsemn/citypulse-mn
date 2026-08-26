/**
 * Venue calendar importer (music).
 *
 * Usage: npm run import-music [-- --dry-run] [-- --days=92]
 *
 * Reads First Avenue's own show calendar and reconciles the site against it.
 * Same spirit as scripts/import-sports.ts, with one deliberate difference: this
 * one is far more reluctant to hide anything, because music titles are fuzzy and
 * a venue calendar is a weaker negative than a league schedule.
 *
 *   room dark that night   → hidden (status 'draft', never deleted)
 *   room busy, no match    → FLAGGED for a human, nothing touched
 *   found on the calendar  → stamped verified
 *   on the calendar, not on the site → created
 *
 * As with sports: a fetch that fails changes nothing at all.
 */
import { sql } from "../lib/db";
import { MUSIC_SOURCES, type MusicVenue } from "../lib/music-sources";
import {
  parseFirstAvenueMonth,
  parseFirstAvenueTime,
  parseTribeEvents,
  reconcileShows,
  type VenueShow,
  type ExistingShow,
} from "../lib/music-feed";
import { computeEventKey, normalizeTier } from "../lib/event-key";
import { normalizeAgentTime } from "../lib/time-integrity";
import { upsertEvents } from "../lib/upsert";
import { chiTodayKey } from "../lib/clock";
import type { DbEventInput } from "../lib/types";

const dryRun = process.argv.includes("--dry-run");
const daysArg = process.argv.find((a) => a.startsWith("--days="));
const HORIZON_DAYS = daysArg ? Math.max(1, Number(daysArg.slice("--days=".length)) || 0) : 92;

/** Identifies us to the venues whose calendars we read. */
const UA = "Mozilla/5.0 (compatible; CityPulseMN/1.0; +https://citypulsemn.com)";

/** Be a good guest: venue sites are small, and we fetch a page per show we add. */
const POLITE_DELAY_MS = 500;
/** Hard ceiling on detail fetches in one run, so a bad parse can't hammer them. */
const MAX_DETAIL_FETCHES = 260;
/** Backstop on a paged feed, so a bad total_pages can't loop us into its site. */
const MAX_FEED_PAGES = 20;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function getText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "text/html, application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return await res.text();
}

function toEventInput(show: VenueShow, venue: MusicVenue): DbEventInput | null {
  // No time on the calendar and none on the detail page → all-day. We never
  // invent a doors time (rule 11: a placeholder is not a fact).
  const wall = show.time ? `${show.day}T${show.time}` : show.day;
  const time = normalizeAgentTime(wall);
  if (!time) return null;
  // CATEGORY: "music", flat. This started as a call to classifyEvent, on the
  // reasoning that a music room also books comedy and wrestling — but measured
  // against the real calendar the classifier had no usable signal and did active
  // harm. It scores the VENUE name, so every show at the Fitzgerald THEATER came
  // back "arts" (They Might Be Giants, Gary Clark Jr., Chelsea Wolfe included),
  // and the word "Kid" made a family event of Ugly Kid Joe. Blanking the venue
  // just moved everything to music EXCEPT the "Kid" bug, and never once
  // recognised Paula Poundstone as comedy.
  //
  // A concert promoter's show calendar is better evidence of "this is a gig"
  // than a keyword scorer with nothing to go on. Known cost, written down rather
  // than hidden: comedy and spoken-word bookings — mostly at the Fitzgerald —
  // sit under music until there is a real signal to use. First Avenue publishes
  // a genre taxonomy (Comedy, Improv) but tags no events with it.
  return {
    event_key: computeEventKey(show.title, venue.name, show.day),
    title: show.title,
    category: "music",
    venue: venue.name,
    address: venue.address,
    city: venue.city,
    lat: venue.lat,
    lng: venue.lng,
    start_at: time.iso,
    all_day: !show.time,
    // Venue calendars publish a start, not a finish.
    end_at: null,
    price: "See listing",
    priceTier: normalizeTier(""),
    ticket_url: show.url,
    description: `${show.title} at ${venue.name}, ${venue.city}.`,
    image: "",
    source_url: show.url,
    status: "published",
  };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!sql) throw new Error("no database connection");
  const today = chiTodayKey();
  const horizonEnd = addDays(today, HORIZON_DAYS);
  console.log(
    `[import-music] ${today}→${horizonEnd}${dryRun ? " · DRY RUN" : ""}`,
  );

  for (const source of MUSIC_SOURCES) {
    console.log(`\n${source.label}`);
    const urls = source.urls(today, horizonEnd);

    // ALL-OR-NOTHING, exactly as in sports: these pages are slices of ONE
    // calendar, and a missing slice reads as "the room was dark" — which is the
    // one verdict here that hides things.
    let shows: VenueShow[] = [];
    try {
      for (const url of urls) {
        const body = await getText(url);
        if (source.format !== "tribe-json") {
          shows.push(...parseFirstAvenueMonth(body));
          await sleep(POLITE_DELAY_MS);
          continue;
        }
        // Tribe reports how many pages there are; walk them all. Guessing the
        // count either 404s or silently truncates, and a truncated calendar is
        // exactly the input that makes this importer hide real shows.
        const first = JSON.parse(body);
        shows.push(...parseTribeEvents(first));
        const pages = Math.min(Number(first?.total_pages) || 1, MAX_FEED_PAGES);
        for (let page = 2; page <= pages; page++) {
          await sleep(POLITE_DELAY_MS);
          shows.push(...parseTribeEvents(JSON.parse(await getText(source.pageUrl!(today, horizonEnd, page)))));
        }
        await sleep(POLITE_DELAY_MS);
      }
    } catch (err) {
      console.log(`   UNAVAILABLE — ${err instanceof Error ? err.message : String(err)} (no changes made)`);
      continue;
    }
    shows = shows.filter((s) => s.day >= today && s.day <= horizonEnd);
    if (!shows.length) {
      console.log("   calendar returned no shows in the horizon (no changes made)");
      continue;
    }

    const byFeedName = new Map(source.venues.map((v) => [v.feedName.toLowerCase(), v]));
    const authoritativeVenues = new Set(
      source.venues.filter((v) => v.authoritative).map((v) => v.feedName.toLowerCase()),
    );
    // Every room we can place, including the ones this promoter only books into.
    const knownVenues = new Set(source.venues.map((v) => v.feedName.toLowerCase()));

    // Our own listings for these rooms, however we happen to spell them.
    const patterns = source.venues.flatMap((v) => v.titleVenuePatterns);
    const rows = await sql<{ id: string; day: string; venue: string; title: string }[]>`
      select id::text as id,
             to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD') as day,
             venue, title
      from events
      where status = 'published'
        and start_at >= now()
        and venue = any(${patterns})
      order by start_at
    `;

    // Map each listing's venue spelling onto the calendar's own name, so
    // "Fine Line Music Cafe" is compared against "Fine Line".
    const spellingToFeed = new Map<string, string>();
    for (const v of source.venues) {
      for (const p of v.titleVenuePatterns) spellingToFeed.set(p.toLowerCase(), v.feedName);
    }
    const existing: ExistingShow[] = rows.map((r) => ({
      id: r.id,
      day: r.day,
      venue: spellingToFeed.get(r.venue.toLowerCase()) ?? r.venue,
      title: r.title,
    }));

    const plan = reconcileShows(shows, existing, today, { authoritativeVenues, knownVenues });

    const phantom = plan.verdicts.filter((v) => v.kind === "phantom");
    const moved = plan.verdicts.filter((v) => v.kind === "moved");
    const unmatched = plan.verdicts.filter((v) => v.kind === "unmatched");
    const ok = plan.verdicts.filter((v) => v.kind === "ok");
    const unknown = plan.verdicts.filter((v) => v.kind === "unknown");

    console.log(
      `   ${shows.length} shows on the calendar, ${plan.window?.from}→${plan.window?.to}` +
        ` · ${rows.length} of our listings in these rooms`,
    );
    for (const v of phantom) console.log(`   HIDE    ${v.title.slice(0, 52).padEnd(52)} room dark that night`);
    for (const v of moved) {
      if (v.kind !== "moved") continue;
      console.log(`   MOVED   ${v.title.slice(0, 42).padEnd(42)} calendar has it ${v.actual.day} at ${v.actual.venue}`);
    }
    for (const v of unmatched) {
      if (v.kind !== "unmatched") continue;
      console.log(`   REVIEW  ${v.title.slice(0, 44).padEnd(44)} venue lists: ${v.alternatives.slice(0, 2).join(" / ").slice(0, 60)}`);
    }
    for (const s of plan.missing) {
      console.log(`   ADD     ${s.day}  ${s.venue.padEnd(18)} ${s.title.slice(0, 46)}`);
    }
    console.log(
      `   → ${phantom.length + moved.length} to hide (${moved.length} found elsewhere) · ${unmatched.length} to review · ` +
        `${plan.missing.length} to add · ${ok.length} verified · ${unknown.length} left alone`,
    );

    if (dryRun) continue;

    const toHide = [...phantom, ...moved];
    if (toHide.length) {
      const ids = toHide.map((v) => v.id);
      await sql`update events set status = 'draft' where id::text = any(${ids})`;
      for (const v of toHide) {
        const why = v.kind === "moved"
          ? `${source.sourceLabel} has this show on ${v.actual.day} at ${v.actual.venue}`
          : `no show in this room that night per ${source.sourceLabel}`;
        await sql`
          insert into admin_audit (action, event_id, patch)
          values ('import_music_hide', ${v.id}::uuid,
                  ${sql.json({ status: "draft", why } as never)})
        `;
      }
    }

    // Flagged, never actioned. This is the record a person reviews in the admin
    // audit; the listing itself is untouched.
    // Flag ONCE per listing, not once per run. The first version inserted
    // unconditionally, so four flagged listings had produced seventeen audit
    // rows by the fourth run — the review queue burying itself. A flag is a
    // standing note that this row needs a person, not a log line.
    for (const v of unmatched) {
      if (v.kind !== "unmatched") continue;
      await sql`
        insert into admin_audit (action, event_id, patch)
        select 'import_music_review', ${v.id}::uuid,
               ${sql.json({ why: `not found on ${source.sourceLabel}`, venue_lists: v.alternatives.slice(0, 6) } as never)}
        where not exists (
          select 1 from admin_audit
          where action = 'import_music_review' and event_id = ${v.id}::uuid
        )
      `;
    }

    if (ok.length) {
      const ids = ok.map((v) => v.id);
      await sql`update events set verified_at = now() where id::text = any(${ids})`;
    }

    // Detail pages, only for shows we're about to create, bounded and paced.
    const toAdd = plan.missing.slice(0, MAX_DETAIL_FETCHES);
    if (plan.missing.length > toAdd.length) {
      console.log(`   (capped at ${MAX_DETAIL_FETCHES} detail fetches; ${plan.missing.length - toAdd.length} deferred to the next run)`);
    }
    let timed = 0;
    for (const s of toAdd) {
      // Tribe hands us the time in the payload; only the HTML calendar needs a
      // second request per show.
      if (s.time) { timed++; continue; }
      try {
        const t = parseFirstAvenueTime(await getText(s.url));
        if (t) { s.time = t; timed++; }
      } catch {
        /* no time is honest; an all-day listing beats an invented 8 PM */
      }
      await sleep(POLITE_DELAY_MS);
    }

    const inputs = toAdd
      .map((s) => {
        const v = byFeedName.get(s.venue.toLowerCase());
        return v ? toEventInput(s, v) : null;
      })
      .filter((e): e is DbEventInput => e !== null);

    if (inputs.length) {
      await upsertEvents(inputs);
      const keys = inputs.map((e) => e.event_key);
      // Same trap as sports: event_key collides with a row somebody hid under
      // the same title, and upsertEvents leaves status alone on UPDATE, so the
      // show would stay hidden and be "added" forever. The venue's own calendar
      // outranks a stale hide.
      const woken = await sql`
        update events set status = 'published'
        where event_key = any(${keys}) and status in ('draft', 'archived')
      `;
      if (woken.count) console.log(`   (republished ${woken.count} row(s) an earlier pass had hidden)`);
      await sql`update events set verified_at = now() where event_key = any(${keys})`;
      console.log(`   added ${inputs.length} (${timed} with a show time, ${inputs.length - timed} all-day)`);
    }
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
