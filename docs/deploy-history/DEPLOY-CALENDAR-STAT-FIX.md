# Deploy — calendar stat: count the click, not the fetch

*July 21, 2026. Not a roadmap item — surfaced by the post-deploy state pull.*

## The problem

The 7-day engagement totals showed **1,419 calendar-adds against 132 views** —
~11 per view, impossible for humans. Traced to
[app/event/[id]/calendar/route.ts](../../app/event/[id]/calendar/route.ts): the
`calendar` stat was counted **server-side on every fetch of the .ics**, and that
route is hit by crawlers, link-preview bots, and — now that 6.1 feeds can be
subscribed — calendar-app pollers. None of it is human, and none of it was
bounded by R2.1's beacon cap (that cap only covers the beacon endpoint). The
"calendar adds" line in the ops digest was meaningless.

## The fix

Count the **human click**, like `view` and `ticket_click`:

- Removed the `recordStat` call from the .ics download route — it now just
  serves bytes.
- [AddToCalendar](../../components/AddToCalendar.tsx): the .ics link now fires
  `sendStat(id, "calendar")` on click, matching the Google Calendar button
  (which already did). Both add-to-calendar paths count once, on the click,
  bounded by the R2.1 per-IP beacon cap.
- `calendar` was already an allow-listed beacon action, so no endpoint change.
- Updated the stale doc comments in [lib/stats.ts](../../lib/stats.ts) and the
  route that claimed the .ics was counted server-side.

## Verification (observed, not intended)

- **The route no longer counts:** 3 direct fetches of the .ics endpoint →
  `event_stats.calendar` stayed **0**.
- **The click does count:** clicking the .ics link fired
  `POST /api/beacon → 204` with the `calendar` action.
- A first browser click briefly showed a count of 2 — chased it down to a dev
  HMR artifact (the stale pre-edit route module ran once); the direct-fetch test
  above confirms the current route counts nothing. All synthetic test rows were
  removed from prod.
- Tests +3 (741/741): source tripwires (route has no `recordStat`; both
  add-to-calendar options beacon `calendar`; `calendar` is a public beacon
  action). Gate: tsc clean · 741/741 · build clean · audit 0.

## Impact & caveat

From now on, "calendar adds" counts human clicks only. **Historical
`event_stats` calendar counts (and the `ops_digest_runs` baseline from Jul 20)
remain inflated** — so the *first* post-deploy digest may show a large negative
calendar WoW as the metric resets to honest levels. That's the number correcting
itself, not a regression; it settles after one cycle.

## Deploy steps

Push to `main`. Code-only, no schema.

## Verify checklist

- [ ] After some real traffic, `event_stats` calendar counts look like a
      sane fraction of views (not 10×).
- [ ] Next ops digest's calendar line is believable (ignore the one-time WoW dip).

## Rollback

`git revert` — restores the server-side count (and the pollution).
