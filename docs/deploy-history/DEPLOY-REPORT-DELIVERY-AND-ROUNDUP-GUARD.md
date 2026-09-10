# Deploy — the checker worked, nobody was told; and the roundup that keeps inventing events (9 Sep 2026)

## What the reader reported

"44th Annual Halloween Party at Westwood Hills Nature Center — wrong days."

They were right, and the listing was wrong in a more interesting way than a
typo: **it was the 2025 event wearing 2026 dates.** The title carried its own
proof. The 44th annual ran 17–18 Oct 2025; 2026 would be the 45th. Our listing
said 17 Oct 2026, 10:00 AM.

Its source was `bringmethenews.com/.../the-twin-cities-best-halloween-events` —
an **evergreen roundup**: a stable URL whose contents are replaced every season.
The research agent read last year's list and stamped this year on it. That is
the same failure as the Damian Marley fabrication a few days earlier, from the
same shape of source.

## Three separate defects

### 1. The event (fixed — drafted, not corrected)

Drafted, with the reasoning in `admin_audit`. **Not** corrected to the 2026
dates, deliberately: aggregators disagree (Family Fun Twin Cities says 23–24
Oct, Explore Minnesota says 18–19, Westopolis says 17–18 — the last two are
2025 leftovers), and **stlouisparkmn.gov's own October 2026 calendar carries no
Halloween Party at all.** Trusting an aggregator over the venue is what caused
this; doing it again to "fix" it would be the same mistake with better
intentions. When the city publishes, the listing can come back.

The reader's report is marked `actioned` / `hidden`.

### 2. The auto-checker ran perfectly and told nobody (fixed)

This is the one worth reading twice.

- 00:02 — reader files the report
- 00:13 — `check-reports` checks it, verdict **`supported`**, with a paragraph of
  correct evidence, saved to the database
- 00:13 — the email carrying that verdict **is not sent**
- the job **exits 0** and shows green in Actions

The line responsible:

```ts
const to = process.env.NOTIFY_TO ?? process.env.OPS_DIGEST_TO;
```

`NOTIFY_TO` is not a configured secret. A workflow that maps
`NOTIFY_TO: ${{ secrets.NOTIFY_TO }}` for a secret that does not exist sets the
variable to the **empty string**, not to `undefined`. `""` is not nullish, so
`??` stopped there and never reached `OPS_DIGEST_TO` — **which was set the whole
time.** The feature was one falsy-vs-nullish away from working since the day it
shipped.

The same shape hit the one-tap decision links:

```ts
process.env.REPORT_ACTION_SECRET ?? process.env.UNSUBSCRIBE_SECRET ?? "…dev…"
```

Under Actions that resolves to `""` (empty HMAC key). On Vercel, where the
variable is genuinely undefined, it resolves to `UNSUBSCRIBE_SECRET`. **Emails
were signed with one key and verified with another** — the buttons could never
have worked, and nothing would have said so louder than a generic "that link
isn't valid".

**Fix:** `lib/env.ts` — `envValue` / `envOr` / `envRequired`, which treat blank
as absent. Applied to every environment fallback in `report-verdict-email`,
`notify-send`, `report-token`, `geocode`, `unsubscribe-token`. A test asserts no
`process.env.A ?? process.env.B` chain returns to those files.

Proven under the exact failing conditions:

```
old  (?? chain): ""                    -> email NOT sent
new  (envValue): "taren@example.com"   -> email sent
signing secret : "the-real-unsub-secret"  (was "")
```

**And the job now fails when it cannot deliver.** A checked verdict that reaches
nobody is an outage, not a log line. The verdicts are saved before the send, so
failing loses nothing and a re-run is safe.

### 3. Roundup sources auto-published unverified (fixed going forward)

`lib/source-trust.ts` — an event whose source is a third-party editorial roundup
now lands as **draft**, not published, and waits for the verify pass to confirm
it against the venue's own calendar. The pipeline logs every held event by name,
so the gate can never quietly gut coverage.

The gate only ever *holds back*; it can never publish something that would
otherwise have waited.

**A rule I tried first and threw away:** "many events from one source sharing an
identical start time" looked like a fabrication fingerprint — 11 of the 20
Halloween events sat at exactly 10:00 AM. Measured against real data it is
useless: Walker Art Center's 14 performances are all 19:30, the Renaissance
Festival's 24 days all open 09:00, and every Wild home game starts 19:00.
Recurring events legitimately share a clock. The honest discriminator is not the
time, it is whether the source is the organizer's own page.

## The blast radius, and a decision for Taren

Of **1,234 upcoming published events, 694 (56%) have never been verified.**
**253 come from a third-party aggregator or news host; 226 of those are
unverified.**

I took down **18** — every published, unverified event from the one article
already proven to have produced a fabrication. None was verified, so no human
judgement was overruled. Undo is one query, printed by the script and recorded
in `admin_audit`.

**I did not touch the other ~208.** Hiding 17% of the upcoming calendar is a
product call, not an engineering one. The tool is ready either way:

```bash
npx tsx scripts/hold-unverified-source.ts --match=mspmag.com --dry-run
```

It never deletes, and it never touches a verified event.

## Still open — worth doing before the next report

**Set `REPORT_ACTION_SECRET` explicitly in both GitHub Actions and Vercel.** The
fallback now resolves consistently, but only because both runtimes reach
`UNSUBSCRIBE_SECRET`. I cannot read Vercel's environment from here, so I cannot
confirm `UNSUBSCRIBE_SECRET` is set there. If it is not, the route verifies with
the dev default while the email signs with the real key, and the buttons stay
broken for a second, quieter reason. One explicit secret in both places removes
the whole class.

**The ops digest only runs `on: workflow_run` after the weekly pipeline** — once
a week. It is now the backup channel rather than the only one, but a verdict
that fails to email still waits up to seven days to appear anywhere.

## Deploy

No schema change, no new env var required.

```bash
git push origin main
```

## Verify

1. Actions → Check Listing Reports → next run logs `verdict email sent`, or
   **fails the job**. It can no longer be green and silent.
2. File a test report from `/report`, wait for the 2-hourly run, confirm the
   email arrives and its Keep/Take-down buttons land on a confirmation page.
3. Next pipeline run: `[pipeline] … held as draft — sourced only from …` lines
   name anything the roundup gate caught.
4. `/places` and the calendar still render; 1,993 tests green.

## Rollback

```bash
git revert <sha>
```

The 18 held events are data, not code — the undo query is in `admin_audit` and
in the script's output above.
