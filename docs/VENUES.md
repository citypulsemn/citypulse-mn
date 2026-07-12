# Venue-anchored discovery

Roadmap 4.2. The pipeline now walks a registry of real venue calendars instead of hoping a generic web search surfaces them.

## The problem

4.1 fixed how events get *labeled*. It didn't fix what gets *found*.

The pipeline gave each category one agent with a small search budget — **8 web searches to cover 30 days of music across the entire metro**. That's fine for festivals: a handful of big, well-indexed events that aggregators cover. It fails completely for music, which is the most fragmented category in any city — dozens of independent clubs, each with its own calendar, none of them aggregated.

The evidence: after the 4.1 backfill surfaced 16 music events, **not one was a First Avenue, Palace, Turf Club, Icehouse, or Dakota show**. They were brewery choir nights and music festivals found incidentally by other agents. The actual live-music calendar of the Twin Cities was simply never being discovered.

## The fix

`lib/venues.ts` — a registry of real venues (30 music rooms, 12 family anchors), each with a city and its primary programming.

For **venue-anchored categories** (music, family — the fragmented ones), the pipeline shards the registry into groups of 5 and gives each shard to its own sub-agent with a dedicated search budget. Each agent's job is narrow and achievable: *walk these five calendars and list everything in the window*.

Coverage becomes a function of the venue list rather than of what a generic search happens to surface. Want better music coverage? Add venues.

## How it runs

- Venue sweeps run in the **near band only** (the next 30 days) — that's where accuracy matters and where venue calendars are actually published.
- The generic category agent still runs; sweeps are **additive**. Overlap is harmless: dedup on `event_key` collapses it.
- If the generic agent fails, sweeps still run (and vice versa) — one failure no longer takes the category down with it.
- The pipeline log reports a `venue-swept` count per run.
- Every swept event still goes through the **4.1 classifier**, so a comedy night at the Turf Club is filed as *arts*, not music. The registry says where to look; the classifier says what it is.

## Cost

Music goes from 8 searches/week to ~72; the sweeps add ~9 sub-agents and ~108 web searches per weekly run in total. That's the price of actually having a live-music calendar. Tune with `VENUES_PER_SHARD` and `VENUE_SWEEP_SEARCHES` in `lib/pipeline-config.ts`, or trim the registry.

## Adding a venue

Add an entry to `VENUES` in `lib/venues.ts`. Two rules, both enforced by tests:

1. **The city must be one `lib/areas.ts` knows.** If it isn't, every event discovered there lands in the "Elsewhere" area bucket and quietly vanishes from area filters — a silent failure the test suite now catches.
2. Venue names must be unique.

The `category` field describes the venue's *primary programming*, not a verdict on its events — the classifier still decides each one.
