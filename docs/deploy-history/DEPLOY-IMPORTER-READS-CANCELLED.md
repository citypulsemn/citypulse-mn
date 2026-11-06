# Deploy: the venue importer reads "cancelled"

**Date:** 6 November 2026 · **Schema:** none · **Data:** none on deploy, until the importer next runs

## What shipped

- `parseFirstAvenueMonth` reads each show's status badge.
- `reconcileShows` gives a new verdict, `off`, for a listing whose show the venue marks
  cancelled or postponed. Such a show no longer confirms a listing or gets added as a new one.
- `import-venues` marks a cancelled show cancelled, and hides a postponed one.
- `weekly-digest.yml` runs the importer right before Thursday's email, with no model and no
  API key. If it fails, the email still goes out.

## Why

On 6 Nov 2026 a research rehearsal found three published shows whose own cited pages said
"THIS SHOW HAS BEEN CANCELLED". All three carried recent verified stamps.

| Show | Page last changed | Stamped | Stamped by |
|---|---|---|---|
| Packaging | 28 Oct | 2 Nov, 14:53 UTC | The free importer |
| The Weeknd Night | 5 Nov, 16:24 UTC | 5 Nov, 21:34 UTC | The paid verify pass |
| The War and Treaty | 21 Aug | Created 22 Aug, stamped since | Likely the importer |

The importer's parser ignored the badge, so "on the calendar" counted as confirmed. A page's
last-changed date is not proof of when a show was cancelled, but it can't be later than the edit.

## Measured

A read-only scan of every page cited by a live listing: **295 read, 24 could not be read**.

- **No other page cited by a live listing says cancelled** beyond the three already fixed.
- **Two more live listings were wrong:** Death From Above 1979, listed for tonight, and Julian
  Lage Quartet. Both are rescheduled to March 2027, and the importer's dry run now finds both.
- **68 pages contain one of the words, and 55 of those are only standard terms** such as "will
  result in cancellation of orders". Of the other 13, four are shows whose listed date is already
  the new one, and several are calendars or unrelated pages. This is why the source check does not
  search page text for the word: a plain search would have flagged every one of them.

## Design decisions

- **The fix is in the calendar reader, not in the source check.** Every affected listing was on
  First Avenue, and its badge is structured data. The source check stays as it is.
- **Read the words, not the class.** A cancelled show's badge has the `badge-sold-out` class.
- **A show that is on always wins.** Rule 12 says a fuzzy match must not destroy on its own, so
  `off` needs the venue's own label on the same room and night, and no matching show that is on.
- **Postponed is hidden, not cancelled.** It is not on that night, and it has not been called off.
  Its new date arrives by itself when it enters the window, or sooner with `npm run correct`.
- **Twice a week, not a new mode.** Thursday runs the normal importer. It can also add and hide
  listings that day, which is what Monday's run already does.

## Known limits

- **Only First Avenue's calendar is read for a status.** The other importer sources' parser reads
  none. A cancellation elsewhere still relies on the verify pass or a report.
- **The 24 unreadable pages are unknown.** They include sites that refuse scripted requests.
- **A wrong title match could still cancel the wrong row in the same room and night,** if it is
  not matched by a show that is on. It is audited and reversible with `"publish": true`.
- **The paid verify pass can still stamp a cancelled show.** The Weeknd Night shows that. The
  importer now runs just before it on Thursdays, so the row is no longer published by then.

## Tested

- `npx tsc --noEmit` clean, `npm test` green, `npm run build` clean, `npm audit` 0.
- Deliberate breaks to the new logic each fail a test.
- `npm run import-venues -- --dry-run` against the real calendars finds the two postponed shows.

**Not tested:** a real run writing a cancellation. The first will be the next importer run.

## Deploy

1. Commit and push. Nothing to set, and no schema change.
2. On the next importer run, check its log for the `CANCELLED` and `POSTPONED` lines.

## Verify

- [ ] The Weekly Event Research log's importer step prints `marked off` in its summary line
- [ ] Thursday's digest log has the new step, and it ran before the verify step and the send
- [ ] Any row it cancelled shows the banner, and has an audit row:

```sql
select at, left(event_id::text, 8) as id, patch from admin_audit
where action = 'verify_cancel' and patch->>'evidence' like '%marks this show cancelled%'
order by at desc limit 10;
```

## Rollback

Revert the commit. To restore a row it cancelled or hid, use `npm run correct` with
`"publish": true` and the page that says the event is on.
