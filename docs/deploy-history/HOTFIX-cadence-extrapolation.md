# Hotfix — a cadence is not a schedule (10 Sep 2026)

## The report

> "Called woodbury - this event is not happening. Their movies in the park does
> not go into fall."

Report `145f44f0`, filed 12:49 CT against **Woodbury Starlight Cinema Outdoor
Movie Night**, Ojibway Park, Sat 12 Sep 2026, 7:00 pm. Reader role: attendee. No
email left, so no reply is possible.

## The reader is right

The 2026 Starlight Cinema season at Ojibway Park was **four screenings and it
ended on 6 Aug**:

| Date | Film |
|---|---|
| Jun 11 | Zootopia 2 |
| Jun 25 | The Bad Guys 2 |
| Jul 23 | Viewer's Choice |
| Aug 6 | The Super Mario Galaxy Movie |

Source: starlightmn.com, the operator's own schedule. The page we cited —
`familyfuntwincities.com/free-cheap-summer-movies/` — lists Woodbury as "one
movie each month this summer" and names **no September date**. There was never a
12 Sep screening to list.

## Where it came from

The weekly research agent created it on **25 Jun 2026** and it was never
verified (`verified_at` NULL for 77 days). It was not copied from anywhere. It
was **extrapolated from a cadence**: the source said "monthly", the agent
projected that word past the end of the season the page covered, and invented a
date.

The listing confessed in its own description:

> "…is presented **monthly** at Ojibway Park; the September screening features
> **a kids-friendly film** with pre-show activities starting at 7pm…"

No film named, because there was no film to name. Writing the cadence into the
description is what an agent does when it has a pattern and no date. That is the
fingerprint.

This is a **different failure from the Marley/Fillmore one** (5 Sep). That was a
roundup article read as a schedule — the guard for it already existed and holds.
This one is a real recurring series, a real venue, a real source page, and a
date that no source ever asserted.

## Linked listings — checked, one class, one casualty

Four listings share that source URL:

| Listing | Date | Verdict |
|---|---|---|
| Maple Grove Sounds of Summer | Aug 28 | already archived |
| Burnsville Friday Night Flicks | Sep 4 | already archived |
| **Woodbury Starlight Cinema** | **Sep 12** | **fabricated → hidden** |
| White Bear Township Movie in the Park | Sep 12 | **real — left up** |

The White Bear Township one looks identical at a glance and is **not** the same
thing: the source page states that date explicitly ("9:00 pm – 10:45 pm, Polar
Lakes Park"), the series genuinely runs June–September, and the verify pass
stamped it on 7 Sep. It stays. Hiding it because it resembled the bad one would
have been the same sin in the other direction.

A sweep of every published future listing whose description asserts a cadence
returned 54 rows. The rest are attested — farmers markets with stated end dates,
Walker Free Thursday Nights, library storytimes. No second casualty.

## What shipped

**1. The listing is hidden.** `status = 'draft'` — never a delete, reversible in
one click. Report `145f44f0` marked `actioned` / `hidden` with the full finding
in `review_note`, plus an `admin_audit` row.

**2. The guard, in both research prompts** (`lib/agents/prompts.ts`):

> A CADENCE IS NOT A SCHEDULE. "First Fridays", "every second Saturday", "one
> movie each month this summer" tells you a PATTERN, not that any given date is
> booked. Only list an occurrence whose own date the source actually states, and
> never project a series past the last date it names or past the season it
> covers. […] If you are writing the cadence into the description because you
> have no specific date, that is the tell. Omit it.

Golden-tested in `lib/__tests__/research-prompts.test.ts` so a silent edit that
drops it fails the suite.

**3. The report checker now runs twice an hour**, not every two hours
(`.github/workflows/check-reports.yml`). The old cron asked for 12 runs a day.
The run history showed 4–5 — GitHub drops scheduled runs under load — with real
gaps of **6h35m and 7h51m**. A report about a show *tonight* could have sat
eight hours, which is precisely what that workflow was built to prevent. Asking
more often does not stop the dropping; it makes the survivors land closer
together. Worst case falls from ~8h to ~2h. Minutes :07/:37 because the top and
half of the hour are the most contended slots.

## Follow-up, same day: the dispatch trigger

Tightening the cron narrowed the worst case to ~2h but could not close it — the
dropping is GitHub's, not ours. So filing a report now **dispatches the workflow
directly** (`lib/check-dispatch.ts`, called from `submitReportAction`). The
verdict email lands in minutes.

The cron stays, and it is still the guarantee. The dispatch is an accelerator
and is allowed to fail: expired token, GitHub outage, unset variable. Every
failure is a log line and the next scheduled run collects the backlog. Same
best-effort contract as the operator notification directly above it — the report
row is committed before either is called.

`workflow_dispatch`, not `repository_dispatch`: the latter needs a token with
Contents: write, i.e. one that can push to `main`. This needs Actions: write
alone. Smoke-tested against the real endpoint — `HTTP 204`, and the run started
four seconds later, versus the 108 minutes the last scheduled run had been
waiting.

## Deploy

```bash
git push origin main
```

Vercel redeploys the app and GitHub picks up the new cron from `main`. No schema
change.

**One new environment variable, and it is optional.** `GH_DISPATCH_TOKEN` in
Vercel turns the dispatch on; leave it unset and you get the cron, a log line
saying so, and nothing broken. Setup steps — including why the token needs
*Actions: Read and write* and nothing else — are in `docs/REPORT-CHECKS.md`
under "Setting up the dispatch token".

The DB changes are **already applied to production** — they were made directly
against Supabase during the investigation, not by this deploy.

## Verify

1. **The listing is gone.** `https://www.citypulsemn.com/event/7ffd0cd0-4d69-44f2-9185-09b67e609308`
   should render "Event not found", and Sat 12 Sep should no longer name
   Starlight Cinema. **Verified 10 Sep 2026, 13:38 CT** — day pages and
   `/api/events` clean, event page `Age: 0`.

   Note it answers **HTTP 200**, not 404. That is not this change: every missing
   event page does, including a UUID that never existed. They carry
   `<meta name="robots" content="noindex">`, so nothing gets indexed, but a soft
   200 for a genuinely absent page is worth its own look sometime.
2. **The sibling survived.** The same day page should still show **White Bear
   Township Movie in the Park** at Polar Lakes Park. If that vanished too,
   something over-reached.
3. **The cron took.** After the push, `gh run list --workflow=check-reports.yml`
   should show runs landing near :07/:37 and roughly twice as many per day.
4. **The dispatch works** (only after `GH_DISPATCH_TOKEN` is set). File a test
   report on any listing, then `gh run list --workflow=check-reports.yml` — a
   `workflow_dispatch` run should appear within seconds. If it does not, the
   Vercel log says why: `[dispatch] GH_DISPATCH_TOKEN unset` or
   `[dispatch] workflow dispatch failed: 401`.
4. `npm test` — 2015 passing, including the two new cadence guards.

### Resolved: the purge now works (and never had)

The cache WAS eventually purged, at 13:38 CT — but only after three separate
faults were cleared, each of which looked like the one before it:

1. `REVALIDATE_SECRET` was set in none of the three places. Production answered
   `503 not configured`; the pipeline and verify pass had been logging
   `⚠ revalidation did NOT happen` on every run for two months while going green.
2. Once set in Vercel, the running deployment still 503'd — Vercel hands env vars
   to a deployment at BUILD time, so an already-running one never sees a new
   secret. A redeploy fixed it.
3. Then it returned `401 missing Authorization header` with the secret correct at
   both ends. `SITE_URL` was the apex, the site 308s to www, and `fetch` strips
   the Authorization header across a cross-origin redirect. `SITE_URL` now names
   the canonical host, and `lib/revalidate-client.ts` refuses to follow a
   redirect rather than failing as if the key were wrong.

`[revalidate] ✓ caches cleared` — the first successful on-demand revalidation
this project has performed. See docs/REVALIDATION.md.

### Original caveat, kept for the record: the cache was not purged by hand

`npm run revalidate` failed from this machine — **`REVALIDATE_SECRET` is not in
`.env.local`** (it is set in Vercel and in GitHub Actions, just not locally).

**Self-healing takes up to two hours, not one.** There are two caches stacked,
and the outer one expiring is not enough:

| Layer | TTL | What it holds |
|---|---|---|
| ISR page cache | 30 min lists, 60 min event pages | the rendered HTML |
| `unstable_cache` in `lib/events.ts` | 60 min (`EVENTS_TTL_SECONDS`) | the DB rows |

An ISR regeneration that fires while the data cache is still warm re-renders the
stale listing and resets the page clock. Observed here: 9 minutes of polling
after the DB write with no change on any surface, which is correct behaviour and
not a bug.

`revalidateTag(EVENTS_TAG)` clears both at once, and `/api/revalidate` is the
only door into it from outside the app — which is what `REVALIDATE_SECRET`
opens. Adding it to `.env.local` (copy from Vercel → Settings → Environment
Variables) turns a two-hour wait into seconds for every future manual DB fix.

Note that this only affects changes made by SCRIPTS or by hand. The admin UI
calls `revalidateTag` in-process, so hiding a listing from `/admin` has always
been immediate.

## Rollback

The listing was real-looking but not real, so there is nothing to restore. If
you disagree with the call:

```sql
update events set status = 'published'
where id = '7ffd0cd0-4d69-44f2-9185-09b67e609308';
update event_reports set status = 'pending', outcome = null, reviewed_at = null
where id = '145f44f0-0c68-437f-8339-e1ef7ce5f8f5';
```

The code changes are a prompt string and a cron line — `git revert` covers both,
and neither can break a running page.

## Still open

The 77-day gap is the real story here. This listing was created in June, sat
published all summer, and the verify pass never reached it once — `verified_at`
was NULL when the reader called the city. The report loop caught it, but the
report loop is a reader doing our verification for us. The unverified long tail
(~694 of 1234 listings) is where the next one of these is sitting right now.
