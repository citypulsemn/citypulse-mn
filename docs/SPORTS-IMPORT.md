# Sports import — schedules from the leagues themselves

The one part of the calendar that does **not** come from research agents. Eight
local teams' home games are read from the leagues' own machine-readable
schedules, and the site is made to agree with them.

## Why this exists

On 21 Aug 2026 a stranger used the report form to say, of a Twins–Royals listing
at Target Field: *"this event doesn't exist."* They were right — the Twins were
in Chicago that day. The audit that followed found **13 of 20 published Twins
listings wrong**, and the Wild wrong at the identical rate: phantom games on days
the team was out of town, wrong opponents rendered beside the correct game, wrong
first pitches.

Cause: the pipeline was learning the schedule from *news articles about the
schedule release*. Four runs read four different articles and produced four
Septembers that disagreed with one another. Nothing in the system could tell
which was right, because nothing had read the schedule.

Every league publishes the real thing as JSON, for free.

Full incident: `docs/deploy-history/HOTFIX-sports-phantom-games.md`.

## Run it

```bash
npm run import-sports -- --dry-run          # prints the plan, writes nothing
npm run import-sports                       # applies
npm run import-sports -- --only=twins,wild  # one or more teams
npm run import-sports -- --days=180         # widen the horizon (default 92)
```

Also runs weekly in `.github/workflows/weekly-research.yml`, **after** the
research pipeline — the agents are the thing being corrected.

## What it does

For each team: fetch the league feed, compare it to what the site publishes, and
resolve every difference.

| Situation | Action |
|---|---|
| No home game that day | listing hidden (`draft`) |
| A game, but a different opponent | listing hidden (`draft`) |
| Right game, wrong start time | corrected in place |
| Matches the feed | stamped `verified_at` |
| Real home game, no listing | created, published, verified |

Nothing is ever deleted. Every hide and retime writes an `admin_audit` row
carrying its reason, so the queue in Admin → Events shows *why*.

## The safety property

**A feed that fails, or returns nothing, changes nothing.** This is the part to
preserve if you touch anything here.

An empty response and an offseason are indistinguishable from inside this script.
Treating them alike would archive an entire season the first time an API had a
bad morning. So:

- **The proving window comes from the data.** `feedWindow()` spans the first to
  last game the feed actually returned — home *and* away, because an away game
  proves the feed knows about that date. A listing outside that window gets the
  verdict `unknown` and is left strictly alone.
- **A team's URLs are all-or-nothing.** ESPN splits a season into `seasontype=2`
  (regular) and `seasontype=3` (playoffs). Reading only the first would make a
  home playoff game look like a phantom the moment it was scheduled, so both
  must succeed or the team is skipped.
- **An empty merge is an error, not a result** — reported as unavailable.
- Everything is scoped to the future. Played games are not re-litigated.

## A placeholder is not a fact

Both feeds encode "start time not announced yet" as a real-looking instant, and
taking them literally reproduces the exact bug this module exists to kill:

- **MLB** parks next season's games at `08:33Z` with `status.startTimeTBD: true`.
  Read literally: a 3:33 AM first pitch.
- **ESPN** parks an unannounced kickoff at Eastern midnight with
  `timeValid: false`. Read literally, Michigan at Minnesota on Oct 3 becomes an
  11 PM game on **Oct 2** — the wrong *day*, which is worse than a wrong clock.

So a TBD game keeps the day its own feed states (MLB's `dates[].date`, ESPN's
Eastern date) and carries **no time claim at all**: stored `all_day`, rendered
"All day". There is also a backstop for a placeholder nobody flagged — any start
before 7 AM, the same threshold `lib/time-integrity.ts` applies to agent times.

A TBD game never overwrites a listed time with midnight, either. If we already
show a plausible time and the league hasn't set one, ours stands.

## Pieces

- **`lib/sports-feed.ts`** — pure. Three parsers (`parseMlbSchedule`,
  `parseNhlSchedule`, `parseEspnSchedule`), the opponent matcher, `feedWindow`,
  and `reconcile`, which turns feed + listings into verdicts. No network, no DB,
  no clock of its own.
- **`lib/sports-sources.ts`** — the eight-team registry. Each entry owns its
  league's quirks so they don't become branches in the script.
- **`scripts/import-sports.ts`** — the I/O: fetch, apply, report.
- **`lib/__tests__/sports-feed.test.ts`** — 42 tests, built from the actual bad
  rows of the incident.

## The three feed shapes

| Team | Feed | Note |
|---|---|---|
| Twins | `statsapi.mlb.com` | `sportId=1&teamId=142` |
| Saints | `statsapi.mlb.com` | Triple-A rides the same feed, `sportId=11` |
| Wild | `api-web.nhle.com` | season code `20262027`, rolls over in July |
| Vikings, Timberwolves, Lynx, Gophers FB | ESPN team schedule | `seasontype=2` **and** `3` |
| MN United | ESPN **scoreboard** | see below |

ESPN's one shape — `events[].competitions[0].competitors[]` tagged home/away —
serves five leagues, which is why five teams share a parser.

**MLS is the odd one out.** Its per-team endpoint returns only the first half of
the season whatever season/half parameters you pass (checked Aug 2026: it
answered February–April every time). The league-wide scoreboard honours a date
range, so we filter that instead — and the range must stay modest, since a
400-day span returns HTTP 400.

## Known edges

- **ESPN ignores the date range** on its team endpoints and returns whole
  seasons, so the horizon is enforced again after parsing. Clipping shrinks the
  proving window too, which is the honest outcome.
- **`event_key` is `sha256(title|venue|day)`**, so an imported game can collide
  with a row someone hid earlier under the same title. `upsertEvents` sets status
  only on INSERT, so the collision would update the hidden row and leave it
  hidden — the game then looks missing on every run and is "added" forever
  without appearing. The importer therefore **republishes** what it writes, and
  says how many rows that resurrected. The league outranks a stale hide.
- **It validates, it does not dedupe.** Two listings of the same real match under
  different titles ("MNUFC vs. LA Galaxy" and "Minnesota United FC vs. Los
  Angeles Galaxy") both match the feed and both survive. That is `collapse`'s job.
- **`dedupeNearDuplicates` interaction, not currently live.** It keeps the
  earliest-created row of a similar same-day pair, which could in principle
  archive a freshly imported game in favour of a hidden older one. Measured after
  the first import: no sports pair scores above 0.45 against a 0.6 threshold. If
  this ever bites, the fix is to make that pass prefer the *verified* row.
- **Only these eight teams.** Races, high-school and college sports beyond Gophers
  football are still agent-researched and unverified.
