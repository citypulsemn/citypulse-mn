# Deploy — Winning detail (moat): trampoline / ninja / climbing activity badges

*Aug 17, 2026. This kind lumps three different venue types together — trampoline
parks, ninja gyms, and rock-climbing gyms — so the highest-value badge is the
activity itself: "what kind of place is this?" is the primary decision. Reuses the
detail layer (and the `socksRequired` field from indoor playgrounds); no new UI.*

## What it badges
`trampolines` · `ninjaCourse` · `rockClimbing` (new fields) + reused
`socksRequired` ([lib/places.ts](../../lib/places.ts)). A venue can carry several
(Urban Air is all of trampolines + ninja + climbing).

## How it was verified (honesty first)
One research agent checked all 17 against their official sites, `yes → badge`,
`unknown → no badge`:
- **`trampolines` 8/17** — the trampoline parks (Sky Zone ×4, Urban Air ×3, Zero
  Gravity). The pure climbing/ninja gyms correctly get none.
- **`ninjaCourse` 10/17** — Sky Zone + Urban Air warrior courses + the dedicated
  ninja gyms (Obstacle Academy, Conquer ×2). **Zero Gravity was held back** — its
  site lists only a "Sky Walker Net Course" (an aerial net course), not a ninja
  course, so no badge (its old `ninja-course` tag was not confirmed).
- **`rockClimbing` 10/17** — the climbing gyms (Vertical Endeavors ×4, Bouldering
  Project ×2) plus the venues with climbing walls (Urban Air ×3, Sky Zone Maple
  Grove). Sky Zone locations without a confirmed wall get none.
- **`socksRequired` 8/17** — the trampoline parks require grip socks; the climbing
  gyms want climbing *shoes*, not grip socks, so they correctly get no socks badge.
- **Every one of the 17 carries at least one activity badge** — the kind is fully
  differentiated (a bouldering gym reads climbing-only; a Sky Zone reads
  trampolines + ninja + socks).

## Verification (observed, not intended)
- **Live browser** (`/places/trampoline-climbing`, DOM-driven): badges Trampolines
  8 · Ninja course 10 · Rock climbing 10 · Socks required 8; four filter chips;
  Rock-climbing filter → 10 of 17. Console clean.
  - *(A dev-server stale-chunk 500 appeared mid-verify — a `.next` HMR cache glitch,
    not code; cleared by restarting the dev server. Production `npm run build` was
    clean throughout.)*
- **Tests +4** (1154 total): activity count locks; a bouldering gym reads
  climbing-only (no trampolines/ninja/socks); every venue carries ≥1 badge; filter
  order.
- Gate: `tsc` clean · 1154/1154 · `npm run build` clean · `npm audit` 0.

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema (registry is code), no secret.

## Rollback
`git revert`. `trampolines`/`ninjaCourse`/`rockClimbing` are optional; reverting
removes them and the badges/filters. `socksRequired` is shared with indoor
playgrounds — this revert leaves that kind's socks badges intact.
