# Handoff — current state (3 November 2026)

The single map a new session reads after `CLAUDE.md`. Rewritten today; the
previous version was dated 4 October and most of its numbers had moved — in one
case (`RESEND_API_KEY`) it was describing an environment that no longer existed.

## Read the instruments, not this file

Still the most important line here, and today is the strongest evidence for it.

> **`/admin/ops`** — every section of the Monday ops email, live. Grey means a
> check could not run and is never a pass.
> **`/admin/growth`** — subscribers, acquisition, funnel, returning readers.
> **`/admin/submissions`** — each submission's check verdict and evidence.
> **`npm run ops-digest -- --dry-run`** — the same report in a terminal.

Open those before proposing work. If they disagree with this file, they are
right. **And prefer the instrument's own query to one you write yourself:** the
verify-flag count below is 33 because that is what the digest reports; a
hand-written query over the same table gave 164 and then 25, because "open" also
covers **a flag raised after a stamp**, and because it takes only the latest flag
per listing. A number that nearly matches is worse than no number. That predicate
now has exactly one home — `lib/verify-flags.ts` — and both the email and
`/admin?status=flagged` come through it.

## Where things stand

| | |
|---|---|
| Published upcoming | **557** (95 inside 7 days) |
| Unverified | 66 |
| Upcoming **drafts** (hidden, no route back) | **61** — was 45 on 4 Oct |
| Never source-checked | 67 of 557 — 53 blocked, 7 error, 5 present |
| No ticket link | 0 |
| Open verify flags, still live | **33** — `wrong_event` 9 · moved 8 · weak_source 7 · not_found 6 · unproven 2 · sold_out 1 |
| Self-check | **1 probable duplicate**, 0 clashes — was 9 findings this morning |
| Active subscribers | **48** (+2 in 7 days) |
| Sitemap URLs | **1,402** — down from 2,242 on 7 Sep |
| GSC impressions (7d, read in Actions) | **14,490** — 29,056 eight weeks ago |
| Engagement (7d) | views 596, ticket clicks 139, saves 1, calendar adds 0 |
| Model spend | Sep **$78.84** · Oct **$131.05** · Nov **$10.28** so far |
| Spend by job, last 32 days | verify $63.13 · pipeline $57.95 · reels $9.71 |
| Archived rows, all time | 4,328 |

## The one thing to understand before planning anything

**Supply is falling and nobody knows why yet.** Pipeline intake per weekly run,
from `pipeline_runs.bands`:

| | upserted | of which `near` | run time |
|---|---|---|---|
| 17 Aug | 534 | 255 | 44 min |
| 26 Oct | 291 | 129 | 34 min |
| 2 Nov | 122 | 122 | 18 min |

**Most of that headline is not a fault.** `051bd93` (17 Aug) deliberately
staggered the research bands — near weekly, mid fortnightly, far every three
weeks — and predicted the shorter runs in its own message. 17 Aug was the last
run with all three bands due, so 534-vs-122 compares a three-band run to a
one-band run.

What is real is the `near` band, the only one that runs every week: **255 → 122**.
Part of that is config from the same commit (venue sweeps run *only* on `near`,
and their search budget was cut 12→10). The rest is **not diagnosed**.
Seasonality is the obvious candidate and could not be tested, because
`cost_searches` only starts 21 Sep. Ruled out by measurement: dedupe rejection
(flat 34–52/week), cancellations and unnamed drops (~0), and less searching
within the band (near-only runs use 131–137 searches every time).

Downstream this is the sitemap and impressions decline in the table above. Event
pages are **89% of all search impressions** (`gsc-section-demand-oct-2026`), so
it lands on the only surface that earns.

## What shipped since 4 October

75 commits. The theme of the last day of it is worth naming, because it repeats:

> **Four separate instruments were each reading something adjacent to the thing
> they claimed to measure.**

| | |
|---|---|
| `f0dfd4e` | The WoW baseline read the newest stored run, and the Monday job writes one at 09:01 — so every later read that day compared today against this morning. It printed `±0%` over a week when the sitemap fell 1,508→1,409. Fixed with `pickBaseline`, 72-hour floor, one definition for all three baselines |
| `dc4d7c2` | Nothing escalated a decline. Three rules, each calibrated against the 16 stored weeks rather than chosen: a -80% one-week cliff (0 historical fires), 4 consecutive down weeks (views have never run more than 2), and an opt-in -25%-over-8-weeks rule for structural surfaces only |
| `6754154` | The digest read `pipeline_runs`, so four red Mondays reported a healthy pipeline while the fabrication check sat at 0 pages for three weeks. A **Jobs** section now reads each workflow's own conclusion |
| `ab8e0fc` | The concurrent-venue allowlist was keyed on a raw spelling while the grouping was keyed on a room. Two entries had hyphens and had been unreachable since the day they were added |

Also: B2's support link went live (`ff56b06`), and nine listing rows were
corrected against organisers' own pages — three had **wrong start times**, one on
a row that had carried a verified stamp since 22 October.

## Open — the watch list

1. **`DIGEST_POSTAL_ADDRESS` is still unset**, and Taren decided on 3 Nov to
   leave the email money-ask off for now. The weekly send still stamps
   `NO POSTAL ADDRESS IN FOOTER (CAN-SPAM)` in its own record. `digestSupport()`
   enforces it in code, so setting the secret turns the line on with no deploy.
   **Owner: one GitHub Actions secret.**
2. **The 33 flagged listings still need a human**, and one of them starts
   tonight. The link works now (see Closed below), but the queue itself is the
   open item: 9 `wrong_event` verdicts mean the venue's own calendar contradicts
   us. Note the email prints only `verifyFlagExamples`, a `slice(0, 4)` — four
   named rows are a sample, never the count.
3. **61 upcoming drafts with no route back to published**, 15 starting inside a
   fortnight. Up from 45. `restore-drafted.ts` exists; nothing surfaces them.
4. **The 17 Nov Ordway report will keep firing.** Two real performances of
   *Gravity and Other Myths* at 10:00 and 12:00, given near-identical titles when
   the midday row was repointed. The matcher is right to flag them; an exemption
   cannot suppress a *duplicate*, and should not.
5. **`ROOM_ALIASES` does not fold the Bryant Lake Bowl spellings** — eight of
   them in the data, several distinct room keys, so the matcher cannot see a pair
   across two of them. Fixing it reaches the **write-time dedupe gate**, so it
   wants the same false-merge measurement that killed the pin fold.
6. **53 listings cite a host that refuses scripts.** Concentrated: espn 11,
   minnesotaorchestra 11, guthrietheater 8, artsmia 6, concertarchives 5,
   armorymn 5. See the environment note below — the block is bot-based, not a
   robots rule, so these are researchable by hand even though the weekly sweep
   can never read them.
7. **Taren's money decisions**: the Vercel spend alert (never set) and whether to
   hold an Anthropic Admin API key so the tile reads real spend rather than our
   own jobs. Our ledger now measures Oct at **$131.05**; whether the console
   agrees is only answerable from the console.
8. **Instagram: reels keep running, the Places card stays unscheduled** —
   Taren's call on 19 Oct (`docs/RETRO-INSTAGRAM-OCT-2026.md`). Unchanged.
9. **`price` is not a correctable field.** `lib/corrections.ts` accepts no
   `price`, so the Ordway's own `$4 per ticket` could not be applied to the two
   school-performance rows. Needs `/admin` or the next re-find.

**Closed since 4 Oct:** the 279 never-source-checked backlog (now 67, and the
remainder is the blocked hosts, not a queue) · the Scream Town clash (the event
has passed) · the four-week source-check outage (`fc7c22f` fixed both the SQL
comment and added `if: !cancelled()` so one step's failure cannot cascade again)
· **the dead triage link** — the email had pointed the flagged queue at
`/admin/events` since 26 Aug and that route never existed; it now says
`/admin?status=flagged`, which is a real filter showing exactly those 33 rows,
soonest first. A test resolves every `/admin` path the digest prints against
`app/**/page.tsx`.

## Environment notes (this machine) — the live form of rule 3

`docs/ENGINEERING.md` rule 3 was written for the ephemeral chat container and
defers here. Measured today:

- **`.env.local` carries** `DATABASE_URL`, `RESEND_API_KEY`, `REVALIDATE_SECRET`,
  `SITE_URL`, `DIGEST_FROM`, `OPS_DIGEST_TO`, `ADMIN_PASSWORD` and a
  **`GITHUB_TOKEN`** — note the token is in the file, not the shell, so anything
  reading `process.env.GITHUB_TOKEN` needs `--env-file-if-exists=.env.local`.
  The old handoff said `RESEND_API_KEY` was absent; it is not.
- **Absent:** `MAPBOX_GEOCODING_TOKEN`, `UNSUBSCRIBE_SECRET`,
  `GSC_SERVICE_ACCOUNT_JSON`, `DIGEST_POSTAL_ADDRESS`, `IG_ACCESS_TOKEN`. Each
  has a consequence rather than being a nuisance:
  - no Mapbox → `geocode()` returns null → `submissionToDbEvent` falls back to
    the **metro centre**, a silent wrong pin. Geocode by hand, pass
    `publishSubmission({ geo })`.
  - no signing secret → the inbox email's one-tap buttons are signed with the
    **dev fallback** and production rejects them as expired.
  - **no GSC key → the Search Console report cannot run locally at all.** It
    correctly prints `NOT MEASURED THIS RUN` rather than zeros. Re-run
    `gsc-report.yml` in Actions instead; the ops digest's impressions line is
    live only there too.
- **Taren edits `.env.local` from a phone — verify value shapes before trusting
  them** (a `//` once arrived as `..`).
- **A "blocked" host may only be blocked to scripts.** minnesotaorchestra.org
  403s every `WebFetch` but the **built-in browser pane reads it fine** — the
  block is bot/UA-based at the edge, and its `robots.txt` serves 200 with
  `Allow: /` and no `Sitemap:` lines at all. The first read right after
  navigating returns a Cloudflare interstitial that clears itself after ~6
  seconds; read once and you will wrongly conclude it is unreadable.
- **A worktree has no `.env.local`**, and `.next/cache` survives rebuilds, so a
  local smoke there serves sample data twice over (count 30 = fallback, ~550 =
  real).
- `git push` needs `GCM_INTERACTIVE=auto` in agent sessions.

## Rule 8, locally — verify the artifact, not the intention

Deliverables are commits now, so the literal archive-parity check is gone. What
replaced it:

- Before staging, `git diff --stat` and confirm the change set is exactly what
  you wrote. Stage files by name, never `git add -A` — nine `corrections-*.json`
  and `verdicts-*.json` working files sit untracked in the repo root on purpose.
- **Never trust a gate measured while a review workflow is in flight.** On 2 Nov
  review agents ran mutations in the shared tree and a "2,953 tests green" figure
  had to be thrown away because it could not be proved which version of
  `lib/digest.ts` it measured. Any agent invited to mutate gets
  `isolation: 'worktree'`.
- A workflow **step** writing a success row does not mean the **run** succeeded.
  Check `gh run list` as well as the table the step writes — that gap cost three
  weeks of the fabrication check.

## Conventions worth preserving

- **Recon before writing.** Grep the real export first; guessed helper names
  remain the top source of wasted turns. Today's examples: `price` is not a
  Correction field, `events.start_at` is not `starts_at`, and
  `CONCURRENT_VENUES` is keyed on a room, not a spelling.
- **Measure before diagnosing**, and say which tool did the measuring. "Blocked"
  and "blocked to `WebFetch`" are different facts.
- **Compare like with like.** The 534→122 intake story was a three-band run
  against a one-band run, and three previous sessions repeated it.
- **One definition of a rule.** Three copies of the WoW baseline query is how
  three sections came to report the same lie independently.
- **A partial measurement must not render as a pass** — and that includes a
  confident `±0%`. Grey is not green; a floor is not a total.
- **Never invent an end date.** Four ends were cleared today rather than derived
  by adding a stated duration to a start.
- **Never delete events** — archive them. Personal data is the exception.
- **A correction must quote the page.** Both fabrication incidents arrived via a
  plausible citation. `verified: true` only when the organiser's own page shows
  exactly the corrected values.
- **Shell escaping mangles things.** Write multi-line patches with a Node script
  and exact-string anchors that fail loudly, not heredocs.
- **Prefer the richer title as a duplicate's survivor**, and carry over anything
  the archived row did better — but only what a source attests.

## First session opener

> Read `CLAUDE.md` and this file, check memory, then `git log --oneline -10` and
> `npm test`. Then run `npm run ops-digest -- --dry-run` — the sections know more
> than this document does, and since 3 Nov they also say when a job went red.
