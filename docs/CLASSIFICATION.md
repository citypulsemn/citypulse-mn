# Event classification

Roadmap 4.1. Every event's category is decided by **what the event is**, not by which research agent happened to find it.

## The bug this fixes

The pipeline fans out one research agent per category, and each agent stamped **its own category** onto whatever it found. So a concert discovered by the *food* agent (because it's at a brewery) became a food event. A gallery opening found by the *festival* agent became a festival.

The visible result on the live site: **Live Music was empty in July** while Festivals held 69 events. Category had become a function of the *discovery path* rather than of the event — an architectural flaw that no amount of UI work could fix.

## The fix

`lib/classify.ts` — a pure, deterministic classifier that scores an event's **title, venue, and description** against weighted category signals and returns the winner. It runs on every event, from every source:

- **the weekly pipeline** (`scripts/run-pipeline.ts`) — replaces the agent's stamp; logs each correction and reports a `reclassified` count per run;
- **community submissions** (`lib/submissions.ts`) — trusts the event's content over the submitter's dropdown pick;
- **the backfill** (`scripts/reclassify.ts`) — re-categorizes events already in the database.

It's rule-based, not an LLM call: free, instant, deterministic, and testable in CI.

## Design principles (why it behaves the way it does)

- **The title is the truest signal** (weighted ×2), the description corroborates, the venue is a hint.
- **Place words are weak everywhere.** "Brewery", "taproom", "brewing" name a *venue*, not a topic — and venue names routinely appear inside titles ("Day Block Brewing Live Music Event"). If they scored normally, a venue's name would outvote what the event actually is. This was a real bug the golden set caught before it shipped.
- **Festival is the weakest claim.** It was the catch-all bucket, so it only wins when nothing more specific does: an art fair is *arts*, a music festival is *music*.
- **Ambiguous English words need musical context.** "Country **Club**", "**Rock** Climbing", "**Soul** Food", "**Folk** Art", "Open **House**" are not concerts. Genre words only fire alongside a musical word — another real false positive caught in testing.
- **No wild guessing.** If nothing scores, it keeps the original category rather than inventing one.

## The golden set

`lib/__tests__/classify.test.ts` holds ~35 **real events pulled from the live City Pulse calendar**, hand-labeled with the category a Twin Cities local would expect — and deliberately tagged with the *wrong* finding agent in several cases to prove the classifier ignores the discovery path.

This is the taxonomy's regression net. If a future change starts filing concerts as food again, these fail. When a judgment call arises ("is an all-ages art class *arts* or *family*?"), settle it here explicitly rather than in the classifier's head.

## Measured impact

Simulated against 42 real events from the live calendar:

| Category | Before | After |
|---|---|---|
| **music** | **0** | **7** |
| arts | 2 | 12 |
| family | 0 | 1 |
| weird | 0 | 1 |
| sports | 4 | 5 |
| food | 6 | 4 |
| **festival** | **30** | **12** |

22 of 42 events were miscategorized. The empty collections fill; the festival dumping-ground shrinks by more than half.

## Extending it

Add signals to `SIGNALS` in `lib/classify.ts` — **and add a golden case for the event that motivated it**. Then `npm run reclassify -- --dry-run` to preview the effect on live data before applying.
