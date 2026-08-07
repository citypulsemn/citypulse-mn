# Deploy UX11 — URL-addressable explorer state

*August 2026. UX roadmap item 11 — the final Tier-3 item, and the last item on
the UX roadmap. The homepage explorer's state now lives in the URL, so a reload,
a shared link, and the browser Back button all do what people expect.*

## The problem

The homepage explorer held everything in React state only: view, date range,
month, categories, price/area filters, the search query, and which day panel or
event modal was open. So:

- **Reload** dropped you back to the default month calendar.
- A **shared link** always opened the generic homepage, never "the map, filtered
  to free family events this weekend."
- **Back** left the site entirely — even with a modal open, so a shared event
  link's only exit was Back-off-the-site.

## What shipped

**1 — State ↔ URL, through a pure tested seam**
([lib/explorer-url.ts](../../lib/explorer-url.ts))

`serializeExplorer(state, defaults)` → a canonical query string (defaults
omitted, keys in a fixed order, commas left literal, price tiers mapped to digit
tokens so no `$` lands in the URL). `parseExplorer(search)` → validated fields,
with junk dropped rather than thrown on (a hand-mangled `?m=2026-13` or
`?cat=politics` degrades to defaults). Both are pure and golden-tested, including
a full round-trip.

Params: `view` · `range` · `m=YYYY-MM` · `cat=` · `price=` · `area=` · `q=` ·
`day=` · `event=`. Viewing the current month in the calendar keeps the URL clean
(everything equals a default).

**2 — History wiring in the explorer**
([EventsExplorer.tsx](../../components/EventsExplorer.tsx))

- On mount, initial state comes from (in precedence) **the URL**, then a **saved
  default view**, then the **mobile heuristic** (list + this-week under 820px).
- Every state change writes the URL. When the overlay **stack grows** (none→day,
  day→day+event) it `pushState`s a history entry so **Back peels exactly one
  layer**; everything else `replaceState`s, so typing and filtering never spam
  the Back button. Overlays are modal, so filters can't change under an open one
  — the two never race.
- A `popstate` handler re-derives the whole state from wherever Back/Forward
  landed. Uses `window.location` + the History API directly (no
  `useSearchParams`, so no Suspense-boundary requirement at build).

**3 — "Make this my default view"**

A quiet button under the date presets pins the current **view + range** to
`localStorage` (`cp_default_view`), restored on the next clean visit — for the
weekly-returning core who always want, say, the list on this week. Filters and
search stay transient by design. A URL with params always wins over it.

## Verification (observed, not intended)

Driven live in the dev browser:
- Changing the view wrote `?view=map`; loading
  `?view=map&range=today&cat=music,sports&q=jazz&price=0` **restored** Map view,
  the Today preset, the "jazz" search box, and the two-category selection (URL
  canonicalized to the fixed key order).
- Opening a day cell set `?day=2026-08-01` and **pushed** a history entry
  (`history.length` 5→6). **Back closed the panel and stayed on the site**
  (URL → clean, `stillOnSite: true`); **Forward reopened it**.
- "Make this my default" wrote `{"view":"calendar","range":"month"}` to
  localStorage and flipped to "✓ Your default view"; a fresh clean visit then
  opened on Calendar + This Month, **beating the mobile heuristic** (viewport
  width 0). No console errors.
- **Tests +15 (891/891):** `serializeExplorer`/`parseExplorer` goldens (default
  → empty string; category subset vs all; month-only-when-not-now; price
  digit-token mapping with no `$`; canonical key order; invalid-value dropping;
  a full round-trip) plus wiring tripwires (serialize/parse used, push-on-
  overlay-growth, popstate listener, the default-view button + localStorage key).
- **Gate:** `tsc` clean · 891/891 · `npm run build` clean · `npm audit` 0.

## Deploy steps

Push to `main`. New pure `lib/explorer-url.ts` + explorer wiring + a little CSS.
No schema, no env, no new deps.

## Verify checklist

- [ ] Filter the homepage (view/range/category/price/search) → the URL updates;
      reload → the same view comes back.
- [ ] Copy the URL to another tab → it opens to that exact filtered view.
- [ ] Open a day/event overlay → Back closes it and keeps you on the site; a
      second Back steps the filters, not off the site.
- [ ] "Make this my default" → reopen the site clean → it lands on that view.

## Rollback

`git revert`. `lib/explorer-url.ts` is pure and self-contained; the explorer
wiring is additive (URL read/write + one localStorage key) and reverts to the
prior in-memory-only behavior. Nothing else imports the new module.

---

*This completes the UX roadmap (docs/ROADMAP-UX.md), Tiers 1–3, UX1–UX11.*
*Two sub-items were intentionally deferred with reasons: a `/ongoing` + city
`FeedSubscribe` (needs a new feed kind, see DEPLOY-UX9) and a PWA "Install" chip
(its own capability item, see DEPLOY-UX10).*
