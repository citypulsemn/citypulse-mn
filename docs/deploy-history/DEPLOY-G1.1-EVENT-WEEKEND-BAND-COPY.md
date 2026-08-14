# Deploy — G1.1: event-page & This-Weekend subscribe band copy

*August 2026. Tier 1 (audience). Code-only.*

## What shipped

Context-specific copy on the two remaining default subscribe bands, finishing the
"sharpen the one band" pass (homepage was done separately). Both had been rendering
the generic component default; now each speaks to its surface's mindset.

### Event pages (`source="event"` — highest intent)
A visitor here has already found something they like.
- Heading: **"Get the week's best, every Thursday"**
- Sub: **"You found this one — get the whole week's hand-picked best in your inbox,
  so the next great night out finds you. Free, unsubscribe anytime."**
- "You found this one" / "the next great night out finds you" turn the moment of
  interest into a reason to subscribe.

### This-Weekend (`source="this-weekend"` — weekend planning)
The Thursday email is perfectly timed for weekend plans.
- Heading: **"The weekend, sorted — every Thursday"**
- Sub: **"One email Thursday morning with the weekend's best concerts, games, and
  outings, hand-picked so you're not scrambling Friday night. Free, unsubscribe
  anytime."**
- "Thursday morning" (right before the weekend) and "not scrambling Friday night"
  name the exact benefit for this reader.

Each surface still mounts **exactly one band, no popup**, with its distinct
`source` intact for attribution (the event placement test pins one band + source +
position; copy stays unpinned — Taren's to edit).

## Status: all four bands now tailored
- **home** → "Every Thursday: the week's best, hand-picked" (prior deploy)
- **event** → "Get the week's best, every Thursday" (this deploy)
- **this-weekend** → "The weekend, sorted — every Thursday" (this deploy)
- **this-week** → "Get this shortlist every Thursday" + intro CTA (prior deploys)

The footer form (every other page) keeps its own "The week ahead, in your inbox"
pitch, unchanged.

## Verification

Gate: `tsc` clean · **1003** tests (event placement test green — one band,
source=event, after the article and before MoreAtVenue) · `npm run build` clean ·
`npm audit` 0.

**Browser-verified (dev):** `/this-weekend` shows one band with the weekend copy;
an event page shows one band with the event copy and `source="event"`. No console
errors.

## How we'll know it worked

**Admin → Stats → "Where subscribers come from"** — `event` and `this-weekend` are
smaller placements than `home`; watch whether their share ticks up now that the
copy fits the context.

## Deploy steps

Push to `main`. Code-only, no schema, no env.

## Rollback

`git revert`. Copy-only; reverting restores the component default on both surfaces.
