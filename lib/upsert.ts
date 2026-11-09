import { requireSql } from "./db";
import type { DbEventInput } from "./types";
import { planCollapse, staleSpanIds, planRunFolds, type RunFoldRow } from "./multiday";
import { displayPrice } from "./price-quality";
import { isResaleSource } from "./source-trust";
import { findIncomingDuplicates, type CalendarRow } from "./contradictions";
import { chiWallClock } from "./clock";
import type { RecentVerifyPass } from "./verify";
import type { RecentResearchPass } from "./research-queue";

/** Count populated optional fields — a rough "richness" score for a row. */
function richness(e: DbEventInput): number {
  let n = 0;
  // A known time outranks all six fields below. A tie used to keep the later row,
  // and a venue sweep reading a calendar with no times arrives after the agent that
  // read the time: seven such pairs in the 6 Nov 2026 rehearsal, all First Avenue.
  if (!e.all_day) n += 7;
  if (e.description) n++;
  if (e.ticket_url) n++;
  if (e.image) n++;
  if (e.address) n++;
  if (e.end_at) n++;
  if (e.source_url) n++;
  return n;
}

/**
 * Collapse rows that share an event_key BEFORE the SQL upsert (Layer 1).
 * Two agents can return the same event in one run (e.g. a food festival found
 * by both the "food" and "festival" agents); without this, Postgres rejects the
 * batch with "ON CONFLICT DO UPDATE cannot affect row a second time". When keys
 * collide we keep the richer row (more populated fields), tie → the later one.
 * Pure function — no database needed.
 */
export function dedupeByKey(events: DbEventInput[]): DbEventInput[] {
  const byKey = new Map<string, DbEventInput>();
  for (const e of events) {
    const existing = byKey.get(e.event_key);
    if (!existing || richness(e) >= richness(existing)) {
      byKey.set(e.event_key, e);
    }
  }
  return [...byKey.values()];
}

/**
 * Ingest span guard (event-integrity retro, Aug 2026): a scraped `end_at` that
 * lands strictly BEFORE its `start_at` is a source error — a Saints game
 * "ending" before it starts (11:05 vs 14:07), a theatre run with a swapped date
 * (end Aug 23, start Aug 25). Null it rather than store a backwards span; the
 * archive predicate and display both coalesce to `start_at`, so a null end is
 * safe. A genuine late-night (a 9 PM show ending at 1 AM) has its end on the
 * NEXT day, so `end > start` numerically and is left untouched. Pure + tested.
 */
export function guardEndAt(startAt: string, endAt: string | null | undefined): string | null {
  if (!endAt) return null;
  const s = Date.parse(startAt);
  const e = Date.parse(endAt);
  if (Number.isNaN(s) || Number.isNaN(e)) return endAt; // don't touch unparseable values
  return e < s ? null : endAt;
}

/**
 * Idempotent batch upsert. Conflicts on event_key (the dedup key), so an event
 * re-found in a later run UPDATES its row instead of inserting a duplicate.
 * Returns the number of rows written.
 *
 * Note: status is set only on INSERT. On UPDATE we deliberately do NOT touch
 * status. New events auto-publish; if you later move one to 'draft' to hide it,
 * that decision sticks — a re-found event keeps your status, never reverting.
 */
/**
 * Refuse rows that are already on the calendar under a different name.
 *
 * dedupeByKey only catches an exact `title|venue|day` repeat, and
 * dedupeNearDuplicates runs AFTER the insert on a trigram score that misses
 * the shape this site actually produces: the same show arriving from a second
 * feed with a longer billing. Between 7 and 28 Sep 2026 that put three copies
 * of one Journey concert live across three consecutive Mondays, and four
 * spellings of one Arboretum sale — each new Monday adding one more, each
 * previous hand-cleanup undone.
 *
 * The gate is the self-check's own duplicate rule, imported rather than
 * restated: a second definition of "same event" is what let these diverge.
 *
 * A row whose event_key already exists is NOT a duplicate — it is that event
 * being updated, which is the normal path and must stay open.
 */
async function withoutLiveDuplicates(
  sql: ReturnType<typeof requireSql>,
  incoming: DbEventInput[],
): Promise<DbEventInput[]> {
  const asRow = (e: DbEventInput): CalendarRow => ({
    id: e.event_key,
    venue: e.venue,
    title: e.title,
    category: e.category,
    verified: false,
    start: chiWallClock(new Date(e.start_at)),
  });
  const candidates = incoming.map(asRow);
  const days = [...new Set(candidates.map((c) => c.start.slice(0, 10)))];
  if (days.length === 0) return incoming;

  const live = await sql<(CalendarRow & { event_key: string })[]>`
    select event_key as id, event_key, venue, title, category,
           verified_at is not null as verified,
           to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start
    from events
    where status in ('published', 'draft')
      and (start_at at time zone 'America/Chicago')::date = any(${days}::date[])`;

  // Keyed by event_key on both sides, so an incoming row meets itself and is
  // excluded from its own comparison rather than blocking its own update.
  const incomingKeys = new Set(candidates.map((c) => c.id));
  const others = live.filter((r) => !incomingKeys.has(r.event_key));
  const blocked = findIncomingDuplicates(others, candidates);
  if (blocked.size === 0) return incoming;

  for (const [key, kept] of blocked) {
    const e = incoming.find((x) => x.event_key === key)!;
    console.log(`[upsert] skipped "${e.title}" @ ${e.venue} — already listed as "${kept.title}"`);
    await sql`
      insert into admin_audit (action, patch)
      values ('dedupe:blocked', ${sql.json({
        title: e.title, venue: e.venue, start: e.start_at, source: e.source_url,
        already_listed_as: kept.title,
        why: "same room, same slot, and the titles read as one event (lib/contradictions.ts)",
      })})`;
  }
  return incoming.filter((e) => !blocked.has(e.event_key));
}

/**
 * Fold a re-found RUN onto the run already on the calendar.
 *
 * `event_key` is sha256(title|venue|start DAY) and the pipeline writes the day
 * it FOUND a show, so every weekly pass over a long run mints a fresh identity
 * nothing can collide with — Como Park's daily admission arrived three times at
 * +7 days with a 31-day window each, Kunene and the King three times all ending
 * Nov 8. Measured 4 Nov 2026: 13 productions, 43 live rows, 30 surplus.
 *
 * None of the three gates that look like they should catch it do. `dedupeByKey`
 * compares keys, and these differ by construction. `withoutLiveDuplicates`
 * loads only rows STARTING on an incoming day, so it never meets a run that
 * started weeks ago. And `collapseMultiDayRuns` hands `planCollapse` the
 * `multi_day_end` column alone, so a run carried in `end_at` reads to it as a
 * single day and seven days of gap refuses the cluster.
 *
 * Folding means three writes, not one: skip the insert, extend the live run
 * when the re-find reaches further, and bump `last_seen_at` — the last because
 * the point is that the run RECEIVED this week's sighting. Leave it off and the
 * keeper looks abandoned, which is the live-duplicate freeze from the other
 * side (while two rows of a pair are live, each blocks the other's re-find, so
 * neither can take a cancellation).
 *
 * The decision itself is `planRunFolds`, pure and mutation-tested, and it
 * deliberately folds run onto run only. See its own note for why a single
 * dated performance inside a run is left alone.
 */
async function foldRunRefinds(
  sql: ReturnType<typeof requireSql>,
  incoming: DbEventInput[],
): Promise<DbEventInput[]> {
  const candidates: RunFoldRow[] = incoming.map((e) => ({
    id: e.event_key,
    title: e.title,
    city: e.city,
    category: e.category,
    start: chiWallClock(new Date(e.start_at)),
    end: e.end_at ? chiWallClock(new Date(e.end_at)) : null,
    multiDayEnd: null, // the pipeline never writes a span; the collapse does
  }));
  const earliest = candidates.map((c) => c.start.slice(0, 10)).sort()[0];
  if (!earliest) return incoming;

  // PUBLISHED ONLY, and it is not a tidiness choice. A draft is a row held back
  // on purpose (statusForNewEvent for a roundup-only source, venueIsUnknown),
  // and `status` is set on INSERT alone — so letting a draft keep the slot
  // declines a re-find that would have been inserted VISIBLE, and the event
  // then renders nowhere at all. 26 of 149 live runs are drafts. Before this
  // gate existed the outcome was a visible duplicate; coverage loss is worse.
  //
  // Lower bound only: a live run must still be running on or after the earliest
  // incoming start to overlap anything in this batch. The upper bound is left
  // to planRunFolds rather than restated as a second SQL date expression — the
  // whole shape of this bug was two gates disagreeing about one definition.
  const live = await sql<(RunFoldRow & { event_key: string })[]>`
    select id::text as id, event_key, title, city, category,
           to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start,
           to_char(end_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as end,
           to_char(multi_day_end at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as "multiDayEnd"
    from events
    where status = 'published'
      and (coalesce(multi_day_end, end_at, start_at) at time zone 'America/Chicago')::date
          >= ${earliest}::date`;

  // A ROW MUST NOT FOLD ONTO ITSELF, and planRunFolds' own id check cannot see
  // it: the live rows are identified by uuid while an incoming row carries its
  // event_key, so the two sides are different namespaces and that filter never
  // fires. An ordinary re-find — same title, venue and start day, so the SAME
  // event_key, i.e. the normal ON CONFLICT update — then folded onto its own
  // live row: the insert declined, and the update carrying price, ticket_url,
  // end_at and cancellations never ran. Measured 4 Nov 2026: 107 of 149 live
  // runs. Excluded by key, the way withoutLiveDuplicates already does it.
  const incomingKeys = new Set(incoming.map((e) => e.event_key));
  const folds = planRunFolds(
    live.filter((l) => !incomingKeys.has(l.event_key)),
    candidates,
  );
  if (folds.length === 0) return incoming;

  const titleOf = new Map(live.map((l) => [l.id, l.title]));
  for (const f of folds) {
    const e = incoming.find((x) => x.event_key === f.incomingId)!;
    const keptTitle = titleOf.get(f.keepId) ?? "";
    console.log(
      `[upsert] folded "${e.title}" @ ${e.venue} onto "${keptTitle}"` +
        (f.drift ? " (title similarity, not an identical name)" : "") +
        (f.extendTo ? `, extended to ${f.extendTo}` : ""),
    );
    if (f.extendTo) {
      // ::text first — postgres.js types an ISO-shaped param as timestamptz and
      // shifts it before the tz attach. Same cast collapseMultiDayRuns uses.
      //
      // greatest() because every extendTo is computed against the keeper's
      // PRE-BATCH span: two re-finds of one run in a single batch both carry a
      // non-null extendTo, and a bare assignment let the second — possibly the
      // shorter — win, shrinking a span the same batch had just proved reaches
      // further, with the row that attested it already declined. end_at is in
      // the greatest too, because spanEnd prefers multi_day_end once it is set,
      // so writing a nearer span over a further end_at would shrink the run as
      // the site reads it. Spans only ever EXTEND, per keeper, not per fold.
      await sql`
        update events
        set multi_day_end = greatest(
              (${`${f.extendTo}T23:59`}::text::timestamp at time zone 'America/Chicago'),
              multi_day_end,
              end_at)
        where id::text = ${f.keepId}`;
    }
    await sql`update events set last_seen_at = now() where id::text = ${f.keepId}`;
    // RULE 1 — the instrument must not kill the panel. This insert is the ONLY
    // source the ops digest's Run folds section reads, and the mutations above
    // have already committed; one pooler timeout here would otherwise abort the
    // whole pipeline pass mid-run, skipping every remaining band, with the span
    // and last_seen_at written and no trace of why.
    //
    // `drift` records WHICH rule matched, because the two can be wrong in
    // different ways: a key match is two spellings of one name, a drift match
    // is the planner deciding two similar names are one event, and that is the
    // one worth a human's eye on a Monday.
    try {
      await sql`
        insert into admin_audit (action, patch)
        values ('run:folded', ${sql.json({
          title: e.title, venue: e.venue, start: e.start_at, end: e.end_at ?? null,
          source: e.source_url, kept: f.keepId, kept_title: keptTitle, extended_to: f.extendTo,
          drift: f.drift,
          why: f.drift
            ? "a re-find whose title DRIFTED from a run already on the calendar (lib/multiday.ts planRunFolds, DRIFT_MIN)"
            : "a re-find of a run already on the calendar (lib/multiday.ts planRunFolds)",
        })})`;
    } catch (err) {
      console.warn(`[upsert] run:folded audit row failed (fold still applied): ${String(err)}`);
    }
  }

  const blocked = new Set(folds.map((f) => f.incomingId));
  return incoming.filter((e) => !blocked.has(e.event_key));
}

export async function upsertEvents(events: DbEventInput[]): Promise<number> {
  const byKey = dedupeByKey(events);
  if (byKey.length === 0) return 0;
  const sql = requireSql();

  const noDupes = await withoutLiveDuplicates(sql, byKey);
  if (noDupes.length === 0) return 0;

  const deduped = await foldRunRefinds(sql, noDupes);
  if (deduped.length === 0) return 0;

  const rows = deduped.map((e) => ({
    event_key: e.event_key,
    title: e.title,
    category: e.category,
    venue: e.venue,
    address: e.address,
    city: e.city,
    lat: e.lat,
    lng: e.lng,
    start_at: e.start_at,
    all_day: e.all_day ?? false,
    end_at: guardEndAt(e.start_at, e.end_at),
    // "TBD" never enters the column; the schema default says it better.
    price: displayPrice(e.price),
    price_tier: e.priceTier,
    // A lookalike reseller is worse than no link: the reader pays a markup to
    // reach a seat the venue sells directly. Dropping it leaves the honest
    // empty the rest of the calendar already uses.
    ticket_url: isResaleSource(e.ticket_url) ? "" : e.ticket_url,
    description: e.description,
    image: e.image,
    source_url: e.source_url,
    status: e.status,
  }));

  const cols = [
    "event_key", "title", "category", "venue", "address", "city",
    "lat", "lng", "start_at", "all_day", "end_at", "price", "price_tier",
    "ticket_url", "description", "image", "source_url", "status",
  ] as const;

  // A CHANGED CITATION IS AN UNREAD PAGE. This clause overwrites `source_url`
  // on every re-find, and until 27 Oct 2026 it left `source_checked_at` alone —
  // so a row could be handed a brand-new source while carrying a stamp earned
  // by the old one. The weekly source check orders its ~400-page budget by that
  // stamp, nulls first (`stalestFirst`), so the new page went to the back of
  // the queue wearing a freshness it never earned, and the listing stopped
  // being checked against anything real. Also the one thing that could silently
  // undo an operator's citation repair (`npm run correct --from=…`).
  //
  // A CORRECTED ROW KEEPS WHAT IT WAS CORRECTED TO. This clause overwrote every
  // column on every re-find, so a correction lasted until the next run that found
  // the same event, and the row went back to whatever the research agent read. A
  // set `corrected_at` keeps LOCKED_BY_CORRECTION (lib/corrections.ts); category,
  // price, ticket link and image still enrich. League time changes are unaffected:
  // import-sports moves a game with its own UPDATE, not through here.
  //
  // A DATE-ONLY RE-FIND NEVER ERASES A KNOWN TIME. An agent that read a calendar
  // printing no times answers with a date, which the identity treats as the same
  // event, so this clause set the row to all-day at midnight. Simulated on 6 Nov
  // 2026: 26 live rows would have lost their start, Humbird's 8pm among them. A
  // re-find that does carry a time still upgrades an all-day row. Its end still
  // lands if it is later, or a run read off a date-only page would be archived on
  // its first day.
  //
  // A THIN RE-FIND NEVER ERASES WHAT THE ROW KNOWS. In the same rehearsal, 72 of 92
  // live re-finds had no address and 85 said "See listing", which would have turned
  // First Avenue's street into "Minneapolis, MN" and a Free listing into $$. Blank
  // and placeholder values only fill a gap, and shorter prose does not replace longer.
  //
  // Keep prose out of the template below: a `//` line inside it is sent to
  // Postgres, and a backtick in a SQL comment ends the JS literal.
  await sql`
    insert into events ${sql(rows, ...cols)}
    on conflict (event_key) do update set
      title       = case when events.corrected_at is null then excluded.title else events.title end,
      category    = excluded.category,
      venue       = case when events.corrected_at is null then excluded.venue else events.venue end,
      address     = case when events.corrected_at is null and excluded.address <> ''
                         then excluded.address else events.address end,
      city        = case when events.corrected_at is null then excluded.city else events.city end,
      lat         = case when events.corrected_at is null then excluded.lat else events.lat end,
      lng         = case when events.corrected_at is null then excluded.lng else events.lng end,
      start_at    = case when events.corrected_at is null and not (excluded.all_day and not events.all_day)
                         then excluded.start_at else events.start_at end,
      all_day     = case when events.corrected_at is null and not (excluded.all_day and not events.all_day)
                         then excluded.all_day else events.all_day end,
      end_at      = case when events.corrected_at is not null then events.end_at
                         when not (excluded.all_day and not events.all_day) then excluded.end_at
                         when excluded.end_at > coalesce(events.end_at, events.start_at) then excluded.end_at
                         else events.end_at end,
      price       = case when excluded.price = 'See listing' then events.price else excluded.price end,
      price_tier  = case when excluded.price = 'See listing' then events.price_tier else excluded.price_tier end,
      ticket_url  = coalesce(nullif(excluded.ticket_url, ''), events.ticket_url),
      description = case when events.corrected_at is null and length(excluded.description) >= length(events.description)
                         then excluded.description else events.description end,
      image       = coalesce(nullif(excluded.image, ''), events.image),
      source_url  = case when events.corrected_at is null then excluded.source_url else events.source_url end,
      source_checked_at = case when events.corrected_at is null
                                and events.source_url is distinct from excluded.source_url
                               then null else events.source_checked_at end,
      last_seen_at = now()
  `;

  return rows.length;
}

/**
 * Archive published events whose run is FULLY over (R0.2). Two rules:
 *  - TRUE span: coalesce(multi_day_end, end_at, start_at) — the old predicate
 *    ignored multi_day_end, so the first pipeline run after a collapsed
 *    festival's day-1 end would archive it mid-run (Ramsey County Fair would
 *    have vanished Jul 27 with two days left). Same coalesce trending.ts uses.
 *  - End-of-day grace in the CHICAGO frame: archive only once the effective
 *    end's Chicago DAY is behind us, so all-day events (midnight start, no
 *    end) and no-end evening shows survive through their own night instead of
 *    being archived mid-day by a UTC clock.
 * Returns rows changed.
 */
export async function archivePastEvents(): Promise<number> {
  const sql = requireSql();
  const res = await sql`
    update events
    set status = 'archived'
    where status = 'published'
      and (coalesce(multi_day_end, end_at, start_at) at time zone 'America/Chicago')::date
          < (now() at time zone 'America/Chicago')::date
  `;
  return res.count;
}

/**
 * Mark events as cancelled (removes them from the site). Overrides status even
 * if published — a confirmed cancellation should always come down. No-op for
 * keys we don't have. Returns rows changed.
 */
export async function markCancelled(eventKeys: string[]): Promise<number> {
  if (eventKeys.length === 0) return 0;
  const sql = requireSql();
  const res = await sql`
    update events
    set status = 'cancelled'
    where event_key in ${sql(eventKeys)}
      and status <> 'cancelled'
  `;
  return res.count;
}

/**
 * Collapse near-duplicates that string-based keys miss — the same real event
 * listed with a slightly different title or venue spelling ("Como Park" vs
 * "Como Regional Park", "Fest" vs "Fest 2026"). Two events of the same status on
 * the SAME day, within ~250m of each other, with similar titles are treated as
 * one: a row that knows its time is kept over a date-only one, then the
 * earliest-seen, and the others archived (recoverable, not deleted).
 *
 * Uses coordinates (which don't lie about location) plus pg_trgm title
 * similarity, so it catches what normalization can't — without re-keying data.
 * Requires the pg_trgm extension (in db/schema.sql). Returns rows archived.
 */
export async function dedupeNearDuplicates(): Promise<number> {
  const sql = requireSql();
  // R0.3, three fixes to this join:
  //  - Same-day means the same CHICAGO day. `start_at::date` casts in the DB
  //    session zone (UTC on Supabase): a Mon 7:10 PM game lands on Tue's UTC
  //    date — pairing it with Tue's real day game (sports-rule violation) and
  //    missing genuine 5 PM/8 PM same-day duplicates that straddle 7 PM CDT.
  //  - Survivorship is (created_at, id) — the doc's "earliest-seen row is
  //    kept" is now actually true instead of a UUID coin flip.
  //  - The keeper is anchored: a row that is itself being archived this pass
  //    can't be the reason another row dies (stops chained pairs archiving a
  //    row >250 m from its actual survivor; the rare unmatched tail of a
  //    chain survives to the next run rather than guessing).
  // And two more, 9 Nov 2026:
  //  - A draft and a published row never pair. Either could be the keeper, so
  //    a HIDDEN row archived a live one: the Edina book sale, hidden as a
  //    fabrication on 6 Nov, kept the slot and archived the real Plymouth sale
  //    (same placeholder venue, same day, titles 0.66 alike), which then
  //    rendered nowhere. The other direction is no better: an archived row
  //    serves its event page again, which undoes a takedown. Same rule as
  //    CollapseRow.status in lib/multiday.ts.
  //  - A thin row, date-only and single-day, loses to one that knows its time,
  //    and only then does earliest-seen decide. `thin` is the midnight rule in
  //    isDateOnlyWallClock (lib/dates.ts); a row carrying a multi-day span is
  //    never thin, so a curated run card is not archived for one timed day.
  const res = await sql`
    with cand as (
      select id, title, venue, lat, lng, status, start_at, created_at,
             ((start_at at time zone 'America/Chicago')::time = time '00:00'
              and (coalesce(multi_day_end, end_at, start_at) at time zone 'America/Chicago')::date
                  = (start_at at time zone 'America/Chicago')::date) as thin
      from events
      where status in ('published', 'draft')
    ),
    pairs as (
      select a.id as keep_id, b.id as dup_id
      from cand a
      join cand b
        on (a.thin, a.created_at, a.id) < (b.thin, b.created_at, b.id)
       and a.status = b.status
       and (a.start_at at time zone 'America/Chicago')::date
           = (b.start_at at time zone 'America/Chicago')::date
       and similarity(a.title, b.title) > 0.6
       -- Sep 2026: matching venue NAMES settle identity on their own, and
       -- distance only arbitrates when the names genuinely differ. This used to
       -- be the distance test alone, which made agent-supplied coordinates the
       -- arbiter of identity — and they are not good enough for that. Four
       -- same-day pairs with an IDENTICAL venue name sat live with coordinates
       -- 3.6km, 6.9km, 21km and 122km apart; every one survived because the
       -- 250m gate believed the coordinates over the venue.
       -- Mirrors isNearDuplicate() in lib/geo-distance.ts — change both together.
       -- word_similarity, not similarity: venue names differ by CONTAINMENT far
       -- more often than by typo ("Lake Nokomis" inside "Lake Nokomis Community
       -- Center", "First Avenue" inside "First Avenue & 7th St Entry"). Plain
       -- trigram similarity punishes the length difference and scores those
       -- 0.45 and 0.52; word_similarity scores both 1.00. It is asymmetric, so
       -- take the better direction. "Target Field" vs "Xcel Energy Center"
       -- still scores 0.00 — this loosens containment, not identity.
       and (
         greatest(word_similarity(a.venue, b.venue), word_similarity(b.venue, a.venue)) > 0.6
         or 6371000 * acos(greatest(-1, least(1,
           cos(radians(a.lat)) * cos(radians(b.lat)) * cos(radians(b.lng) - radians(a.lng))
           + sin(radians(a.lat)) * sin(radians(b.lat))
         ))) < 250
       )
    )
    update events
    set status = 'archived'
    where id in (
      select dup_id from pairs
      where keep_id not in (select dup_id from pairs)
    )
      and status in ('published', 'draft')
  `;
  return res.count;
}

/**
 * Collapse multi-day runs and merge true duplicates (roadmap 4.4).
 *
 * Reads the candidate rows, groups them in TypeScript with the pure logic in
 * lib/multiday.ts (so the rules are unit-tested rather than buried in SQL), then:
 *   - keeps the earliest row of each cluster, extending it with `multi_day_end`
 *     when the cluster spans more than one day;
 *   - archives the rest.
 *
 * A cluster only forms from CONSECUTIVE days, so a weekly series (a recurring
 * date night, a Thursday film series) is never collapsed — those are real,
 * separate events.
 */
export async function collapseMultiDayRuns(): Promise<{
  collapsed: number; merged: number; folded: number;
  /** Rows the plan wanted to archive, and rows the write actually changed. */
  plannedArchives: number; archivedRows: number;
  /** Spans removed because the per-night rule would never have written them. */
  spansCleared: number;
}> {
  const sql = requireSql();

  // multi_day_end matters here: without it, a previously collapsed run card is
  // invisible to clustering and every new "Weekend V"-style row survives
  // (the 2026-07-20 duplicate wave). planCollapse clusters on full spans.
  const rows = await sql<
    { id: string; title: string; city: string; category: string; status: string; start: string; end_day: string | null }[]
  >`
    select id::text as id, title, city, category, status,
           to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start,
           to_char(multi_day_end at time zone 'America/Chicago', 'YYYY-MM-DD') as end_day
    from events
    where status in ('published', 'draft')
    order by start_at asc
  `;

  const planRows = rows.map((r) => ({ ...r, endDay: r.end_day }));
  const actions = planCollapse(planRows);

  // Reconcile before applying: a span the rules refuse is one the planner
  // already ignores, so the only thing it still affects is what the site
  // renders. Clearing it here means the next change to PER_NIGHT heals itself
  // on the following weekly run instead of waiting for someone to notice.
  const stale = staleSpanIds(planRows);
  let spansCleared = 0;
  if (stale.length > 0) {
    const res = await sql`update events set multi_day_end = null where id::text = any(${stale})`;
    spansCleared = res.count;
  }
  let collapsed = 0;
  let merged = 0;
  let folded = 0;
  // Planned vs landed. These counters used to increment per ACTION, before the
  // write and regardless of what it matched, so the pipeline recorded
  // collapsed_runs = 20 for five weeks running while the rows stayed published.
  // A number that reports intent is worse than no number.
  let plannedArchives = 0;
  let archivedRows = 0;

  for (const action of actions) {
    if (action.kind === "fold") folded++;
    else if (action.kind === "run") collapsed++;
    else merged++;

    if (action.setEnd) {
      // ::text first — postgres.js types ISO-shaped string params as
      // timestamptz, which shifts the value +5/6h before the tz attach
      // (confirmed against prod 2026-07-20). Text cast keeps it a wall time.
      await sql`
        update events
        set multi_day_end = (${`${action.setEnd}T23:59`}::text::timestamp at time zone 'America/Chicago')
        where id::text = ${action.keepId}
      `;
    }

    if (action.archiveIds.length > 0) {
      plannedArchives += action.archiveIds.length;
      const res = await sql`
        update events set status = 'archived'
        where id::text = any(${action.archiveIds})
          and status in ('published', 'draft')
      `;
      archivedRows += res.count;
    }
  }

  if (archivedRows < plannedArchives) {
    console.warn(
      `[collapse] planned ${plannedArchives} archive(s) but only ${archivedRows} landed — ` +
        "something re-published them, or they were already archived",
    );
  }

  return { collapsed, merged, folded, plannedArchives, archivedRows, spansCleared };
}

/** Stamp events as source-verified just now (roadmap 4.5). */
export async function markVerified(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const sql = requireSql();
  const res = await sql`
    update events set verified_at = now()
    where id::text = any(${ids}) and status = 'published'
  `;
  return res.count;
}

/** Cancel events by id with evidence, recorded in the audit log (roadmap 4.5). */
export async function cancelVerified(items: { id: string; evidence: string }[]): Promise<number> {
  if (items.length === 0) return 0;
  const sql = requireSql();
  let n = 0;
  for (const item of items) {
    const res = await sql`
      update events set status = 'cancelled'
      where id::text = ${item.id} and status = 'published'
    `;
    n += res.count;
    await sql`
      insert into admin_audit (action, event_id, patch)
      values ('verify_cancel', ${item.id}::uuid, ${sql.json({ evidence: item.evidence.slice(0, 500) })})
    `;
  }
  return n;
}

/** Record a verification flag for admin attention (roadmap 4.5). */
export async function flagVerification(id: string, verdict: string, note: string): Promise<void> {
  const sql = requireSql();
  await sql`
    insert into admin_audit (action, event_id, patch)
    values ('verify_flag', ${id}::uuid, ${sql.json({ verdict, note: note.slice(0, 300) })})
  `;
}

/**
 * THE VERIFY RUN LEDGER — one row per completed pass.
 *
 * WHY A MARKER AND NOT `verified_at`. The obvious signal for "has a verify pass
 * run lately" is the stamp the pass writes, and it is WRONG: `import-sports`
 * and `import-venues` also set `verified_at = now()` on the rows they cover
 * (scripts/import-sports.ts:239, scripts/import-venues.ts:283), and both run
 * inside weekly-research.yml at 06:00 UTC Monday — six hours BEFORE the Monday
 * verify job. A gate reading the stamp would have found fresh stamps every
 * single Monday and skipped the pass forever, while reporting that it had
 * correctly detected a run. The exact shape of bug this project keeps paying
 * for: an instrument measuring something adjacent to the thing it names.
 *
 * So the pass marks ITSELF, unconditionally — a clean pass with no flags and no
 * cancellations still writes its row, because "nothing was wrong" and "nothing
 * ran" must not look the same. Written AFTER the work, so it means completed.
 *
 * `how` records who did it: "ci", "local" or "file" (verdicts applied from a
 * supervised session). Nothing reads it yet; it is there because the next
 * question anyone asks of this table is which runs were paid for.
 */
export async function recordVerifyPass(
  how: "ci" | "local" | "file",
  counts: {
    /**
     * DISTINCT EVENTS adjudicated — never the number the run set out to do, and
     * never the sum of confirmed+cancelled+flagged, which double-counts a
     * weak-source row (it gets a stamp AND a flag).
     */
    checked: number;
    confirmed: number;
    cancelled: number;
    flagged: number;
    /** Paid path: how many were queued, when the budget truncated the run. */
    ofCandidates?: number;
    /** Paid path: e.g. "10/25", so a truncated run is visibly truncated. */
    batches?: string;
    /** File path: how many verdicts the file offered, and how many it lost. */
    ofFile?: number;
    dropped?: number;
  },
): Promise<void> {
  const sql = requireSql();
  await sql`
    insert into admin_audit (action, patch)
    values ('verify_pass', ${sql.json({ how, ...counts })})
  `;
}

/**
 * Did a verify pass complete within the last `hours`?
 *
 * FAILS OPEN, and that is the whole point. `hasSentDigestToday` fails CLOSED —
 * it reports "already sent" when it cannot tell, because mailing the list twice
 * is the expensive direction there. Here the expensive direction is the
 * opposite: an unchecked week of listings reaching readers costs more than one
 * duplicated pass. So an unreachable database, a missing DATABASE_URL or a
 * malformed answer all return `ran: false` and the pass goes ahead and spends.
 *
 * Without this a lost secret would silently switch verification off for good
 * while every Actions run still showed green — which is how this project lost
 * its revalidation channel for two months.
 *
 * Returns every pass in the window, newest first. Whether one of them is big
 * enough to stand on is `standDownFor`'s decision (lib/verify.ts), not this
 * query's.
 */
export async function recentResearchPasses(hours: number): Promise<RecentResearchPass[]> {
  try {
    const sql = requireSql();
    return [
      ...(await sql<RecentResearchPass[]>`
        select at::text as at, patch->>'upserted' as upserted,
               patch->>'tasksDone' as tasks_done, patch->>'tasksTotal' as tasks_total
        from admin_audit
        where action = 'research_pass'
          and at >= now() - (${hours} * interval '1 hour')
        order by at desc
      `),
    ];
  } catch (err) {
    console.error(
      "[pipeline] could not check for a recent pass — running rather than risk skipping a week:",
      err,
    );
    return [];
  }
}

export async function recentVerifyPasses(hours: number): Promise<RecentVerifyPass[]> {
  try {
    const sql = requireSql();
    return [
      ...(await sql<RecentVerifyPass[]>`
        select at::text as at, patch->>'how' as how,
               patch->>'confirmed' as confirmed, patch->>'cancelled' as cancelled
        from admin_audit
        where action = 'verify_pass'
          and at >= now() - (${hours} * interval '1 hour')
        order by at desc
      `),
    ];
  } catch (err) {
    console.error(
      "[verify] could not check for a recent pass — running rather than risk skipping a week:",
      err,
    );
    return [];
  }
}
