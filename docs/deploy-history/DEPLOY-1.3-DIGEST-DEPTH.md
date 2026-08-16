# Deploy 1.3 — Digest depth (place of the week + most saved)

*Aug 16, 2026. Roadmap v6 Tier 1.3. Two cheap, high-warmth additions to the one
weekly email that is the retention asset: an evergreen **Place of the week** that
also drops the Places SEO surface into the inbox, and honest reader social proof,
**Most saved this week**. Both follow the R2.1 sponsor-slot pattern — global (same
for every recipient), rendered from pure helpers, and dark by honest emptiness
rather than a placeholder.*

## Why this item, now
The rebaseline (Aug 16) found the whole growth/repair spine already shipped
(F2.4, F2.3, F1.2, winter Places, egress). 1.3 was the top genuinely-unbuilt
Tier-1 item, no dependencies, finishable in a session. With subscribers the
binding constraint (~5), **retention matters as much as acquisition**, and "place
of the week" closes the discovery→retention flywheel by promoting the SEO-earning
Places pages *inside* the email.

## What shipped

**Place of the week** — `placeOfTheWeek(now)` in [lib/places.ts](../../lib/places.ts):
- Pure. Picks one registry entry, **rotating weekly and tied to the season**: the
  candidate pool is the places `openNow` (Chicago frame), preferring the ones
  actively in season (a sledding hill in January, a splash pad in July) and
  falling back to the year-round evergreens (museums, indoor playgrounds) in
  shoulder months when nothing seasonal is open — so the pick is always something
  a reader could actually go do this week.
- **Deterministic** from `now` — a Chicago-anchored week index, no `Date.now()`/
  `Math.random()` (tests are stable; two sends in the same week agree). The
  epoch-week boundary lands on Thursday = the digest's send day, so each weekly
  send advances the rotation by one.
- **Manual override**: `PLACE_OF_WEEK_PIN` (a slug, null by default) hand-picks the
  week's place — Taren's voice wins, an off-season pin is honored. Mirrors
  `DIGEST_SPONSOR`; null = automatic, no toil.
- Renders (in [lib/digest.ts](../../lib/digest.ts)) a warm card — kind + city, the
  place's house-voice `intro`, and a UTM'd deep link into `/places/[kind]#slug`.

**Most saved this week** — honest reader social proof:
- `getMostSavedCounts(days)` in [lib/stats.ts](../../lib/stats.ts) — a never-break
  read (`[]` on any failure) mirroring `getTicketClicksByVendor`. Saves are
  recorded **only** inside the server action (the public beacon rejects `save`),
  so this is uninflatable.
- `selectMostSaved(counts, byId)` in [lib/digest.ts](../../lib/digest.ts) — pure,
  golden-tested. Applies a **privacy/noise floor** (`MOST_SAVED_MIN = 3` saves) so
  the block never surfaces a single identifiable person's save or statistical
  noise, resolves ids against the current published set (a saved-then-archived or
  past event is silently dropped — never featured stale), highest first, capped at 3.
- **Dark today by design**: saves run ~1/week, below the floor, so the section
  renders nothing right now and lights up as UX3's save-from-anywhere lifts the
  number. Honest emptiness, per the v6 spec.

**Wiring** ([lib/digest-send.ts](../../lib/digest-send.ts)): both are computed
**once** (they're identical for everyone), not per-message. Place-of-the-week is
pure; most-saved is wrapped in its own try/catch — an outage or thin data omits
the section, never costs anyone their email. Placed between the main picks and the
"See everything" CTA, in both the HTML and plain-text parts.

## Verification (observed, not intended)

- **Rendered a real sample** (`npx tsx` harness): today's auto-pick was **Parque
  Castillo Splash Pad** (splash-pad, St. Paul) — seasonally correct for August —
  deep-linking to `/places/splash-pad#parque-castillo-splash-pad`. Text layout:
  picks → Most saved → Place of the week → CTA. HTML card reuses the proven
  navy-card/gold-border/cream-text markup (identical to the sponsor slot).
- **Tests +18** (1066 total, all green): `placeOfTheWeek` — always returns a real
  place, only ever an open one, prefers seasonal in July/January, deterministic
  within a week, rotates across weeks; `selectMostSaved` — floor boundary
  (exactly `MOST_SAVED_MIN` kept, one below dropped), ordering, stale-id drop,
  cap-at-3, honest emptiness; render helpers — html/text content, escaping, and
  the `renderDigestEmail` integration (sections present when provided, absent by
  default).
- Gate: `tsc --noEmit` clean · 1066/1066 · `npm run build` clean · `npm audit` 0.

## Deploy steps
1. Merge to `main` — **no schema change, no new secret, no config**. Vercel
   auto-deploys, but the digest is a GitHub Actions job, not a page.
2. It goes live on the **next weekly digest send** (Thursday 15:00 UTC). To preview
   before then: **Actions → Weekly Email Digest → Run workflow → dry run = true**,
   and check the logged subject/first-message — or eyeball the sample HTML sent in
   chat.
3. Optional: to hand-pick a week's place, set `PLACE_OF_WEEK_PIN` to a slug in
   `lib/places.ts` and push (reverts to auto when set back to `null`).

## Verify checklist (after the first real send)
- The email carries a "Place of the week" card with a real, in-season place and a
  working `/places/[kind]#slug` link.
- "Most saved this week" is **absent** (correct — saves are below the floor). It
  will appear once a week accumulates ≥3 saves on one event.

## Rollback
`git revert`. Both sections are additive and gated on optional `renderDigestEmail`
args; reverting simply stops passing them and the email returns to its prior shape.
No data or schema to undo.
