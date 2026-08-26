# Deploy — hiding the placeholder listings (26 Aug 2026)

## What shipped

`npm run hide-placeholders`, and a run of it. **21 listings hidden.**

These are the ones the detector found: `"Turf Club Show (Sep 3)"`,
`"Show (Aug 26)"`, `"Hopkins Center for the Arts – Concert (September 26)"`,
`"Fitzgerald Theater Concert Event"` — listings whose title names no event once
the venue, the date and generic words are taken away.

## The call, and the thing worth arguing about

**13 of the 21 leave that venue with nothing listed that day.** Only 8 sat beside
a real show.

That does not change the decision, and it is worth being explicit about why. A
listing titled `"Show (Aug 26)"` asserts that an event exists without naming it.
Rule 6 — honest emptiness — is precisely about preferring a true blank to
invented filler. A reader who sees nothing at Amsterdam Bar & Hall on 26 August
learns something accurate; a reader who sees "Show (Aug 26)" learns nothing and
may well drive there.

The dry run prints which case each listing is, so the operator sees the
difference between tidying a covered room and emptying a night.

## Hidden, not archived

`status = 'draft'`. A draft 404s. An archived event page hardcodes "This event
has already happened", which for a show still to come would replace an empty
falsehood with a fresh one — the same reasoning that keeps `archived` off the
report queue in `docs/REPORTS.md`.

## Safety

- **Dry run by default**, like `dedupe-flagged`, because this decides on a word
  list rather than a primary source.
- **Backup written** before the bulk change, with every id and its prior status.
- **One `admin_audit` row each** (`hide_placeholder_title`), recording the reason
  and what else was in that slot.
- **Not in the weekly workflow.** Repeatable by hand, deliberately not automatic.

## Effect

| | Before | After |
|---|---|---|
| Placeholder titles | 21 | **0** |
| Conflicts | 32 | **24** |

Conflicts fell without being touched: 8 of the placeholders were one half of a
clash pair, so hiding them resolved those clashes too.

## Verify

```bash
npm run hide-placeholders
```

Expect `nothing flagged — nothing to do`.

Checked on the rendered pages: `/day/2026-09-03` now shows only `"Clung Tight"`
at the Turf Club at 8 PM, and `/day/2026-08-26` carries no Amsterdam listing at
all rather than a hollow one.

## Rollback

**Restore from `admin_audit`**, action `hide_placeholder_title` — see
`docs/ADMIN.md`, "Undoing a bulk change". The `--backup=` file is a convenience
for whoever ran the script, not a durable record. Or one click per row in
Admin → Events.

## Quality gate

`npx tsc --noEmit` clean · **1405/1405** tests · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · verified in the database, in the digest, and on
two rendered day pages.

## Still open

- **24 conflicts** and **6 listings with venue "TBD"** — untouched.
- **The source keeps producing these.** Hiding is a mop, not a fix: the research
  agents still write a filler listing when they know a venue has something on but
  not what. The durable answer is for the pipeline to drop a listing it cannot
  name, which is a change to `scripts/run-pipeline.ts`, not to this tool.
