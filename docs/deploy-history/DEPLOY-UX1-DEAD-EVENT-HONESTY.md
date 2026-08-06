# Deploy UX1 — dead-event honesty

*August 2026. First item of the UX roadmap (docs/ROADMAP-UX.md), from the
five-track UX audit. The clearest "the site contradicts itself" bug.*

## The bug

A cancelled or already-ended event still showed the live gold **"Tickets &
Info"** button and the **Save / Add-to-calendar** row. The banner said "This
event has already happened" while the biggest button on the page invited you to
buy tickets — and you could add a dead event to your personal calendar,
guaranteeing a future no-show. Root cause: the page computed the time-state for
its banner, but `EventDetailBody` (shared by the page AND the in-app modal)
never knew the event was dead, so it always rendered the live actions.

## The fix — the body owns the event's status

Moved the cancelled/time-state **banner** and the action-gating **into
`EventDetailBody`**, so the standalone page and the modal can never drift:

- New pure predicate **`isDeadEvent(event, now)`**
  ([lib/event-view.ts](../../lib/event-view.ts)) — true when cancelled,
  archived, or already ended by the clock (true-span aware, rule 5).
- `EventDetailBody` renders the banner itself and gates the ticket CTA and the
  save/calendar row on `!dead`. **Share stays** (a dead event is still worth
  sharing). Bonus: the in-app modal, which had *no* time-state banner before,
  now shows "Happening now" / "Starts in N" / "already happened" too.
- The event page ([app/event/[id]/page.tsx](../../app/event/[id]/page.tsx))
  dropped its own banner block and the now-unused computation/imports.
- Two smaller audit items in the same files: the Price row is omitted when price
  is empty (honest emptiness), and the no-ticket "Details to come" faded-gold
  ghost button (read as broken) is now a quiet non-interactive note.

## Verification (observed, not intended)

On a dev server against real prod data:
- **Ended event** (Minnehaha Falls Art Fair): banner "This event has already
  happened"; ticket button **absent**; save/calendar row **absent**; Share
  present.
- **Live event** (Battle of the Improv All-Stars, happening now): banner
  "Happening now"; "Tickets & Info" present; save/calendar present; Share present.
- Tests +7 (796/796): `isDeadEvent` golden (cancelled/archived always dead, past
  end dead, live/upcoming not dead, mid-run multi-day not dead) + wiring
  tripwires (body gates on `!dead`, banner moved out of the page, price row
  gated).
- Gate: tsc clean · 796/796 · build clean · audit 0.

## Deploy steps

Push to `main`. Code-only, no schema. ISR `revalidate = 300`, so the banner/CTA
state can lag up to 5 minutes — same freshness the ended banner already had.

## Verify checklist

- [ ] Open a past or cancelled event page → no "Tickets & Info" button, no
      Save/Add-to-calendar; the banner explains why; Share still works.
- [ ] Open a current event → tickets + save + calendar all present as before.
- [ ] Open an event from the homepage calendar (the modal) → it now shows the
      same time-state banner as the page.

## Rollback

`git revert`.
