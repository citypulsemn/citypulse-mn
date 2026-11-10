/**
 * OPEN VERIFY FLAGS — one definition, two readers.
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
 * STILL ON, not still to come (9 Nov 2026). The window clause asked
 * `e.start_at >= now()` — a START question — so a RUN that opened before today
 * and is still on dropped out of triage while staying live on the site. A
 * `cancelled` verdict on a run is exactly the honest-data failure the ranking
 * above exists to surface, and it could sit unseen for the length of the run:
 * the longest live run measured on 9 Nov 2026 was 333 days.
 *
 * greatest(), not coalesce(): lib/event-view.ts isEnded takes the LATEST of
 * start/end/multiDayEnd, and a bare `coalesce(multi_day_end, end_at, start_at)`
 * prefers multi_day_end even when it is not later than the start — the latent
 * disagreement lib/events.ts:305 documents. Postgres greatest() ignores NULLs,
 * so this is the same rule isEnded applies, and lib/upsert.ts already uses
 * greatest() on these three columns for the same reason.
 */
import { sql } from "./db";

export interface OpenVerifyFlag {
  id: string;
  /** The pass's own verdict — `wrong_event`, `moved`, `not_found`, … */
  verdict: string;
  title: string;
  venue: string;
  /** Chicago "Mon DD", for the operator email. */
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

/** Every listing with an open verify flag, most dangerous verdict first. */
export async function openVerifyFlags(): Promise<OpenVerifyFlag[]> {
  if (!sql) return [];
  const rows = await sql<OpenVerifyFlag[]>`
    select distinct on (e.id)
           e.id::text as id,
           coalesce(a.patch->>'verdict', 'flag') as verdict,
           e.title, e.venue,
           to_char(e.start_at at time zone 'America/Chicago', 'Mon DD') as day
    from admin_audit a
    join events e on e.id = a.event_id
    where a.action = 'verify_flag'
      and e.status = 'published'
      and (e.verified_at is null or a.at > e.verified_at)
      and greatest(e.start_at, e.end_at, e.multi_day_end) >= now()
    order by e.id, a.at desc`;
  return [...rows].sort((x, y) => flagRank(x.verdict) - flagRank(y.verdict));
}

/** Just the ids, for `/admin?status=flagged`. */
export async function openVerifyFlagIds(): Promise<string[]> {
  return (await openVerifyFlags()).map((f) => f.id);
}
