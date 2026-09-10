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

## Deploy

```bash
git push origin main
```

That is the whole deploy. No schema change, no new secret, no env change. Vercel
redeploys the app (the prompt change only matters to the pipeline, which runs
from GitHub Actions), and GitHub picks up the new cron from `main`.

The DB changes are **already applied to production** — they were made directly
against Supabase during the investigation, not by this deploy.

## Verify

1. **The listing is gone.** `https://www.citypulsemn.com/event/7ffd0cd0-4d69-44f2-9185-09b67e609308`
   should 404, and Sat 12 Sep should no longer name Starlight Cinema.
   *Expect a delay of up to an hour* — see the caveat below.
2. **The sibling survived.** The same day page should still show **White Bear
   Township Movie in the Park** at Polar Lakes Park. If that vanished too,
   something over-reached.
3. **The cron took.** After the push, `gh run list --workflow=check-reports.yml`
   should show runs landing near :07/:37 and roughly twice as many per day.
4. `npm test` — 2015 passing, including the two new cadence guards.

### Caveat: the cache was not purged by hand

`npm run revalidate` failed from this machine — **`REVALIDATE_SECRET` is not in
`.env.local`** (it is set in Vercel and in GitHub Actions, just not locally). The
pages self-heal on their ISR windows instead: 30 min for day/list pages, 60 min
for the event page, 5 min for `/api/events`.

Worth fixing, because this is exactly the case the script exists for: adding
`REVALIDATE_SECRET` to `.env.local` makes every future manual DB fix take effect
in seconds instead of an hour. Copy the value from Vercel → Settings →
Environment Variables.

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
