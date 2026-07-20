# Deploy Guide — Roadmap 5.5: Neighborhoods

**The site now speaks the way locals do.** "Minneapolis" is a filter; "Northeast on Friday" is a plan. Sixteen real Twin Cities districts — Uptown, Northeast, North Loop, Loring Park, Whittier & Eat Street, Downtown St. Paul & Lowertown, Midway, Como, and the rest — with browse pages, upcoming counts, and a tappable chip on every event that falls inside one.

**Code-only deploy. No database step, no backfill, no new secrets.**

---

## The design decision: coordinates, not addresses

Every event is already geocoded — so neighborhoods are **derived from lat/lng** by nearest-centroid-within-radius, computed at the read path (the same philosophy as 4.7's title cleaning). What that buys you:

- **No schema change and no backfill** — nothing was written anywhere.
- **Tunable forever**: adjust a centroid or radius in `lib/neighborhoods.ts`, redeploy, and every event past and future re-resolves instantly.
- **Honest by construction**: suburban events resolve to *no* neighborhood — "Maplewood" already says where the fair is; inventing a district would add nothing. And nearest-first resolves adjacent districts the way a local would: Target Field is North Loop, not Downtown.

## The golden set — the part that makes it trustworthy

Eighteen real venues at their real coordinates, each asserting the assignment a local would sign off on: **First Avenue → Downtown**, **the Walker → Loring Park**, **Icehouse → Whittier & Eat Street**, **the Turf Club → Midway**, **CHS Field → Downtown St. Paul & Lowertown**, **Como Zoo → Como**, plus suburb-null cases and the Downtown/North Loop boundary. If a centroid ever gets tuned, these tests are the guardrail against quietly breaking an assignment.

## What's on the site

1. **`/neighborhoods`** — a grid grouped by city, each district with a one-line local blurb and its upcoming-event count. **Only districts with upcoming events appear** — an empty card is a broken promise (same honesty rule as trending).
2. **`/neighborhoods/uptown`** (etc.) — upcoming events in the district, soonest first, multi-day aware, titled *"Things to Do in Uptown"* — the evergreen search phrasing Phase 6's SEO push will build on.
3. **Event pages** — a gold neighborhood chip next to the venue, linking to the district. Verified live: detail pages already carry `→ /neighborhoods/downtown-minneapolis`.
4. Footer gains a **Neighborhoods** link.

`EventRecord.neighborhood` is now available everywhere for future consumers — the digest, filters, and Phase 6 venue pages can all use it.

## Quality bar (all green)
- **439 tests (24 new)** — the 18-venue golden set, suburb honesty, the adjacency boundary, garbage-coordinate safety, registry hygiene (unique slugs, sane radii), and a haversine sanity check (the two downtowns are ~15 km apart, as they should be).
- Live-server smoke in one pass: index renders, district page renders, bogus slug → 404, detail chip present and linking correctly.
- Typecheck clean, build clean, **0 vulnerabilities**.

---

## Deploy

Unzip `citypulse-mn.zip` over your repo, commit (`Neighborhoods (roadmap 5.5)`) → push. Done.

## Verify

- [ ] `/neighborhoods` shows districts with counts — with 650+ geocoded events live, expect Downtown Minneapolis, Northeast, and Downtown St. Paul to lead.
- [ ] Open a First Avenue show → the chip says **Downtown Minneapolis** and links to the district page.
- [ ] A suburban event (the Maplewood fair) has **no** chip — correct, not a bug.
- [ ] `/neighborhoods/uptown` lists upcoming Uptown events, soonest first.
- [ ] If any assignment looks wrong to your local eye, tell me the venue — tuning a centroid is a one-line change guarded by the golden set.

## Rollback
Roll back the deploy. Nothing was written anywhere.

---

## Phase 5 status

5.1 ✓ · 5.2 ✓ · 5.3 ✓ · 5.4 ✓ · **5.5 ✓**. Remaining: **5.6 the ops digest** (coverage + verification flags + pipeline health in one weekly email to you — the smallest bite left, and the one that watches everything else) and **5.7 the Ongoing strip**. Plus the standing **multi-day collapse** data op — still ready whenever you send the export.
