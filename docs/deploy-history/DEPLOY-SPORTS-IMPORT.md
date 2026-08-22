# Deploy — official sports schedule importer (21 Aug 2026)

## What shipped

Local sports listings are no longer researched from prose. Eight teams' home
games are now read from the leagues' own machine-readable schedules and the site
is reconciled against them, weekly and on demand.

**Ran against production immediately.** Result of the first pass:

```
8/8 feeds reachable · 4 hidden · 7 retimed · 28 added · 34 verified · 2 left alone
```

Second and third runs converge to `0 · 0 · 0 · 69 verified` — idempotent.

Verification, before → after:

| Team | Before | After |
|---|---|---|
| Twins | 20 upcoming, 10 verified (13 provably wrong) | 7 upcoming, **7 verified** |
| Wild | 27 upcoming, **0 verified** | 10 upcoming, **10 verified** |
| MN United | 8, 0 verified | 7, **7 verified** |
| Gophers | 7, 0 verified | 7, **7 verified** |
| Lynx | 6, 0 verified | 3, **3 verified** |
| Timberwolves | 7, 0 verified | 13, **11 verified** (2 beyond the horizon) |
| Vikings | 2, 0 verified | 4, **4 verified** |
| Saints | 11, 3 verified | 10, **10 verified** |

The two holes the Aug 21 placeholder cleanup left are filled: **Nov 6 vs. the
Sharks** and **Nov 7 vs. the Lightning** are on the site with real opponents.

## Design decisions, and why

**The feed is the source of truth; the site converges on it.** Phantom and
wrong-opponent listings are hidden, wrong times corrected, missing games created.
That means the opponent matcher does not have to be perfect — a miss hides our
row and creates the feed's in the same pass, so the outcome is right either way.
The matcher exists to avoid churn, not to be a gate.

**A feed that fails changes nothing.** The property worth protecting above all
others. An empty response and an offseason are indistinguishable from inside the
script, so the proving window is derived from the games the feed actually
returned — home *and* away, since an away game proves the feed knows that date.
Anything outside is `unknown` and untouched. ESPN's regular-season and playoff
halves are all-or-nothing for the same reason: half a season read as a whole one
would call a home playoff game a phantom.

**A placeholder is not a fact.** Both feeds encode "time not announced" as a
real-looking instant. MLB parks next season at `08:33Z` (a 3:33 AM first pitch);
ESPN parks unannounced kickoffs at Eastern midnight, which in Chicago reads as
11 PM **the previous day** — the wrong date, not just the wrong clock. Caught in
the dry run. TBD games now keep the day their feed states and carry no time
claim: stored `all_day`, rendered "All day".

**Horizon 92 days, matching `lib/horizon.ts`.** MLB will hand over all of next
season on request: 224 games nobody is browsing for, nearly all of them TBD.
Override with `--days=N`.

**Nothing is deleted, everything is logged.** Hides and retimes each write an
`admin_audit` row carrying the reason.

**MLS is the awkward one.** Its per-team endpoint returns only the first half of
the season whatever parameters you pass — it answered February–April every time.
The league-wide scoreboard honours a date range, so it filters that instead, and
the range must stay modest (400 days returns HTTP 400).

## One bug worth recording

The first two production runs reported "10 added" and added nothing.

`event_key` is `sha256(title|venue|day)`, so games the importer created collided
with rows the **Aug 21 cleanup had hidden under the same title** — e.g. the real
Aug 28 Twins–White Sox game, hidden that morning for a wrong start time.
`upsertEvents` sets status only on INSERT (so a re-found event keeps an
operator's hide), so each collision quietly *updated the hidden row and left it
hidden*. The game looked missing forever and was re-added on every run without
ever appearing.

The importer now republishes what it writes and reports the count. Eight Twins
rows and two Saints rows were resurrected — all real games, most of which the
Aug 21 pass had hidden when the better fix was to correct the time.

Caught only because the second run was expected to be a no-op and wasn't.

## Deploy steps

1. Merge to `main`. Vercel auto-deploys; nothing in the import path is
   build-time, so the deploy is only for the cache and the workflow file.
2. **No new secrets.** The importer needs `DATABASE_URL` and nothing else — no
   model, no Mapbox, no API keys. All feeds are public and unauthenticated.
3. The weekly run is already wired into `.github/workflows/weekly-research.yml`,
   after the pipeline step. It first fires with the Monday 06:00 UTC cron.

## Verify

```bash
npm run import-sports -- --dry-run     # expect: 8/8 feeds reachable, all zeros
```

- Admin → Events, filter Sports: every upcoming Twins/Wild/United/Gophers/Lynx
  listing shows a `verified_at`.
- `/day/2026-11-06` shows **Minnesota Wild vs. San Jose Sharks, 7 PM**.
- `/day/2026-11-07` shows the Gophers–UCLA game as **All day**, not 11 PM.
- No same-venue same-day contradictions except the known MNUFC Sep 19 duplicate.

## Rollback

The importer only ever moves status and start times, so nothing is unrecoverable.

- Undo a run: `admin_audit` rows with action `import_sports_hide` /
  `import_sports_retime` carry the previous value in `patch`.
- Stop it running: delete the "Reconcile sports against official league
  schedules" step from `.github/workflows/weekly-research.yml`.
- The code is inert unless invoked — no page imports it.

## Quality gate

`npx tsc --noEmit` clean · **1323/1323** tests (42 new) · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · rendered `/day/2026-08-28`, `/day/2026-11-06`,
`/day/2026-11-07` and read the actual output.

## Still open

- **Six teams' worth of non-team sports** ("other": races, etc., 11 upcoming) are
  still agent-researched and 0-verified.
- **The MNUFC Sep 19 duplicate** — same real match, two titles, one abbreviated.
  The importer validates, it doesn't dedupe.
- **`dedupeNearDuplicates` interaction**, not currently live: it keeps the
  earliest-created row of a similar same-day pair, which could archive a freshly
  imported game in favour of a hidden older one. Measured after the first import —
  no sports pair scores above 0.45 against a 0.6 threshold. The fix, if it ever
  bites, is to make that pass prefer the verified row.
- **The rest of the calendar is unaudited.** Sports was the category where a
  stranger could instantly tell we were wrong. Music, arts and family come from
  the same pipeline and have never been checked against a primary source.
