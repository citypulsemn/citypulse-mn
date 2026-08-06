# Deploy UX4 — mobile-first list view (presets that actually list)

*August 2026. UX roadmap item 4, the Tier-2 headline. The discovery audit's #1
finding, echoed across three of the five tracks: the homepage is blind on a
phone.*

## The problem

The homepage defaulted to a month **calendar grid** that hides every event title
below 820px (just colored dots), and the date presets only **dimmed** out-of-
window cells instead of producing a list — so "what's on this weekend" meant
tapping Fri, Sat, Sun as three separate overlays. The clean chronological
surfaces (`/this-weekend`, `/ongoing`) existed but were buried in the footer.

## What shipped

- **A third view: List** (toggle: List · Calendar · Map). It renders the
  **windowed, filtered events** — exactly what the date presets drive — as a
  chronological agenda grouped by day, reusing `EventDayCard` so every row
  carries the UX3 ♡ save overlay.
- **Presets now produce a list.** Tapping "This Weekend" / "This Week" narrows
  the List to that window (verified: "This Week" → 120 events across 7 day
  groups) instead of dimming a month grid. This also sidesteps the old
  count-vs-grid mismatch — the List shows exactly the counted events.
- **Mobile default = List, opening on "this week."** Below 820px the explorer
  switches to the list on mount and sets the range to `week`, so a phone opens
  to ~a week of events (not a ~400-event month), with the month one tap away.
  Desktop keeps the calendar/month default.
- **[lib/list-view.ts](../../lib/list-view.ts): `groupEventsByDay`** — pure,
  golden-tested. Ongoing events whose start precedes the window (a festival
  mid-run) are **clamped to the window's first day**, so they appear at the top
  of the list, not under a header for a date that's already passed.

## Verification (observed, not intended)

Driven on a dev server against real data:
- Three toggle buttons; List renders a day-grouped agenda (headers like
  "Saturday, August 1, 2026"); every card carries the ♡.
- "This Week" preset narrowed the list from the month (391 events / 30 days) to
  **120 events / 7 days**; the preset drives the surface.
- Mobile default (small width) opened to **List + This Week**; switching to
  Calendar restored the grid cleanly.
- Tests +8 (820/820): `groupEventsByDay` (day bucketing, within-day time sort,
  ongoing-clamp-to-window-start, empty, no input mutation) + wiring tripwires
  (view type includes `list`, List toggle, renders `windowedEvents`, mobile
  default sets list + week, list reuses EventDayCard).
- Gate: tsc clean · 820/820 · build clean · audit 0.

## Product note (a small call made in-flight)

Seeing the real magnitude — a month List is ~400 events — the mobile default was
set to open on **"this week"** rather than the full month. This follows the
audit's own recommendation (default to a tighter window) and keeps the phone-open
experience digestible. It's a one-line change if you'd prefer "This Weekend" or
the full month.

## Ops note (self-inflicted, logged so it isn't repeated)

Running `npm run build` while a `npm run dev` preview is live **corrupts the
shared `.next`** (routes-manifest / webpack-chunk 500s on the dev server). Not a
code issue — stop the dev server before building, or verify in a fresh dev
restart. Cost ~one confused debugging loop.

## Deploy steps

Push to `main`. Code-only, no schema.

## Verify checklist

- [ ] On a phone, the homepage opens to a scannable **list of this week's
      events** (titles visible), not a dot-only calendar.
- [ ] Tap "This Weekend" → the list narrows to the weekend; "This Month" widens it.
- [ ] Tap "Calendar" → the grid; "Map" → the map. All three switch cleanly.
- [ ] Each list row shows the ♡ and opens the event.

## Rollback

`git revert`. Additive (new view + files); calendar and map are untouched.
