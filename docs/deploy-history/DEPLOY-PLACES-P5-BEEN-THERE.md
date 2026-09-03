# Deploy Places P5 — "Been there": the place checklist

*3 September 2026. Spec: `docs/ROADMAP-PLACES.md` P5 (Taren's idea; built as
recommended — the word is "Been there", every kind shows the progress line, the
check-off nudge does not mention the digest). Roadmap v6 Tier 1.5.*

## What shipped

- **A "Been there" check on every place** — a compact pill on each kind-page
  row ([PlacesList](../../components/PlacesList.tsx)) and a button in the
  header of every detail page ([VisitButton](../../components/VisitButton.tsx)).
  Same shape as the save button: pressed-state button, optimistic flip,
  revert on failure, broadcast (`citypulse:visit`) only after the write lands.
- **The progress line on kind pages** ([PlaceProgress](../../components/PlaceProgress.tsx)):
  "Been to 3 of the 11 sledding hills on our list" with a thin gold bar.
  **Nothing at zero** — no empty bar, no "0 of 50".
- **Honest denominators.** `KIND_COVERAGE` in [lib/places.ts](../../lib/places.ts)
  declares each kind `exhaustive` (a documented metro-wide sweep → "of 50
  splash pads in the metro") or `curated` (a pick → "of the 22 parks on our
  list"). Conservative by default: only kinds whose registry header says
  "exhaustive"/"metro-wide" get the stronger wording (beaches, splash pads,
  pools, golf, farmers markets, nature centers, gardens, museums, orchards,
  ski hills). Disc golf and dog parks stay `curated` — their headers say the
  set is partial. The line is built in [lib/place-progress.ts](../../lib/place-progress.ts)
  and golden-tested; the number on the page is never hand-typed.
- **"Been there / Not yet" filter chips** on kind pages — only once something
  is checked (a visitor with none never sees an empty axis). `filterPlaces`
  gained an optional `been` axis + visited set, pure and tested.
- **"Places you've been" on `/saved`** ([VisitedPlaces](../../components/VisitedPlaces.tsx)):
  per kind, the progress line and the places as links; most-complete kind
  first; omitted entirely at zero. The keep-list form now shows when either
  list is non-empty, and its copy mentions places.
- **One identity, one link.** `place_visits` keys on the same `user_token` as
  `saved_events`. Both merge points in [lib/saved-restore.ts](../../lib/saved-restore.ts)
  (merge-on-request R2.7, merge-on-restore R0.4) now copy `place_visits`
  alongside `saved_events`; the restore email says the link carries places too.
- **A one-time check-off nudge** ([FirstVisitNudge](../../components/FirstVisitNudge.tsx),
  mounted globally): same dismissible bottom strip as the save nudge, its own
  dismissal key, appears only on a check (never an uncheck), points at `/saved`.
- **Copy in one place:** `PLACE_VISIT_COPY` in [lib/editorial.ts](../../lib/editorial.ts).
  `button` is THE word — rename it there and it changes on every check, the
  chips, and the saved section. **`TODO(taren)`: read the eight strings and
  make them yours.**

## Design decisions (why)

- **Static pages stay static.** The kind page keeps `revalidate = 3600`, the
  detail page keeps `revalidate = false` / `dynamicParams = false` (the 26 Aug
  CPU fix). Neither reads the cookie. State hydrates in the browser through
  **one shared store** ([useVisited](../../components/useVisited.ts)) — one
  `/api/visited` fetch per page however many rows (a golf page has 86), and a
  live update on every toggle. **No cookie → `[]` with zero DB reads**, so
  crawlers and first-time visitors cost nothing. `places-static.test.ts` now
  tripwires the no-cookie rule on all three page files.
- **No foreign key.** The registry is code, so `lib/place-visits.ts` accepts
  only slugs that resolve in it (`isValidPlaceSlug`, the analog of
  `isValidUuid`), and a slug that later leaves the registry is simply not
  counted — never an error, never a ghost row. `VISITS_CAP = 1000` sits above
  the 522-entry registry so a full sweep can finish (drift-guarded).
- **Never-break (ENGINEERING rule 1).** Observed during verification: with the
  table not yet applied, `/saved` 500'd on the visits query. Fixed —
  `getVisitedSlugsSafe` logs and returns `[]`, so `/saved` and `/api/visited`
  render as they did before P5 if the read fails. Tripwired.
- **Quiet by design.** No streaks, badges, confetti, or a new header count (the
  ♥ badge stays events-only — tripwired). One `SubscribeBand` per page,
  unchanged (`subscribe-placement.test.ts` still green).
- **`KIND_COVERAGE` is a sibling Record, not a field on `KindMeta`** (a small
  deviation from the spec): the `Record<PlaceKind, …>` type makes a missing
  kind a compile error, which is a stronger drift guard than a test, and it
  keeps the 19 `KIND_META` lines untouched.

## Verification (observed, not intended)

Quality gate: `npx tsc --noEmit` clean · `npm test` **1880 passed (113 files)**,
+31 tests · `npm run build` clean — **522 place detail pages static,
`revalidate: false` in the prerender manifest, 20 kind pages** · `npm audit`
**0 vulnerabilities**. (`npm run lint` opens an interactive ESLint setup prompt
— pre-existing: the repo has no ESLint config; not touched here.)

**Schema + store + RLS, against real Postgres (PGlite, offline):** the P5 block
applies twice without error (idempotent); columns as designed; RLS enabled;
policy `place_visits_owner` for all commands. The store's queries verbatim:
mark is idempotent, count/is-visited/newest-first/unmark all correct; the
restore merge folds one token's rows into another. Under a non-owner role: no
token → 0 rows visible; the visitor's own token → own rows only, 0 of another
visitor's; cross-user delete → 0 affected; an insert impersonating another
token → **refused by the policy's WITH CHECK**; the owner still sees all rows.
Reproduce in Supabase with [`db/verify-rls-visits.sql`](../../db/verify-rls-visits.sql).

**Dev server (Browser pane), `/places/sledding` mobile + desktop:**
- Cold: 11 compact "Been there" buttons, one per row; **no progress line, no
  chips** at zero; no console errors; `/api/visited` → 200.
- Checked state (driven through the store's broadcast, since the table isn't
  in the DB the dev server points at — see below): "**Been to 3 of the 11
  sledding hills on our list**" + bar appears under the header; three buttons
  read "Been there — tap to undo"; three rows get the filled gold ordinal; the
  chips appear; **Not yet → "8 of 11"** (8 rows), **✓ Been there → "3 of 11"**
  (3 rows, all `.visited`), Clear → "11 of 11"; the check-off nudge strip
  appeared once with the keep-list link and dismissed.
- Detail page `/places/sledding/battle-creek-sledding-hill`: one "Been there"
  button in the header line after Directions; page unchanged otherwise.
- `/saved` with a cookie and **no table**: renders normally ("Nothing saved
  yet", no places section, no keep-list form) and the server log shows the
  wrapped `[place-visits] read failed` line — the rule-1 fix, observed.
- Clicking a check with no table: server action 500s, the button **reverts**
  to unchecked (the failure path works).

**Not observed, and why:** the end-to-end write (tap → row in `place_visits`
→ reload shows it checked → `/saved` lists it → keep-list link restores it on
another device). The dev server points at the production database and
creating the table there was blocked by the session's permission policy, so
that path is deploy step 1 + the verify checklist below. The SQL itself and
the store queries are verified against real Postgres above.

## Deploy (in order)

1. **Schema first.** In the Supabase SQL editor paste the block at the end of
   [`db/schema.sql`](../../db/schema.sql) under `-- ── Place visits (Places P5`
   (or `psql "$DATABASE_URL" -f db/schema.sql` — the whole file is idempotent).
   Confirm: Table editor → `place_visits` exists with the RLS shield on.
   *Until this runs, the site keeps working exactly as before P5 (rule 1), but
   every check-off tap reverts.*
2. `git push` → Vercel auto-deploys. No new env vars.
3. **Verify on your phone (the real path):**
   - `/places/splash-pad` → no progress line → tap "Been there" on a row → it
     fills, "Been to 1 of 50 splash pads in the metro" appears, the ♥ header
     count does **not** change, the nudge strip appears once.
   - Reload → still checked (the row came back from the table).
   - Open that place's detail page → button shows checked; the response is a
     CDN `HIT` (Vercel → Deployments → Functions: no invocation for the page).
   - `/saved` → "Places you've been" with the line and the link; keep-list form
     present → email yourself the link → open it in a private window → the
     check-off is there.
   - `curl -s https://citypulsemn.com/api/visited` (no cookie) → `{"slugs":[]}`.
   - Optional: run `db/verify-rls-visits.sql` in the SQL editor.
4. `TODO(taren)`: the eight strings in `PLACE_VISIT_COPY`.

## Rollback

Revert the commit. The table is additive and inert without the code — leave it.

## Files

New: `lib/place-progress.ts` · `lib/place-visits.ts` · `lib/place-visit-actions.ts`
· `app/api/visited/route.ts` · `components/useVisited.ts` · `VisitButton.tsx` ·
`PlaceProgress.tsx` · `FirstVisitNudge.tsx` · `VisitedPlaces.tsx` ·
`db/verify-rls-visits.sql` · tests `place-progress` · `place-visits` · `been-there`.
Changed: `db/schema.sql` · `lib/places.ts` (`KIND_COVERAGE`, `been` filter) ·
`lib/editorial.ts` · `lib/saved-restore.ts` · `components/PlacesList.tsx` ·
`PlacesBrowser.tsx` · `KeepListForm.tsx` · `app/places/[kind]/page.tsx` ·
`app/places/[kind]/[slug]/page.tsx` · `app/saved/page.tsx` · `app/layout.tsx` ·
`app/globals.css` · tests `places-static` · `saved-restore-queries` · docs
`PLACES.md` · `SAVED.md` · `ROADMAP-PLACES.md` (spec) · `ROADMAP-v6.md` (1.5).
