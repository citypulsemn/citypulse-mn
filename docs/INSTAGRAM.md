# Instagram card generator

Roadmap 6.4 — Admin → Instagram. The Monday research session, generated: the week's three card variants (Regular / Family / Weird) plus captions, built from live event data under the operation's locked content rules. Copy buttons on everything.

## The locked rules, as code (`lib/instagram.ts`, golden-tested)

1. **Exactly five per card** (`CARD_SIZE`). A thin lane yields an *incomplete* card with a visible warning — never padding.
2. **No overlap between variants.** Family draws only from the family category, Weird from weird, Regular from music/festival/food/arts/sports — disjoint by construction, with an ID guard enforcing it anyway. Regular additionally caps any one category at 2 for variety.
3. **No drag or political events**, via word-boundary rules with documented exceptions: "Drag Racing"/"Drag Strip" (motorsports) and "March Madness" pass; "Drag Brunch" and "Rally for X" don't; "Rallycross" passes. **Filtering is transparent**: the page shows every excluded event with its reason — the operator reviews, nothing is silently dropped.

## Windows & captions

Two windows: next 7 days (default) or the 6.3 weekend clock. Captions carry a per-variant hook, variant hashtag sets, and the bio-link tie-in: **citypulsemn.com/this-weekend**.

## Scope boundary (deliberate)

B-roll (Pexels) and the ISO-week shot/audio rotation stay in the operator workflow — this generates card copy and captions only. The two-line format lives in ONE function (`formatCard`); if the locked format differs from the default (`DAY M/D · Title` / `Venue · time · price`), it's a one-place change.
