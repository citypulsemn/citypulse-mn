# Deploy — a citation can be repaired, and `end_at` can finally be cleared

**27 Oct 2026.** Code plus one row already applied. No schema change, no
secrets, no migration.

## What shipped

The intended item was small: `npm run correct` had no way to change a listing's
`source_url`, so the one false flag left over from the source-check fix could
only be repaired with hand-written SQL. Adding the field surfaced two bigger
things.

### 1. `source_url` on the correction tool

- `lib/corrections.ts` — `source_url` on `Correction` and `CorrectionRow`, a
  `put` in `planCorrection`, and both field lists in `validateCorrection`.
- **Not** added to `VERIFY_RELEVANT`. The verify pass never sees a citation, so
  a better source is not a changed fact and must not cost a row its stamp.
  `verified: true` on a citation-only correction is refused for the same reason:
  pointing at a page is not reading it.
- New plan field `resetsSourceCheck` sets `source_checked_at = null`. The new
  page has never been read whatever the old one's stamp says, and the sweep
  orders its ~400-page budget by that stamp, nulls first.
- A roundup (`isAggregatorSource`) or a reseller (`isResaleSource`) is refused,
  naming the host. A social page is allowed — `lib/source-trust.ts` is explicit
  that those are good enough to cite and not good enough to verify on. The lists
  overlap: `eventbrite.com` is in both, so Eventbrite is caught by the roundup
  rule.
- `String(c.source_url)` before matching, because corrections come from
  `JSON.parse` of an operator's file where `"source_url": null` is one keystroke
  away. Reading `.slice` off it threw out of `validateCorrection`, which runs
  inside a `flatMap` — so one typo abandoned every other correction in the file.

### 2. `end_at` could never be cleared, and every record said it had been

Found by an adversarial review of the above, which edits the same UPDATE.
`{"end": null}` is the documented way to clear an end time. The script wrote
`fields.end_local ?? row.end_local`, and `??` falls through on null:

```
null ?? "2026-10-23T23:00"   ->   "2026-10-23T23:00"      the OLD value, written back
```

The null branch was reachable only when the row was *already* null, because
`put` skips a field whose value already matches — so the column could not be
cleared at all. Meanwhile `describePlan` printed `end_local: 2026-10-23T23:00 →
(none)`, the `admin_audit` row stored that line, and the run counted the id as
applied. `end_local` is in `VERIFY_RELEVANT`, so the row also lost its
`verified_at` to a change that never happened and went back into the
~5p-a-listing queue; re-running the file rewrote the same lie every time.

**The golden test named "can clear an end time without clearing it by accident"
was green throughout.** It asserted the plan, and the plan was always right —
the same shape as the drift guard that searched for a call a rename had removed.

The decision now lives in `nextValue` (`lib/corrections.ts`): presence in the
plan decides, the value never does. Every column in the UPDATE reads through it.

### 3. The same invariant at the root — `upsertEvents`

`on conflict (event_key) do update set source_url = excluded.source_url` runs on
every weekly re-find and left `source_checked_at` alone, so a row could carry a
brand-new source with a freshness earned by the old one — and because the budget
is ordered by that stamp, the new page went to the *back* of the queue. It was
also the one thing that could silently revert an operator's citation repair while
keeping it looking checked. One `case when … is distinct from …` clause fixes it
for the path that touches every row, not just the tool that touches one.

## Verification

Both SQL statements were exercised **against the live database inside a
transaction that was rolled back**, because a statement that does not parse is
exactly what killed the weekly job for four weeks in Sep–Oct:

```
1) victim: "Peter and the Wolf – Young People's Conc"  end_at = 2026-10-27T12:00
   {"end": null}          -> null                ✓ CLEARED
   {"end": "...T21:00"}   -> "2026-12-01T21:00"  ✓ SET (no 5h shift)

2) upsert conflict clause PARSED and planned:
    Insert on events   Conflict Resolution: UPDATE
    Conflict Arbiter Indexes: events_event_key_key

3) after rollback — end_at = "2026-10-27T12:00" (unchanged: true)
```

Gate: `npx tsc --noEmit` clean · `npm test` **9,828** green across 552 files
(23 new) · `npm run build` clean · `npm audit` 0 vulnerabilities.

*(`npm run lint` is not usable in this repo — `next lint` is unconfigured and
prompts interactively. Pre-existing, not touched here.)*

## The row, already applied

```bash
npm run correct -- --from=hallmark-citation.json --apply --backup=before.json
```

```
± EDIT  The Unauthorized Hallmark(ish) Parody Musical — 2026-12-14T19:30 @ Pantages Theatre
    source_url: https://tourstoyou.org/resources/venues/hennepin-arts/
              → https://hennepinarts.org/events/the-unauthorized-hallmark-ish-parody-musical-2026
1 applied, 0 refused, 0 unchanged
```

Backup: `Documents\CityPulseMN\backups\2026-10-27-hallmark-citation-before.json`.

Row afterwards — `source_checked_at` null, **`verified_at` preserved at
2026-10-05**, venue, date and status untouched. The sweep now reports
`present 4 · NOT ON SOURCE 0` for `hennepinarts.org`, so Monday will not flag it.

## Deploy

```bash
git push origin HEAD:main
```

Vercel auto-deploys. Nothing to run and nothing to set. The `upsertEvents` change
takes effect on the next weekly pipeline run.

## What to watch

The upsert change raises the never-checked page count whenever the pipeline
legitimately moves a source. That is correct — those pages genuinely have not
been read — but the sweep only reaches ~400 of ~593 pages per run, so watch the
`(N never checked)` figure in the weekly log. If it climbs past the cap the
budget needs raising, not the invariant relaxing.

## Rollback

```bash
git revert <sha> && git push origin HEAD:main
```

The one data change is reversible from the backup file above: it is a single
`source_url` on a single row, and nothing else on that row was touched.

## Still open, found in review and deliberately not fixed here

- **`evidence` is unguarded.** `source_url` refuses a roundup or a reseller, but
  `evidence` — the field that actually licenses `verified: true` — accepts any
  string. Someone could stamp a row verified citing a reseller page. Pre-existing
  and a different decision.
- **`npm run correct`'s dry-run summary** calls every planned row "unchanged",
  since `touched` is only populated under `--apply`. Cosmetic, pre-existing; the
  `DRY RUN` suffix carries the real meaning.
