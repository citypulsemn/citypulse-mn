# Trending

Roadmap 5.2 — the first consumer of the 5.1 feedback loop. Ranks upcoming events by what people are actually doing, instead of what an editor guesses.

## The math

`score = Σ over stat rows ( weight × count × 0.5^(age_days / 3) )`

- **Intent ladder** (weights): view 1 · save 3 · calendar 4 · ticket_click 5. A ticket click means more than a view.
- **Momentum, not lifetime totals**: 3-day half-life over a 7-day window. Yesterday's spike beats last week's steady trickle; nothing coasts on old popularity.
- **Eligibility**: published, and still attendable (upcoming, or a multi-day run in progress).
- Ties break toward the sooner event — you can still make it.

## Cold-start honesty (the policy that matters)

Three events with two views each is not "trending" — it's noise wearing a crown. Two guards, both in `rankTrending` and both tested:

1. **Score floor** (`TREND_MIN_SCORE = 8` ≈ one ticket click + three views today).
2. **All-or-nothing minimum** (`TREND_MIN_LIST = 4`): unless at least four events clear the floor, trending renders **nothing**. No sad placeholders on the homepage — the surface earns its place or it hides.

Capped at 12 (`TREND_CAP`).

## Surfaces

- **Homepage strip** ("Trending now", top 6) — absent entirely until qualified.
- **`/collections/trending`** — full ranked list; the empty state says plainly that trending is measured, not curated.
- **Collections index** — a "Trending Now" card appears in first position only when populated.

All three read `getTrendingEvents()`, which carries the analytics resilience contract (learned in 5.1): any failure logs and returns `[]` — a trending strip must never take down the homepage. Scoring and ranking are pure (`scoreRows`, `rankTrending`, `decayFactor` in `lib/trending.ts`) and golden-tested, including an end-to-end scenario where a stale spike with the largest lifetime totals is out-ranked by fresh momentum.

## Tuning

Everything is a named constant: weights, half-life, window, floor, minimum, cap. If trending feels too twitchy, raise the half-life; too stale, lower it. The admin Stats page shows the raw counts feeding it.
