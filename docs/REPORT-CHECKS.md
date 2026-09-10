# Report checks — and deciding from the email

What happens between a reader telling us a listing is wrong and that listing
coming down.

## Why this exists

**5 September 2026, 11:20.** A reader used the report form on our listing for
*Damian 'Jr. Gong' Marley & Stephen Marley* at The Fillmore Minneapolis. Their
whole message:

> The show is wrong. Masego tonight at Fillmore

They were right, and it was worse than they knew:

| | |
|---|---|
| The Fillmore's own calendar, that night | **Masego — Fix Your Face Tour**, 7:00 PM |
| Damian Marley's upcoming dates on Live Nation | **none, anywhere** |
| The article we cited as our source | names Isaiah Rashad, Digable Planets and Thundercat at that venue — **never mentions the Marleys** |

So the listing was not a misreading of a schedule. It was invented, and it
carried a citation that does not support it. It was **published**, the show was
**that evening**, and the freshness verify pass had stamped it `verified_at`
**two days earlier**.

Meanwhile the report sat in the queue as one line of plain text — `1 listing
report awaiting review` — waiting for a human to open the admin.

## The three things that changed

### 1. Every report is checked before it reaches Taren

`npm run check-reports` takes pending, unchecked reports and asks a question the
freshness pass does not: **what does the venue itself say is in that room that
night?**

That is the difference that matters. The verify pass asks whether an event
"still appears as scheduled" against *its own source* — and when the source is a
roundup that never mentioned the event, the honest answer is uninformative, yet
it came back `confirmed`. Asking the venue's own calendar is a different
question, and it is the one that catches an invented booking.

The verdict is about **the reader's claim**, never about the listing directly.
That keeps "we couldn't find anything" from reading as "the reader is wrong":

| verdict | meaning | suggested |
|---|---|---|
| `supported` | evidence backs the reader; the listing looks wrong | take it down |
| `contradicted` | evidence backs our listing; the reader looks mistaken | keep it |
| `unclear` | nothing decisive found | a human should look |
| `error` | the check could not run | a human should look |

**`unclear` never suggests removal.** A page you cannot find is not evidence
that an event is fake — the same asymmetry `lib/verify.ts` enforces for
cancellations, and for the same reason: a false removal deletes a real event and
nobody ever reports *that*.

**A decisive verdict without evidence is downgraded to `unclear`.** An assertion
with no source is exactly what put the Marley listing on the site.

### 2. The verdict travels with the report into the email

Two channels, deliberately:

- **`check-reports` emails you** once a check completes — every 2 hours, and it
  no-ops in seconds when nothing is pending. This is the timely one. The Marley
  show was *that evening*; a weekly digest would have reached you four days
  after the doors opened.
- **The weekly ops digest** grows a **Reports** section carrying the same
  verdicts and the same buttons. That is the backstop, matching the existing
  two-layer design — if the email is ever dropped, Monday still surfaces it.

The instant "a new listing report came in" ping is unchanged and still fires the
moment someone submits. That one tells you something arrived; these tell you
whether it was right.

### 3. You can settle it from the email in one tap

Every report block carries **Take it down** and **Keep it**.

- *Take it down* hides the listing (`status = 'draft'`) and closes the report as
  actioned. **Nothing is ever deleted** — Admin → Events puts it back.
- *Keep it* closes the report as declined and leaves the listing alone.

Both are recorded in `admin_audit` as `report_decision_email`, and the report
stores `decided_via = 'email'` so a one-tap decision stays distinguishable from
one taken in the admin.

## The security design, which is the part worth reading

**Mail providers follow links in messages.** Outlook Safe Links and Gmail's
scanners fetch every URL before a human sees it. A link that hid a listing would
fire on delivery and take events off the site by itself.

So:

- **GET changes nothing.** It renders a confirmation page.
- **POST applies the decision**, from a form on that page.

One extra tap, and no listing is ever taken down by a spam filter. Verified
against a running server: five GETs against a valid takedown link left the
report `pending`.

**The token signs the action as well as the report id** (`report:<id>:<action>`),
so a *Keep it* link cannot be edited into a takedown. Verified: swapping the
action with the other action's token returns 400 on both GET and POST.

Tapping the same link twice is safe — the second one says "already decided" and
changes nothing, because the update only matches a report that is still pending.

## The secret

`REPORT_ACTION_SECRET` signs the links. **If it is unset it falls back to
`UNSUBSCRIBE_SECRET`**, which is already configured because the weekly digest's
unsubscribe links work. That is deliberate: `REVALIDATE_SECRET` has been unset
since the day it was added, and a decision channel that silently does nothing is
worse than one sharing a key. Sharing is safe because the HMAC message is
namespaced — no unsubscribe token can be replayed as a decision.

Give it its own secret whenever convenient; nothing needs to change when you do.

## Running it

```bash
npm run check-reports                 # check, save, email
npm run check-reports -- --dry-run    # check and print; writes nothing, sends nothing
npm run check-reports -- --limit=3    # smaller batch
```

Scheduled by `.github/workflows/check-reports.yml` at :07 and :37 past every
hour. It used to say every 2 hours; GitHub was dropping most of those runs and
the real gap between checks reached 7h51m. See HOTFIX-cadence-extrapolation.md.

## Pieces

- `lib/report-check.ts` — the prompt, the parser, the verdict policy (pure, tested)
- `lib/report-token.ts` — HMAC over report id + action (pure, tested)
- `lib/report-verdict-email.ts` — the email with the buttons
- `lib/report-revalidate.ts` — cache busting after an emailed decision
- `app/report-action/route.ts` — GET confirms, POST applies
- `scripts/check-reports.ts` + `.github/workflows/check-reports.yml`
- `lib/event-reports.ts` — `getUncheckedReports`, `saveReportCheck`,
  `getPendingReportsWithChecks`, `applyEmailedDecision`
- Schema: five additive nullable columns on `event_reports`

## What this does not fix

**The freshness verify pass still confirmed a fabricated event.** This module
catches it once a reader complains; nothing yet stops the listing being created,
and nothing stops `verify` stamping `verified_at` on something that does not
exist. The Fillmore has no primary-source importer — it is part of the ~435
listings in the unverified long tail. See the open items in
`docs/deploy-history/DEPLOY-REPORT-CHECKS.md`.
