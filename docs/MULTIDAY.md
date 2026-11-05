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

A run of **up to 14 days** appears on every day it spans — in the calendar, in day pages, and in "what's on today". The Aquatennial is genuinely happening on Thursday, not just on its opening day. That's handled by `daysSpanned` (client) and a span-aware `getEventsForDay` query (server).

**A LONGER RUN APPEARS ONLY ON ITS START DAY — IN THE GRID.** Since 5 Nov 2026 it also
appears in the day page's capped "Also running" shelf on every day it spans (lib/ongoing
`alsoRunningPlan`, and the same planner in the homepage day panel); the calendar CELLS and
their pills are still start-day-only, which is what the cap protects. `EXPAND_MAX_DAYS = 14` (`lib/dates.ts:177`) caps the client expansion, and `lib/events.ts` caps the server query at a 13-day date *diff* — 14 days inclusive of the start. R1.7b made the two agree after the server briefly allowed 15-day spans the day panel refused. So a 45-night light display shows on one evening in the grid, and **`/ongoing` is the surface that carries it** for the rest of the run (`lib/ongoing.ts`: started before today, still running by TRUE `spanEnd`, longer than 3 days).

This paragraph previously said a span "appears on every day it spans" with "a 60-day cap". Both were wrong — there is no 60-day cap anywhere in `lib/multiday.ts`, `lib/dates.ts` or `lib/events.ts` — and on 4 Nov 2026 that wrong doc led to three corrections being written up as if a 43–45-day span would render across its whole run. **Taren's call, 4 Nov 2026: the 14-day grid cap stays, and `/ongoing` is the right home for long runs.** The cap is what keeps a six-week exhibition from crowding out six weeks of concerts, which is the whole point of collapsing a run into one card.

The span still does real work beyond the grid even when it is long: `/ongoing`, `/this-weekend` and every "is this running on day X?" question read TRUE span intersection via `spanEnd()`, never the capped expansion — that is standing rule 5, and the 17-day fair that vanished from `/this-weekend` is why.

**Until 5 Nov 2026 that sentence had an exception, and it was the big one.** `isUpcoming` —
venue, city and neighborhood pages, their index counts, `/venue-report` and the sitemap's
supply test — read the CAPPED list, so a run past 14 days read as finished on its second
day. Fixed: the span rule now has one home (`lib/dates.ts spanEndISO`) and `spanEnd`
delegates to it. **The grid cap did not change** — `daysSpanned` still returns the start day
alone for a long run, and a test asserts that asymmetry deliberately so the next reader does
not "fix" it. The calendar grid is still start-day-only for a long run; the day page carries
it in the "Also running" shelf, and `/ongoing` still carries it too.
See [DEPLOY-ISUPCOMING-OVERCAP.md](deploy-history/DEPLOY-ISUPCOMING-OVERCAP.md).

## Schema

`events.multi_day_end timestamptz` — the last day of the run, `null` for ordinary events. Additive and idempotent.
