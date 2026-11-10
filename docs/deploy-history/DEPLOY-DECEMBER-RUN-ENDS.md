# Deploy — two December runs were stored shorter than they are, and one heal could undo the fix

**Date:** 10 November 2026
**Data:** two `multi_day_end` corrections, applied — `corrections-december-run-ends.json`
**Code:** `lib/multiday.ts` (`staleSpanIds`), tests in `lib/__tests__/multiday.test.ts`
**Schema:** none.

[DEPLOY-TRENDING-STILL-ATTENDABLE.md](DEPLOY-TRENDING-STILL-ATTENDABLE.md) left two rows open: the
only two published rows where `coalesce(multi_day_end, end_at, start_at)` and
`greatest(start_at, end_at, multi_day_end)` disagreed. They disagreed because `multi_day_end` was
wrong on both. This corrects them.

| | stored span | the source says | the page read |
|---|---|---|---|
| The Music Man · Ordway Music Theater | ends 2026-12-09 | December 8 – 27, 2026 | `Dec 8 – 9` |
| Julmarknad · American Swedish Institute | ends 2026-12-05 | December 4-6, 2026 | `Dec 4 – 5` |

The Music Man was storing **two days of a twenty-day run**. From 10 December the site would have
called a Broadway run finished with seventeen days of performances left — and `archivePastEvents`
(`lib/upsert.ts:399`) reads the same `coalesce`, so the weekly pipeline would have **archived it on
10 December**. That is a larger consequence than the trending strip this came from.

---

## Verification before the write

Nine agents, read-only. Each date was read twice from scratch — once from the organiser's own site,
once from sources forbidden to use it — and then attacked twice more by verifiers told to default to
*refuted* and press two different angles: that the run may have been cut short, and that the date may
belong to another year, venue or production.

**All four refuters returned `refuted=false` at high confidence.** The decisive evidence was found
by a refuter, not by me:

> The Ordway's performance list is collapsed behind a "View 20 more performances" control.
> WebFetch cannot expand it, which is why every scripted pass only ever saw Dec 8–11.
> Opened in a browser, the list holds **24 performances ending Sunday, December 27, 2026**
> at 1:30 PM and 7:00 PM — both still on sale, with no row after.

Corroboration from outside ordway.org: BroadwayWorld's March 2026 season announcement and its
September 2026 tour-extension article, Visit Saint Paul, and resale calendars listing a ticketed
27 December performance. The weekday labels on the Ordway's own list (Tuesday 8 December, Sunday
27 December) pin the year — the wrong-year trap that has twice produced fabricated listings here.

For Julmarknad, ASI's December **2026** month calendar (year in the URL path) lists exactly three
Julmarknad entries and nothing after the 6th: Preview Night Friday 4 December 5:30–8:00 PM, then
Market & Festival on Saturday 5 and Sunday 6 December, each 10:00 AM – 4:00 PM.

**Two things in our own data already agreed and were being ignored.** The Music Man's stored
description reads "runs December 8–27, 2026" — the row contradicted itself, prose against columns.
And an archived Julmarknad row carries `end_at 2026-12-06 16:00`, matching ASI's 4:00 PM close.

---

## What was changed

`multi_day_end` only, on both rows. Nothing else.

That is sufficient and it is the whole change, because `spanEndISO` (`lib/dates.ts:246`) *prefers*
`multi_day_end` over `end_at` rather than taking the max, and every display path goes through it —
card labels, the event page, day pages, `/this-weekend`, `/ongoing`, collections, the map and list,
the JSON-LD `endDate`, and the `.ics` download. The applier appends `T23:59`, so the closing day
stays live through the evening instead of expiring at midnight.

`end_at` was deliberately **not** touched. On The Music Man it holds `2026-12-25 21:30`, which
matches no performance on the Ordway's list, and the honest replacement — the first night's end
time — is not attested anywhere. It is now shadowed by the later `multi_day_end` on every surface.
See *Left open*.

---

## The code change: one heal could have silently undone it

The correction looked durable. It is not, quite, and the gap is worth the one condition it costs.

`staleSpanIds` (`lib/multiday.ts`) NULLs `multi_day_end` on every row whose category is in
`PER_NIGHT` (`{sports, music}`) and whose span outlasts its start day. It ran on every weekly
pipeline and every `npm run collapse`, and it checked **neither `corrected_at` nor `status`** —
while `planCollapse` skips a corrected row outright. The two halves of one pass disagreed about who
outranks whom, and they sit 526 lines apart (`lib/multiday.ts:295` and `:821`), which is most of
why nobody noticed.

The consequence is one-way. Nothing puts a cleared span back, and `lib/upsert.ts:361` freezes
`end_at` once `corrected_at` is set. So the chain is: category drifts to `music` → the next collapse
NULLs the corrected span → `spanEndISO` falls back to `end_at` → **"Dec 8 – 27" becomes "Dec 8 – 25"
permanently**, with no instrument reporting it.

The row this was found on is *The Music Man* at the *Ordway **Music** Theater*. That is about as
adversarial an input as `lib/classify.ts` will ever be handed. `PER_NIGHT` has already grown once —
music was added on 29 Sep 2026 — and `staleSpanIds` exists precisely because nobody reconciled the
rows that growth stranded.

```ts
.filter((r) => !r.corrected && PER_NIGHT.has(r.category ?? "") && (r.endDay ?? "") > dayOf(r.start))
```

The guard is `planCollapse`'s own. An operator's hand-checked span now outranks the automatic heal.

---

## Verification after the write

Both rows read through the real read path and the rendered production build:

```
The Music Man     label="Dec 8 – 27"   spanEnd=2026-12-27T23:59   ics DTEND:20261228T055900Z
Julmarknad        label="Dec 4 – 6"    spanEnd=2026-12-06T23:59   ics DTEND:20261207T055900Z
greatest == coalesce on both rows.  Divergent rows remaining site-wide: 0
```

Event page, rendered: **`Dec 8 – 27 · runs 20 days · daily from 7:30 PM`**.

Where readers gain the days:

- **`/day/2026-12-06`** now carries Julmarknad. The festival ran Friday to Sunday, but the site
  stopped it on Saturday, so its closing Sunday — the family day, 10 AM-4 PM — appeared nowhere.
- **`/day/2026-12-27`** now carries The Music Man's final performances.
- **`/ongoing`** will carry the run from 9 December (`selectOngoing` requires `startDay < today`).
- Mid-run day pages list it among *"34 also running"* rather than on the shelf itself: at 20 days
  the run exceeds `EXPAND_MAX_DAYS`, and `ALSO_RUNNING_CAP` shows 6, ending-soonest. That is the
  established cap (see [DEPLOY-ISUPCOMING-OVERCAP.md](DEPLOY-ISUPCOMING-OVERCAP.md)) and this change
  does not alter it.

### Mutation

| mutation | tests that failed |
|---|---|
| drop `!r.corrected` from the guard | 4 |
| the `lib/upsert.ts` query stops selecting `corrected_at` | 1 |
| `scripts/collapse-multiday.ts` stops passing `planRows` | 1 |

The second mutation **passed at first, and the test was wrong, not the mutation**: `upsert.ts` has a
*second* query that also selects `corrected_at`, so a whole-file `toContain` was satisfied while the
query that actually feeds `staleSpanIds` had been gutted. The assertion is now scoped to the 2,000
characters preceding the `staleSpanIds(planRows)` call, with a guard that the slice is non-empty.
A pure guard on a field the callers never SELECT is a no-op that reads as a fix.

### Quality gate

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | **3,411 passed in 156 files** (6 new) |
| `npm run build` | clean |
| `npm audit` | **0 vulnerabilities** |

### Backups

- `Documents/CityPulseMN/backups/2026-11-10-span-end-corrections-before.json` (full rows, taken first)
- `Documents/CityPulseMN/backups/2026-11-10-december-run-ends-before.json` (written by the applier)

---

## Deploy

The data is already applied to production Supabase and the two event pages were revalidated by the
applier. The code change ships with:

```bash
git add lib/multiday.ts lib/__tests__/multiday.test.ts corrections-december-run-ends.json docs/deploy-history/DEPLOY-DECEMBER-RUN-ENDS.md
git commit -m "fix — two December runs were stored shorter than they are"
git push
```

## Rollback

Data: re-apply the backup's `multi_day_end` values with `npm run correct`. Code: `git revert` —
one condition in one filter.

---

## Left open

- ~~A live duplicate of The Music Man.~~ **Resolved the same day** — see below.
- **The Music Man's `end_at` (2026-12-25 21:30) is wrong and now frozen.** It matches no
  performance. It is shadowed everywhere by `multi_day_end`, but it is visible in the admin editor,
  and `lib/admin-actions.ts:124` would write it straight back on any unrelated admin save.
- **Per-day times a one-row-per-run model cannot hold.** Julmarknad renders "daily from 5 PM" from
  its single `start_at`; ASI's Friday preview is 5:30 PM and Saturday and Sunday open at 10 AM.
  Nothing is false in the columns — the model has one start time for three different days.
- **`staleSpanIds` still ignores `status`**, so it will clear a span on a draft or archived row.
  That is harmless today and was left alone; only the `corrected` precedence was fixed.

---

## Addendum, 10 November 2026 — the duplicate this exposed, archived

`6a05455a` was published at *Ordway Center for the Performing Arts*, a different spelling of the
same building, so neither `event_key` nor `roomKey` ever folded it against the keeper
(`roomKey` gives `ordway center for the performing arts` against `ordway music theater`). It
covered 26 Dec 14:00 to 27 Dec 22:00 — exactly the last weekend of the corrected run, matching the
Ordway's Saturday 2:00 PM and Sunday 1:30/7:00 PM performances.

**The row said so itself.** Its stored description:

> The Music Man plays at the Ordway Center for the Performing Arts December 8–27, 2026, with
> performances available through December 27. The final days of the run fall within the
> December 26–27 window.

It was minted from `msp.kidsoutandabout.com`'s "101 ideas for holiday family fun" roundup, whose
26–27 December window became the event's dates. Its ticket link was only `ordway.org`'s homepage,
while the keeper cites the Ordway's own event page — the same weak-citation shape as the
[Children's Museum duplicate](DEPLOY-SELFCHECK-SEES-RUNS.md).

**Archived, not hidden.** The performances are real; only this row's date range is wrong. That is
the duplicate lever, not the takedown for a fabrication.

### It will not come back

`status` is absent from the upsert's `on conflict` set in `lib/upsert.ts`, so a weekly
re-find updates an archived row's fields without republishing it. `corrected_at` additionally
freezes title, venue, start, end, description and source_url. Checked before applying, because an
archive that reverts in seven days is not a fix. Note that `msp.kidsoutandabout.com` is **not** in
`AGGREGATOR_HOSTS` (`lib/event-links.ts:31`) — that list is ticketing and national aggregators —
which is how a roundup-sourced row came to be published in the first place.

### Verified

| | before | after |
|---|---|---|
| published Music Man rows | 2 | **1** |
| `/day/2026-12-26` | not measured | **1** |
| `/day/2026-12-27` | 2 cards, "5 events" | **1**, "4 events" |

Three rows for this production are now archived and one is published. The archived row's event page
still renders, under "THIS EVENT HAS ALREADY HAPPENED" — the documented archive behaviour, so an old
link does not 404 and does not claim the listing is upcoming.

### A rebuild was not enough, and it nearly produced a false report

After archiving, `npm run build` plus a fresh `npm run start` **still served the archived row** on
`/day/2026-12-27`. The day query filters `status = 'published'` (`lib/events.ts:221`), so the
data layer was right the whole time; `.next/cache` had survived the rebuild, all 368 MB of it.
`rm -rf .next/cache` and a cold rebuild gave the true page.

This is recorded for worktrees in the local-smoke notes, but it bit here in the **main checkout**
after a **data-only** change, where no code had changed at all and a rebuild looks sufficient.
**After a correction, clear `.next/cache` before believing any local page.** The tell was the day
header: it still read "5 events" after a row had been archived.

### Files

- `corrections-music-man-duplicate.json` (applied)
- Backups: `Documents/CityPulseMN/backups/2026-11-10-music-man-duplicate-before.json` and
  `...-music-man-duplicate-applier.json`
- Gate re-run after the archive: `tsc` clean · **3,411 tests in 156 files** · build clean ·
  `npm audit` 0

### Still open after this

- **The Grinch pile.** Children's Theatre Company's *Dr. Seuss's How the Grinch Stole Christmas!*
  is 8 published rows under two titles for one run, two of which render back to back in the
  homepage Trending strip. Same family, larger, and not touched here.
- **An archived future-dated row says "THIS EVENT HAS ALREADY HAPPENED"**, which is not literally
  true of a run that has not started. Pre-existing wording, not introduced here.
