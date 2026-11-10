/**
 * OPEN AUDIT FLAGS — one definition, three readers.
 *
 * The verify pass writes a `verify_flag` row into `admin_audit` when it cannot
 * confirm a listing against the page it cites. The audit log is append-only, so
 * "open" cannot be stored — it has to be computed from the listing's current
 * state, which is what makes this a predicate rather than a column and why it
 * needs exactly one home.
 *
 * It had two. The Monday ops digest computed it inline, and a hand-written query
 * over the same table on 3 Nov 2026 returned 164, then 25, against the digest's
 * 33 — because the condition is subtler than it looks (see below) and a near
 * miss is worse than no number at all. Both now come through here.
 *
 * IT HAD THREE (10 Nov 2026). The music-review queue — the same shape over the
 * same two tables, one a.action value over — was still inline six lines above
 * the openVerifyFlags() call, and it had the bug this file was created to end:
 * a bare `verified_at is null`, with no after-stamp clause. It reported 0 while
 * hiding 1. See openFlagCount below.
 *
 * THE SUBTLE PART: a flag is open when the listing is unverified **or when the
 * flag was raised after the stamp**. That second clause is the whole point. A
 * flag raised after a stamp used to vanish from the count, and it is the most
 * dangerous flag there is — something re-checked a confirmed listing and
 * disagreed, and the stamp swallowed the disagreement. Dropping that clause is
 * what turned 33 into 25.
 *
 * Self-clearing by construction: once a later pass hides the listing, archives
 * it, or re-verifies it against a real page, the item leaves the set without
 * anyone closing a ticket.
 *
 * STILL ON, not still to come (10 Nov 2026). The window clause asked
 * `e.start_at >= now()` — a START question — so a RUN that opened before today
 * and is still on dropped out of triage while staying live on the site. A
 * `cancelled` verdict on a run is exactly the honest-data failure the ranking
 * above exists to surface, and it could sit unseen for the length of the run:
 * the longest live run measured on 10 Nov 2026 was 333 days.
 *
 * greatest(), not coalesce(): lib/event-view.ts isEnded takes the LATEST of
 * start/end/multiDayEnd, and a bare `coalesce(multi_day_end, end_at, start_at)`
 * prefers multi_day_end even when it is not later than the start — the latent
 * disagreement lib/events.ts:305 documents. Postgres greatest() ignores NULLs,
 * so this is the same rule isEnded applies.
 *
 * (An earlier version of this paragraph added "and lib/upsert.ts already uses
 * greatest() over these same three columns for the same reason". Wrong on both
 * counts: that call is greatest(extendTo, multi_day_end, end_at) — start_at is
 * not among them — and its reason is that a span may only EXTEND during a fold,
 * not that an ended test wants the latest of three. There IS precedent for
 * greatest() on span columns in SQL here; it is not this rule.)
 */
import { sql } from "./db";

export interface OpenVerifyFlag {
  id: string;
  /** The pass's own verdict — `wrong_event`, `moved`, `not_found`, … */
  verdict: string;
  title: string;
  venue: string;
  /** Chicago wall start, for ordering. Not for display; `day` is that. */
  start: string;
  /**
   * Chicago "Mon DD" for a single day, "Mon DD – Mon DD" for a run — the
   * operator's question is whether the listing is still ON, and a run's start
   * day does not answer it.
   */
  day: string;
}

/**
 * Most dangerous first. `wrong_event` means the venue's own calendar
 * contradicts us, which is the strongest negative the pass produces; a
 * `cancelled` verdict is next because a cancelled event still on the site is
 * the honest-data failure this project exists to avoid.
 */
export function flagRank(verdict: string): number {
  return verdict === "wrong_event" ? 0 : verdict === "cancelled" ? 1 : 2;
}

/**
 * The order both readers use: most dangerous verdict, then soonest, then title.
 *
 * Extracted 10 Nov 2026, and the tiebreaks are the point. Sorting by rank alone
 * leaned on Array.sort being stable to keep whatever the DB had underneath —
 * and that was `distinct on (e.id) ... order by e.id`, i.e. UUID order. So
 * WHICH four flags the Monday email printed as its examples was effectively
 * arbitrary within a verdict, and a reader could not tell two runs of the same
 * data apart. `/admin?status=flagged` then threw the rank away entirely and
 * sorted start_at asc, so on 10 Nov 2026 the four wrong_event listings sat at
 * positions 7, 19, 33 and 45 of 71, under thirty unproven rows.
 */
export function byDanger(a: OpenVerifyFlag, b: OpenVerifyFlag): number {
  return (
    flagRank(a.verdict) - flagRank(b.verdict) ||
    a.start.localeCompare(b.start) ||
    a.title.localeCompare(b.title)
  );
}

/** Every listing with an open verify flag, most dangerous verdict first. */
export async function openVerifyFlags(): Promise<OpenVerifyFlag[]> {
  if (!sql) return [];
  const rows = await sql<OpenVerifyFlag[]>`
    select distinct on (e.id)
           e.id::text as id,
           coalesce(a.patch->>'verdict', 'flag') as verdict,
           e.title, e.venue,
           to_char(e.start_at at time zone 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI') as start,
           -- A RUN states its span. Widening the window clause below made runs
           -- reachable here for the first time, and this printed start_at alone,
           -- so a cancelled exhibition would have reached the operator email as
           -- "May 23" — a date months past for something still on. Sixth time
           -- in this chain that a widened filter met a label written for the
           -- narrow set.
           --
           -- Deliberately NOT a port of lib/multiday.ts multiDayLabel, which
           -- collapses a same-month span to "Oct 19 – 23". This is one line in an
           -- operator email; repeating the month is clearer there than teaching
           -- SQL a display rule, and nothing compares the two strings.
           case when (greatest(e.start_at, e.end_at, e.multi_day_end) at time zone 'America/Chicago')::date
                     > (e.start_at at time zone 'America/Chicago')::date
                then to_char(e.start_at at time zone 'America/Chicago', 'Mon DD')
                     || ' – ' ||
                     to_char(greatest(e.start_at, e.end_at, e.multi_day_end) at time zone 'America/Chicago', 'Mon DD')
                else to_char(e.start_at at time zone 'America/Chicago', 'Mon DD')
           end as day
    from admin_audit a
    join events e on e.id = a.event_id
    where a.action = 'verify_flag'
      and e.status = 'published'
      and (e.verified_at is null or a.at > e.verified_at)
      and greatest(e.start_at, e.end_at, e.multi_day_end) >= now()
    order by e.id, a.at desc`;
  return [...rows].sort(byDanger);
}

/**
 * How many listings carry an OPEN flag of this action — the same open-state rule
 * openVerifyFlags applies, so a second queue cannot drift from the first.
 *
 * Written for the music-review queue, which had computed it inline with a bare
 * `verified_at is null`. That is the 33-vs-25 defect in miniature, and worse
 * here than it was there: scripts/import-venues.ts inserts this flag only WHERE
 * NOT EXISTS a prior one for the event (deliberately — a flag is a standing note,
 * not a log line), while stamping verified_at on every row it matched. So the
 * ordinary life of the flag is: matched and stamped in run N, calendar re-spells
 * the listing in run N+1, first flag inserted with a.at AFTER the stamp — and a
 * count keyed on `verified_at is null` never sees it, nor can a fresher flag row
 * ever arrive to make it visible. Invisible permanently, by the common path.
 * Measured 10 Nov 2026: the queue reported 0, and 1 was open.
 */
export async function openFlagCount(action: string): Promise<number> {
  if (!sql) return 0;
  const [row] = await sql<{ n: number }[]>`
    select count(distinct a.event_id)::int as n
    from admin_audit a join events e on e.id = a.event_id
    where a.action = ${action}
      and e.status = 'published'
      and (e.verified_at is null or a.at > e.verified_at)
      and greatest(e.start_at, e.end_at, e.multi_day_end) >= now()`;
  return row?.n ?? 0;
}

/** Just the ids, for `/admin?status=flagged`. */
export async function openVerifyFlagIds(): Promise<string[]> {
  return (await openVerifyFlags()).map((f) => f.id);
}
