# Deploy — a page a venue can open, and the number B1 was splitting in four

**29 Oct 2026.** C1 from [ROADMAP-MONETIZATION.md](../ROADMAP-MONETIZATION.md).
Seven files, 23 tests. No schema change, no data change, no new secret required.
Deploy is a push.

The spec for this item was wrong about one thing, the live data said so before
any code was written, and correcting it turned a dashboard for 48 rooms into a
dashboard for 326 businesses. That is most of what this guide is about.

## What shipped

A venue gets a URL. The URL is the credential. It opens one page that answers one
question: how many people looked at your listings on City Pulse MN, and how many
clicked through to your tickets. Read-only, no login, no account, no table.

| File | What it is |
|---|---|
| [lib/venue-report.ts](../../lib/venue-report.ts) | the pure half — the report key, and the merge from venue strings to businesses |
| [lib/venue-token.ts](../../lib/venue-token.ts) | HMAC magic links, namespaced `venue-report:`, 90-day TTL |
| [lib/stats.ts](../../lib/stats.ts) | `getVenueStats` replaces `getTicketClicksByVenue` |
| [app/venue-report/page.tsx](../../app/venue-report/page.tsx) | the page the venue sees |
| [app/admin/stats/page.tsx](../../app/admin/stats/page.tsx) | the venue table now merges spellings, shows views + CTR, and mints the link |
| [app/robots.ts](../../app/robots.ts) | `/venue-report` disallowed |
| `lib/__tests__/venue-report.test.ts`, `venue-token.test.ts` | 12 + 11 tests |

## The spec said "keyed on venue slug". The data said no.

C1's design note read: *"magic-link, no login, no account… add `lib/venue-token.ts`
in the same shape, **keyed on venue slug**."* Before writing the token I measured
what that would cover, against 30 days of live stats:

- **381** distinct venue strings earned a view or a ticket click.
- **82** of them are registry venues (`lib/venues.ts`).
- Of the **top ten by clicks, nine are not in the registry**: Ferguson's Orchard,
  Trail of Terror, Scream Town, Pryes Brewing, Battle Creek Recreation Center,
  Bar Meteor, Chanhassen Dinner Theatres, Anoka and Dakota county fairgrounds.

The registry is pipeline config — the rooms the weekly sweep visits. It is a
**supply** list. Keying the dashboard on it would have built a venue-relations
tool for the arenas, which carry the most listings and almost none of the clicks.
That is finding 1 of the roadmap wearing a different hat, and finding 1 is the
standing proof that the wrong axis sends you after the wrong party.

**So the key is the registry slug when there is one, and the slugified venue name
otherwise.** Registry first matters, because its alias table is the only thing
that knows "7th St Entry" is First Avenue and that "Grand Casino Arena" is the
building whose slug still says Xcel. Slugify alone still does most of the merging
for free, because `normalizeVenueName` already drops parentheticals.

Reportable businesses: **326, not 48.**

## It also corrected a number B1 was getting wrong

The B1 table grouped by the raw venue string. A business whose listings name
different rooms was therefore split across rows, and the row Taren would have
quoted was a fragment of its own total:

| Business | B1 showed | Actually | Spellings |
|---|---|---|---|
| Three Rivers Park District | 39 | **42** | 4 |
| Minnesota Zoo | 32 | **34** | 4 |
| Como Park Zoo & Conservatory | — | merged | 5 |
| First Avenue | — | merged | 4 |

Measured live, **40 keys merge more than one spelling.** The merge happens
*before* the top-25 slice, which is why `getVenueStats` has no `limit`: cutting
at 25 raw strings first could drop part of a venue's own total on the floor.
Understating ourselves to a buyer is a smaller sin than overstating, but it is
the same class of error, and it was in a table built specifically for sales.

`getTicketClicksByVenue` was **deleted**, not kept alongside. The new function
strictly subsumes it and the admin table reads better from the merged rows. One
query, two call sites.

## The token

The fifth module in this shape — `unsubscribe-token`, `restore-token`,
`confirm-token`, `report-token`, now `venue-token` — and deliberately the same
shape rather than a new idea.

- **Namespaced** `venue-report:`, which is what makes sharing `UNSUBSCRIBE_SECRET`
  safe. A test asserts that a restore token and an unsubscribe token for the same
  key both fail here.
- **Signs the venue key**, so editing `?v=` to read a competitor's numbers fails.
  Smoked live, not just unit-tested: a valid Restaurant Week token with `?v=` swapped
  to `first-avenue` renders the expired notice.
- **Has a 90-day expiry**, though it changes nothing. Unsubscribe links live
  forever because the worst case is unsubscribing. Here the worst case is a
  forwarded thread giving a stranger a permanent read on one business's traffic.
  Not personal data — `event_stats` holds no identifiers by schema — but it is
  commercial information we do not publish, so it gets a life.
- **Secret falls back to `UNSUBSCRIBE_SECRET`**, same argument as `report-token`:
  this project had `REVALIDATE_SECRET` unset for two months and the channel it
  gated was silently dead. `VENUE_REPORT_SECRET` is honoured if you ever set it.
  **No new secret is required to deploy.**

## What the page will not say

- **No placement, in writing.** "Nothing here is for sale and nothing you do on
  this page changes how your events are ordered on the site — we have never sold
  placement and are not going to." The roadmap's watch-item for C1 was that the
  dashboard must never imply we can move a ranking; stating the opposite is
  cheaper than hoping nobody asks.
- **Not unique readers.** The page says so in plain words: one person looking
  twice counts twice, and we have no verified unique-reader figure. This is the
  roadmap's own measurement caveat, printed where a venue will read it rather
  than kept in a doc.
- **Nothing about conversion.** We cannot see what happens after the click and
  the page says that too.
- **No subscribe band.** One per reader page is the rule; this is not a reader
  page, and a business opening its own numbers did not ask for a pitch.

## Two things the smoke caught that tests did not

Both were copy, both were only visible by loading the page.

1. **"Your 0 upcoming listings."** The zero case is the *common* one here — a
   seasonal operator reads this the week after its season ends, which is exactly
   the O1 send list. The heading now drops the count when there is nothing to
   count.
2. **A slug as a headline.** A quiet registry venue with no stats and no live
   listings printed **"cabooze"** at the top of its own report. The name now
   falls back through the stats rows, then the registry's curated name, then any
   listing we hold — and if every source is empty it says nothing rather than
   title-casing a slug into a name the venue never used.

## Quality gate

- `npx tsc --noEmit` — clean
- `npm test` — **148 files, 2,900 tests**, all passing (2,877 → 2,900)
- `npm run build` — clean, 611 static pages; `/venue-report` is `ƒ` as intended
  (a signed link per venue must never be cached or prerendered) and `/api/events`
  is still `○`
- `npm audit` — **0 vulnerabilities**
- Smoked live against the real database, four cases: a non-registry business with
  traffic (Ferguson's Orchard, 208 views / 47 clicks / 23%), a registry business
  whose four spellings merge (Three Rivers, 42 clicks), a venue with nothing in 90
  days (honest zeros and a sentence saying so), and an expired link. The one
  console error on the page also appears on the untouched homepage — pre-existing,
  not from this change.
- `robots.txt` served locally and carries `Disallow: /venue-report`

**What was NOT observed, stated rather than implied: the rendered `/admin/stats`
page.** It is behind HTTP Basic auth and `ADMIN_PASSWORD` is not readable in this
environment, so the new table was verified by running the exact expressions the
page evaluates (`aggregateVenueStats(await getVenueStats(30)).slice(0, 25)` plus
`venueReportUrl`) against the live database, and by the build compiling it. The
table's layout is unverified. That is the first item on the verify list below.

`npm run lint` still does not run — `next lint` is deprecated and drops into an
interactive prompt. Pre-existing, unchanged.

## Deploy

1. Push to `main`. Vercel auto-deploys.
2. Nothing else. No schema, no secret, no backfill.

Optional, any time: set `VENUE_REPORT_SECRET` in Vercel to give venue links their
own signing key. **Doing this invalidates every link already sent**, so if you set
it, set it before the first send.

## Verify

1. **Open `/admin/stats?days=30`.** The venue table should read *"Venues — views
   and ticket clicks"*, have five columns, and show a few rows tagged
   "· N spellings". Top row will be Metro-wide (multiple restaurants) at ~565
   clicks. This is the one surface not smoked here — if the layout is off, say so.
2. **Click a "Report ↗" link.** It opens that venue's page with its own numbers.
3. **Edit the `?v=` in the address bar** to another venue slug. It must say the
   link has expired, not show you that venue.
4. Spot-check one merged row: Three Rivers Park District should read 42 clicks
   over 30 days, not 39.
5. `/robots.txt` contains `Disallow: /venue-report`.

## Then the thing this was built for

O1 has been the highest-value unblocked item all day. It now has a link, not a
screenshot:

> Mint from `/admin/stats` and paste into the email. The warm list is the top of
> that table — the seasonal operators whose season ends this weekend, which is
> the week their numbers are highest and their attention is cheapest.

One wart to know before sending. The top row by clicks is
**"Metro-wide (multiple restaurants)"** at 565 clicks — the Restaurant Week
listing, whose real counterparty is **mspmag.com**, not a venue. The report is
honest and the number is the strongest we have, but the heading will read oddly
in an email to a publisher. Your call whether to send it as-is or lead with the
number in prose.

## Rollback

`git revert` and push. `/venue-report` disappears and the admin table reverts to
raw venue strings with ticket clicks only. Any link already sent stops working,
which is visible to whoever holds it — so if a venue has the link, tell them
rather than letting it 404 quietly. Nothing else depends on either module.
