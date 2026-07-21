# Deploy F2.1 — "Happening now / starts in N hours" on event pages

*July 21, 2026 (morning). Roadmap v5, first F2 feature — spending the trust
R0.1 bought: event-page time-state is finally reliable, so the page can say
more than ended/not.*

## What shipped

**[lib/event-view.ts](../../lib/event-view.ts): `eventTimeState(event, now)`**
— a pure four-state machine beside `isEnded`, wall-frame correct (rule 10:
walls cross into instants only through `wallToInstant`, instants compare to
instants — the countdown math survives DST by construction):

- **upcoming** (> 12h out) → no banner; the When row is the honest answer
- **soon** (≤ 12h) → "Starts in 2 hours" / "Starts in 25 minutes"
- **now** (start → true span end, rule 5) → "Happening now"
- **ended** → "This event has already happened." (same copy as before)

`timeStateLabel` owns the copy; [app/event/[id]/page.tsx](../../app/event/[id]/page.tsx)
swaps the binary banner for the state machine (archived rows are always
"ended"; cancelled outranks everything). Two new banner styles in
`globals.css` (`.live` gold, `.soon` dimmer gold).

## Design decisions

- **No-end events count as happening for 2 hours** — `DEFAULT_DURATION_MS`,
  now exported from [lib/ics.ts](../../lib/ics.ts), is the same assumption
  every .ics/Google export already hands to calendars. Before this, a no-end
  7 PM show read "already happened" at 7:01 PM while our own .ics said it ran
  to 9 — the page and the calendar file now agree. (`isEnded` itself is
  unchanged; it remains the conservative frame and R0.1's tests still pin it.)
- **All-day events never get a countdown** — their stored midnight start is a
  date, not a doors-open time; they're "now" across their span days.
- **12-hour horizon** for the countdown: beyond it, a countdown is noise.
- The page is ISR (`revalidate = 300`), so a banner can lag up to 5 minutes —
  same freshness the old ended banner had; hour-level copy absorbs it.

## Verification (observed, not intended)

- **All four states found and rendered with real prod data on a live dev
  server**: Bell Museum Youth Summer Camps → "HAPPENING NOW" (gold, computed
  styles verified) · Lunch on the Lawn → "STARTS IN 3 HOURS" · Minnehaha Falls
  Art Fair (the very event R0.1 was verified on) → "THIS EVENT HAS ALREADY
  HAPPENED." · Scott County Fair → no banner.
- Tests +8 (692/692), riding R0.1's fixtures: countdown at 2h/25min · during →
  now · past last minute → ended · 12h boundary both sides · no-end 2h window ·
  mid-run day-2 now · all-day fair (no midnight countdown, now across days,
  ended after) · label pluralization + null · winter-frame countdown.
- Gate: tsc clean · 692/692 · build clean · audit 0.

## Deploy steps

Push to `main`. Code-only.

## Verify checklist

- [ ] Tonight ~5 PM: open any 7 PM show's page → "Starts in 2 hours".
- [ ] Same page ~8 PM → "Happening now".

## Rollback

`git revert` — the old binary banner comes back exactly.
