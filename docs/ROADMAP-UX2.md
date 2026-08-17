# Roadmap — UX Round 2: Discovery, Map, Ordering & Location

> **✅ COMPLETE — ALL SEVEN SHIPPED (as of Aug 17, 2026). This doc is now history;
> kept for the recon record.** U1 `8edd8cb` · U2 `7bd3860` · U3 `59980cc` · U4
> `7ab2b13` · U5 `1c2e9b7` · U6a/U6b `28a46f4`/`6894146` · U7 `003cf62`. Do not treat
> the "ship now / high leverage" tags below as open work — they're all done. See the
> Aug 17 rebaseline at the top of `ROADMAP-v6.md` for what's actually next.

*Aug 14, 2026. Seven items from Taren's list, each recon'd against the working tree
(four parallel read-only passes — mobile/desktop/nav, map popup, event links + day
ordering, location feasibility). This is conversion/retention-quality work — the
kind that makes the Places-SEO traffic actually convert and return — so it sits
under **Roadmap v6 Tier 1** (grow the sellable audience) as UX quality. Ordered by
impact ÷ effort, correctness first. The standing quality gate applies to every
item; sizes are honest estimates.*

## The seven at a glance

| # | Item (Taren's list) | What it really is | Size | Tier |
|---|---|---|---|---|
| U1 | #4 Map popup light-on-light | A one-rule CSS cascade bug | **XS** | A — ship now |
| U2 | #7 Day chronological order | Already sorted; align 2 surfaces + span placement | **S** | A — ship now |
| U3 | #3 Places/Collections "buried" | Homepage has no section nav (deliberate; test-pinned) | **S–M** | B — high leverage |
| U4 | #6 Official link first | `ticketUrl` is the only link shown; no "official" concept | **S–M / L** | C — trust |
| U5 | #1 Mobile experience | Kill the calendar→list flash; mobile-usable calendar | **S–M** | C |
| U6 | #2 Desktop experience | 50% wasted width; no map+list side-by-side | **M** | D |
| U7 | #5 Zip/city → tailored view | New feature; needs a zip→coords table | **M–L** | D — the feature |

**If we do one thing: U1** (the map popup is visibly broken). **If we do two: U3**
— it's the highest-leverage item on the list, directly serving the funnel.

---

## Tier A — Correctness & visible bugs (ship first, cheap, obviously right)

### U1 — Map popup contrast (#4)  · Size XS
**What it is.** Selecting an event on either map opens a popup that's near-white
text on a white box — the event name and details are effectively invisible.

**Root cause (diagnosed, not guessed).** The vendor `mapbox-gl/dist/mapbox-gl.css`
is imported from the client map components (`components/MapView.tsx:4`,
`components/PlacesMapInteractive.tsx:4`), so it loads **after** `app/globals.css`
(imported once in the root layout). Its `.mapboxgl-popup-content { background:#fff }`
ties the site's intended `background: var(--navy-900)` (`globals.css:161`) on
specificity and wins on source order. The box goes white while `.pop-title`
(cream) and `.pop-meta` (`--pop-meta`, light) keep their dark-box colors → light on
light. The author already hit this once and fixed only the *tip* with `!important`
(`globals.css:162`); the content box was missed.

**Fix.** Make the site's popup background/color win — add `!important` to
`background` and `color` on `.mapboxgl-popup-content` (`globals.css:161`), mirroring
line 162; or raise its specificity; or reorder the imports so globals loads last.
Then re-check `.pop-title` / `.pop-meta` / `.pop-cat` contrast against the (now
correctly navy) box. Affects **both** maps identically; markers/pins are fine and
untouched.
**Tests.** CSS-only — no unit test. A source-tripwire could assert the rule carries
`!important`, matching the drift-guard convention.
**Verify.** Open the homepage map + a `/places/[kind]` map, select a pin, confirm
dark box + readable cream text (screenshot). Light/dark theme both.
**Depends:** nothing.

### U2 — Day view chronological order (#7)  · Size S
**What it is.** "When I look at a day, put events in chronological order by start
time." Expanded: the fix isn't *adding* a sort — both day surfaces already sort —
it's making them **agree** and handling multi-day/all-day placement honestly.

**Current state (recon).** The `/day/[date]` page is already `order by start_at asc`
(`lib/events.ts:202`). The homepage DayPanel already sorts timed events by clock
time, but hoists **multi-day spans to the top, alphabetized** (`EventsExplorer.tsx:233-242`).
So the two disagree, and on the `/day` page a festival that began days ago sorts to
the very top of *later* days because it's ordered by its original (earlier)
`start_at`.

**Design decision (Taren's call, small).** Pick one model and apply to both:
recommend **"multi-day + all-day events grouped at the top with a label (e.g. 'All
day / ongoing'), then timed events chronological by start."** That matches the
DayPanel's existing instinct and reads correctly ("here's what's running all day,
then here's tonight by time"). The alternative — pure `start_at asc` everywhere —
is simpler but re-introduces the stale-start pinning quirk.
**Build.** `/day/[date]`: a post-read re-sort in `readEventsForDay` or the page
(the DB can't cheaply know "clock time within this day" for a span). DayPanel: adjust
the comparator at `EventsExplorer.tsx:233-242` (add an explicit all-day branch — all-day
currently falls into the timed bucket at `00:00`). Reuse `isMultiDay`/`spanEnd`
(`lib/multiday.ts`) so "multi-day" means the same thing everywhere. Put the ordering
in a pure `lib/` helper with golden tests so both surfaces call one function.
**Tests (~6).** Timed events sort by start; all-day/multi-day grouped first; a
mid-run festival on a later day doesn't pin above tonight's timed events; the
page/panel parity fixture.
**Verify.** A day with a festival + an all-day + several timed events renders the
same order in `/day/[date]` and the homepage DayPanel.
**Depends:** nothing.

---

## Tier B — Discovery (the highest-leverage item on the list)

### U3 — Surface Places / Collections / sections on the homepage (#3)  · Size S–M
**What it is.** The owner: Places, Collections, Venues, etc. feel "buried at the
bottom of the page." Confirmed: on the **homepage** they are footer-only.

**Current state (recon).** Every *content* page gets the shared `TopBar` with an
8-link horizontally-scrollable section nav (`TopBar.tsx:16-25`). But the homepage
renders its **own** header (`EventsExplorer.tsx:350-377`) with only Logo, Saved,
and the view toggle — **no section nav** — and `app/page.tsx` never renders
`TopBar`. So on the highest-traffic page, all 8 sections appear only in the footer,
reached by scrolling past the entire explorer + Trending + Ongoing + Subscribe +
Collections strips. **This was a deliberate UX6 decision** ("a redundant section
strip would clutter it") **with a test asserting EventsExplorer does NOT use
TopBar** — so any fix must consciously revisit that call and update the test.

**Design (recommended).** Don't duplicate the full TopBar on the homepage (respects
the anti-clutter rationale and the SSR-render-then-hydrate concerns). Instead add a
**compact, horizontally-scrollable "Explore" chip row** directly beneath the
homepage header — visually distinct from the view toggle — surfacing the browseable
sections (This Weekend · Ongoing · Collections · Places · Venues · Neighborhoods ·
Cities). It's one slim band high on the page, not eight redundant nav links, and it
turns the buried footer sections into a scannable top-of-page affordance.
*Alternative (weaker): promote sections into the existing editorial-strip area — but
strips are content carousels and don't cover Places/Venues/Neighborhoods/Cities as
browse targets.*
**Build.** A small `ExploreRow` component (reuse the `.section-nav` scroll styles),
rendered in `EventsExplorer`'s header or in `app/page.tsx` just under the explorer;
update the UX6 test that pins "homepage has no TopBar" to allow/expect the chip row.
**Tests (~3).** The chip row renders all sections with correct hrefs; the existing
homepage-header test updated; a11y (scrollable, 44px targets — reuse UX7 patterns).
**Verify.** Homepage on mobile + desktop shows the Explore row above the fold;
each chip navigates; no layout shift.
**Size S–M. Depends:** nothing (but coordinate with the UX6 test).
**Strategic note.** This is the item with the best impact ÷ effort on the list —
it directly connects the SEO-earning Places pages to homepage visitors, feeding the
funnel v6 Tier 1 is built around.

---

## Tier C — Trust & mobile polish

### U4 — Official site first for event links (#6)  · Size S–M (render) or L (data)
**What it is.** Event links should prefer the **official** site (venue / box office)
over aggregators (Eventbrite, Ticketmaster resale, etc.).

**Current state (recon).** `ticketUrl` is the **only** event URL ever rendered
(`TicketButton.tsx:14,22`); `sourceUrl` is stored but never surfaced. There is **no
"official" concept in code** — only a prose instruction telling the research agent
to "prefer primary sources (venue / box-office) over aggregators" for `source_url`
(`lib/agents/prompts.ts:60`). So `sourceUrl` is *already the more-likely-official*
field, and it's the one we throw away at render time.

**Two ways to do it — recommend starting render-side:**
- **Option A (render heuristic, S–M — recommended first).** Add a pure
  `primaryEventLink(event)` helper (natural home `lib/event-view.ts` or
  `lib/outbound.ts`) with a small **aggregator host denylist** (eventbrite,
  ticketmaster resale, seatgeek, etc.). Logic: if `ticketUrl`'s host is an
  aggregator and `sourceUrl` is a non-aggregator, present `sourceUrl` as the
  primary "Official site" link — optionally keeping `ticketUrl` as a secondary
  "Tickets ↗" when they differ. Call it from the one render seam
  (`TicketButton.tsx:22`); cards/detail defer to it, no other change. No migration,
  ships immediately, leverages the `sourceUrl` we already collect.
- **Option B (data field, L).** Add an explicit `officialUrl`/`isOfficial` to
  `EventRecord` + `DbEventInput` (`lib/types.ts`), thread through the column
  selects (`lib/events.ts`), the upsert set (`lib/upsert.ts`), and the agent
  contract (`prompts.ts`); add an official-preference tiebreak to `richness()` so a
  re-found aggregator URL can't overwrite an official one; plus a one-time
  reclassify/backfill pass over existing rows. More robust, but a real project.

**Recommendation.** Ship **Option A** now (immediate trust win, no data risk); treat
Option B as a later hardening item if the heuristic proves too coarse. The product
question for Taren: when official and ticket URLs differ, show **one** "Official
site" link, or **two** (Official + Tickets)? I lean two — buyers still want the
ticket link.
**Tests (~6).** Aggregator `ticketUrl` + official `sourceUrl` → official chosen;
official `ticketUrl` → unchanged; only `ticketUrl` present → it's used; empty both →
the existing "coming soon" note; denylist host matching (subdomains, case).
**Verify.** Spot-check several live events across venue/aggregator mixes; confirm the
CTA points at the official page.
**Depends:** nothing.

### U5 — Mobile experience (#1)  · Size S–M
**What it is.** "Optimize the mobile experience." Recon narrowed the broad ask to
two concrete, worth-fixing issues (UX4's mobile List and UX7's 44px targets/modal
a11y already shipped — not re-proposed):
1. **The calendar→list flash.** Initial React state is `view="calendar"/month`
   (`EventsExplorer.tsx:84-86`); a mount effect switches phones to `list/week`
   (`:150-156`). SSR renders the month calendar, then the client swaps to list — a
   visible flash + layout shift on every fresh phone load.
2. **Mobile Calendar is title-less.** Under `@media (max-width:820px)`,
   `.cell .evs { display:none }` (`globals.css:244`) — a phone user who taps
   "Calendar" gets colored dots only, no event names, no counts.

**Design.** (1) Kill the flash: seed the initial `view/range` so the server and
first client paint agree on mobile — either a cookie/header viewport hint read
server-side, or make **List the universal default** (calendar an opt-in) so there's
no swap. Recommend the latter — simplest, and List is already the better mobile
surface. (2) Either give mobile an **agenda-style calendar** (tap a day → its list)
or, if List is the default, de-emphasize Calendar on mobile and accept dots as a
month heatmap with a "tap a day" affordance.
**Build.** `EventsExplorer.tsx:84-86,150-156` (initial state / default), possibly a
tiny server viewport hint; `CalendarView.tsx` + `globals.css:244` for the mobile
calendar treatment.
**Tests (~4).** Default-view resolution (URL > saved > viewport) without a
mismatched first paint; the mobile-calendar rendering choice.
**Verify.** Fresh phone load: no flash, no layout shift; Calendar on mobile is
usable or clearly a heatmap-with-tap. `resize_window` mobile preset.
**Depends:** nothing (touches the same file as U3 — sequence them together).

---

## Tier D — Bigger builds

### U6 — Desktop experience (#2)  · Size M
**What it is.** "Optimize the desktop experience." Recon: the Calendar fills the
1240px shell well, but the **List/agenda is a single 640px column** (`globals.css:339,354`)
marooned in a sea of navy — ~50% of a wide viewport wasted — and the three views are
**mutually exclusive** (`EventsExplorer.tsx:457-469`): no side-by-side map+list.

**Design (two slices, do the cheap one first).**
- **U6a (S) — responsive multi-column list.** At ≥1000px, flow the agenda into 2
  (or 3) columns instead of one 640px ribbon. CSS-mostly (`.list-view`/`.day-list`
  max-widths + a grid at a `min-width` breakpoint — note there are currently *no*
  `min-width` queries in the app).
- **U6b (M) — side-by-side map + list.** On desktop, a "Map" mode that shows pins
  **and** a scrollable result list together (hover/click a row → highlight its pin).
  A real composition change at `EventsExplorer.tsx:457-469` + CSS; high polish, the
  layout the width is begging for.
**Tests (~3).** Column reflow at the breakpoint; map↔list selection sync (U6b).
**Verify.** `resize_window` desktop; the list uses the width; map+list stay in sync.
**Size M (U6a is S). Depends:** nothing.

### U7 — Zip/city → tailored view (#5)  · Size M–L  · the feature
**What it is.** The user enters a zipcode or city and the view tailors from there —
nearest events first / within a radius.

**Feasibility (recon): high, low-to-medium effort.** Every published event carries
**non-null** `lat/lng` — the pipeline geocodes centrally and *skips* any event that
fails (`scripts/run-pipeline.ts:142-146`), so distance math works for 100% of events
with zero backfill (`lib/types.ts:26-27`, `schema.sql:22-23`). A **tested Haversine
already exists** (`lib/geo-distance.ts` `distanceMeters`). The homepage already
personalizes without breaking ISR via client-side hydration (the `cp_default_view`
localStorage + `/api/saved` cookie patterns). **The only missing piece is
zip → coordinates.**

**Design (recommended — Option 1, pure client, zero backend).**
1. **Static `lib/zip-coords.ts`** — a `MN_ZIP_COORDS: Record<string,{lat,lng}>` for
   metro zips (~200–400 entries, Census ZCTA / GeoNames, public domain), drift-tested
   like `lib/places.ts`. City→coords derivable from the existing `CITY_AREA` names
   (centroid) or the event set. A Mapbox-geocode fallback behind a `force-dynamic`
   route (`lib/geocode.ts` is server-only) can cover unknown zips later.
2. **A location control** in `EventsExplorer` (sibling to the filters): type a zip or
   pick a city.
3. **Persist** in `localStorage` (mirror `cp_default_view`) and optionally the URL
   (`serializeExplorer`/`parseExplorer`) so a located view is shareable.
4. **Distance as a new axis** — compute `distanceMeters(user, e)` and sort ascending
   or filter to a radius, composed after the existing `applyPriceArea` step in the
   `useMemo` filter chain. Homepage stays ISR-cached; no cookie/route/DB for the MVP.
*Rejected: server-side PostGIS/SQL distance (Option 3) — overkill for a metro dataset
the client already holds in full, and it pushes work onto a per-request DB path the
standing rules avoid.*
**Build.** `lib/zip-coords.ts` (+ drift test), a `lib/geo-distance` reuse, a
`LocationControl` component, and the distance step + persistence in `EventsExplorer`.
**Tests (~8).** Zip resolves to coords; unknown zip degrades gracefully; distance
sort ordering; radius filter boundary; persistence round-trip; composes correctly
with date/category/price filters; drift guard on the zip table (valid coords, in the
metro box).
**Verify.** Enter a zip → nearest events first; a suburb zip vs a downtown zip
reorder differently; reload keeps the choice; shareable URL.
**Size M–L. Depends:** nothing technically; pairs naturally with U3/U5/U6 since all
touch `EventsExplorer`.
**Product note (Taren).** Decide the default behavior once a location is set: *sort*
by distance (keep everything, nearest first — recommended) vs *filter* to a radius
(hide far events — riskier, can empty the view). Recommend sort, with an optional
"within N miles" toggle.

---

## Recommended sequence

```
NOW      → U1 map popup (XS) → U2 day ordering (S)          [correctness, a day total]
NEXT     → U3 homepage Explore row (S–M)                    [the funnel win]
         → U4 official-link heuristic, Option A (S–M)       [trust]
THEN     → U5 mobile flash + calendar (S–M)                 [pairs with U3 — same file]
         → U6a desktop multi-column list (S)
LATER    → U7 zip/city location feature (M–L)               [the feature; own session]
         → U6b side-by-side map+list (M) · U4 Option B data field (L, if needed)
```

Several of these (U3, U5, U6, U7) all touch `components/EventsExplorer.tsx` — batch
them thoughtfully or sequence back-to-back to avoid churn, but ship one item per
session per the working agreement.

## Decisions that are Taren's to make (surfaced, not pre-decided)
- **U3:** revisit the UX6 "homepage stays nav-free" call — recommend the compact
  Explore chip row.
- **U4:** one "Official site" link vs two (Official + Tickets) — lean two.
- **U5:** make List the universal default (calendar opt-in) to kill the flash?
- **U7:** sort-by-distance vs filter-to-radius default — lean sort.

*Provenance: four parallel read-only recon passes over EventsExplorer / globals.css /
TopBar / the map components / the event + day pipeline / the geo stack, Aug 14, 2026.
Every "current state" claim carries a file:line ref in the item above.*
