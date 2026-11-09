# Deploy: times survive merges, and merges stop losing listings

**Date:** 9 November 2026 · **Schema:** none · **Order:** push only; no SQL to run

## What shipped

- **Every tool that changes a start time now updates the "All day" flag.**
  `npm run correct`, the `/admin` edit form and `scripts/restore-drafted.ts` all used
  to change the time and leave the flag on, so the page still printed "All day". A test
  now fails any statement in `lib/` or `scripts/` that sets `start_at` without saying
  what `all_day` becomes.
- **The duplicate step** (`dedupeNearDuplicates`, run every pipeline run):
  - **Live rows only.** A hidden (draft) row can't keep a live row's slot, and it is
    never archived; archiving one would serve its event page again and undo a takedown.
  - **A timed row beats a date-only single-day row.** Only after that does the
    earliest-found row win.
  - **Corrected rows are never archived.** An operator-corrected row can be kept, but
    never archived.
- **The weekly collapse** (`planCollapse`) keeps its old rules, with three narrow
  changes:
  - **Hidden and corrected rows are left out of planning entirely.** They're never
    kept, never archived, and never used to join two other rows into one run.
  - **Its order for choosing the keeper is unchanged:** earliest day, then the row
    already carrying a span, then the shorter title. Only when all three tie does a row
    with a time now beat a "thin" one. A thin row is date-only with no span of its own,
    or a date-only sports or music copy.
  - **It never writes an end date earlier than the kept row's own `end_at`.**
- **A correction file that names one listing twice is refused** for that listing. The
  second entry would have quietly written the first one's old values back.

## Why

Sunday's local research run (8 Nov) hit problems that paid runs share:

- **20 listings showed "All day"** after the 9 Nov corrections gave them their real
  times. They were fixed by hand that morning (backup
  `2026-11-09-all-day-flag-before.json`).
- **The Plymouth book sale disappeared.** The duplicate step kept the hidden Edina row
  and archived the live Plymouth sale. Run on today's data, the old query would have
  done it again at the next run; the new one archives nothing.
- **AJ McLean's date-only copy beat its timed copy** on sort order alone.
- **The fair's own Merry Market rows were archived** under a blog's date-only row (see
  Known limits).

**Why the collapse change is narrow.** Three adversarial review rounds tried bolder
collapse rules, ranking a timed row, a corrected row or a fold's parent higher. Every
time, the reviewers found a real shape the bolder rule got wrong. A one-day festival
lost its card to its own parade. A sub-event with its own end date took a festival's
card. A timed night archived a run stored in `end_at`. A corrected row joined two others
into a span that ended on the wrong day. Each review found these by building the inputs
and running them, and a second agent confirmed each finding.

So the collapse keeps its old rules. The time rule only breaks a tie that was already a
tie, and corrected and hidden rows are left out. A comparison of the old and new
planners on 20,000 random row sets is in Tested.

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
- **Corrected rows are protected, never promoted.** Promoting them let a corrected
  sub-event take over a festival, or a corrected night archive a run card.
- **The admin duplicates page uses the duplicate step's rules,** and a test checks that
  its candidate set matches exactly.

## Known limits

- **The Merry Market shape isn't fixed by the merge.** When a shorter-titled row (a
  blog's "Minnesota Merry Market") folds a longer-titled one (the fair's "…Weekend 2"),
  the shorter title keeps the card, as before. That's the same shape as a festival and
  its parade, which must keep working. Today's Merry rows are corrected, so the merge
  now leaves them alone. The real fix is upstream: don't publish rows that cite only a
  roundup such as visitsaintpaul.com's blog. That's a product call.
- **Folds behave exactly as before this work.** Any shape where the old rules let a
  sub-event become the card still does.
- **A time isn't a venue.** If the date-only copy is actually the newer fact (AJ McLean
  moved to the Fine Line), the timed copy wins with the old room.
- **The collapse doesn't carry an archived row's own end date.** When it archives a row
  that carried its span in `end_at`, that end isn't moved onto the kept card. For
  example, a preview night the day before a run stored in `end_at` keeps the card and
  ends the run early. That's older behaviour. This change only stops it writing an end
  earlier than the *kept* row's own end.
- **Corrected duplicates stay visible.** A corrected row the merges would once have
  archived now stays live beside the kept card. The admin duplicates page no longer
  offers it, so archive it with a correction file (`archive: true`).
- **In the duplicate step, a run card can still lose to a timed night found earlier.**
  That's the old earliest-found rule; the new rule never demotes a run card. Its
  date-only test is also by date, so a date-only row ending just after midnight falls
  back to the old rule.
- **The insert check still lets a hidden row block a new one.** This was **not
  changed**. Over 60 days, 18 of the 235 listings it skipped were blocked by a hidden
  row. Some were useful blocks of re-found fabrications; others hid real events, such
  as the Nokomis book sale on 14 Nov and a Gophers game. That's a product call.
- **The manual cleanup file isn't updated.** `db/dedupe-near-duplicates.sql`, which
  `docs/DATABASE.md` mentions for manual cleanup, still uses the old rules. Don't run
  it; the pipeline's `dedupeNearDuplicates` is current.
- **The admin form still doesn't lock its edits.** It never sets `corrected_at`.
- **Black Nativity (1 Dec)** is still flagged all-day with a 7:30 PM start, from an
  older writer. Re-state its start in a correction once the time is confirmed on
  Penumbra's page.

## Tested

- **Type check and suite:** `npx tsc --noEmit` is clean. The full suite passes in a
  clean copy of the pushed commits on top of `origin/main`; counts are in the last
  commit message. In a fresh Windows checkout, `corrections.test.ts` "the edit path
  sets the lock" fails on line endings alone; it passes on Linux and in this checkout.
- **Build and audit:** `npm run build` is clean, built in a separate copy because
  another session's dev server shares this checkout. `npm audit` found 0
  vulnerabilities.
- **Old planner versus new, on 20,000 random row sets** (titles, categories, days,
  times, spans, end dates, hidden and corrected rows):
  - **Identical:** 16,520 sets.
  - **Different:** 3,480 sets, every one explained by the three intended rules:
    - 2,446 because hidden or corrected rows are left out
    - 819 because a thin keeper gave way to a timed row that tied on day, span and title
    - 215 because a shorter end wasn't written over the kept row's own
  - **Unexplained:** none.
- **Live data:**
  - **Collapse:** both planners make the same plan on today's 972 rows.
  - **Duplicate step:** the exact `dedupeNearDuplicates` statement passes `EXPLAIN` on
    production. Run as a SELECT, it archives 0 rows today; the old one would have
    archived the Plymouth sale.
- **Mutation testing:** across three review rounds, deliberate breaks were caught 19 of
  22, then 10 of 16; each miss became a test or a tighter check. In the final round, six
  breaks to the narrowed collapse rules were all caught:
  - the time rule moved above title
  - the time rule removed
  - sports dates not counted as thin
  - corrected rows planned again
  - hidden rows planned again
  - the end-date guard dropped
- **Golden tests:** 21 in the planner's "who keeps the slot" block, covering:
  - every shape the reviews found
  - the Merry Market limit and its corrected rows
  - Twelve Kinds of Ice and Kunene and the King
  - Grand Old Day and Woodbury Days, both ways round

## Deploy

1. Push to `main`. Vercel redeploys. The only site code that changed is the admin
   duplicates page and the admin edit form.
2. The Sunday 7 pm scheduled task runs from `C:\Users\mccul\Documents\Event_Site\citypulse-mn`,
   so that checkout must contain these commits before Sunday. Pull them in once nothing
   else is uncommitted there. GitHub's Monday run uses `main`.
3. Nothing to run in Supabase.

## Verify

After Sunday's run, ask Claude to check the merges: compare what the run archived with
what stayed live, read-only. To check by hand, run these in the Supabase SQL editor.
Both read the run's own window from `pipeline_runs`, so they work whenever you run them.

```sql
-- 1. Timed rows archived during the run beside a date-only twin that stayed live.
--    Expected where the old rules still decide: folds (a sub-event, or a
--    longer-titled row under a shorter one), a different start day, a span, a
--    shorter title — and rows that were already archived and merely re-found.
--    A same-day, same-title pair with no span is the bug.
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

Revert these four commits, newest first, and push:

1. "fix — the collapse keeps its old rules, plus three narrow ones the reviews could not break"
2. "fix — a merge no longer archives a corrected row, and a folded sub-event never becomes the card"
3. "fix — the first merge fix let one timed night archive a run, a festival or a takedown"
4. "fix — a timed listing lost to its date-only copy, and a hidden row could archive a live one"

Then pull in the checkout the Sunday task runs from, before Sunday. Nothing changed in
the schema, and no data was migrated. A row that the new rules kept, or archived, where
the old ones would have done the opposite can be fixed with a normal correction:
`archive: true`, or `publish: true` with evidence.
