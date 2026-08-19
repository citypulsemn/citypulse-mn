# Deploy — The view toggle rides the shared header (Taren item 1)

*Aug 19, 2026. "When I click This Week / This Weekend or any of those top nav
buttons, the list/calendar/map slider disappears. Shouldn't that be persistent?"
It should. It does now, on the three events pages.*

## Root cause (diagnosed, not guessed)
The List/Calendar/Map buttons were never a site-wide control — they were three
plain `<button>`s written **inline inside `components/EventsExplorer.tsx`** (old
lines 430–449), and that component is mounted on **exactly one route**: the
homepage (`app/page.tsx`). Every other page renders `components/TopBar.tsx`, which
had a logo, the saved link, and the section nav — and no toggle. The header links
are real full-page navigations, so tapping "This Week" threw away the whole React
page, toggle included. Nothing was broken; the control had only ever been built
for one screen.

`TopBar` already exposed the exact seam for the fix: `({ actions }: { actions?:
ReactNode })` rendered inside `.topbar-actions` — and **nothing in the repo passed
it**. This fills that slot.

## What shipped
- **`components/ViewToggle.tsx`** — the control extracted, in the two forms the
  site honestly needs:
  - `ViewToggleButtons` — the homepage explorer's interactive toggle (switches view
    in place). Now also emits `aria-pressed`, which the inline version lacked.
  - `ViewToggleLinks` — for `/this-week`, `/this-weekend`, `/ongoing`. "List" is the
    page you're on (`class="active" aria-current="page"`); Calendar and Map are
    **anchors** to `/?view=<v>&range=<r>`.
- **Wiring:** the three pages pass it via `<TopBar actions={…} />` with their own
  range (`week` / `weekend` / `month`). `EventsExplorer` renders
  `<ViewToggleButtons view={view} onSelect={setView} />` — it still owns the state.
- **CSS** ([app/globals.css](../../app/globals.css)): a `.viewtoggle a` rule
  mirroring the button pill (plus `.active`, `:hover`, `:active`, and both
  responsive breakpoints). The `.viewtoggle button {` rule is deliberately left as
  its own literal block because `a11y.test.ts` greps that exact string for the
  44px touch-target guard.

## The honesty call worth knowing about
On those pages Calendar/Map **navigate** rather than re-rendering in place, and the
set of events changes: `/this-week` is the curated shortlist that feeds the Thursday
email (`digestEvents()`), while the homepage explorer shows everything in the
database for that date window. Rendering them as **links, not buttons**, is what
keeps that honest — the control looks like it navigates because it does. Taren chose
this behaviour explicitly over the alternative (leave the toggle homepage-only and
just rename the nav links).

**Not added to `/collections`, `/places`, `/venues`, `/neighborhoods`, `/cities`** —
those aren't event date-ranges, so a List/Calendar/Map control there would be a
dead option. (Places already has its own map + filters.)

## Verification (observed, not intended)
- **Rendered HTML** (dev server, curl — link mode is pure server markup, so this is
  a direct check of what ships):
  - `/this-week` → `<a href="/this-week" class="active" aria-current="page">List</a>`
    + `/?view=calendar&range=week` + `/?view=map&range=week`
  - `/this-weekend` → `range=weekend`; `/ongoing` → `range=month`
  - Homepage → still `<button type="button" class="active" aria-pressed="true">` ×3
    (interactive, unchanged behaviour)
  - `GET /?view=calendar&range=week` → 200
- **Tests +5** (1193 total): each events page passes `ViewToggleLinks` with its own
  range through the actions slot; `TopBar` still exposes the slot; link mode uses
  anchors + `aria-current`; the explorer still drives the shared buttons; **and a
  round-trip guard** in `explorer-url.test.ts` asserting every `view×range` href the
  toggle emits parses back to that exact view and range — so the control can never
  silently degrade to "lands on the default view" if the query contract drifts.
- Updated (not deleted) two tests that pinned the old structure: `topbar.test.ts`
  now asserts `<TopBar` rather than the literal `<TopBar />` (three pages now pass
  `actions`), and `list-view.test.ts` follows the buttons to their new file.
- Gate: `tsc` clean · 1193/1193 · `npm run build` clean · `npm audit` 0.

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema, no secret.

## Note on the other meaning of "persistent"
This makes the control **present** everywhere it's honest to be. It does not yet
**remember** your choice across visits. That was a deliberate hold: the homepage is
ISR-cached, so restoring a saved view client-side repaints after first render —
exactly the flash `DEPLOY-U5-MOBILE-FLASH.md` was shipped to kill. There is already
an explicit "Make this my default view" button (`cp_default_view` in localStorage);
if Taren wants stickiness, making that button more visible is the honest fix, not
auto-writing on every tap.

## A related UX wrinkle, flagged not fixed
"This Week" and "This Weekend" appear **twice** on the homepage: as date presets
inside the explorer (which keep the toggle and only change the date window) and as
nav links in the header one row above (which leave the page). Taren confirmed the
header links were the ones clicked, so this deploy addresses the real complaint —
but two rows using the same words for different actions is still a live confusion.
Renaming the nav copies ("The Week's Best", "Weekend Guide" — they live in
`lib/nav-sections.ts`) is an XS follow-up if it keeps causing trouble.

## Rollback
`git revert`. The component is additive and the pages fall back to a bare
`<TopBar />`; the homepage toggle is unaffected either way.
