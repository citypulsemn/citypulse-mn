# Deploy — Winning detail (moat), three kinds at once: pools · dog parks · playgrounds

*Aug 17, 2026. A batch expansion of the verified-detail moat across three more
kinds (98 places), each with the facts its visitors actually decide on. Reuses the
whole layer — `PlaceDetails`, the gold ✓ badges, the per-kind filter chips, the
reactive map — so no per-kind UI was written.*

## What each kind badges
- **Pools (25):** `indoor` (reuses the shared field), `waterSlide`, `zeroDepth`
  (zero-depth / beach entry — the "safe for little kids" fact).
- **Dog parks (58):** `fenced` (the off-leash safety decision), `smallDogArea`
  (a separate small-/shy-dog enclosure).
- **Playgrounds (15):** `fenced` (fully enclosed — toddler-runner safety),
  `restrooms` (reuses the shared field).

New schema fields: `waterSlide`, `zeroDepth`, `fenced`, `smallDogArea`
([lib/places.ts](../../lib/places.ts)). `indoor`/`restrooms` reused across kinds.

## How it was verified (honesty first)
Five background research agents (pools ×1, playgrounds ×1, dog parks ×3) checked
each place against its official page, with one fallback search where a page 403'd
or was thin. Strict verdicts — `yes → badge`, `unknown → no badge`:
- **Pools:** water slide 22 · zero-depth 20 · indoor 6 (indoor **verified from the
  page, not derived** from season).
- **Dog parks:** fenced 45 · small-dog area 31. **`fenced` was held to a high bar** —
  Twin Cities has many *large unfenced* off-leash trail/prairie areas; those get no
  fenced badge. 8 parks carry no badge (e.g. Crow-Hassan "40-acre unfenced", Meeker
  Island "no fence surrounding the park").
- **Playgrounds:** fenced **1** · restrooms 10. Fully-fenced playgrounds are rare
  and rarely documented; only Teddy Bear Park (Stillwater) is source-confirmed
  enclosed. One true badge that answers a real question ("which one is fenced?").
- **14 places carry no badge at all** (nothing confirmable) — the correct honest
  state.

## The tag audit — 8 corrections
Re-verifying against sources (rather than trusting the old hand tags) caught 8
mismatches, including a **wrong-direction** one:
- **Arlington-Arkwright** (St. Paul) was tagged *unfenced* but the official page
  says "completely enclosed" → now correctly **fenced**.
- Fish Lake, Bloomington Nesbitt, Southbridge: `fenced` tags **not** confirmed
  (partial/large open sites) → no fenced badge.
- Chaska Lions: `small-dog-area` tag unsupported (two fenced zones differ by size,
  not by dog size) → no badge.
- Madison's Place, Hamlet (playgrounds): `fenced` tags unconfirmed → no badge.

## A data-integrity flag (surfaced, not acted on)
**Eagan Community Center pool** — its official page lists *no swimming pool* (fitness
/ gym / indoor playground only); the agent couldn't verify a pool exists there. It
carries no badges, and the entry itself is flagged for review. Per policy we
**archive, never delete**, so no change was made here — Taren's call.

## Verification (observed, not intended)
- **Live browser** (DOM-driven): `/places/pool` → Indoor 6 · Water slide 22 ·
  Zero-depth 20; `/places/dog-park` → Fenced 45 · Small-dog area 31, Fenced filter
  → 45 of 58; `/places/playground` → Fenced 1 · Restrooms 10. Console clean.
- **Tests +11** (1138 total): per-kind count locks, "fenced never on a big unfenced
  trail area", the Arlington audit fix, the single fenced playground, and that each
  kind's details use only its allowed keys (no cross-kind leakage).
- Gate: `tsc` clean · 1138/1138 · `npm run build` clean · `npm audit` 0.

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema (registry is code), no secret.

## Follow-ups
- **Eagan CC pool** — verify the pool exists / correct or archive the entry.
- **Beaches (45): lifeguarded** — still deferred (safety-sensitive + volatile).
- Consider a `smallDogArea` re-check on the 4 Ramsey County parks (confirmed via a
  county-wide "all parks have small-dog areas" statement rather than a per-park line).

## Rollback
`git revert`. All new fields are optional; reverting removes the pool/dog/playground
badges + filters, leaving ski / rink / splash-pad details intact.
