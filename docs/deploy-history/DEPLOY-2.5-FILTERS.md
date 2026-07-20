# Deploy Guide — Roadmap 2.5: Price & Area Filters

Adds a collapsible **Filters** panel so people can narrow events by **price** (Free / $ / $$ / $$$) and **metro area** (Minneapolis, St. Paul, North/South/East/West suburbs, Elsewhere). Everything composes as **AND** with search, category chips, and the range presets, and narrows the calendar, map, and day lists together.

**Code-only** update: no database migration, no environment variables, no dependencies.

---

## What you're deploying

- A **Filters** toggle (with an active-count badge) under the category chips, revealing:
  - **Price** pills: Free, $, $$, $$$
  - **Area** pills: Minneapolis, St. Paul, North / South / East / West metro, Elsewhere
- Filters compose with everything else (search + categories + presets), all ANDing, and update every surface at once.
- The match-count whisper and empty state now cover filters too, with a single **clear all**.
- Toggling a filter fires `price_toggle` / `area_toggle` analytics events (visible in your Vercel custom-events breakdown — useful signal for the Collections feature later).

Full reference: `docs/FILTERS.md`.

## Quality bar (all green)
- 170 automated tests pass (13 new: city→area mapping incl. Saint/St folding and the "Elsewhere" fallback, and the price/area predicates composing as AND).
- Typecheck clean, production build clean, **0 npm vulnerabilities**.
- Smoke test confirmed the homepage renders with the Filters control and no regressions (search + footer intact).

---

## Deploy steps (~5 minutes + Vercel build)

1. **Sync the code.** Unzip the new `citypulse-mn.zip`, copy contents over your project (**Replace**). Your `.env.local`, `node_modules`, and Git history are untouched.

   New files to confirm: `lib/areas.ts`, `lib/filters.ts`, `components/FilterPanel.tsx`.

2. **Push.** GitHub Desktop → commit (`Price & area filters (roadmap 2.5)`) → **Push origin**.

3. **Vercel auto-redeploys.** Watch **Deployments** until green.

4. **Nothing else** — no Supabase step, no env vars.

---

## Verify on the live site

- [ ] On the homepage, tap **Filters** under the category chips → the Price and Area pills appear.
- [ ] Tap **Free** → the calendar/map narrows to free events; the count whisper updates.
- [ ] Tap an area like **West metro** → results narrow to that area (Plymouth, Edina, Minnetonka, etc.).
- [ ] Combine a price + an area + a category chip + This Weekend → results are the intersection of all of them.
- [ ] With filters that match nothing, you get "No events match these filters · **clear all**", and clear-all resets search + filters.
- [ ] The Filters button shows a small count badge when filters are active.

---

## Notes

- **Client-side and instant** — no backend calls, no layout shift.
- **Area mapping** is a metro city list (~90 cities) in `lib/areas.ts`. If you notice a city landing in "Elsewhere" that should be in a compass bucket, add it to `CITY_AREA` there. A lat/lng fallback (assign area by coordinates) is a natural future enhancement.
- This **unblocks 2.4 Collections** — a Collection is essentially a saved filter combination.

## Rollback
GitHub Desktop can undo the commit, or Vercel → **Deployments** → roll back in one click. No database or env change means rollback is instant.

---

## What's next on the roadmap
With filters in place, **Phase 2 (audience)** is largely done: content generator, email capture, add-to-calendar, and now filters. Natural next steps: **2.4 Collections** (curated/saved filter views — now unblocked), or move into **Phase 3 (community)** and the **weekly email digest** that your 2.2 subscriber list is built to feed.
