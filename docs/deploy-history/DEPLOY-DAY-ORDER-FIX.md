# Deploy — A day now reads in clock order

*Aug 20, 2026. Reported from a calendar day panel: 10 AM, 8 PM, 10 AM, 7 PM, 7 PM.
"Didn't we want this to run chronologically?"*

## What was happening
`orderDayEvents` (from U2) split a day into two groups: **multi-day spans first,
sorted alphabetically**, then single-day events by the clock. The titles in the
screenshot gave it away — **A**, **D**, **E**, **L**, **M**.

Two things were wrong.

**1. The split asked the wrong question.** It grouped on *"does this span multiple
days?"* — but a play that opens tonight at 8 PM and runs through Sunday spans days
**and** has a real start time today. Measured on the reported day (Aug 21), 11 events
were filed as spans and sorted alphabetically, and **six of them started that very
day**:

| | |
|---|---|
| starts today (has a real showtime) | 2D Con 10 AM · Mpls Summer Art 10 AM · Pandafest 11 AM · MACT 7 PM · Private Lives 7:30 PM · Dances with Dalí 8 PM |
| genuinely ongoing (began earlier) | A Year With Frog (Aug 13) · Explorasaurus (Aug 17) · Live Music (Aug 20) · Fringe Hangover (Aug 20) · Woodbury Days (Aug 20) |

The card **displayed** "8 PM" and then refused to sort by it. That's what read as
broken — and fairly.

**2. U2's label was never built.** The design said spans should be grouped *"with a
label (e.g. 'All day / ongoing')"*. Only the ordering shipped, so the leading block
had nothing explaining why it wasn't in clock order.

The original concern was real but narrower than the rule: a festival that opened
Aug 13 shows *Aug 13's* 10 AM on Aug 21 — a stale time worth protecting from. That
applies only to events that began earlier.

## What shipped
**The rule is now "did it start on the day you're looking at?"**
([lib/day-order.ts](../../lib/day-order.ts)):
- **Ongoing** — began earlier, still running. No meaningful clock time today, so
  alphabetical, under an **"Already running"** heading.
- **Everything starting today** — chronological, whether or not it runs longer.
  All-day events store 00:00 and naturally lead.

`splitDayEvents(events, dayKey)` returns both groups; `orderDayEvents(events, dayKey)`
is the flat concatenation. The day comparison is a **string compare on the Chicago
wall date** — no `Date` parsing, so no timezone drift.

**Both surfaces render the headings** — `/day/[date]` and the homepage `DayPanel`
(the one the report came from) — from the same shared split, so they cannot drift.

## Verification (observed, not intended)
Real production data for Aug 21, before → after:

```
BEFORE:  11 alphabetical (10 AM, 8 PM, 10 AM, 7 PM, 7 PM …) + 16 chronological
AFTER:   Already running (5)  — began Aug 13–20
         Starting today (22)  — 9 AM → 10 PM, strictly non-decreasing ✓
```

Dances with Dalí now sits with the other 8 PM shows; MACT with the 7 PM ones.

- Rendered `/day/2026-08-21` on a dev server and read the DOM order: both headings
  present, times ascending 10 AM → 4 → 5 → 6 → 6:30 → 7 → 7:30 …
- **Tests +5** (1272 at that point): a same-day opening sorts by clock not title; the
  genuinely-ongoing are still protected from a stale start; ongoing lead the flat
  order; a 00:00 start on the day itself is *today's* all-day event, not ongoing;
  and both surfaces carry the headings. The six existing U2 tests still pass
  unchanged (their fixtures used genuinely-earlier spans) — the protection U2 added
  is intact, only its criterion narrowed.
- Gate: `tsc` clean · 1272/1272 · `npm run build` clean · `npm audit` 0.

## The run label (shipped same day)
Grouping fixed the ORDER, but an "Already running" card still showed its original
start time — A Year With Frog and Toad rendered **10 AM** on Aug 21, which is
*Aug 13's* 10 AM. A real-looking number that simply isn't today's.

**`dayTimeLabel(ev, dayKey)`** now decides what goes in the time slot:
- **began earlier** → how much longer you have: **"Last day"** or **"Through Aug 23"**.
  Never a clock time we can't stand behind.
- **starts today** → its **actual start time, even if it runs on for days**. A play
  opening tonight at 8 PM says 8 PM; that it also runs Saturday belongs on the event
  page. On a day view, *when today* is the useful fact.

That second half is a deliberate change to existing behaviour: `EventDayCard` used
to swap in a span badge for **any** multi-day event, so MACT Fact*Fest showed
"Aug 21 – 22" instead of "7 PM" on its own opening day. Inside a day view that hides
the one thing the reader came for.

**Scoped by an optional `dayKey` prop.** Only the two day surfaces pass it;
`/this-week`, `/saved` and collections have no single day in view, so they keep the
span badge exactly as before — pinned by a test.

Rendered on the real Aug 21 page:

```
== Already running ==
   Through Aug 23   A Year With Frog and Toad
   Through Aug 23   Explorasaurus: A Dinosaur Adventure
   Last day         Live Music – Amsterdam Bar and Hall
   Through Aug 31   Minnesota Fringe Festival Fringe Hangover
   Through Aug 22   Woodbury Days
== Starting today ==
   9 AM … 10 PM     (22 events, strictly in order)
```

**Tests +9** (1281 total): a stale time is never shown for an earlier start; "Last
day" when the run ends today; month boundaries ("Through Aug 2"); an opening-today
run keeps its 8 PM; single-day and all-day events unaffected; a missing end degrades
to "Ongoing" rather than inventing a date; both day surfaces use it; and cards
outside a day view still take the old path.

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema, no secret.

## Rollback
`git revert`. The signature gained a required `dayKey`, so a revert restores both
call sites together.
