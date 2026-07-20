# Deploy Guide — Roadmap 1.3: Text Search

Adds a live search box that narrows the **calendar dots, map pins, and day lists** simultaneously as you type — across event titles, venues, cities, and descriptions. Composes with the category chips and range presets (everything ANDs together).

**Code-only** update: no database migration, no new environment variables, no new dependencies, pipeline untouched.

---

## What you're deploying

- **A search box** in the controls area (rounded field, magnifier icon, gold focus ring, ✕ clear button, ESC-to-clear).
- **Live, accent- and case-insensitive matching** across title / venue / city / description. "café" matches "cafe"; "como" matches "Como Park"; multi-word queries require every word to appear.
- **All three surfaces narrow at once** — calendar, map, and the day panel — because search filters the shared event set before the category/window filters apply.
- **A match-count whisper** ("14 events match this range") and an **empty state** ("No matches for 'x' — clear search") with one-tap clear.
- **Snappy input** via React's `useDeferredValue` — typing never lags even with the full event set.
- **A search-analytics seam** (`lib/track.ts`) that no-ops today and will light up in roadmap 1.4 to log search terms (your demand-research data).

## Quality bar (all green)
- 111 automated tests pass (13 new, covering the matcher: title/venue/city/description hits, case-folding, accent-folding both directions, substring match, multi-word AND, empty/punctuation queries, and no-match).
- Typecheck clean, production build clean, **0 npm vulnerabilities**.
- Smoke test confirmed the homepage server-renders the search UI.

---

## Deploy steps (~5 minutes + Vercel build)

1. **Sync the code.** Unzip the new `citypulse-mn.zip`, copy its contents over your project folder, choosing **Replace**. Your `.env.local`, `node_modules`, and Git history are untouched.

   New files to confirm: `lib/search.ts`, `lib/track.ts`, `components/SearchBox.tsx`, `docs/SEARCH.md`.

2. **Push.** GitHub Desktop → commit (`Live text search (roadmap 1.3)`) → **Push origin**.

3. **Vercel auto-redeploys.** Watch **Deployments** until green.

4. **Nothing else** — no Supabase step, no env vars.

---

## Verify on the live site

- [ ] A search box appears above the filters on citypulsemn.com.
- [ ] Type **como** → the calendar dots (and, in Map view, the pins) narrow to matching events; the whisper shows a match count.
- [ ] Type a venue like **first avenue** → only that venue's events remain.
- [ ] Type something with no matches → the "No matches for 'x'" line appears with a **clear search** link.
- [ ] Press **Esc** in the box (or tap ✕) → search clears and everything returns.
- [ ] Combine with a category chip (e.g. turn off all but Music) and a preset (This Weekend) → results are the intersection.
- [ ] On your phone, the box is full-width and the keyboard shows a "search" action.

---

## Notes

- **Search is client-side** — instant, no backend calls. It's comfortable to ~2–3k live events. When volume crosses that, `docs/SEARCH.md` documents the exact Postgres full-text-search upgrade (a generated `tsvector` column + GIN index + a `q` param on the read boundary). Don't build it before it's needed.
- **Analytics:** search terms flow through `lib/track.ts`, which is intentionally a no-op until roadmap 1.4. No behavior change now; 1.4 swaps the internals and the search logging starts working automatically.

## Rollback
GitHub Desktop can undo the commit, or Vercel → **Deployments** → roll back in one click. No database or env change means rollback is instant and total.

---

## What's next on the roadmap
Per the execution order: **2.5 Price/Area filters** pairs naturally with search (both are cheap client-side UX wins and 2.5 unblocks Collections), then **1.4 Analytics + 1.6 RLS**, then the **1.5 Admin panel**.
