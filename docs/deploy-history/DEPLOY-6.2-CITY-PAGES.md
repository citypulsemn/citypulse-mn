# Deploy Guide — Roadmap 6.2: City Landing Pages

**The other SEO axis.** 6.1 answered "first avenue schedule"; 6.2 answers **"things to do in Bloomington"** — a landing page per metro city, from the two downtowns to the suburbs, each listing its upcoming events with the search-phrased title that query deserves. (The neighborhood half of 6.2's original spec shipped early as 5.5 — this completes the item.)

**Code-only deploy. No database step, no new secrets.**

---

## The design

**Derived from the area machinery, one normalization everywhere.** `lib/cities.ts` builds pages from the same `CITY_AREA` map that powers the area filter — ~110 metro cities — and matches events through the *same* `normalizeCity` the filter uses. "Saint Paul", "St. Paul", and "st paul, MN" all land on one page, guaranteed by construction rather than by hoping two normalizers agree.

**The thin-content rule — the SEO judgment call that matters.** Most of those ~110 suburbs are quiet most weeks, and a hundred empty pages is spam, not SEO. So:
- **Every mapped city has a stable URL** — `/cities/edina` renders an honest empty state rather than 404ing in a quiet week, so links never rot.
- **The index and the sitemap only surface cities with upcoming events.** The smoke test caught my first sitemap filter using *all* published events instead of *upcoming* ones — fixed before shipping, so the sitemap and the index now agree by the same rule.
- Unmapped cities (Duluth) 404 — the metro is the beat.

**Cross-linked both directions.** Minneapolis and St. Paul pages list their districts with upcoming events ("By neighborhood: Uptown · Northeast · …"), and every neighborhood page's eyebrow now links *up* to its city page. Search engines and humans both get a coherent geography: city → neighborhood → venue → event.

## Quality bar (all green)
- **482 tests (21 new)** — display-name canonicalization ("st louis park" → "St. Louis Park", "west st paul" → "West St. Paul"), the variant family collapsing to one slug, unknown-city rejection, unique slugs, and round-trips for all ~110 pages.
- Live smoke of the full loop: index, `/cities/minneapolis`, a variant-named suburb, the stable empty-suburb URL, the Duluth 404, the neighborhood→city eyebrow link, and the sitemap.
- Route modes per the recorded rule: index prerenders (`○`), slug pages on-demand (`ƒ`) — zero build-time DB dependency, confirmed in the manifest.
- Typecheck clean, build clean, **0 vulnerabilities**.

---

## Deploy

Unzip `citypulse-mn.zip` over your repo, commit (`City landing pages (roadmap 6.2)`) → push.

## Verify

- [ ] `/cities` — Minneapolis and St. Paul lead their own sections, active suburbs grouped by metro area with counts.
- [ ] `/cities/minneapolis` — the "By neighborhood" row links into districts; any Uptown page's eyebrow links back.
- [ ] `/cities/maplewood` (or wherever the fair is) — suburb events list correctly.
- [ ] `/cities/duluth` → 404. `/cities/edina` in a quiet week → a polite empty page, not an error.
- [ ] `sitemap.xml` — city URLs present only for cities that currently have events.

## Rollback
Roll back the deploy. Nothing was written anywhere.

---

## Phase 6 status

6.1 venues ✓ · **6.2 cities + neighborhoods ✓**. Next: **6.3 the evergreen "this weekend" URL** — one permanent page that always shows the coming weekend, the highest-intent search in local events and the natural Instagram bio link; it's the smallest build in the phase. Then **6.4 Instagram automation** closes the weekly Reels loop. Still open behind us: **5.6 ops digest**, **5.7 Ongoing strip**, and the standing **multi-day collapse** export — the State Fair remains quadrupled until we run it.
