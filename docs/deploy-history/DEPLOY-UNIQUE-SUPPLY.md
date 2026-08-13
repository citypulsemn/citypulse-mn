# Deploy — grow the Unique (weird) supply

*August 2026. Not a roadmap item per se — the fix for a live coverage alert and
the standing F1.1 finding. Pipeline sourcing only; no schema, no site change.*

## The problem (live)

The Aug 7 ops digest flagged **"EMPTY Unique — week of Aug 10: 0/1"**: the
`weird`/Unique category had zero upcoming events against its floor of one. This
is the F1.1 finding turned into an active failure — Unique is the metro's
highest-interest category by views-per-event, and it keeps running dry.

**Root cause:** every category gets one topic-research agent, and the fragmented
or hard-to-search categories *also* get venue-anchored calendar sweeps — but only
`music` and `family` were anchored (`VENUE_ANCHORED`). `weird` relied entirely on
a generic search whose own hint admitted "plain APIs won't surface these." So in
a thin week it found nothing.

## The fix

Apply the F1.1 "coverage follows the venue list, not a generic search" mechanism
to `weird`, and sharpen its topic hints. Both are **supply-side** — we grow the
scarce category rather than cut music (never delete real content):

1. **Anchor `weird`** ([lib/venues.ts](../../lib/venues.ts)) — added `weird` to
   `VENUE_ANCHORED` and seeded five reliable oddity rooms with calendars: **Can
   Can Wonderland, Bauhaus Brew Labs, Sisyphus Brewing, Bryant-Lake Bowl, and
   Sever's**. Anchoring is *additive* — the topic-research agent still runs, and
   now a venue sweep of these rooms runs alongside it (deduped on `event_key`).
2. **Richer topic hints** ([lib/agents/prompts.ts](../../lib/agents/prompts.ts))
   — the `weird` source hint now names local alt outlets that surface the quirky
   stuff (Racket, Southwest Voices, Minnesota Monthly / Meet Minneapolis "unusual
   things to do"), reliable veins (roller derby, silent discos, drag brunches,
   trivia/nerd nights, oddity & maker markets, ghost tours, immersive pop-ups),
   and seasonal one-offs — and tells the agent to cast a wide net on our scarcest
   category.

The classifier still decides each event's final category (a comedy night at a
brewery may land in `arts`), so this raises the *chance* Unique clears its floor,
not a guarantee — but it attacks the actual bottleneck (discovery) with the
proven mechanism.

## Verification (honest limits)

- **Gate:** `tsc` clean · **939/939** (the venue-city-in-areas test accepts the
  new St Paul / Minneapolis / Shakopee rooms) · `npm run build` clean · `npm
  audit` 0.
- **Field verification is the NEXT pipeline run.** There's no dry-run for
  *discovery* — the research agents only run on the weekly pipeline. So the real
  proof is **Monday Aug 10's run + its coverage line**: watch for `weird` at or
  above its floor, and for `N venue sweeps` now including the weird shard in the
  `near` band. If it's still thin after a couple of runs, the next lever is a
  product call (more oddity venues, or a research-budget reallocation from
  over-supplied music — see F1.1).

## Cost note

`weird` now adds ~1 venue-sweep shard (5 venues, `VENUES_PER_SHARD`) to the
`near` band, running in parallel with the others — a small, bounded increase in
agent calls, which is the point.

## Deploy steps

Push to `main`. Config only. Takes effect on the next pipeline run (Mon Aug 10).

## Verify checklist

- [ ] Mon Aug 10 run log shows a `near/weird` venue sweep of the five rooms.
- [ ] The following ops digest's Coverage line shows `weird` ≥ 1 (not EMPTY).

## Rollback

`git revert`. Config only — reverts the anchor + hints.
