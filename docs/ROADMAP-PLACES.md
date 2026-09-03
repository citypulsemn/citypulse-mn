# Place Guides — prioritized build plan (Roadmap item F2.7)

*Mid-August 2026. Self-contained spec: a Claude Code session can execute any wave item from this file alone. The Places SEO deep-dive referenced by `docs/ROADMAP-v6.md` Tier 1.2. House rules apply to every item: one item per session, finished (design → build → test → deploy guide); quality gate per `CLAUDE.md`; honest data; Taren's voice wins.*

## What this is and why

Evergreen **place directories** — "Splash pads in the Twin Cities," "Sledding hills," "Concert venues by size" — as first-class pages on citypulsemn.com. Feasibility study conclusions (July): Google Maps lists have no API (manual mirror only, ops item at the bottom); Google Places API data can't legally be stored to build a directory; therefore places are **hand-curated registry data in `lib/`**, the same pattern as the venue registry, with drift-guard tests. That constraint is also the moat: the winning detail ("which beaches have lifeguards," "which taprooms allow kids") is exactly what can't be scraped.

**The timing insight that drives the wave order: pages take months to index and rank, so guides are built one season *ahead* of demand.** Winter guides ship September–October to rank by December; summer guides ship January–March to rank by June. Building a splash-pad guide in July is too late for that July.

**Prioritization scoring (used throughout):** search demand (qualitative — validate against Search Console once live) · event-synergy (does it link into the calendar?) · curation cost (can 15–30 entries be verified in one sitting and re-verified twice a year?) · season lead time.

---

## Wave 0 — Infrastructure + seed guide (build first; one session; size M)

**W0. `lib/places.ts` registry + `/guides/[slug]` template.**

Design decisions:
- **Data shape** (hand-maintained array, exported, drift-guard-tested like `related.test.ts`):
  ```ts
  type Place = {
    slug: string; name: string; kind: PlaceKind;      // 'splash-pad' | 'sledding-hill' | ...
    address: string; city: string; lat: number; lng: number;
    area?: string;                                     // reuse lib/areas.ts keys
    website?: string; price?: 'free' | '$' | '$$';
    season?: 'summer' | 'winter' | 'year-round';
    details?: Record<string, string | boolean>;        // guide-specific facts: lifeguards, kidFriendly, dogFriendly, rentals
    venueSlug?: string;                                // bridge to the venue registry when the place hosts events
    blurb: string;                                     // 1-2 sentences, Taren voice, TODO(taren) placeholders OK at ship
    verifiedAt: string;                                // YYYY-MM-DD; staleness surfaces in ops digest later
  };
  type GuideSpec = { slug: string; title: string; kinds: PlaceKind[]; intro: string; season?: Season; detailColumns?: string[] };
  ```
- **Page:** `app/guides/[slug]/page.tsx` + `app/guides/page.tsx` index. Server-rendered, `revalidate` (no build-time DB — registry is code, so prerender is actually fine here; positive reason: zero DB reads). Each entry: name, area chip, price, the guide's detail columns, blurb, Mapbox static map (reuse the venue-page pin helper), and — when `venueSlug` matches — "Upcoming here" links via the existing venue-event selector (`MoreAtVenue` pattern).
- **SEO:** `ItemList` JSON-LD **through `jsonLdSafe()`** (the R0.6 escaping helper — hard dependency; do not ship guides before that fix). Canonicals, sitemap entries, footer "Guides" link, OG card reusing the 3.3 style.
- **Cross-links both ways:** guide → venue pages/events; venue pages get a "More guides" line when their venue appears in one.
- **Tests (~10):** registry drift guards (unique slugs, valid areas, lat/lng bounds, kinds match a GuideSpec, verifiedAt parseable) · guide selection/ordering pure function · ItemList JSON-LD golden incl. `</script>`-title case · empty-guide honesty (unpublished until ≥8 entries — no sad placeholders).
- **Seed guide shipped in the same session: G1 (concert venues by size)** — it re-slices the existing 42-venue registry, so the data cost is near zero and the template proves itself on real content.

**Deploy:** code-only. **Verify:** smoke `/guides` + `/guides/concert-venues`, Rich Results test on the ItemList, one venue cross-link click-through.

---

## Wave 1 — Winter guides (build September–October; rank by December)

Priority order. Each is one session: curate + verify entries, write intro (`TODO(taren)` pass), ship, mirror as a Google Maps list (ops step below).

| # | Guide | Demand | Event-synergy | Count | The winning detail |
|---|-------|--------|---------------|-------|--------------------|
| G2 | **Sledding hills** | High, sharply seasonal, and no good metro list exists — the moat query | Low | ~20 | Lit at night? Steepness/age fit; parking; "the one with the warming house" |
| G3 | **Indoor playgrounds & play cafés** | High Sept–April (parents) | Medium (story times, events) | ~15 | Age bands, price, café quality, sock policy, birthday rooms |
| G4 | **Ice skating rinks** | High Dec–Feb | Medium (open-skate times are event-ish) | ~25 | Outdoor neighborhood rinks vs indoor arenas; rentals; free vs paid; flooded-by-city dates |
| G5 | **Trampoline, ninja & climbing gyms** | Medium, evergreen-indoor | Low | ~12 | Toddler hours, day-pass price, age minimums |
| G6 | **Ski, snowboard & tubing hills** | Medium-high Nov–Feb | Medium (Hyland/Buck Hill host events) | ~8 | Tubing reservations, night skiing, lesson programs |

## Wave 2 — Evergreen & commercial (November–December)

| # | Guide | Demand | Event-synergy | Count | The winning detail |
|---|-------|--------|---------------|-------|--------------------|
| G7 | **Birthday party venues** | High year-round, high commercial value | Medium | ~20 | Mostly re-slices G3/G5 + bowling/mini-golf entries — cheap once Wave 1 exists; price-per-kid, private-room yes/no |
| G8 | **Museums by kid age** | Medium-high, evergreen | **High** (family events already on the calendar) | ~15 | Free days, age-band honesty ("Bell is 7+, MCM peaks at 5") |
| G9 | **Breweries & taprooms with patios** | Medium-high, evergreen | **High** (trivia/music nights already scraped) | ~25 | Kids allowed? Dogs? Food truck cadence; patio heat lamps (winter angle) |
| G10 | **Free attractions** | Medium, evergreen, broad | High (Como Zoo etc. host events) | ~15 | What's *actually* free vs donation-suggested; parking cost — the honest catch |
| G11 | **Indoor walking spots** (conservatories, skyways) | Sneaky-high Dec–Mar (stroller/senior) | Low | ~12 | Hours, stroller-friendliness, attached parking |

## Wave 3 — Summer guides (build January–March; rank by June)

| # | Guide | Demand | Event-synergy | Count | The winning detail |
|---|-------|--------|---------------|-------|--------------------|
| G12 | **Splash pads & wading pools** | Very high May–Aug; the flagship parent query | Low | ~30 | Hours/season dates, shade, bathrooms, fenced or not |
| G13 | **Swimming beaches & pools** | High Jun–Aug | Low | ~25 | **Lifeguard schedule** — nobody keeps this current; water-quality-advisory link |
| G14 | **Destination playgrounds** | Medium-high, evergreen-leaning-summer | Low | ~15 | Chutes & Ladders is the anchor; age fit, shade, bathrooms |
| G15 | **Waterparks** (indoor + outdoor) | Medium-high | Low | ~8 | Indoor ones flip this to a winter guide too — tag both seasons |
| G16 | **Paddle launches & rentals** | Medium Jun–Aug | Low | ~15 | Rental prices, reservation links |
| G17 | **Nature centers** | Medium, evergreen | **High** (their programs are already events) | ~12 | Free vs paid, best-for ages, indoor exhibit for rain days |

## Wave 4 — Fill-ins and next-season prep (as capacity allows; June–July for the fall pair)

G18 **Apple orchards & pumpkin patches** (build June–July to rank by September; very high Sept–Oct demand, high event-synergy — orchard festivals are already on the calendar) · G19 **Regional parks & gardens** · G20 **Dog parks** · G21 **Mini golf / go-karts / bowling** · G22 **Comedy clubs & small music rooms** (re-slice of venue registry) · G23 **Disc golf** · G24 **XC ski & snowshoe trails** (next winter's addition).

*Deliberately excluded for now:* restaurants-as-such (different product, different competitors), anything requiring daily freshness (water quality readings — link out instead), and any pay-to-be-listed arrangement (the Phase 5 exclusions apply to guides identically: **inclusion is never for sale**).

---

## Standing rules for every guide session

1. **Ship at ≥8 verified entries or don't ship** (honest-emptiness). Target counts above are ceilings of usefulness, not quotas.
2. **Every entry gets `verifiedAt`** — the date a human (or a session with web evidence) confirmed name/address/status. Re-verify cadence: seasonal guides at season start, evergreen twice a year. A later ops-digest line ("N guide entries stale >180d") is a small follow-on once ≥3 guides exist.
3. **Voice rules apply** (`CLAUDE.md`): concrete over promotional; the banned-word list; blurbs are Taren-editable data.
4. **Editorial intros** ship as `TODO(taren)` placeholders flagged in the deploy guide, filled in one commit — same convention as the 3.2 venue intros.
5. **Distribution ritual per shipped guide** (ops, ~30 min, no code): mirror it as a Google Maps list in the CityPulse account (manual — there is no API) and link "Open in Google Maps" from the guide page · one digest mention · one Instagram slot. The site page earns search; the Maps list earns app-native follows; both point at the same curated data.
6. **Measure before Wave 2 locks:** after Wave 1 is live ~4 weeks, read Search Console queries/impressions per guide and reorder the remaining waves by observed demand. The table's demand column is judgment; the instrument outranks it.

## Sequencing at a glance

```
NOW (late Aug)   → W0 infra + G1 concert venues (M; requires R0.6 JSON-LD fix shipped)
SEP              → G2 sledding hills → G3 indoor playgrounds → G4 ice rinks
OCT              → G5 gyms → G6 ski/tubing
NOV–DEC          → G7 birthdays → G8 museums → G9 taproom patios → G10 free → G11 indoor walks
JAN–MAR          → G12 splash pads → G13 beaches/pools → G14 playgrounds → G15–G17
JUN–JUL          → G18 orchards/pumpkins (for the fall) → Wave 4 fill-ins
EVERY GUIDE      → +Google Maps list mirror, digest mention, IG slot
```

**If you build one thing: W0 + G1** — the template proves itself on data you already own. **If you build two: G2 sledding hills in September** — highest-demand unserved query in the metro, and it must be indexed before the first snow.

---

# P5 — "Been there": a place checklist you can work toward

*Spec'd 3 Sep 2026 (Taren's idea; option 1 of the two shapes discussed). Self-contained: a Claude Code session can build this from this section alone. House rules apply: design → build → test → deploy guide, one session, finished; quality gate per `CLAUDE.md`; honest data; no dark patterns; Taren's copy wins.*

## What it is, in one paragraph

Every place on the site gets a **"Been there"** check. Kind pages show your progress ("Been to 12 of 50 splash pads"). The saved page grows a "Places you've been" section. Progress rides the **existing anonymous saver identity** — the `cpid` cookie, the keep-list magic link, the merge-on-restore — so there is still no login, and emailing yourself the link now keeps your check-offs too. That last part is the point: this is the first feature on the site where a visitor has something *of their own* to lose, which is a far better reason to hand over an email than "get a weekly digest."

## Why it fits (and why now)

- **Places are finite; events are not.** A checklist is only fun if it can be finished. Twelve sledding hills, eight ski hills, fifty splash pads — and the exhaustive-sweep kinds (beaches, splash pads, pools, golf, dog parks, disc golf) make "all 50" an honest claim, not marketing.
- **The blocker is audience, not features** (`docs/ROADMAP-MONETIZATION.md` retro, Aug 2026; subscribers ≈ 5). Check-offs create loss aversion → the keep-list email → a `pending` subscriber row that the digest opt-in can convert later. It feeds v6 Tier 1 directly.
- **Ninety percent of the plumbing exists.** `saved_events` + `lib/saver.ts` + `lib/saved-restore.ts` + `SaveButton` + `FirstSaveNudge` + `/api/saved` is the exact pattern; this item is that pattern applied to a place slug instead of an event id.
- **Content angles fall out for free:** "I've done 31 of 50" is a reel, a digest line, and next summer's "splash pad passport" (phase 2, below).

## Recon (what's actually in the code — do not re-derive)

| Thing | Where | What matters |
|---|---|---|
| Anonymous identity | `lib/saver.ts` | `getSaverToken()` (render-safe read), `ensureSaverToken()` (server actions only), `setSaverToken()` (restore). Cookie `cpid`, httpOnly, 1 year. |
| Save store | `lib/saved.ts`, `db/schema.sql` ~L270 | `saved_events(user_token, event_id)` PK, RLS policy `saved_events_owner` on `current_setting('request.saver_token', true)`. Every query also scoped by token in app code (belt and braces). `SAVED_CAP = 300`. |
| Toggle action | `lib/saved-actions.ts` | `toggleSaveAction(id)`: validate → `ensureSaverToken` → read → write → `recordStat` → `revalidatePath("/saved")`. |
| Client hydration | `app/api/saved/route.ts`, `components/SaveButton.tsx`, `components/SavedLink.tsx` | Static pages stay static; the button fetches `/api/saved` (no-store) on mount unless the parent passes state. Broadcasts `citypulse:save` after the write lands. |
| First-save nudge | `components/FirstSaveNudge.tsx` (mounted in `app/layout.tsx`) | Listens for the broadcast, one-time, dismissible, localStorage key, bottom strip, links to `/saved`. |
| Keep-list + restore | `lib/saved-restore.ts` (`requestSavedLink`, `mergeAndRestore`), `components/KeepListForm.tsx` | **Two merge points** copy `saved_events` between tokens: on request (R2.7) and on restore (R0.4). Both must learn about the new table. Golden-tested in `lib/__tests__/saved-restore-queries.test.ts`. |
| Places registry | `lib/places.ts` | 522 entries, 19 kinds; `Place.slug` is **globally unique** (drift-guard in `places.test.ts`). `KindMeta { kind, label, plural, blurb }`. Selectors are pure. |
| Kind page | `app/places/[kind]/page.tsx` | `revalidate = 3600`, no DB. Header is `.dayhdr` with a `.dayhdr-count` line "N across the Twin Cities metro". List is `PlacesBrowser` (client) → `PlacesList`. |
| Detail page | `app/places/[kind]/[slug]/page.tsx` | **`revalidate = false`, `dynamicParams = false`** — the CPU-overage fix (26 Aug). Must stay byte-identical across visitors. Header has cost · address · neighborhood chip · Directions link. One `SubscribeBand`. |
| Saved page | `app/saved/page.tsx` | `force-dynamic`, `robots noindex`, token read server-side; shows `KeepListForm` only when the list is non-empty. |
| Static tripwires | `lib/__tests__/places-static.test.ts`, `subscribe-placement.test.ts` | Source-text tests that pin rendering mode and one-band-per-page. Extend, don't bypass. |

## Design decisions

**D1 — Rides the saver token; no new identity.** One cookie, one magic link, one merge. A person who emails themselves a link gets events *and* places back. Anything else would be a second identity to explain and a second thing to lose.

**D2 — New table, no foreign key.** The registry lives in code, not the DB, so `place_slug` can't reference anything. Validity is enforced in the server action (slug must resolve via the registry — the analog of `isValidUuid`). A slug that later leaves the registry is simply not counted (pure selector ignores orphans; never errors, never shows a ghost).

```sql
-- db/schema.sql — additive, idempotent (P5)
create table if not exists place_visits (
  user_token text not null,
  place_slug text not null,
  visited_at timestamptz not null default now(),
  primary key (user_token, place_slug)
);
create index if not exists idx_place_visits_user on place_visits (user_token, visited_at desc);
alter table place_visits enable row level security;
drop policy if exists place_visits_owner on place_visits;
create policy place_visits_owner on place_visits
  for all
  using  (user_token = current_setting('request.saver_token', true))
  with check (user_token = current_setting('request.saver_token', true));
```

**D3 — Static pages stay static; state hydrates client-side.** Non-negotiable given the 26 Aug measurement (80k ISR writes / 30 days, 4h16m CPU on a 4h allowance). The detail page keeps `revalidate = false`; the kind page keeps `3600`. Neither imports `cookies()` or `getSaverToken`. A new `GET /api/visited` (mirror of `/api/saved`, `no-store`) returns `{ slugs: string[] }`; **no cookie → `[]` with zero DB reads**, so crawlers and first-time visitors cost nothing. Worst case payload is 522 short slugs (~13 KB); typical is under 1 KB. **One fetch per page**, not one per row: `PlacesBrowser` fetches once and passes a `Set` down to every row's button; `PlaceProgress` shares the same hook. The detail page has one button, so it self-hydrates.

**D4 — Honest counts, two framings.** A checklist implies the list is complete, and for some kinds it isn't. Add `coverage: "exhaustive" | "curated"` to `KindMeta` (drift-guard: every kind declares it; the registry's own sweep comments say which is which — beaches, splash pads, pools, golf courses, dog parks, disc golf, farmers markets, rinks are sweeps; parks, playgrounds, museums, gardens, etc. are curated picks). Copy differs:
- exhaustive → *"Been to 12 of 50 splash pads in the metro"*
- curated → *"Been to 4 of the 22 parks on our list"*

Both the denominator and the wording come from a pure, golden-tested `placeProgress()` — the number on the page is never hand-typed.

**D5 — Quiet by design (no dark patterns).** Zero state renders **nothing**: no empty progress bar, no "0 of 50", no "start your list!" The progress line appears only after the first check. No streaks, no badges, no confetti, no "you're missing X." No new header badge (the ♥ count stays events-only — one badge is enough). One `SubscribeBand` per page, unchanged; the nudge is the existing bottom strip pattern, once, dismissible.

**D6 — The check is a button, not a checkbox input.** Same shape as `SaveButton` (`aria-pressed`, optimistic flip, revert on failure, broadcast after the write). Label *"Been there"* → *"✓ Been there"*. A `compact` variant for list rows. Copy strings live in `lib/editorial.ts` (`PLACE_VISIT_COPY`) so Taren can rename it ("Visited", "Done", "Checked off") without touching a component.

**D7 — Cap above the registry.** `VISITS_CAP = 1000` with a drift-guard test asserting `VISITS_CAP > PLACES.length` — someone who really does sweep every golf course must be able to finish.

**D8 — Not stats-tracked per event.** `event_stats` keys on event UUIDs; don't contort it. Fire `track("visit_toggle", { slug, kind, visited })` through `lib/track.ts` for the analytics side, and add one line to the ops digest later if the number turns out to matter (follow-on, not this item).

## Build plan (the files)

**Schema** — `db/schema.sql`: the block in D2, appended under a `-- ── Place visits (P5) ──` header.

**Pure logic** — `lib/place-progress.ts` (no DB imports):
- `placeProgress(kind, visitedSlugs: ReadonlySet<string>) → { visited, total, coverage }` — counts only slugs that exist in the registry *for that kind*; orphans ignored.
- `progressLine(kind, progress) → string | null` — `null` at zero (D5); the two framings from D4 using `KIND_META[kind].plural` lowercased.
- `visitedByKind(visitedSlugs) → Array<{ kind, places: Place[], progress }>` — for the saved page; kinds with zero visits omitted; ordered by most-complete first, ties by plural.

**Store** — `lib/place-visits.ts` (mirror of `lib/saved.ts`): `VISITS_CAP`, `isValidPlaceSlug(slug)` (registry lookup, exported for tests), `isVisited`, `markVisited` (idempotent, capped), `unmarkVisited`, `getVisitedSlugs(token) → string[]`. Every query scoped by `user_token`.

**Action** — `lib/place-visit-actions.ts` (`"use server"`): `toggleVisitAction(slug) → boolean`, mirroring `toggleSaveAction` minus `recordStat`. `revalidatePath("/saved")` is harmless but unnecessary (the page is `force-dynamic`); omit.

**Route** — `app/api/visited/route.ts`: copy of `/api/saved` returning `{ slugs }`.

**Restore** — `lib/saved-restore.ts`: both merge inserts gain a sibling for `place_visits` (same `insert … select … on conflict do nothing` shape). Extend `saved-restore-queries.test.ts` goldens so a future edit can't drop one side. Restore-email copy gets a clause about places (editorial string).

**Components**
- `components/VisitButton.tsx` — client; props `{ slug, kind, visited?: boolean, variant?: "default" | "compact" }`; hydrates from `/api/visited` only when `visited` is undefined; broadcasts `VISIT_EVENT = "citypulse:visit"`.
- `components/useVisited.ts` — client hook: fetch once, expose `Set<string>`, re-fetch on `VISIT_EVENT`. Used by `PlacesBrowser` and `PlaceProgress`.
- `components/PlaceProgress.tsx` — client; `{ kind }`; renders the D4 line + a thin bar; `null` at zero.
- `PlacesList.tsx` — accepts optional `visited?: ReadonlySet<string>`; when present, each row renders a compact `VisitButton` in `.place-head` after the cost badge and adds `.place-row.visited` (subtle: checked rows get a muted number, nothing louder).
- `PlacesBrowser.tsx` — calls `useVisited()`, passes the set to `PlacesList`; adds a **"Been there / Not yet"** filter chip only when the set is non-empty (a third state in `PlaceFilters` via `filterPlaces`, pure-tested).
- Kind page — mount `<PlaceProgress kind={k} />` directly under `.dayhdr` (above the season banner).
- Detail page — `<VisitButton slug kind />` appended to the `.dayhdr-count` line after "Directions ↗". Nothing else on the page changes; it stays static.
- Saved page — new server-rendered section **"Places you've been"** under `SavedList`: per kind, the D4 line + the places as plain links (name → detail page). Uses `getVisitedSlugs(token)` + `visitedByKind`. Section omitted entirely at zero. `KeepListForm` now shows when `events.length > 0 || visitedSlugs.length > 0`, and its sub-copy mentions places (editorial).
- `FirstSaveNudge.tsx` — also listens for `VISIT_EVENT` with its own dismissal key (`cp_visitnudge_dismissed`) and copy *"Checked off in this browser. Email yourself a link to keep your list on any device."* Same strip, same rules.

**Editorial** — `lib/editorial.ts`: `PLACE_VISIT_COPY = { button, buttonOn, nudge, savedHeading, keepListSub }` — `TODO(taren)` markers in the deploy guide, filled in one commit.

**Styles** — `app/globals.css`: `.visitbtn`, `.visitbtn.on`, `.visitbtn-compact`, `.place-progress` (+bar), `.place-row.visited`. Reuse the `savebtn` tokens; dark and light both.

## Tests (golden, in `lib/__tests__/`; target ~16)

- `place-progress.test.ts` — exhaustive vs curated wording · zero → `null` (honest emptiness) · orphan slug ignored · slug of another kind not counted · `visitedByKind` ordering and omission of empty kinds · every `KIND_META` declares `coverage` (drift guard) · `VISITS_CAP > PLACES.length`.
- `place-visits.test.ts` — `isValidPlaceSlug` accepts a real slug, rejects unknown/empty/injection-ish/non-string.
- `saved-restore-queries.test.ts` — extend: both merge sites copy `place_visits` as well as `saved_events`.
- `places-static.test.ts` — extend: `app/places/[kind]/[slug]/page.tsx` and `app/places/[kind]/page.tsx` do **not** import `next/headers` or `@/lib/saver`; detail page still has `revalidate = false` (pins D3 against a future "just read the cookie" shortcut).
- `subscribe-placement.test.ts` — unchanged and still green (one band per page).
- `filterPlaces` — new visited/not-yet state in `places.test.ts`.

## Deploy (in order)

1. **Schema first, in Supabase SQL editor:** paste the D2 block. Idempotent; safe to re-run. Confirm `place_visits` exists with RLS enabled (Table editor → shield icon).
2. `npx tsc --noEmit` · `npm test` · `npm run build` · `npm audit` → 0.
3. Push to `main` (Vercel auto-deploys). No new env vars.
4. **Verify (the actual surface, on a phone):** `/places/splash-pad` shows no progress line cold → tap "Been there" on a row → line appears "Been to 1 of 50 splash pads in the metro", ♥ header count unchanged, nudge strip appears once → open that place's detail page: button shows checked (hydrated, page still static — check the response is CDN `HIT`) → `/saved` shows "Places you've been" and the keep-list form → request the link, open it in a private window: check-off is there, merged → `/api/visited` in a cookieless `curl` returns `{"slugs":[]}` → Vercel function log shows **no** invocation for the detail page.
5. Deploy guide: `docs/deploy-history/DEPLOY-PLACES-P5-BEEN-THERE.md`. Update `docs/PLACES.md` (data model + pages) and the saved-events section of `docs/ARCHITECTURE.md` (identity now carries two lists).

**Rollback:** revert the commit. The table is additive and inert without the code; leave it.

## Size and dependencies

**M, one session.** Depends on nothing unbuilt. Does not touch the pipeline, the digest, or the events tables.

## Taren's calls (surfaced, not pre-decided)

1. **The word.** "Been there" (recommended — it's how people say it), "Visited," "Done," or "Checked off." One string in `lib/editorial.ts`.
2. **Which kinds show the progress line.** Default: all of them, with the D4 framing doing the honesty work. Alternative: only exhaustive kinds get the line, curated kinds get just the checks. Recommendation: all — "4 of the 22 on our list" is still a fun number.
3. **Does the check-off nudge mention the digest?** The save nudge does ("…or get the week's best, emailed every Thursday"). Recommendation: no — keep the places nudge single-purpose (keep your list); the digest ask already lives in the band.

## Phase 2 (explicitly not in this item)

- **Share card:** an OG image "31 of 50 splash pads" for a reel or a text. Needs a public URL carrying the count without a DB read (query-param OG route); spec when there's a first person who'd share one.
- **Seasonal passport:** "Splash Pad Summer '27" — a named, dated challenge with a themed kind page intro, one digest mention per month, and a finisher line. Build in March per the guide-ahead-of-season rule.
- **Ops digest line:** "N places checked off this week" once the number is non-trivial.
