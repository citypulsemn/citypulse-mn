# Deploy — G1.1 slice 5: subscriber conversion attribution

*August 2026. Tier 1 (audience). Code-only. Closes out G1.1.*

## What shipped

The measurement that makes the conversion overhaul **observable**. Slices 1–4
built the surfaces (the /this-week landing, sharpened band copy, band on home +
event pages, warm-lead nudge + digest referral). This adds the answer to "is it
working, and *which* surface converts?" on the live admin dashboard.

Every signup already stored its `source` (the page/placement it came from), and
the weekly **ops digest** already reports the last 7 days by placement. The gap
was the **pull dashboard** — Admin → Stats showed total + new-7d but no split.

- **[lib/subscribe.ts](../../lib/subscribe.ts)**:
  - `summarizeSubscriberSources(rows)` — **pure**: sorts placements by total desc
    (ties alphabetical), attaches a friendly label and each source's share of all
    subscribers. Does **not** merge distinct raw sources that share a label (e.g.
    `venue` / `venue-page`) — honest to the underlying data.
  - `subscribeSourceLabel(source)` — **pure**: maps the high-traffic sources
    (`home`→Homepage, `this-week`→This Week page, …) and prettifies anything
    unmapped, so every source renders readably. Blank/`site` → "Direct / other".
  - `getSubscribersBySource()` — cumulative counts grouped by source (+ a last-30d
    column), under the **never-break contract** ([] on any failure).
- **[Admin → Stats](../../app/admin/stats/page.tsx)** — a "Where subscribers come
  from" table (Placement · Subscribers · Last 30d · Share), gated on non-empty so
  it's honest-empty before any data.

## Verification

Gate: `tsc` clean · **1001** tests (+8 golden: label mapping, prettify fallback,
sort + share math, tie-break, no-merge, honest-empty, no-mutate) · `npm run build`
clean · `npm audit` 0.

**Live read-only probe** (the untested SQL axis, run against production):
```
total subscribed: 5 | last7d: 1
  Homepage (home): 3 total · 2 last30d · 60%
  Cities (cities): 1 total · 1 last30d · 20%
  Event pages (event): 1 total · 1 last30d · 20%
share sum: 100
```
Query executes, columns map, labels + shares correct.

## The finding (already actionable)

Of 5 subscribers, the **homepage band drives 60%**; the **/this-week landing has
converted 0** so far. That's not a failure — it's the newest, lowest-traffic
surface. It says: the homepage band is the workhorse, and /this-week needs
*traffic* (internal links, sharing) before its conversion can be judged. Feeds
G1.2 (SEO) and tells us where to point links.

## Deploy steps

Push to `main`. Code-only, no schema, no env. (Reads the existing
`subscribers.source` column.)

## Verify checklist

- [ ] Admin → Stats shows "Where subscribers come from" with rows summing to 100%.
- [ ] A new signup on a given surface increments that placement next render
      (≤ force-dynamic, so immediately).

## Rollback

`git revert`. Read-only reporting; nothing to undo in data.
