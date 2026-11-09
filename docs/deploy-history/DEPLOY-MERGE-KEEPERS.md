# Deploy: times survive merges, and hidden rows stay out of them

**Date:** 9 November 2026 · **Schema:** none · **Order:** push only; no SQL to run

## What shipped

- **Every tool that changes a start time now updates the "All day" flag.**
  - **`npm run correct`:** when a correction gives a listing a start time, the tool
    writes `all_day` to match. Before, it changed the time and left the flag on, so
    the page still printed "All day".
  - **The `/admin` edit form and `scripts/restore-drafted.ts`:** these had the same
    gap and are fixed too.
  - **A test now guards all of them.** It fails any statement in `lib/` or `scripts/`
    that writes `start_at` without saying what `all_day` becomes.
- **The weekly merge keeps the row that has a time**, once the older rules have
  ruled. When the collapse finds two copies of one event, the order is:
  1. the row whose span runs longest
  2. the run's own rows over a sub-event folded into it
  3. a row an operator corrected
  4. **then, new:** a row with a start time over a date-only one
  5. the shorter title

  The duplicate step uses the same idea in its own order: a corrected row first, then
  a timed row over a date-only single-day one, then the earliest found.
- **The merge steps leave hidden rows alone.** Both now look at live listings only. A
  hidden (draft) row can't keep a live row's slot, and it can't be archived either.
  Archiving a hidden row would bring its event page back, which undoes a takedown.
- **A correction file that names one listing twice is refused** for that listing. The
  second entry would have quietly written the first one's old values back.

## Why

Sunday's local research run (8 Nov) hit three problems that paid runs share:

- **20 listings showed "All day"** after the 9 Nov corrections gave them their real
  times: 15 Cedar shows, AJ McLean, Tuffie and three market weekends. They were fixed
  by hand the same morning (backup `2026-11-09-all-day-flag-before.json`).
- **The fair's own Merry Market rows were archived.** A blog's "Minnesota Merry
  Market", with no hours, became the merge parent of the fair's "…Weekend 2" and
  "Weekend 3" rows (10 am-4 pm). It won on its shorter title, and the timed rows were
  archived.
- **The Plymouth book sale disappeared.** The duplicate step kept the hidden Edina row
  (same day, same placeholder venue, titles 0.66 alike) and archived the live Plymouth
  sale. Run on today's data, the old query would have archived Plymouth again at the
  next pipeline run. The new one archives nothing.

The first version of this fix got through the full quality gate and still had two
regressions. An adversarial review found them: nine agents, 22 deliberate breaks to
the code, and a second agent trying to disprove each finding.

- **A run lost to one night of itself.** A run stored as a single row with its last
  day in `end_at` would have lost to a timed night on its first day. Twelve Kinds of
  Ice (Oct 19 to Nov 22) has exactly that shape.
- **A festival lost to its own sub-event.** Its date-only rows would have lost to a
  timed sub-event folded into it, such as a fireworks night.

The review also found that two hidden rows could still be paired, which could archive
an older takedown. All of this is fixed and tested here.

## Design decisions

- **One midnight rule.** `isDateOnlyWallClock` in `lib/dates.ts` is the only
  definition of "no time of day". `normalizeAgentTime`, the correction tool, the admin
  form, `restore-drafted` and the collapse all call it. The duplicate step's SQL spells
  out the same test. The rule lives in `dates.ts` because putting it in
  `time-integrity.ts` would create an import loop through `seo/event-jsonld.ts`.
- **In a correction, the flag follows the start.** A correction file has no `all_day`
  field: stating `start` sets the flag from the clock. Stating an *unchanged* start
  also repairs a flag that some other writer left wrong. That keeps the verified stamp,
  because the time didn't change.
- **The admin form can still set a genuine midnight.** A real time clears the flag,
  and midnight leaves it as it was.
- **`restore-drafted` only clears the flag for a confirmed time.** If the time is
  unconfirmed, it stays hidden behind "All day".
- **The new time rule sits below the old ones.** Span length now reads both span
  columns, through `spanEndISO`, the site's own span rule. A sub-event folded into a
  longer run ranks after the run's own rows. A child with the *same* dates as its parent
  is treated as the same event under a longer title. That's the Merry Market case, so
  the time rule decides it.
- **Hidden rows are left out entirely** rather than kept apart by status. That's the
  only way neither direction can archive a takedown.
- **The admin duplicates page uses the same rules,** and a test checks that its
  candidate set and keeper order match the duplicate step's.

## Known limits

- **A time isn't a venue.** If the date-only row is actually the newer fact, the timed
  row now wins with the old venue. AJ McLean moved to the Fine Line, and this rule would
  have kept the First Avenue row: right time, wrong room. That row is fixed by hand.
- **The duplicate step can still archive a run card when a timed night was found
  first.** That's the old "earliest found" behaviour: the new rule never demotes a run
  card, but it doesn't promote one either. The collapse step, which prefers spans,
  runs after it and never sees the archived card.
- **The duplicate step's date-only test is by date.** A date-only row whose end falls
  just after midnight doesn't count, so the old rule decides for it. The collapse uses
  the site's late-night rule, so the two steps can treat that one shape differently.
- **The insert check still lets a hidden row block a new one.** This was **not
  changed**. Before research inserts a listing, `withoutLiveDuplicates` skips it if a
  similar row exists, and that check includes hidden ones. Over 60 days it skipped 235
  listings, 18 of them because of a hidden row.
  - **Useful blocks:** some stopped re-finds of hidden fabrications, such as the
    year-shifted Toddler Music Lab rows.
  - **Harmful blocks:** others hid real events. The Nokomis book sale on 14 Nov is
    missing because of the hidden Edina row, and a Gophers game was blocked by a hidden
    row for a different opponent.

  That's a product call between keeping fabrications out and keeping real events in,
  so it's left for Taren.
- **Hidden duplicates now stay in the table** instead of being archived. They aren't
  shown anywhere.
- **The admin form still doesn't lock its edits.** It never sets `corrected_at`. That's
  unchanged, and the form now at least keeps the time visible.
- **Black Nativity (1 Dec)** is still flagged all-day with a 7:30 PM start, from an
  older writer. Once someone confirms the time on Penumbra's page, re-state its start
  in a correction file and the flag will follow.

## Tested

- **Type check, build and audit:** `npx tsc --noEmit` is clean. `npm run build` was
  clean for the first round, built in a separate copy because another session's dev
  server shares this checkout. `npm audit` found 0 vulnerabilities. The full suite
  result is in the commit message.
- **Review, round 1:** of the 22 breaks, the tests caught 19. Two of the three misses
  were real gaps: the `and` joining the two halves of the date-only test, and the admin
  page's candidate filter. Both are now pinned. The third was the bare-date case of
  `isDateOnlyWallClock`, which now has its own test.
- **Round 2, all caught after the fixes:**
  - **Planner:** five deliberate breaks:
    - span tie-break blind to `end_at`
    - sub-event rank removed
    - corrected rank removed
    - hidden rows planned again
    - every fold child marked as a sub-event
  - **Writer guard:** the new `all_day` line removed from the admin form, then from
    `restore-drafted`.
- **New golden tests:**
  - **Merry Market:** the real fold, with and without its stored end times.
  - **Twelve Kinds of Ice:** the run row stored as one row keeps its slot.
  - **Woodbury Days:** the festival keeps its card over the fireworks.
  - **Plymouth:** the corrected row keeps its slot.
  - **Same-day and sports copies:** the timed copy wins.
  - **Hidden rows:** left alone in both directions and in folds.
  - **Correction-tool flag cases:** six of them.
  - **The writer guard and the duplicate-id refusal.**
- **Live data, read-only:**
  - **Planned, not run:** the exact `dedupeNearDuplicates` statement from the file
    passes `EXPLAIN`, which plans it without running it.
  - **As a SELECT:** the same statement would archive 0 rows today. The old rule would
    have archived 1, the Plymouth sale.
  - **Collapse planner:** 0 actions on today's data under both versions.

## Deploy

1. Push to `main`. Vercel redeploys. The only site code that changed is the admin
   duplicates page and the admin edit form.
2. The pipeline uses the new rules from its next run. The Sunday 7 pm scheduled task
   runs from `C:\Users\mccul\Documents\Event_Site\citypulse-mn`, so that checkout must
   contain this commit. It does if you pushed from there, or after `git pull`. GitHub's
   Monday run uses `main`.
3. Nothing to run in Supabase.

## Verify

After Sunday's run (15 Nov), in the Supabase SQL editor. Both queries read the run's
own start and finish times from `pipeline_runs`, so they work whenever you run them.

```sql
-- 1. Timed rows archived beside a date-only twin that stayed live. Expect 0 rows.
with run as (select started_at, finished_at from pipeline_runs where ok order by started_at desc limit 1)
select b.title as archived, a.title as kept,
       to_char(b.start_at at time zone 'America/Chicago', 'Mon DD HH24:MI') as at
from run, events b
join events a
  on a.status = 'published' and b.status = 'archived'
 and (b.start_at at time zone 'America/Chicago')::time <> '00:00'
 and (a.start_at at time zone 'America/Chicago')::time = '00:00'
 and (coalesce(a.multi_day_end, a.end_at, a.start_at) at time zone 'America/Chicago')::date
     = (a.start_at at time zone 'America/Chicago')::date
 and (a.start_at at time zone 'America/Chicago')::date = (b.start_at at time zone 'America/Chicago')::date
 and similarity(a.title, b.title) > 0.4
where b.updated_at between run.started_at and run.finished_at;

-- 2. Upcoming listings the run archived, with the live row that covers each.
--    Paid runs archive 27-34 a week, nearly all duplicates. Expect every row to
--    have covered_by filled; an empty one is a listing that vanished — check it.
with run as (select started_at, finished_at from pipeline_runs where ok order by started_at desc limit 1)
select b.title, to_char(b.start_at at time zone 'America/Chicago', 'Mon DD HH24:MI') as at,
  (select string_agg(a.title, ' / ') from events a
    where a.status = 'published' and similarity(a.title, b.title) > 0.4
      and (a.start_at at time zone 'America/Chicago')::date <= (b.start_at at time zone 'America/Chicago')::date
      and (coalesce(a.multi_day_end, a.end_at, a.start_at) at time zone 'America/Chicago')::date
          >= (b.start_at at time zone 'America/Chicago')::date) as covered_by
from run, events b
where b.status = 'archived' and b.updated_at between run.started_at and run.finished_at
  and coalesce(b.multi_day_end, b.end_at, b.start_at) > now()
order by b.start_at;
```

Correction tool, without writing anything. Save this as `check.json` and run
`npm run correct -- --from=check.json` (no `--apply`):

```json
[{ "id": "0e750060-c9ca-447e-907f-a235e1f5925d", "start": "2026-12-01T19:30",
   "why": "dry-run check that a re-stated start repairs the all-day flag" }]
```

Expect `all_day: true → false` and nothing else. Don't apply it until the 7:30 PM time
has been checked on Penumbra's page.

## Rollback

`git revert` both commits and push. Nothing changed in the schema, and no data was
migrated. A row that the new rules kept where the old ones would have archived it (or
the other way round) can be fixed with a normal correction: `archive: true`, or
`publish: true` with evidence.
