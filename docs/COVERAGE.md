# Coverage monitor

Roadmap 4.3. Answers one question every week: *how many events do we have, per category, per week, for the next month* — and flags anything below a floor.

## Why this exists

The Live Music collection sat empty for weeks and nobody knew. It was found by a human looking at the site.

That's the real failure — not the gap itself, but the **absence of any instrument that would report one**. The pipeline ran green every Monday while shipping a calendar with a hole in it, because "the job succeeded" says nothing about whether its *output* is any good. 4.1 fixed classification and 4.2 fixed discovery, but without this, both can silently regress and you'd find out the same way you did last time.

## What it does

`lib/coverage.ts` (pure, unit-tested) builds a **category × week grid** from published events and grades each cell against a floor:

- **ok** — meets the floor
- **thin** — below the floor
- **empty** — zero events; a visitor would see a dead collection

It surfaces in two places you already look:

1. **Admin → Coverage** — the grid, with a banner counting empty and thin cells, and a short "what to do" note.
2. **The pipeline run log** — every weekly run ends by grading the calendar and printing the gaps, so a thin category is visible in the GitHub Actions output without anyone going looking.

## The floors

```
music 6 · arts 4 · family 3 · food 3 · sports 2 · festival 2 · weird 1
```

These are **editorial judgments about the Twin Cities, not statistics**. A week with no live music is broken; a week with no "unique" oddity is just a normal week. Music carries the highest floor because it's the most-searched and least-aggregated category. They're set deliberately low so a flag means something when it fires. Tune them in `WEEKLY_FLOORS`.

## Reading a flag

An empty or thin category is almost always a **discovery** problem, not a classification one:

1. Add rooms for that category to the venue registry (`lib/venues.ts`) so the next run sweeps them — that's the 4.2 lever.
2. Check **Admin → Pipeline** for agent failures in that category.
3. Only if events exist but are landing in the wrong bucket is it a classifier issue (`docs/CLASSIFICATION.md`).

## Notes

- Weeks are Monday-based and forward-looking from today.
- Sports legitimately goes quiet in the offseason — that's why its floor is low. If a flag is expected and permanent, lower the floor rather than learning to ignore the dashboard.
- In local dev without a database, the grid grades the sample calendar; since the sample events are dated in the past, the dev grid reads empty. That's correct for a forward-looking monitor.
