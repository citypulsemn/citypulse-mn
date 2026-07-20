# Deploy Guide — Roadmap 4.3: Coverage Monitor

**The instrument that would have caught the empty Live Music collection.**

You found that gap by looking at the site and noticing. That doesn't scale — and the pipeline ran green every Monday the whole time it was broken, because "the job succeeded" says nothing about whether its *output* is any good. 4.1 fixed classification, 4.2 fixed discovery; this makes sure neither can silently regress.

**Code-only deploy.** No database migration, no new environment variables.

---

## What you're deploying

**Admin → Coverage** — a category × week grid of published events for the next 4 weeks, with each cell graded:

- **ok** — meets its weekly floor
- **thin** — below the floor
- **empty** — zero events; a visitor would see a dead collection

Plus a banner counting the problems, and a short "what to do" note.

**And in the pipeline log:** every weekly run now ends by grading the calendar and printing the gaps — so a thin category shows up in your GitHub Actions output without you going looking:

```
[coverage] EMPTY Music          week of Jul 20: 0/6
[coverage] thin  Family         week of Jul 27: 1/3
[coverage] 2 category-week(s) below floor — see /admin/coverage
```

## The floors

`music 6 · arts 4 · family 3 · food 3 · sports 2 · festival 2 · weird 1`

These are **editorial judgments about the Twin Cities, not statistics**: a week with no live music is broken, a week with no oddity is just a normal week. Music carries the highest floor because it's the most-searched, least-aggregated category. Set deliberately low so a flag means something. Tune in `WEEKLY_FLOORS` (`lib/coverage.ts`).

Full reference: `docs/COVERAGE.md`.

## Quality bar (all green)
- 300 tests pass (14 new), typecheck clean, build clean, **0 vulnerabilities**.
- The suite includes a **regression test that reproduces your actual failure** — festivals full, live music empty — and asserts that shape now raises an alarm, and that a healthy Festivals count doesn't mask the music hole.
- Verified live: the page is admin-auth gated (401 → 200), the grid/banner/legend render, and all three cell states (ok / thin / empty) were confirmed against known inputs.

---

## Deploy

Unzip the new `citypulse-mn.zip`, copy **all** contents over your repo (replace), commit (`Coverage monitor (roadmap 4.3)`) → push. Vercel redeploys.

New: `lib/coverage.ts`, `app/admin/coverage/`. Changed: the pipeline, `lib/admin.ts`, admin tabs.

---

## Verify

- [ ] Open **/admin/coverage** — you get a grid with a row per category and a column per week.
- [ ] The banner reflects reality: after the 4.1 backfill and a 4.2 pipeline run, **Music should no longer be empty**. If it still is, that's the monitor doing its job — tell me and we'll widen the venue registry.
- [ ] After the next Monday run, the **GitHub Actions log** ends with `[coverage] …` lines.

### How to read a flag
An empty or thin category is almost always a **discovery** problem, not a classification one:
1. Add rooms for that category to `lib/venues.ts` (the 4.2 lever) so the next run sweeps them.
2. Check **Admin → Pipeline** for agent failures in that category.
3. Only if the events exist but sit in the wrong bucket is it a classifier issue.

One honest note: **sports legitimately goes quiet in the offseason.** If a flag is expected and permanent, lower that floor rather than training yourself to ignore the dashboard — a monitor you learn to tune out is worse than no monitor.

## Rollback
Roll back the deploy. Nothing in the database changes; the monitor is read-only.

---

## What's next (roadmap v2)

**Phase 4 is now complete** — classification (4.1), discovery (4.2), and the monitor (4.3) that keeps them honest. Two things remain in Phase 4 as I scoped it:

- **4.4 Multi-day events** — worth pulling forward. Your live data has "Woodbury Days" ×3, "Prior Lake Days" ×3, "Slavic Experience Festival" ×3, "Day Block Brewing Date Night" ×4. Multi-day festivals are generating a row per day and duplicates are slipping past the dedup key, which inflates counts and clutters the calendar. This is now the most visible data-quality problem on the site.
- **4.5 Freshness / cancellation re-verification.**

Then **Phase 5** (first-party analytics → trending → personalized digest), which is where the feedback loop finally closes: you'd be able to see what people actually click and save, and let that steer coverage instead of guessing.
