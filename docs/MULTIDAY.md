# Multi-day events & duplicates

Roadmap 4.4. A 12-day State Fair is **one** card that says "Aug 20 – 31," not twelve rows crowding everything else off the calendar.

## Three problems that look identical

The live export showed "Woodbury Days" ×3, "Slavic Experience Festival" ×3, "Day Block Brewing Date Night" ×4. Those are **not the same problem**, and treating them the same would delete real events:

| Pattern | Example | Treatment |
|---|---|---|
| **Multi-day run** — one festival, stored once per day | Woodbury Days ×3 (same venue, consecutive days) | **Collapse** into one event with a date span |
| **True duplicate** — same event found repeatedly with different venue guesses | Slavic Experience Festival at "Lenox Community Center" / "Westwood Hills Nature Center Area" / "St. Louis Park (venue TBA)" | **Merge** — keep one, archive the rest |
| **Legitimate recurrence** — a real weekly series | Day Block Brewing Date Night ×4, Walker Free Thursday Night ×4 | **Leave alone** — these are four real, separate nights |

The distinguishing rule: **only CONSECUTIVE days form a run** (gap ≤ 1 day). A weekly series has 7-day gaps, so it never collapses. That single rule is what protects the recurring events, and it's the most important thing this feature gets right.

The pre-existing dedup only merged events within 250m of each other — which is why the Slavic duplicates slipped through, since the agent guessed venues on opposite sides of town. Grouping is now by **title + city**, so distance can't hide a duplicate, while genuinely different events (a farmers market in Bloomington vs. Burnsville) stay apart.

## How it works

- `lib/multiday.ts` (pure, unit-tested): `normalizeRunTitle` (strips "2026", "Weekend 1", "(Second Edition)", possessives), `runKey` (title + city), `groupRuns` / `collapsibleClusters`, and the display helpers `isMultiDay`, `multiDayLabel`, `runLength`, `spansDay`.
- `collapseMultiDayRuns()` in `lib/upsert.ts` applies it: keeps the earliest row of each cluster, sets `multi_day_end` when the cluster spans days, archives the extras. Runs at the end of every pipeline run. Nothing is deleted — extras are archived, so it's reversible.
- `scripts/collapse-multiday.ts` (`npm run collapse`) backfills the existing database, with a `--dry-run` preview.

## Display

A multi-day event shows a gold **"Aug 20 – 31"** badge instead of a start time, and its detail page reads "runs 12 days · daily from 9 AM".

Crucially, it appears on **every day it spans** — in the calendar, in day pages, and in "what's on today". The Aquatennial is genuinely happening on Thursday, not just on its opening day. That's handled by `daysSpanned` (client) and a span-aware `getEventsForDay` query (server), with a 60-day cap so a bad `multi_day_end` can't balloon the calendar.

## Schema

`events.multi_day_end timestamptz` — the last day of the run, `null` for ordinary events. Additive and idempotent.
