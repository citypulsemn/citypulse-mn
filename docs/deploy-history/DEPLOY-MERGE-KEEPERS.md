# Deploy: times survive merges, and merges stop losing listings

**Date:** 9 November 2026 · **Schema:** none · **Order:** push only; no SQL to run

## What shipped

- **Every tool that changes a start time now updates the "All day" flag.**
  `npm run correct`, the `/admin` edit form and `scripts/restore-drafted.ts` all used
  to change the time and leave the flag on, so the page still printed "All day". A test
  now fails any statement in `lib/` or `scripts/` that sets `start_at` without saying
  what `all_day` becomes.
- **When the weekly collapse finds two copies of the same event, the one with a time
  wins** a tie it used to lose. The full order for choosing which row to keep:
  1. the row on the earliest day
  2. in a fold, the parent's own rows over the folded child
  3. the row whose span runs longest, counting both `multi_day_end` and `end_at`
     (sports and music nights ignore spans)
  4. **then, new:** a row with a start time over a date-only one
  5. the shorter title

  In the duplicate step, a row with a time is kept over a date-only single-day one, and
  only then does the earliest-found row win.
- **The merge steps no longer archive operator-corrected rows or hidden rows.** A
  corrected row can still be the one kept; it's just never the one archived. If a
  corrected row duplicates another, both stay live: a duplicate you can archive, rather
  than a listing you vouched for being lost. Hidden (draft) rows are left out entirely:
  they can't keep a live row's slot, and they can't be archived. Archiving one would
  bring its event page back, which undoes a takedown.
- **A run is never cut short.** The collapse never writes an end date earlier than the
  kept row's own end.
- **A correction file that names one listing twice is refused** for that listing. The
  second entry would have quietly written the first one's old values back.

## Why

Sunday's local research run (8 Nov) hit problems that paid runs share:

- **20 listings showed "All day"** after the 9 Nov corrections gave them their real
  times. They were fixed by hand that morning (backup
  `2026-11-09-all-day-flag-before.json`).
- **The Plymouth book sale disappeared.** The duplicate step kept the hidden Edina row
  and archived the live Plymouth sale. Run on today's data, the old query would have
  done it again at the next run. The new one archives nothing.
- **The fair's own Merry Market rows were archived** under a blog's date-only row. See
  Known limits: the merge can't fix this shape safely, and today's rows are protected
  by their corrections instead.

Two adversarial reviews changed the design. Each used nine agents, made deliberate
breaks to the code, and had a second agent try to disprove every finding:

- **Round 1** found that the first version let one timed night archive a run stored in
  `end_at`, such as Twelve Kinds of Ice, Oct 19 to Nov 22. It also let a festival lose
  its card to its own fireworks.
- **Round 2** found three more problems with the fix:
  - **Sub-events:** a sub-event with its own end date could still win.
  - **Equal dates:** "same dates means same event" made a one-day festival's parade the
    festival's card.
  - **Corrected rows:** ranking them first let a corrected single night archive a run
    card.

  It also found an older bug: the collapse could write an earlier end over a run's
  `end_at`, cutting the run short.

The rules above are the version that fixes all of them.

## Design decisions

- **One midnight rule.** `isDateOnlyWallClock` in `lib/dates.ts` is the only definition
  of "no time of day". It's used by `normalizeAgentTime`, the correction tool, the admin
  form, `restore-drafted` and the collapse, and the duplicate SQL spells out the same
  test. It lives in `dates.ts` because `time-integrity.ts` would create an import loop.
- **In a correction, the flag follows the start.** There's no `all_day` field to set.
  Stating an unchanged start also repairs a flag left wrong by another writer, and it
  keeps the verified stamp.
- **The admin form can still set a genuine midnight.** A real time clears the flag, and
  midnight leaves it as it was.
- **`restore-drafted` follows the same rule both ways:**
  - a midnight answer means date-only
  - a confirmed time clears the flag
  - an unconfirmed time leaves the flag as it was
- **A folded child never becomes the card,** whatever its time or span. The planner
  can't tell a sub-event (a parade, fireworks) from the same event under a longer title,
  and every attempt to use dates for that made a sub-event the card.
- **A corrected row is protected from archiving, not promoted.** Promoting it let a
  corrected sub-event or single night take over a festival or a run.
- **The admin duplicates page uses the same rules**, and a test checks that its
  candidate set matches the duplicate step's exactly.

## Known limits

- **The Merry Market shape isn't fixed by the merge.** When a shorter-titled row (a
  blog's "Minnesota Merry Market") folds a longer-titled one (the fair's "…Weekend 2"),
  the shorter one keeps the card. That's the same shape as a festival and its parade.
  Today's Merry rows survive because they're corrected. The real fix is upstream: don't
  publish rows that cite only a roundup such as visitsaintpaul.com's blog. That's a
  product call.
- **A time isn't a venue.** If the date-only copy is actually the newer fact (AJ
  McLean moved to the Fine Line), the timed copy wins with the old room.
- **The earliest day still comes first.** A copy that starts a day earlier keeps the
  slot even over a longer run. A preview night on Oct 18 beats a run row that starts
  Oct 19.
- **In the duplicate step, a run card can still lose to a timed night found earlier.**
  That's the old "earliest found" rule; the new rule never demotes a run card, but it
  doesn't promote one either. Its date-only test is also by date, so a date-only row
  ending just after midnight falls back to the old rule.
- **Corrected duplicates stay visible.** Two live cards are possible where one is
  corrected. Archive the extra one with a correction.
- **The insert check still lets a hidden row block a new one.** This was **not
  changed**. Over 60 days, 18 of the 235 listings it skipped were blocked by a hidden
  row. Some were useful blocks of re-found fabrications; others hid real events, such
  as the Nokomis book sale on 14 Nov and a Gophers game. That's a product call.
- **The manual cleanup file isn't updated.** `db/dedupe-near-duplicates.sql`, which
  `docs/DATABASE.md` mentions for manual cleanup, still uses the old rules. Don't run it.
  The pipeline's own `dedupeNearDuplicates` is the current version.
- **The admin form still doesn't lock its edits.** It never sets `corrected_at`.
- **Black Nativity (1 Dec)** is still flagged all-day with a 7:30 PM start, from an
  older writer. Re-state its start in a correction once the time is confirmed on
  Penumbra's page.

## Tested

- **Type check and suite:** `npx tsc --noEmit` is clean. The full suite passes in a
  clean copy of the pushed commit on top of `origin/main`; counts are in the commit
  message. In a fresh Windows checkout, `corrections.test.ts` "the edit path sets the
  lock" fails on line endings alone. It passes on Linux and in this checkout.
- **Build and audit:** `npm run build` is clean, built in a separate copy because
  another session's dev server shares this checkout. `npm audit` found 0
  vulnerabilities.
- **Mutation testing:** across the two reviews, the tests caught 19 of 22 and then 10
  of 16 deliberate breaks. Each miss became a test, and the guard and pins were tightened.
  In the final round, all 8 targeted breaks were caught:
  - the fold rank removed, or ranked below span
  - sports trusting spans
  - an end written over the kept row's own end
  - corrected rows archived again, in both steps
  - the late-night rule dropped
  - a new unparenthesised `start_at` writer with no `all_day`
- **Golden tests:** the planner's "who keeps the slot" block holds 18, including:
  - **Merry Market, both cases:** a parent keeps the card over a timed child, and a
    corrected child stays.
  - **Folds:** Grand Old Day's parade, Woodbury's fireworks and carnival, and a hidden
    sub-event.
  - **Spans:** Twelve Kinds of Ice's run row, the Kunene and the King span not
    shortened, and a curated span over a timed night.
  - **Same-title copies:** the same-day midnight-first case, a sports copy with a bogus
    end, and the late-night rule.
  - **Corrected and hidden rows:** corrected rows never archived, hidden rows never
    touched, and takedowns left alone.
- **Live data, read-only:** the exact `dedupeNearDuplicates` statement passes `EXPLAIN`
  on production. Run as a SELECT, it archives 0 rows today; the old rule would have
  archived the Plymouth sale.

## Deploy

1. Push to `main`. Vercel redeploys. The only site code that changed is the admin
   duplicates page and the admin edit form.
2. The Sunday 7 pm scheduled task runs from `C:\Users\mccul\Documents\Event_Site\citypulse-mn`,
   so that checkout must contain these commits before Sunday. Pull them in once nothing
   else is uncommitted there. GitHub's Monday run uses `main`.
3. Nothing to run in Supabase.

## Verify

The simplest route: ask Claude, after Sunday's run, to "check the merges". The read-only
scripts from 9 Nov compare what the run archived with what stayed live.

To check by hand, run these in the Supabase SQL editor after Sunday's run. Both read the
run's own window from `pipeline_runs`, so they work whenever you run them.

```sql
-- 1. Timed rows archived during the run beside a date-only twin that stayed live.
--    Expected only for folds (a sub-event, or a longer-titled row under a shorter one)
--    and for rows that were already archived and merely re-found. Anything else is the bug.
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
--    Paid runs archive 27-34 a week, nearly all duplicates. An empty covered_by is a
--    listing that vanished — check it.
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

Revert these three commits, newest first, and push:

1. "fix — a merge no longer archives a corrected row, and a folded sub-event never becomes the card"
2. "fix — the first merge fix let one timed night archive a run, a festival or a takedown"
3. "fix — a timed listing lost to its date-only copy, and a hidden row could archive a live one"

Then pull in the checkout the Sunday task runs from, before Sunday. Nothing changed in the schema,
and no data was migrated. A row that the new rules kept, or archived, where the old ones
would have done the opposite can be fixed with a normal correction: `archive: true`, or
`publish: true` with evidence.
