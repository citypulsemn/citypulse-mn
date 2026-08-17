# Deploy — Winning detail (moat), the thin tail: garden features

*Aug 17, 2026. The moat's last kind (13th) — a deliberately lean pass, since gardens
are 9 one-off destinations where facts are sparse. Badges the two that genuinely
distinguish them: an indoor conservatory (weather-proof winter draw) and a themed
cultural garden. Reuses the detail layer; no new UI.*

## What it badges
`conservatory` (an indoor glasshouse open year-round) · `culturalGarden` (a
Japanese/Chinese/etc. themed garden) — new fields on `PlaceDetails`
([lib/places.ts](../../lib/places.ts)). "Free" skipped (8 of 9 are free; cost is
already filterable).

## How it was verified (honesty first)
One research agent checked all 9 against their official sites, `yes → badge`,
`unknown → no badge`:
- **`conservatory` 2/9** — the Arboretum (Meyer-Deats Conservatory) and Marjorie
  McNeely (the Como glasshouse / Sunken Garden under glass).
- **`culturalGarden` 4/9** — those two (each contains a Japanese garden) plus
  Normandale Japanese Garden and the St. Paul–Changsha China Friendship Garden.
- **5 carry no badge** — the outdoor formal / native display gardens (Eloise Butler,
  Lyndale, Noerenberg, Longfellow, Cowles). Honest emptiness.

## The audit catch
**Cowles Conservatory** is literally *named* a conservatory and was tagged one — but
its official Minneapolis Parks page says the 2016–17 renovation made it an **open-air
pavilion**, not an enclosed glasshouse. So it correctly gets **no** conservatory
badge. A name is not a source; the page is.

## Verification (observed, not intended)
- **Tests +3** (1182 total): count locks (2 / 4); the Cowles audit (named a
  conservatory, not badged one); the two conservatories are exactly Arboretum +
  McNeely.
- Gate: `tsc` clean · 1182/1182 · `npm run build` clean · `npm audit` 0.
- *Live DOM check skipped this once given the mid-task redirect — the render path is
  identical to the 12 kinds verified live earlier this session (badges + filters via
  the same `PlacesList`/`PlacesBrowser`), and the build prerenders `/places/garden`
  clean. Low risk; flagged for honesty.*

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema, no secret.

## Note
This is the moat's thin tail (2 + 4 across 9). The two facts still split the gardens
usefully — indoor-in-winter vs cultural destination vs plain outdoor display — and
the Cowles catch alone justified the honesty pass. The moat is now complete across
the 13 kinds where curated facts differentiate.

## Rollback
`git revert`. Both fields are optional and garden-only; reverting removes them.
