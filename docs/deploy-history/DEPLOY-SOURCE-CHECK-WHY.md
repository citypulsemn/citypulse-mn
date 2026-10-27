# Deploy — the sweep records *why*, because "177 blocked hosts" was wrong

**27 Oct 2026.** One additive schema column, applied by hand. Code otherwise.

## What this is, and the correction that produced it

Asked to work "the 177 listings behind hosts that 403 a script", I measured
before building — and the figure I had reported that morning was wrong by six
times, on the wrong cause. Probing one page per host across 97 hosts:

| cause | hosts | listings |
|---|---|---|
| **readable, but not a dated index** | 69 | **348** |
| readable index, simply not swept yet | 12 | 61 |
| **blocked** (401/403/429) | 12 | **59** |
| dead link, HTTP error, thin page | 4 | 10 |

Blocking is **a sixth of the problem.** The dominant cause is JavaScript:
`first-avenue.com`'s own venue page answers 200 with **zero** dated entries, as
do Fine Line's and Chanhassen Dinner Theatres'. That also explains the 63
never-checked listings on `first-avenue.com` despite it being read on 28 Sep —
readable, and not an index.

The reason it could be reported wrongly is the actual defect: every doubt
collapsed into one `unchecked` bucket, so the proportions existed nowhere but in
an afternoon of hand-probing. **This deploy makes the question a query.**

- `lib/source-presence.ts` — `SourceCheck`'s `unchecked` variant now carries a
  structured `why: UncheckedWhy` (`thin`, `weak-title`, `no-date-given`,
  `not-an-index`, `day-not-covered`, `partial-match`) on all eight gates, plus
  pure `pageNote()` / `noteCategory()`. A regex over the reason prose was the
  obvious shortcut and the obvious next fragility.
- `db/schema.sql` — `alter table events add column if not exists
  source_check_note text`. Additive, idempotent, nullable.
- `scripts/check-sources.ts` — `fetchText` returns a structured `status` /
  `network`; the note is written on **every** attempt and the run prints the
  breakdown.
- `lib/source-sweep.ts` + `lib/vendor-health.ts` — the Monday email's coverage
  line names its causes.

## The line that was lying

The alarm shipped earlier today said:

> `479 of 644 upcoming listings have never been checked (some hosts refuse a script)`

That parenthetical is what sent an afternoon at the smallest bucket. It now
reads:

> `407 of 902 upcoming listings have never been checked — 348 unchecked, 59 blocked`

## The note is recorded even when the timestamp is not

`source_checked_at` is stamped only when a page is actually **read** — a blocked
page keeps its null so it comes up again next run. That is deliberate and
unchanged. The note answers a different question, *what happened last time we
tried*, so it is written in both branches. Two columns, two meanings.

**Rule 1 applies to both writes.** `source_check_note` arrives by migration, so
between this deploy and the `alter table` every note write fails — and
check-sources is the *last step* of weekly-research with no
`continue-on-error`, so an unguarded write would fail the whole workflow and
take the ops digest's trigger down with it. That is precisely the shape of the
four-week outage this instrumentation exists to report. Both the write and the
causes query degrade: the write counts its failures and the summary says
`N notes could not be stored — is the column migrated?`, and the breakdown
renders as `no cause recorded yet`.

## Two things measured and deliberately not built

- **A 429 retry.** `new.artsmia.org` answers 429 to every path including
  `robots.txt` and never clears — 15 seconds, the apex domain, three paths, no
  `Retry-After` header. A block wearing a rate limit's number, so a backoff
  would have been dead code.
- **Re-citing the aggregator-sourced rows.** 29 of the 59 blocked cite an
  aggregator or an API (`site.api.espn.com`, `concertarchives`, `jambase`,
  `bandsintown`, `axs`) and the registry already holds an organiser URL for 27
  of them — but every one of those targets is blocked or JS-rendered:

  ```
  first-avenue.com/venue/first-avenue/   200, 0 dated entries
  first-avenue.com/venue/fine-line/      200, 0 dated
  chanhassendt.com                       200, 0 dated
  armorymn.com/events/                   307 redirect loop
  cancanwonderland.com/events            403
  ```

  So re-citation buys a more honest citation and **no verification**. Worth
  doing as data hygiene; not a fix for this, and not shipped as one.

## Deploy

**Step 1 — apply the column in Supabase.** Safe to run twice; it is the last
statement in `db/schema.sql`:

```sql
alter table events add column if not exists source_check_note text;
```

**Step 2 — push.** Vercel auto-deploys.

```bash
git push origin HEAD:main
```

The order does not matter: without the column the notes do not store and the
sweep says so, and nothing else changes. The first `--apply` sweep after the
column exists fills it for every page it touches.

## Verify

```bash
npm run check-sources -- --host=minnesotaorchestra.org
```

```
· minnesotaorchestra.org — 403  (9 listings blocked:403)
[sources] why each listing landed where it did:
               13  blocked      403 13
```

Then, after a real sweep, the Monday email's `Source check` section should name
its causes rather than guessing.

## Applied, and what it actually did

The column was applied in Supabase on 27 Oct 2026. Observed, not predicted:

```
column: source_check_note | text | nullable

[sources] 4 pages fetched (4 unreadable) · present 0 · NOT ON SOURCE 0 · unchecked 13
[sources] why each listing landed where it did:
               13  blocked      403 13

note stored         blocked:403  on 13 rows
source_checked_at   still null   on all 13  (so they come up again next run)
verified_at         untouched    on all 12 that had one
verify_flag rows    0
```

The ops digest coverage line changed in the same breath, from a guess to a
count:

```
before  477 of 642 upcoming listings have never been checked — 477 not yet attempted
after   477 of 642 upcoming listings have never been checked — 464 not yet attempted, 13 blocked
```

The staleness alarm still reads `down` (4 missed sweeps, 29 days), which is
correct: a blocked page is not a read page, so the newest stamp is still
28 Sep. The two columns kept their two meanings.

Proven before that against the live database inside a transaction that was rolled back —
`ALTER TABLE` is transactional in Postgres, so the migration itself was
rehearsed and reverted:

```
migration applied, and is idempotent
wrote note: blocked:403 | source_checked_at untouched: true
the causes query returns: 475 not yet attempted, 3 blocked
rolled back
column exists after : false (nothing left behind)
```

Gate: `npx tsc --noEmit` clean · `npm test` green across 552 files ·
`npm run build` clean · `npm audit` 0 vulnerabilities.

## The decision this leaves open — yours, not mine

`minnesotaorchestra.org` (13 listings) and `guthrietheater.org` (9) **serve
`robots.txt` happily and declare `Allow: /`** for `User-agent: *`. The Guthrie
even advertises its sitemap there. Every actual path then answers 403, the
sitemap included.

That is an overbroad edge rule contradicting the site's own published policy,
which is a different situation from `docs/SOURCE-CHECK.md`'s standing stance
("a site that would rather we did not read it gets that wish"). Three options,
and I did not take any of them:

1. **Leave them.** 22 listings stay unverifiable by this instrument; the verify
   pass still covers them, and they are now *counted* rather than estimated.
2. **Identify as a browser.** They serve the content to Chrome. This is a
   change of stance and the kind that is easier to regret than to undo.
3. **Ask the organisations** to allow `citypulsemn/1.0`. Slow, and the most
   likely to actually stick.

My recommendation is **1 now, 3 when there is a reason to write to them** — the
22 listings are 2.4% of the calendar and the verify pass is the better
instrument for them anyway.

## The bigger fish, named

**348 listings on JS-rendered calendars** is six times the blocked count and the
real ceiling on this check. Fixing it means rendering JavaScript in the weekly
job (Playwright in the workflow), which is a genuine capability decision with a
real cost — and it is now a decision backed by a number instead of a guess.

## Rollback

```bash
git revert <sha> && git push origin HEAD:main
```

The column can stay; it is nullable and nothing else reads it. Dropping it is
optional and destructive, so prefer leaving it.
