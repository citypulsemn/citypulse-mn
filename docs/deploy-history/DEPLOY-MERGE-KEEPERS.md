# Deploy: times survive merges, and hidden rows stop winning

**Date:** 9 November 2026 · **Schema:** none · **Order:** push only; no SQL to run

## What shipped

- **Corrections set the "All day" flag.** When a correction gives a listing a start
  time, `npm run correct` now writes `all_day` to match. Before, it changed the time
  and left the flag on, so the page still printed "All day".
- **The weekly merge keeps the row that has a time.** When the collapse step finds two
  copies of one event on the same day, a row with a start time now beats a date-only
  row. Before, the date-only copy often won because its title was shorter or its
  midnight sorted first.
- **Hidden rows and live rows are never merged.** The duplicate step and the collapse
  step now only pair rows of the same status. Before, a hidden (draft) row could keep
  the slot and archive the live listing beside it.

## Why

Sunday's local research run (8 Nov) hit all three:

- **20 listings showed "All day"** after the 9 Nov corrections gave them their real
  times: 15 Cedar shows, AJ McLean, Tuffie and three market weekends. They were fixed by
  hand the same morning (backup `2026-11-09-all-day-flag-before.json`).
- **The fair's own Merry Market rows were archived.** A blog's "Minnesota Merry Market",
  with no hours, became the merge parent of "…at the State Fair – Weekend 2" and
  "Weekend 3" (10 am-4 pm, from the fair's page). It won on its shorter title, and the
  timed rows were archived.
- **The Plymouth book sale disappeared.** The Edina sale, hidden on 6 Nov because it
  doesn't exist, was on the same day at the same placeholder venue, with titles 0.66
  alike. The duplicate step kept the hidden Edina row and archived Plymouth, which then
  showed nowhere. Run on today's data, the old query would have archived Plymouth again
  at the next pipeline run; the new one archives nothing.

## Design decisions

- **One midnight rule.** `isDateOnlyWallClock` in `lib/dates.ts` is now the only
  definition of "no time of day". `normalizeAgentTime`, the correction tool and the
  collapse all call it, and the duplicate step's SQL spells out the same test. It lives
  in `dates.ts` because putting it in `time-integrity.ts` would create an import loop
  through `seo/event-jsonld.ts`.
- **The flag follows the start, never the operator.** A correction file has no `all_day`
  field. Stating `start` sets the flag from the clock. Stating an *unchanged* start also
  repairs a flag that some other writer left wrong, and it leaves the verified stamp
  alone, because the time didn't change.
- **A curated run card still beats a timed single day.** In the collapse, the row that
  already carries a multi-day span is still preferred first, and the timed rule only
  breaks ties after that. Otherwise a festival card could be archived for one timed
  night inside it.
- **In the duplicate step, "thin" means date-only and single-day.** A row whose span
  runs past its start day is never thin, so the same protection holds there.
- **Status separation works both ways.** A hidden row can't archive a live one, and a
  live row can't archive a hidden one either. Archiving a hidden row would bring its
  event page back, which undoes a takedown.
- **The admin duplicates page follows the same rule**, so its keep and duplicate labels
  match what the pipeline does. A test checks that the two queries match.

## Known limits

- **A time isn't a venue.** If the date-only row is actually the newer fact, the timed
  row now wins with the old venue. AJ McLean moved to the Fine Line, and this rule would
  have kept the First Avenue row: right time, wrong room. (It's fixed in the data.)
- **The insert check still lets a hidden row block a new one.** This was **not
  changed**. Before research inserts a listing, `withoutLiveDuplicates` skips it if a
  similar row exists, and that check includes hidden ones. Measured over 60 days: it
  skipped 235 listings, 18 of them because of a hidden row. Some of those blocks were
  useful, stopping re-finds of hidden fabrications such as the year-shifted Toddler
  Music Lab rows. Others hid real events: the Nokomis book sale on 14 Nov is missing
  because of the hidden Edina row, and a Gophers game was blocked by a hidden row for a
  different opponent. That's a product call between keeping fabrications out and
  keeping real events in, so it's left for Taren.
- **Hidden duplicates of live rows now stay hidden** instead of being archived. They
  aren't shown anywhere. They just stay in the table.
- **Corrected rows can still be merged away** by a better duplicate. The correction lock
  protects their fields from research, not their status from the merge steps. Not
  requested and not changed.
- **Black Nativity (1 Dec)** is still flagged all-day with a 7:30 PM start, from an
  older writer. Once someone confirms the time on Penumbra's page, re-state its start in
  a correction file and the flag will follow.

## Tested

- `npx tsc --noEmit` clean. `npm test`: 156 files, 3,348 tests, all passing. The first
  run of the day crashed Node with a native stack trace and didn't repeat on rerun.
  `npm audit`: 0 vulnerabilities. The build ran in a separate copy, because another
  session's dev server shares this checkout.
- **New golden tests:**
  - **Corrections:** a show time clears the flag; midnight sets it, matching
    `normalizeAgentTime` at four clock times; a timed-to-timed move leaves the flag out
    of the plan; a correction with no start never touches it; re-stating a start repairs
    a stray flag without touching the stamp; re-running the file is a no-op.
  - **Collapse:** the real Merry Market fold, the same-day midnight-first case, a sports
    copy, a span card beating a timed night, the title tie-break between two date-only
    rows, both directions of status separation, drafts still collapsing among
    themselves, and a fold across statuses being refused.
  - **Query checks:** the dedupe's keeper order, `thin`, same-status pairing, and the
    admin page's `thin` text being identical to the dedupe's.
- **Live data, read-only:** the old and new duplicate rules were run side by side as
  SELECTs. The old rule would have archived 1 row (Plymouth), the new one 0. The
  collapse planner has 0 actions on today's data under both. The exact
  `dedupeNearDuplicates` statement passes `EXPLAIN` against production, which plans it
  without running it.

## Deploy

1. Push to `main`. Vercel redeploys. The only site code that changed is the admin
   duplicates page's query.
2. The pipeline uses the new rules from its next run. The Sunday 7 pm scheduled task
   runs from `C:\Users\mccul\Documents\Event_Site\citypulse-mn`, so that checkout must
   contain this commit. It does if you pushed from there, or after `git pull`. GitHub's
   Monday run uses `main`.
3. Nothing to run in Supabase.

## Verify

After Sunday's run (15 Nov), in the Supabase SQL editor:

```sql
-- 1. Did any timed row get archived beside a date-only twin that stayed live? Expect 0 rows.
select b.title as archived, a.title as kept, to_char(b.start_at at time zone 'America/Chicago', 'Mon DD HH24:MI') as at
from events b
join events a
  on a.status = 'published' and b.status = 'archived'
 and b.updated_at > now() - interval '1 day'
 and (b.start_at at time zone 'America/Chicago')::time <> '00:00'
 and (a.start_at at time zone 'America/Chicago')::time = '00:00'
 and (coalesce(a.multi_day_end, a.end_at, a.start_at) at time zone 'America/Chicago')::date
     = (a.start_at at time zone 'America/Chicago')::date
 and (a.start_at at time zone 'America/Chicago')::date = (b.start_at at time zone 'America/Chicago')::date
 and similarity(a.title, b.title) > 0.4;

-- 2. Is the Plymouth sale still live? (It runs 14 Nov, so check before then.)
select status from events where id = 'ae4edde1-c9df-471d-ab2b-c1c07e77050a';
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

`git revert <this commit>` and push. Nothing changed in the schema, and no data was
migrated. A row that the new rules kept where the old ones would have archived it (or
the other way round) can be fixed with a normal correction: `archive: true`, or
`publish: true` with evidence.
