# Deploy Guide — Roadmap 6.1: Venue Pages

**Phase 6 — Growth — opens with the largest cheap SEO surface the site has.** People don't search "events aggregator"; they search **"first avenue schedule."** As of this deploy, `/venues/first-avenue` exists to be that answer — and so do 41 siblings: every room in the 4.2 sweep registry gets a page with its upcoming shows, address, neighborhood, a map, and Place JSON-LD.

**Code-only deploy. No database step, no new secrets** — the map reuses your existing public Mapbox token.

---

## The design: a page layer over the registry you already curate

The 4.2 venue registry is pipeline config — it tells the Monday agent which calendars to sweep. 6.1 derives the public pages **from** it without touching it:

- **Registry-first, not string-first.** Pages exist for the ~40 rooms people actually search, with stable URLs and curated names — not a junk slug for every venue string that ever passed through the pipeline.
- **Free-text matching with an alias table.** Events say "First Ave," "7th St Entry," "The Dakota," "Como Zoo," "Xcel" — all find their rooms through normalization + aliases, golden-tested with 15 realistic strings. Unknown basements stay unmatched; no page claims them.
- **The building's facts come from its own events.** Coordinates and address are the **most common** values across the venue's events — the mode, not the mean — so one bad geocode is outvoted rather than dragging the map pin into the river. Past events count: history knows where the building is even in a quiet week.

## What's on the site

1. **`/venues`** — active venues grouped by city with upcoming counts; quieter registry venues follow as a compact link list so all 42 pages stay reachable and crawlable year-round.
2. **`/venues/first-avenue`** (and 41 more) — the schedule soonest-first, the address, the 5.5 neighborhood chip, a **directions link**, a **static Mapbox map** (a plain image — zero JavaScript added to an SEO page), and **Place JSON-LD** with geo + postal address for the search engines this phase courts.
3. **Event pages** — the venue name is now a link to its venue page when matched.
4. **Footer** gains Venues; the **sitemap** gains all 42 venue URLs — *and* the 16 neighborhood URLs that 5.5 should have added. That omission surfaced during this build and is fixed here; for a growth phase, pages search engines can't find don't exist.

Route modes follow the recorded rule from the 5.5 incident: the index prerenders (one query, like the homepage), the 42 slug pages are **on-demand ISR** — confirmed in the build manifest (`ƒ`), zero database dependency at build time.

## Quality bar (all green)
- **461 tests (22 new)** — slug/normalization behavior, curated overrides, the 15-string matching golden set, registry hygiene (42 unique slugs), the mode-beats-mean coordinate rule, and the map URL format.
- Live smoke in one pass: index renders with the quiet-venues list, `first-avenue` renders with Place JSON-LD and directions, bogus slugs 404, sitemap counts verified (42 + 16), event detail carries the venue link.
- Typecheck clean, build clean, **0 vulnerabilities**.

---

## Deploy

Unzip `citypulse-mn.zip` over your repo, commit (`Venue pages (roadmap 6.1)`) → push.

## Verify

- [ ] `/venues` — First Avenue, the Turf Club, and the other swept rooms show with counts.
- [ ] `/venues/first-avenue` — shows the schedule, the map pin sits on the actual building, the chip says Downtown Minneapolis.
- [ ] Open any show at a tracked venue — the venue name links to its page.
- [ ] `citypulsemn.com/sitemap.xml` includes `/venues/...` and `/neighborhoods/...` URLs.
- [ ] Optional, worth doing: submit the sitemap in Google Search Console to speed up indexing of the 58 new URLs.
- [ ] If a map pin or a venue match looks wrong, name the venue — aliases and coordinates are tunable in one place, guarded by the golden set.

## Rollback
Roll back the deploy. Nothing was written anywhere.

---

## What's next

Phase 6 continues with **6.2 neighborhood/city landing pages** (mostly done early — 5.5 built the pages; 6.2 would add city-level rollups), **6.3 the evergreen "this weekend" URL** (the highest-intent search in local events and the natural Instagram bio link — a small, satisfying build), and **6.4 Instagram automation** (one-click weekly cards + captions from the admin, aligned to your locked content rules). Still open behind us: **5.6 the ops digest**, **5.7 the Ongoing strip**, and the standing **multi-day collapse** export.
