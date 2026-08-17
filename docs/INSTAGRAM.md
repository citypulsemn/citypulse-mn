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

## Evergreen cards (Aug 2026 — the "where to go" + topic half)

The event kit above covers *events*. Two evergreen card types extend it to the parts of the site that had no social presence, so distribution can amplify the pages we're trying to get discovered (the Aug-16 GSC finding: `/places` + collections weren't even indexed):

- **Place of the week** — `/content/place/[slug]` (satori, 1080×1350) + `placeCaptionFor` (`lib/content/templates.ts`). The card is registry-only (no DB). Admin→Content features `placeOfTheWeek(now)` — the same weekly-rotating pick as the digest (`lib/places.ts`), so the two channels agree. Caption closes on the `/places/[kind]` bio link.
- **Collection / topic** — `/content/collection/[slug]` + `collectionCaptionFor`. Renders any collection as a card (title + up to 6 events + tagline). Admin→Content features the demand-validated **Food Truck Festivals** collection; swap the slug for another. Degrades to the tagline when a collection is out of season (honest emptiness).

Both live in **Admin → Content** with a preview, caption + copy button, and a Download button, exactly like the event cards. Captions are pure and golden-tested (`lib/__tests__/content.test.ts`).

**Known precision note:** the Food Truck Festivals collection matches the query "food truck" across title+description, so a festival that merely *mentions* food trucks (a jazz/music fest) can appear on the card. Tighten to a title-scoped match or curate if it reads off-topic — see `DEPLOY-IG-EVERGREEN-CARDS.md`.
