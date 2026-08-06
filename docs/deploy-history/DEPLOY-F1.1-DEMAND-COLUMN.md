# Deploy F1.1 — evidence-based coverage (the demand column)

*August 2026. Roadmap v5 F1.1 (v4 4.1), the first F1 ripening item. Its gate —
`event_stats` with ~4 weeks of depth — is met: 23 days / 2,200 counted actions
as of the build.*

## What shipped

Coverage-so-far answered "do we have enough events?" It couldn't answer "does
anyone want them?" F1.1 adds the **demand side** to Admin → Coverage.

- **[lib/coverage.ts](../../lib/coverage.ts): `assessDemand(demand, published)`**
  — pure, golden-tested. Per category: 30-day views / ticket clicks / saves,
  plus two derived reads: **intensity** = views per upcoming published event
  (null when there's no upcoming supply — undefined, not zero), and **CTR** =
  ticket clicks / views (guarded). Sorted by intensity descending, so the
  **under-served categories float to the top** and no-supply rows sink. A
  `hasSignal` flag (≥ 50 total views) gates the whole table — honest emptiness,
  no grid of near-zeros pretending to mean something.
- **[lib/admin.ts](../../lib/admin.ts): `getCategoryDemand(30)`** — the query
  (event_stats ⋈ events, grouped by category), never-break: `[]` on no-DB or
  failure, so the page degrades rather than 500s. Counts stats regardless of the
  event's current status (a view on a now-archived event still measures category
  interest). Supply denominator reuses `report.totals` — one source, so the
  demand table and the supply grid can't disagree.
- **[/admin/coverage](../../app/admin/coverage/page.tsx)** renders the demand
  table below the supply grid, framed as a supply *signal*, not a verdict.

## Verification (observed, not intended)

The exact page server-logic run against **real prod data** produced the insight
the feature exists for:

| Category | Upcoming | Views | Clicks | CTR | Views/event |
|---|---|---|---|---|---|
| Unique | 6 | 68 | 7 | 10% | **11.3** ← under-served |
| Festival | 37 | 136 | 35 | 26% | 3.7 |
| Food | 44 | 145 | 30 | 21% | 3.3 |
| Family | 48 | 58 | 11 | 19% | 1.2 |
| Arts | 85 | 96 | 18 | 19% | 1.1 |
| Music | 117 | 126 | 11 | 9% | 1.1 ← most supply, low demand |
| Sports | 45 | 34 | 3 | 9% | 0.8 |

The supply floors demand the most of Music (floor 6/wk, and it's the most-
supplied) — but demand says **Unique** is the real gap and Music is over-invested.
`hasSignal=true` on 663 views.

- Tests +10 (787/787): intensity math + under-served-first sort; CTR guarded
  against divide-by-zero; null intensity (demand, no supply) sinks below
  measurable rows; every category appears once; hasSignal floor; totals.
- Gate: tsc clean · 787/787 · build clean · audit 0.
- **Not observed here:** the rendered HTML — /admin/coverage is behind admin
  Basic auth (I don't handle the password). The data path is proven above and
  the markup is a standard table; visual confirm is on the checklist.

## Deploy steps

Push to `main`. Code-only, no schema (reads existing `event_stats`).

## Verify checklist

- [ ] Open **/admin/coverage** → below the supply grid, a "Demand (last 30
      days)" table, sorted with Unique on top, Sports at the bottom.
- [ ] The reading it gives: **more Unique supply, and Music may be over-served** —
      does that match your gut? (This feeds F1.2 trending calibration next.)

## Rollback

`git revert`. Read-only feature; nothing to undo in data.
