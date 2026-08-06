# Deploy F1.2 — trending calibration (re-derived for the honest regime)

*August 2026. Roadmap v5 F1.2 (v4 4.2), after F1.1. A calibration item: replay a
real week through the scorer, tune the thresholds, decide on "Most saved."*

## The replay finding

Ran a live 7-day window through the real `scoreRows`/`rankTrending` — and it
overturned the going-in assumption. Facts:

- **Trending was dark, and the old "lit — 12 events" was bot inflation.** The
  `calendar` stat used to be counted server-side per .ics fetch (crawlers +
  calendar-app pollers), weight 4 — it pumped dozens of events over the floor.
  With that stat de-botted (now a human beacon click), calendar has **vanished
  from the eligible window** (0% of every score). Honest engagement is
  view + ticket-click: 82 views + 17 ticket clicks across 53 upcoming events.
- Honest score distribution: one event at **13.2**, then 6.8, 4.9, 4.8, 3.8…;
  **median 0.6**. Only **1** cleared the old `MIN_SCORE=8`, and `MIN_LIST=4`
  needs four — so the surface rendered nothing.

The old floor (8) was calibrated for the inflated regime. It had to be
re-derived for the honest one.

## The decision (Taren's call: "reflect real momentum")

- **`MIN_SCORE` 8 → 5** — one genuine ticket click (weight 5), or ~5 views
  today. A real intent signal, not noise.
- **`MIN_LIST` 4 → 3** — a young site's "cluster" is smaller; still all-or-
  nothing so a lone crowned event never shows.
- **Weights and half-life: unchanged** — the intent ladder (view 1 → save 3 →
  calendar 4 → ticket-click 5) and 3-day half-life were replay-checked and are
  sound; the problem was the floor-vs-volume, not the shape.
- **"Most saved this week" in the digest: deferred.** Saves are 4 in 30 days — a
  "most saved" line would be noise. Honest-emptiness says wait; F1.3 is already
  gated on save volume.

At today's traffic this **correctly stays dark** (2 events clear 5, need 3) and
lights up the moment a 3rd crosses the bar — honest now, responsive as
engagement grows, no bot-era inflation.

## Verification (observed, not intended)

- **The honest state, end-to-end on real data:** `npm run ops-digest --
  --dry-run` → Trending now reads *"dark — below the all-or-nothing minimum"*,
  where earlier this session it falsely showed "lit ✓ — 12 events." The surface
  stopped lying.
- Tests +2 net (789/789): the ladder math (ticket click 5 + 3 views = 8; one
  ticket click alone = 5 clears the floor); the all-or-nothing boundary rewritten
  constant-driven (one short of MIN_LIST dark, exactly MIN_LIST renders, a
  sub-floor event never counts); a guard that MIN_LIST stays ≥ 3.
- Gate: tsc clean · 789/789 · build clean · audit 0.

## Deploy steps

Push to `main`. Code-only, no schema. Takes effect immediately on the homepage
strip, /collections/trending, and the ops digest.

## Verify checklist

- [ ] Homepage: trending stays hidden today (honest — not enough engagement),
      and appears once 3+ upcoming events genuinely draw clicks/views.
- [ ] Watch the ops digest Trending line: it should flip to "lit" only when the
      real signal supports it — and when it does, the names should be events you'd
      agree are drawing interest (Nordeast Polish Fest / Lebanese Fest are the
      current front-runners).

## Rollback

`git revert` — restores the old thresholds (and the empty surface under honest
data).
