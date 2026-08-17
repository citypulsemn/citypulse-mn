# Deploy — Winning detail (moat), kind 8: orchard fall-outing features

*Aug 17, 2026. Timed for the season — apple picking starts in a few weeks. Adds the
four facts a family picks one orchard over another for: pick-your-own apples, cider
donuts, a pumpkin patch, and a corn maze. Reuses the whole detail layer (badges +
per-kind filters + reactive map); no orchard-specific UI.*

## What it badges
`uPick` (pick-your-own apples) · `ciderDonuts` (fresh apple-cider donuts) ·
`pumpkinPatch` · `cornMaze` — new fields on `PlaceDetails`
([lib/places.ts](../../lib/places.ts)).

## How it was verified (honesty first)
One research agent checked all 12 orchards against their official sites (fallback
search where a homepage was empty/redirected), `yes → badge`, `unknown → no badge`.
Two facts where the strict bar mattered:
- **`uPick` (7/12):** several well-known orchards sell apples **pre-picked from the
  barn only** — Pine Tree, Sweetland, and Sever's are *not* u-pick — so they get no
  u-pick badge even though they sell apples. This is exactly the distinction a
  visitor who wants to *pick* cares about.
- **`ciderDonuts` (5/12):** held to *cider* donuts specifically — orchards whose
  bakery makes "apple donuts" / "apple-spice donuts" / "mini donuts" (Afton, Apple
  Jack, Sponsel's, Whistling Well, Pinehaven, Waldoch) did **not** get the badge
  unless a source confirmed apple-cider donuts.
- `pumpkinPatch` 10/12 · `cornMaze` 7/12. Every one of the 12 carries at least one
  badge (no honest-empties this round).

## Verification (observed, not intended)
- **Live browser** (`/places/orchard`, DOM-driven): badges U-pick 7 · Cider donuts 5
  · Pumpkin patch 10 · Corn maze 7; four filter chips present; U-pick filter → 7 of
  12. Console clean.
- **Tests +4** (1142 total): count locks; a guard that a pre-picked orchard never
  claims u-pick (Pine Tree, Sweetland); filter surfaces the four facts in order;
  orchard details use only orchard keys.
- Gate: `tsc` clean · 1142/1142 · `npm run build` clean · `npm audit` 0.

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema (registry is code), no secret.

## A seasonality note
Orchard offerings shift year to year more than a rink's warming house does (a farm
can drop u-pick a given season). `verifiedAt` is 2026-08-17; worth a light re-check
next August before peak season. The facts chosen (u-pick, patch, maze, cider donuts)
are the most stable, signature offerings, not one-off event details.

## Follow-ups
- **Beaches (45): lifeguarded** — still deferred (safety-sensitive + volatile).
- **Eagan CC pool** entry review — still open (spun off separately).

## Rollback
`git revert`. All four fields are optional; reverting removes the orchard badges +
filters, leaving the other seven kinds' details intact.
