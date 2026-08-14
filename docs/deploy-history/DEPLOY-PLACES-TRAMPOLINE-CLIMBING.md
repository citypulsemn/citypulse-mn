# Deploy — Places: Trampoline & Climbing Gyms (a new kind, 0 → 17)

*Roadmap v6 Tier 1.2 (compounding Places SEO — the winter kinds). Aug 14, 2026.*

## What shipped

A new Places kind — **`trampoline-climbing`** — with **17 verified entries** across
the metro, live at `/places/trampoline-climbing`. Indoor active gyms for burning off
a Minnesota winter: trampoline parks, standalone ninja gyms, and rock-climbing /
bouldering gyms. The fourth of the winter build wave (after indoor playgrounds,
neighborhood rinks, and ski/tubing).

- **Kind:** `trampoline-climbing`, label "Trampoline & Climbing Gym", plural
  "Trampoline & Climbing Gyms". `YEAR_ROUND` (indoor), all paid.
- **17 entries, type mix 8 trampoline · 3 ninja · 6 climbing:**
  - *Trampoline:* Sky Zone ×4 (Edina, Maple Grove, Eagan, St. Paul/Oakdale), Urban
    Air ×3 (Apple Valley, Plymouth, Coon Rapids), Zero Gravity (Mounds View).
  - *Ninja:* Obstacle Academy (Eden Prairie), Conquer Ninja ×2 (Blaine, Woodbury).
  - *Climbing:* Vertical Endeavors ×4 (Minneapolis, St. Paul, Twin Cities
    Bouldering, Bloomington), Bouldering Project ×2 (Minneapolis, St. Paul).

## Design decisions

- **One combined kind, not three.** The roadmap grouped trampoline / ninja /
  climbing as a single guide, and the ≥8-entries rule favors one robust kind (17)
  over three thin ones. The `KIND_META` blurb and intro carry the full scope
  ("trampoline parks, ninja gyms, and rock-climbing walls") so the ninja and
  climbing entries read honestly under the label. *If Taren would rather split
  climbing into its own kind later, the data is tagged by type and splits cleanly.*
- **Chain locations are separate entries.** Each Sky Zone / Urban Air / Vertical
  Endeavors / Bouldering Project site is its own entry with its own address and
  page URL — that's what a directory is for, and each was verified individually.
- **`YEAR_ROUND`, all paid.** These are indoor and open all year (the demand peaks
  Dec–March, carried by the intro copy, not a closed banner). All sell jump time /
  day passes / memberships.
- **Scope kept clean.** Excluded per the kind's rules and the research's checks:
  climbing walls inside fitness clubs / YMCAs / college rec centers, members-only
  co-ops, retail-store walls, and FECs whose main draw is laser-tag/arcade. Two
  closed/rebranded spots were caught and excluded (**Sky Zone Plymouth** → now Urban
  Air; **Rockin' Jump Eagan** → now Sky Zone Eagan) — old directory pages still list
  the dead ones.
- **Honest sourcing.** Every entry verified against the operator's own current page.
  One URL (Sky Zone's Oakdale/"St. Paul" location) wasn't cleanly captured by the
  research, so it was confirmed by hand — `https://www.skyzone.com/stpaul/` returns
  200. Prices were kept qualitative ("paid," with ballpark model in the intro) — the
  research didn't read every operator's live 2026 price page, so no specific dollar
  figures were published unverified.

## Files

- `lib/places.ts` — `trampoline-climbing` added to the `PlaceKind` union +
  `KIND_META` (forced together by exhaustiveness), and the 17-entry block at the end
  of the `PLACES` registry.
- `lib/editorial.ts` — `PLACES_KIND_INTRO["trampoline-climbing"]` (house voice).
- `lib/__tests__/places.test.ts` — `"trampoline-climbing"` added to the
  `kindsWithPlaces` exact-list drift guard.
- **No route/sitemap/OG code** — all registry-driven.

## Verification (observed)

- `npx tsc --noEmit` — clean.
- `npm test` — **1010 passed**; `places.test.ts` 43/43 including the new drift-guard
  line, slug-uniqueness across all 17, metro bounding box, https sources, banned
  words, intro length.
- `npm run build` — clean; **41/41 static pages** (was 40 — the new
  `/places/trampoline-climbing` route prerenders via `generateStaticParams`).
- `npm audit` — **0 vulnerabilities**.
- **Live smoke:** `/places/trampoline-climbing` 200, title "Trampoline & Climbing
  Gyms in the Twin Cities, Mapped," h1 "Trampoline & Climbing Gyms," "**17** across
  the Twin Cities metro," 17-item list, all 17 present, intro copy live, canonical
  `https://www.citypulsemn.com/places/trampoline-climbing`. The `/places` index shows
  the new card (18 kind cards total).

## Deploy steps

1. Merge to `main` — Vercel auto-deploys. No schema/env change.
2. Confirm live: `https://www.citypulsemn.com/places/trampoline-climbing` (17
   entries) and the new card on `/places`.
3. The sitemap gains `/places/trampoline-climbing` automatically; Monday's ops-digest
   Index line ticks up by one URL.

## Post-ship ritual (ops, ~30 min, no code)

- Google Maps list mirror; one digest mention; one Instagram "mapped" slot.
- **Re-verify cadence:** evergreen → twice a year. This category churns (closures /
  rebrands are common — two caught this pass), so watch for it.

## Rollback

Pure additive code. Revert this commit to remove the kind (union member, `KIND_META`,
intro, entries, and the test line together). No migration.

## Follow-ups (not this item)

- **Prices:** if you want firm day-pass ballparks per entry, a follow-up pass can
  pull each operator's current pricing page.
- Next: the winter build wave is essentially complete (indoor playgrounds, rinks,
  ski/tubing, trampoline/climbing all shipped). Roadmap v6 Tier 1.2 continues with
  cross-linking + whatever Search Console demand data says to build next (the
  instrument outranks the demand-column judgment once ~4 weeks of per-guide data
  exists).
