# Deploy — reported listings get checked, and you can decide from the email (5 Sep 2026)

## The report that produced this

A reader, 11:20 today, on our *Damian 'Jr. Gong' Marley & Stephen Marley*
listing at The Fillmore Minneapolis:

> The show is wrong. Masego tonight at Fillmore

**The claim is true.** Checked against three independent sources:

- The Fillmore's own site lists **Masego — Fix Your Face Tour**, Sat 5 Sep 2026,
  7:00 PM. Corroborated by Ticketmaster, AXS, SeatGeek, and Explore Minnesota's
  own event page for that show.
- **Live Nation shows no upcoming Damian Marley dates at all** — not a wrong
  venue, no tour.
- The article we cited as our source —
  `exploreminnesota.com/events/best-fall-concerts-minneapolis-st-paul` — lists
  Isaiah Rashad (Sept 4), Digable Planets (Oct 17) and Thundercat (Oct 27) at
  that venue. **It never mentions the Marleys.**

So this was not prose misread as a schedule. The listing was invented and given
a citation that does not support it.

Three aggravating facts:

1. It was **published** and the show was **that evening**.
2. The freshness verify pass had stamped it `verified_at` **two days earlier**.
3. That one article seeded **15 listings**; this was the only verified one.

**Action taken:** hidden (`published` → `draft`, reversible, audited as
`hide_reported_false` with the evidence), and the report closed as
`actioned`/`hidden`.

> Cache note: the hide could not bust the CDN, because `REVALIDATE_SECRET` is
> still unset — `npm run revalidate` fails closed. The page cleared on its own
> when its ISR window expired. This is the second time that unset secret has had
> a visible cost.

## What shipped

### 1. Every report is checked before it reaches you

`npm run check-reports` asks the question the freshness pass does not: **what
does the venue itself say is in that room that night?**

Run against the real report, it reached the same conclusion in one call:

```
SUPPORTED  Damian 'Jr. Gong' Marley & Stephen Marley @ The Fillmore Minneapolis
  The Fillmore Minneapolis's own website lists 'Masego: Fix Your Face Tour' on
  Sat Sep 5, 2026 — not Damian 'Jr. Gong' Marley & Stephen Marley. Ticketmaster's
  Fillmore page corroborates. No Damian/Stephen Marley Minneapolis date appears
  anywhere near Sept 5, 2026. The reader is correct.
  evidence: https://www.fillmoreminneapolis.com/
  → take-it-down
```

The verdict is about **the reader's claim**, not the listing — so "we couldn't
find anything" cannot read as "the reader is wrong". `unclear` never suggests
removal, and a decisive verdict with **no evidence is downgraded to `unclear`**,
because an assertion with no source is exactly what put this listing on the site.

### 2. The verdict is in the email

- **`check-reports` emails you** when a check completes — every 2 hours, and it
  no-ops in seconds when nothing is pending. This is the timely channel: the
  Marley show was *that evening*, and the weekly digest would have reached you
  four days after the doors opened.
- **The ops digest** grows a **Reports** section carrying the same verdicts and
  buttons, as the backstop. It renders only when something is pending.

The instant "a report came in" ping is unchanged.

### 3. Take it down / Keep it, from the email

Both recorded in `admin_audit`; the report stores `decided_via = 'email'`.
*Take it down* archives (`draft`) — **never a delete**, and Admin → Events puts
it back.

## The security design

**Mail providers follow links before a human does.** Outlook Safe Links and
Gmail's scanners fetch every URL in a message. A link that hid a listing would
fire on delivery.

So **GET renders a confirmation page and changes nothing; POST applies.** The
token signs the action as well as the report id, so a *Keep* link cannot be
edited into a takedown.

Verified against a production build:

| | |
|---|---|
| GET valid takedown link (the mail-scanner case) | 200, confirm page, **report still `pending`** |
| GET with the *keep* token on the delete action | 400 |
| GET with no token / a bogus action | 400 |
| POST with a tampered token | 400 |
| POST valid | applied — report `actioned`/`hidden`, `decided_via='email'` |
| POST the same link twice | "Already decided", nothing changed |
| GET + POST on the keep path | confirm page, then report `declined` |

## The secret

`REPORT_ACTION_SECRET` signs the links, and **falls back to
`UNSUBSCRIBE_SECRET`** when unset — which is already configured, so the buttons
work the day this deploys. That fallback is deliberate: `REVALIDATE_SECRET` has
been unset since it shipped, and a decision channel that silently does nothing is
worse than one sharing a key. Safe because the HMAC message is namespaced
(`report:` vs `unsub:`).

## Deploy steps

1. **Schema — already applied.** The five columns on `event_reports`
   (`check_verdict`, `check_note`, `check_evidence`, `checked_at`,
   `decided_via`) were added to production during this session; the DDL in
   `db/schema.sql` is additive and idempotent, so re-running it is a no-op.
2. Merge to `main`. Nothing is build-time.
3. **Optional:** set `REPORT_ACTION_SECRET` in Vercel and GitHub Actions. Not
   required — it falls back.
4. The new workflow runs on its own schedule. To try it now, dispatch **Check
   Listing Reports** with dry run on.

## Verify

```bash
npm run check-reports -- --dry-run
```

Prints each pending report, its verdict, the evidence and the suggestion, and
writes nothing. Then file a test report on any listing and watch the email
arrive within two hours with both buttons.

## Rollback

Delete `.github/workflows/check-reports.yml` and the `reports` block in
`scripts/send-ops-digest.ts`. The columns can stay — they are nullable and
nothing reads them when the section is absent. `app/report-action/route.ts` is
inert once no email links to it.

## Quality gate

`npx tsc --noEmit` clean · **1913/1913** tests (+33) · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · the checker run against the real report, the
route exercised on a production build for all seven cases above, the digest
section unit-tested including HTML escaping of the reader's prose.

*The suite includes the uncommitted **reels** workstream in the working tree.
Those files are not part of this change; `package.json` was staged as HEAD plus
one line so the two reels script entries stayed uncommitted.*

## Open — and the biggest one is not fixed

**The freshness verify pass confirmed a fabricated event.** This ships the net
that catches it *after* a reader complains. Nothing yet stops the listing being
created, and nothing stops `verify` stamping `verified_at` on something that
does not exist. `buildVerifyPrompt` asks only whether an event "still appears as
scheduled" against its own source — the same question that returned `confirmed`
here. Teaching it to ask the venue's calendar, the way the report check does, is
the obvious next change and is not in this deploy.

**The other 14 listings from that article are unverified** and were seeded by
the same run. None is confirmed wrong; none is confirmed right either.

**The Fillmore has no primary-source importer.** It sits in the research agent's
venue registry with no venue-calendar reconciliation, like ~435 other listings.
It is a Live Nation room, so Ticketmaster's API would cover it — the key that has
been outstanding since August.
