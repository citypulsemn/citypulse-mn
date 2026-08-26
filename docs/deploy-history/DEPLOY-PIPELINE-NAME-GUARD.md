# Deploy — the pipeline stops storing what it cannot name (26 Aug 2026)

## What shipped

The upstream fix for placeholder listings. Hiding them was a mop; this is the tap.

Three layers, prevention first:

1. **Both research prompts** now tell the agent to omit an event it cannot name,
   with the real examples: *"Turf Club Show (Sep 3)", "Show (Aug 26)" and
   "Fitzgerald Theater Concert Event" are not events.* The venue-sweep prompt
   names the exact failure — *seeing that a room is booked and writing that down
   as if it were a listing* — because that sweep is where all 21 came from.
2. **A guard in `run-pipeline.ts`**, because prompts are guidance and guidance is
   not a guarantee. `isPlaceholderTitle(ev.title, ev.venue)` drops the row before
   it is stored. Reuses the detector already calibrated against production, so
   the pipeline and the digest cannot drift into disagreeing about what a
   placeholder is.
3. **A count**, `pipeline_runs.unnamed_dropped`, surfaced in the ops digest.

## Why a drop and not a draft

The row was never a fact. Storing it and hiding it later would leave a record of
something that did not happen; rule 6 says the honest move is the blank. It is
dropped *before* geocoding, so a listing headed for the bin does not spend a
Mapbox call on the way — there is a test pinning that ordering.

## A silent drop is as dishonest as a silent invention

If the agents start guessing more, that has to appear somewhere a person looks.
So the drop is logged per listing (`✂ names no event, dropping: …`), totalled in
the run summary, written to `pipeline_runs.unnamed_dropped`, and printed in the
digest's Pipeline section as *"N listings dropped for naming no event — the
agents guessed that often"*.

The column is additive and nullable. Historical rows read `null`, which
`deltaTag` renders as silence rather than as a fall to zero — verified against
the three most recent real runs.

## Drift guards

Four tests, because every layer here is the kind that rots quietly:

- `run-pipeline` imports the guard **and** calls it before `geocode`
- the drop is counted in all three places
- **both prompts** still carry the instruction, with a named example
- the schema change is `add column if not exists`

## Deploy steps

1. Merge to `main`.
2. **Schema:** `alter table pipeline_runs add column if not exists unnamed_dropped int;`
   — already applied to production, additive and idempotent, safe to re-run.
3. No new secrets or dependencies. Takes effect on the next Monday pipeline run.

## Verify

After the next pipeline run:

```bash
npm run ops-digest -- --dry-run
```

A `listings dropped for naming no event` line appears in the Pipeline section
only if the count is non-zero. The run log shows each dropped title.

## Rollback

Remove the `isPlaceholderTitle` block from `scripts/run-pipeline.ts`. The column
and the prompt wording are harmless on their own. Nothing already in the database
is touched by any of this.

## Quality gate

`npx tsc --noEmit` clean · **1409/1409** tests (+4) · `npm run build` exit 0 ·
`npm audit` 0 vulnerabilities · column applied and read back from production, and
the digest composed against it.

## What this does and doesn't fix

**Does:** the specific, measurable failure where an agent turns "this room is
booked" into a listing. 21 of those were live last week.

**Doesn't:** anything else the agents guess at. A wrong *date* or a wrong *venue*
still passes every check here — the sports audit found six phantom Twins games
whose titles were perfectly well-formed. Naming an event is the floor, not proof
that it exists. The primary-source importers remain the only thing that
establishes that, and they still cover two categories out of seven.
