# Deploy — Winning detail (moat): indoor-playground visit-prep facts

*Aug 17, 2026. Timed for the indoor-play season. Badges the three things a parent
decides and preps on before going: a separate toddler area, an on-site café, and
whether grip socks are required. Reuses the whole detail layer; no new UI.*

## What it badges
`toddlerArea` (a separate toddler/infant zone) · `cafe` (on-site café) ·
`socksRequired` (grip socks required — bring them) — new fields on `PlaceDetails`
([lib/places.ts](../../lib/places.ts)). `socksRequired` is shared with the
trampoline/climbing kind.

## How it was verified (honesty first)
One research agent checked all 13 against their official sites (fallback search on
403s), `yes → badge`, `unknown → no badge`:
- **`toddlerArea` 8/13** — only where a source names a *separate* under-3 zone
  (Wild Things' "Little Wild Ones", Adventure Peak's "Little Peak", InnerActive's
  Toddler + Infant zones, etc.). "Fun for all ages" alone did not qualify.
- **`cafe` 3/13 — held to a real café.** The agent found three venues whose only
  food is **vending machines** (Good Times, both InnerActive). A "✓ Café" badge
  implies a staffed counter, so vending-only was **excluded** — the same honesty
  call as dropping "rentals" when tubes were merely provided. The three that earn
  it: Adventure Peak ("Peak Cafe") and the two play-cafés (Sovereign Grounds,
  Rebe's).
- **`socksRequired` 10/13** — where the site states socks/grip socks are required.
- **Good Times** carries no badge (toddler + socks unconfirmed, café was vending) —
  honest emptiness.

## Verification (observed, not intended)
- **Live browser** (`/places/indoor-playground`, DOM-driven): badges Toddler area 8
  · Café 3 · Socks required 10; three filter chips. Console clean.
- **Tests +4** (1150 total): count locks; a guard that vending-only venues never get
  the café badge (and the three real cafés are exactly right); filter order; keys
  guard.
- Gate: `tsc` clean · 1150/1150 · `npm run build` clean · `npm audit` 0.

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema (registry is code), no secret.

## Rollback
`git revert`. All three fields are optional; reverting removes the badges + filters.
(`socksRequired` is also used by trampoline/climbing — revert that kind separately.)
