# Deploy — the panel could say which ticketing platform, not which business

**29 Oct 2026.** One query function, one import, one table, one copy edit, two
tests. No schema change, no data change, no new secret, no migration. Deploy is a
push.

This is **B1** in [ROADMAP-MONETIZATION.md](../ROADMAP-MONETIZATION.md) — first in
the queue despite being worth $0 on its own, because it unblocks the one action in
that document that does not require the audience to grow first.

## Why this, before anything that earns money

`/admin/stats` already had `getTicketClicksByVendor` — ticket clicks grouped by
the destination **host**. That is the affiliate question, and as of this week the
affiliate question is settled and closed: of 1,444 ticket clicks in 30 days across
119 distinct hosts, **28 — 1.9%** reach any affiliate-able destination. About $6 a
month.

The question that is still open is the other axis: *which businesses do we send
buyers to?* Nothing on the site answered it without a hand-written SQL join, and
the two axes disagree in a way that matters:

| | Listings | Clicks (30d) |
|---|---|---|
| first-avenue.com | **160 — most of any host** | **14** |
| mspmag.com (one Restaurant Week listing) | 1 | **565 — 39% of everything** |

I got this wrong myself before measuring it, and recommended leading the outreach
with First Avenue on the strength of its listing count. **Supply is not demand.**
Ordering by host, or by listings, sends you to the wrong party — so the panel now
carries the axis the pitch is actually made on.

## The design decision worth recording

**A sibling function, not a generalized one.** The obvious-looking move is to take
the existing vendor query and add a `groupBy` parameter. That needs either dynamic
SQL or a column allowlist, for exactly two call sites, and it would bury the
never-break contract inside a branch. `getTicketClicksByVenue` instead mirrors
`getTicketClicksByVendor` line for line — same 1–90 day clamp, same
`America/Chicago` date window, same `limit 25`, same `[]`-on-failure catch — so
the two read as a pair and neither can drift into cleverness.

**The venue table renders above the vendor table.** The vendor question is
answered and closed; the venue question is live and is the one being worked.

**The vendor block's note gained one sentence** saying the affiliate question
measured 1.9% and the seam stays dormant. A panel that silently invites a settled
decision is a small trap, and the table is now the tripwire that would reopen it.

## Never-break contract, on the page that produced the rule

ENGINEERING rule 1 was born here — `HOTFIX-admin-stats.md`, the day this page 500'd
in production because an engagement query failed. The new function carries the same
contract: `[]` on any failure, the error logged rather than swallowed, the rest of
the page still standing. Both tests encode it.

There is a second reason beyond the rule. A partial click count quoted to a
business is worse than no count at all, so this query fails **empty**, never
partial.

## What shipped

| File | Change |
|---|---|
| [lib/stats.ts](../../lib/stats.ts) | `VenueClicks` + `getTicketClicksByVenue(days)` |
| [app/admin/stats/page.tsx](../../app/admin/stats/page.tsx) | import, call, the venue table above the vendor one, one sentence on the vendor note |
| [lib/\_\_tests\_\_/stats-resilience.test.ts](../../lib/__tests__/stats-resilience.test.ts) | both reports return `[]` on a throwing query (and log); `[]` with no database at all |

Honest emptiness: the block renders **nothing** when there are no rows, mirroring
the vendor block. No empty table, no placeholder.

## Quality gate

- `npx tsc --noEmit` — clean
- `npm test` — **552 files, 9,958 tests, all passing** (CLAUDE.md still says 2,290+; it is well out of date)
- `npm run build` — clean
- `npm audit` — **0 vulnerabilities**
- Smoked the shipped function against production data (below)

**`npm run lint` does not run** — `next lint` is deprecated and drops into an
interactive ESLint-setup prompt. Pre-existing and project-wide, not caused by this
change, and worth its own small session.

### The smoke

Called the exported function (not hand-written SQL) against the live database:

```
565  Metro-wide (multiple restaurants)
 49  Battle Creek Recreation Center
 47  Ferguson's Orchard
 41  Trail of Terror Grounds (Minnesota Renaissance Festival Site)
 39  Bar Meteor
 39  Three Rivers Park District (Baker Campground)
 32  Minnesota Zoo
 29  Pryes Brewing Company
rows=25 (limit 25)    first-avenue.com as vendor: 14 clicks
```

**What I did not verify:** the rendered page in a browser. `/admin` is HTTP basic
auth and fails closed; `ADMIN_PASSWORD` is set in `.env.local` but reading secrets
out of that file is blocked here, so I could not sign in. The JSX is a copy of the
vendor table that already renders on that same page, and the build compiled it —
but a human has not looked at it. **That check is in the list below.**

## Deploy

1. Push to `main`. Vercel auto-deploys.
2. Nothing else. No schema, no secret, no backfill, no revalidation.

## Verify (about a minute, after the deploy goes green)

1. Open `/admin/stats` and sign in.
2. **"Ticket clicks by venue — last 7 days"** appears **above** the vendor table.
3. Switch the range to 30 days. The top row should be
   *Metro-wide (multiple restaurants)* around 565, and the list should look like
   seasonal attractions, parks and breweries — not arenas.
4. The vendor table still renders below it, now ending with the 1.9% sentence.
5. Nothing else on the page moved.

Then **lane O1**: that table is the email. Lead with the number next to their name.

## Known limits (deliberate, not defects)

- **`limit 25`**, mirroring the vendor table. The top 25 venues account for 1,117
  of 1,444 clicks in 30 days — the tail is real and is not shown. Raise the limit
  if the tail ever matters.
- **The top row is not a venue.** *"Metro-wide (multiple restaurants)"* is
  Restaurant Week; the contact there is the publisher, Mpls.St.Paul Magazine, not
  a venue. That is honest data, not a bug — but do not send that one a "your venue"
  email.
- **Window definition.** This uses `America/Chicago` days, like the rest of the
  site. The finding-2 table in ROADMAP-MONETIZATION.md was built with an ad-hoc
  UTC-day query, so individual counts differ by a click or two. The ranking does
  not change; the panel is the more correct of the two.
- **No per-venue drill-down.** That is C1, the venue dashboard.

## Rollback

`git revert` the commit and push. The panel loses one table; nothing reads
`getTicketClicksByVenue` but that page, there is no schema or data to undo, and
the vendor table is untouched by the revert except for its one added sentence.
