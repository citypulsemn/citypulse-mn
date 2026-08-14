# Deploy — M0.2 calendar-metric integrity (dedup the add)

*August 2026. Monetization Tier 0. Code-only.*

## What shipped

The "Add to calendar" control is two links — `.ics` download and Google Calendar —
that beacon the first-party `calendar` stat on click. They're **one intent**
("add this event"), so clicking both, or double-tapping, was counting 2+ adds for
one human. This deduped the beacon so it counts **once per event per page visit**.

- **[AddToCalendar.tsx](../../components/AddToCalendar.tsx)** — a module-level
  `countedCalendar` Set + `countCalendarOnce(id)`; both onClick handlers route
  through it instead of calling `sendStat(id, "calendar")` raw. First call for an
  event beacons; repeats are no-ops for the rest of the visit. (The vendor
  `track("ics_download", …)` event still fires per click — that's per-interaction
  analytics, a different question.)
- Doc honesty in **[lib/stats.ts](../../lib/stats.ts)**: `calendar` can exceed
  detail-page `view` **legitimately** — adds also fire from the in-app day-panel
  modal, which records no `view`. So the two counters aren't a funnel; the audit
  did **not** invent a phantom bug, it fixed the one real double-count and
  documented the rest of the gap.

## Why this way

A `Set` (not a per-click flag) so both buttons and repeat taps share one memory,
keyed by event id — a page showing many events dedups each independently. Resets
on full navigation (new visit), which is the right grain for "adds per visit."

## Verification

Gate: `tsc` clean · **977** tests · `npm run build` clean · `npm audit` 0.
Source tripwires (can't run click handlers without jsdom, which this repo omits):
both handlers call `countCalendarOnce`, the raw `sendStat(…, "calendar")` is gone,
and exactly one `sendStat` remains (inside the guard) — in both
`perf-ux10.test.ts` and the updated `stats.test.ts`.

## Deploy steps

Push to `main`. Code-only, no schema, no env.

## Verify checklist (production)

- [ ] Open an event, tap **Add to calendar** then **Google Calendar** — Admin →
      Stats "Calendar adds" rises by **1**, not 2, for that event/day.
- [ ] Calendar links still download / open correctly.

## Rollback

`git revert`. Reverts to raw per-click counting (harmless, just re-inflates the metric).
