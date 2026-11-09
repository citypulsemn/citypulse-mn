import { dkey, evDate, spanEndISO } from "./dates";
import type { EventRecord } from "./types";

/**
 * Grouping for the homepage LIST view (UX4). The list renders the windowed,
 * filtered events chronologically — the surface the date presets should have
 * produced all along, and the one that reads on a phone (the calendar hides
 * titles below 820px).
 *
 * Ongoing events whose start precedes the window (a festival mid-run) are
 * clamped to the window's first day, so they appear at the TOP of the list
 * rather than under a header for a date that's already passed.
 */
export interface DayGroup {
  key: string; // YYYY-MM-DD
  events: EventRecord[];
}

export const LIST_ONGOING_CAP = 6;

export interface ListPlan {
  /** Started before the window and still running — capped, ending soonest first. */
  ongoing: EventRecord[];
  /** How many qualify in total, so the heading can be honest about the cap. */
  ongoingTotal: number;
  /** Everything that STARTS inside the window, grouped by day as before. */
  days: DayGroup[];
}

/**
 * What the homepage list should render (5 Nov 2026).
 *
 * Until today `eventsInWindow` dropped every mid-run event before the list saw
 * it, so `groupEventsByDay`'s clamp branch below — written for exactly this case,
 * and covered by a test since UX4 — had never once run in production. On the
 * default Today range the widened predicate would have put 23 events, most of
 * them months-long exhibitions, at the top of a 33-item list ahead of the 10
 * things actually starting. That is the calendar-flood incident arriving by a
 * different door.
 *
 * (The first cut of this file claimed that fixing the predicate "makes the clamp
 * branch live". A review showed it did not: every row that could reach the clamp
 * was routed into `ongoing` instead, so the branch stayed dead and the claim was
 * simply wrong. It IS live now, but only because of the `todayKey` fix below —
 * a run that overlapped the window and has since closed goes to `starting` with
 * a start before the window, which is exactly what the clamp handles.)
 *
 * So the mid-run ones get their own capped group, ordered ending-soonest, the
 * same shape `/day/<date>` and `/this-weekend` already use. `groupEventsByDay`
 * is deliberately untouched: `/this-week` shares it.
 *
 * "ALREADY RUNNING" IS DECIDED FROM `todayKey`, NOT FROM THE WINDOW, and that
 * distinction is the whole correctness of the heading. The first cut split on
 * `windowStartKey` alone, and a review caught what that does: on 5 Nov 2026 one
 * tap on "This Month" set the window to 1 Nov, the widened predicate admitted
 * the Halloween runs that closed on 2 Nov, and the ending-soonest sort put the
 * deadest rows FIRST — all six visible cards were attractions that had shut,
 * evicting the runs that were genuinely on. The mirror case is a future window:
 * on a Monday the weekend preset starts on Friday, so a Wednesday-to-Sunday run
 * would have been "Already running" two days before it opened. Both shapes were
 * NEW, because the old start-only predicate excluded those rows entirely.
 *
 * A row that overlapped the window but has since closed is not dropped — it
 * falls through to the day groups and `groupEventsByDay` clamps it to the
 * window's first day, which is what that branch was written for. On a past
 * month that is the only way a run that spanned it appears at all.
 */
export function planListView(
  events: EventRecord[],
  windowStartKey: string,
  todayKey: string,
  cap = LIST_ONGOING_CAP,
): ListPlan {
  const ongoing: EventRecord[] = [];
  const starting: EventRecord[] = [];
  for (const e of events) {
    const startKey = dkey(evDate(e));
    const end = spanEndISO(e)?.slice(0, 10);
    const endKey = end && end > startKey ? end : startKey;
    const underwayWhenTheWindowOpened = startKey < windowStartKey;
    const onRightNow = startKey < todayKey && endKey >= todayKey;
    if (underwayWhenTheWindowOpened && onRightNow) ongoing.push(e);
    else starting.push(e);
  }

  const endKey = (e: EventRecord) => spanEndISO(e)?.slice(0, 10) ?? dkey(evDate(e));
  ongoing.sort(
    (a, b) => endKey(a).localeCompare(endKey(b)) || a.title.localeCompare(b.title),
  );

  return {
    ongoing: ongoing.slice(0, cap),
    ongoingTotal: ongoing.length,
    days: groupEventsByDay(starting, windowStartKey),
  };
}

/**
 * One ordering for every "pick N events for a card" surface: what STARTS
 * inside the window first, soonest first; then the runs that were already
 * underway when the window opened, ending-soonest first.
 *
 * Why not plain start-ascending, which is what both callers did before: once a
 * surface became span-aware, a run that opened months earlier sorted FIRST and
 * filled the card. "Started longest ago" is an anti-signal for "what should I
 * do this week" — the collection share card led with an eleven-month gallery
 * rotation, and the Instagram Regular card led with two rows dated 23 May.
 * Both were found on 5–6 Nov 2026, a day apart, which is why the rule lives
 * here once instead of being written a third time.
 *
 * Runs are NOT excluded: they top the list up when the calendar is thin, so a
 * quiet week shows real runs rather than blank rows (rule 6).
 */
export function soonestFirstThenRuns(
  events: EventRecord[],
  windowStartKey: string,
  /** Defaults to windowStartKey, which is right when the window opens today.
   *  Pass it separately for a window that opens LATER (the map's month view),
   *  so this asks planListView exactly what ListView asks of the same array. */
  todayKey: string = windowStartKey,
): EventRecord[] {
  // cap = events.length so nothing is dropped; the caller does the limiting.
  const plan = planListView(events, windowStartKey, todayKey, events.length);
  return [...plan.days.flatMap((g) => g.events), ...plan.ongoing];
}

export function groupEventsByDay(events: EventRecord[], windowStartKey: string): DayGroup[] {
  const byDay = new Map<string, EventRecord[]>();
  for (const e of events) {
    const startKey = dkey(evDate(e));
    const key = startKey < windowStartKey ? windowStartKey : startKey;
    const arr = byDay.get(key);
    if (arr) arr.push(e);
    else byDay.set(key, [e]);
  }
  return [...byDay.keys()]
    .sort()
    .map((key) => ({
      key,
      events: byDay
        .get(key)!
        .slice()
        .sort((a, b) => evDate(a).getTime() - evDate(b).getTime()),
    }));
}
