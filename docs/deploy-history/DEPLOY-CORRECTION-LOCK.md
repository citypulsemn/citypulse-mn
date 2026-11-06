# Deploy: corrections that stick, and can fix the description

**Date:** 6 November 2026 · **Schema:** one nullable column · **Order matters:** run the SQL before pushing

## What shipped

- **`description` in correction files.** A date fix no longer has to leave the old
  date in the prose.
- **A lock on corrected rows.** A correction that edits a row sets `corrected_at`.
  From then on, a research re-find can't overwrite that row's title, venue, address,
  pin, times, description or source.

## Why

`upsertEvents` overwrote every column whenever research found the same event again, so
a correction lasted only until the next run that re-found it. Today's Tamalada, Bell
Museum and Plymouth fixes were all exposed to that on Monday.

Separately, seven Timberwolves rows state a tip-off an hour later than their correct
start, and the two Twelve Kinds of Ice rows still named their old dates after being
moved. `lib/corrections.ts` had no way to edit that text.

## Design decisions

- **The lock lives in the upsert's `on conflict` clause, not in the pipeline.** Every
  caller gets it: research, the importers and published submissions.
- **Research can still improve the rest.** Category, price, ticket link and image still
  update. A correction can't edit those, so there is nothing to protect.
- **League data still wins.** `import-sports` moves a game with its own `update`, which
  the lock doesn't touch, so a real schedule change still lands.
- **A prose fix leaves the verified stamp alone.** The verify pass never reads
  descriptions, and `verified: true` on prose alone is refused.
- **A blank description is refused,** so a typo can't wipe a listing.

## Known limits

- **A moved date can come back.** Moving a date gives the row a new identity, so research
  reading the same page could re-create the old date as a new row. Check the query below
  after Monday's run.
- **A locked row can go stale.** Research can't update it even if the event really changes.
  That now relies on the verify pass flagging it. To release a row:
  `update events set corrected_at = null where id = '...';`
- **Hide and archive don't set the lock.** They don't need it, because research already
  leaves a row's status alone.
- **Older corrections aren't locked.** 61 upcoming published rows have been corrected at
  some point, and only today's are included below. Their values may have changed since, so
  locking them all could freeze a research value rather than a correction.
- **Research can still write times into new descriptions.** Stopping that is a later fix.

## Tested

- `npx tsc --noEmit` clean, `npm test` green, `npm run build` clean, `npm audit` 0.
- Deliberate breaks to the new logic and the upsert clause each fail a test.
- **Real scripts on temp tables.** `npm run correct` and `upsertEvents` ran against temp
  tables shadowing `events` and `admin_audit` on one connection, with a guard refusing to
  start unless both resolved to the temp schema. All 10 corrections applied and locked, and
  no verified stamp changed. A simulated re-find then overwrote the uncorrected control row
  and left the corrected row's title, start, description and source alone, while its price
  and ticket link still updated. Production row count and latest `updated_at` were
  unchanged, and no rows leaked.

**Not tested:** the column on the production table, and a real research run. Step 4 and
Monday's checks cover those.

## Deploy

**Run these in this order.** The new code references `corrected_at`, so pushing first would
make Monday's research fail on its first write.

### 1. Run this in the Supabase SQL editor

```sql
alter table events add column if not exists corrected_at timestamptz;

update events
set corrected_at = now()
where corrected_at is null
  and id in (
    '00b34033-a206-4d8a-888e-b54f911a1059',
    '1f72e848-827d-4b72-88c7-32b3279dd839',
    'ae4edde1-c9df-471d-ab2b-c1c07e77050a',
    '8becf4ee-b3b1-4364-bf96-d1fdcc2f4ab3',
    '24423229-caba-4343-8313-65a6c30342fa',
    '44289dfd-9502-412c-b634-5ad22178181d'
  );

select count(*) as locked from events where corrected_at is not null;
```

**Expect `locked` = 6.** It is safe to run twice, but the count only stays 6 until step 3
locks more rows. Adding a nullable column doesn't rewrite the table or change anything
readers see.

### 2. Commit and push

Vercel deploys `main`. Readers see no change from this step.

### 3. Apply the description fixes

```bash
npm run correct -- --from="C:/Users/mccul/Documents/CityPulseMN/backups/2026-11-06-descriptions-corrections.json"
```

```bash
npm run correct -- --from="C:/Users/mccul/Documents/CityPulseMN/backups/2026-11-06-descriptions-corrections.json" --apply --backup="C:/Users/mccul/Documents/CityPulseMN/backups/2026-11-06-descriptions-before.json"
```

The first is a dry run and the second applies. Expect `10 applied, 0 refused`.

## Verify

- [ ] The step 1 query returned 6
- [ ] After step 3 the count is 13: the 6 above plus 7 Timberwolves rows
- [ ] A Timberwolves page no longer says "Tip-off"
- [ ] The Twelve Kinds sensory page says November 15 and no longer says November 19
- [ ] After Monday's research, Actions shows Weekly Event Research completing its pipeline
      step, and the corrected rows are unchanged:

```sql
select title, to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD HH24:MI') as starts,
       left(source_url, 50) as source, left(description, 60) as description
from events where corrected_at is not null order by start_at;
```

- [ ] After Monday's research, the old Twelve Kinds dates did not come back:

```sql
select title, status, to_char(start_at at time zone 'America/Chicago', 'YYYY-MM-DD HH24:MI') as starts
from events where title ilike '%twelve kinds of ice%'
  and (title ilike '%sensory%' or title ilike '%asl%') order by start_at;
```

## Rollback

- **Code:** revert the commit. The column can stay, because nothing else reads it.
- **Description text:** `2026-11-06-descriptions-before.json` holds the old text.
- **The column:** leave it. This project's schema is additive only.

If the push went first and research fails with `column events.corrected_at does not exist`,
run step 1. The next run will then work.
