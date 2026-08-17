# Deploy — Instagram evergreen cards (place of the week + collection)

*Aug 16, 2026. Extends the existing Instagram kit (roadmap 6.4, Admin→Content /
Admin→Instagram) past events to the two verticals that had **zero** social
presence: the evergreen Places guides and the demand-validated collection/topic
pages. Distribution is the binding-constraint lever (audience ~5 subs), and these
are exactly the pages the Aug-16 GSC finding showed weren't even indexed — so
social amplification does double duty.*

## Recon-first finding
The Instagram asset generator **already existed** and is comprehensive: a weekly
roundup image (`/content/week`), per-event cards (`/content/card/[id]`), the
`lib/instagram.ts` locked-rules 3-variant copy system, and two admin hubs with
captions + copy + download buttons. So this is an **extension**, not a rebuild —
the genuine gap was that the kit only covered events.

## What shipped
- **`/content/place/[slug]`** ([route](../../app/content/place/[slug]/route.tsx)) —
  a 1080×1350 satori card for a Place (kind badge, name, house-voice intro, city,
  `/places` footer). Registry-only, **no DB**. Unknown slug → the brand fallback.
- **`/content/collection/[slug]`** ([route](../../app/content/collection/[slug]/route.tsx))
  — a card for any collection (title + up to 6 events + tagline; degrades to the
  tagline when out of season).
- **Captions** ([lib/content/templates.ts](../../lib/content/templates.ts)):
  `placeCaptionFor(place)` and `collectionCaptionFor(collection, sample)` — pure,
  golden-tested, house voice, closing on the `/places` and `/collections` bio
  links (the IG→site flywheel).
- **Admin → Content** ([page](../../app/admin/content/page.tsx)): two new blocks —
  **Place of the week** (features `placeOfTheWeek(now)`, the same weekly-rotating
  pick as the digest, so the channels agree) and **Food Truck Festivals** (the
  demand-validated collection). Both render regardless of the 7-day event window.

## Verification (observed)
- **Rendered the real PNGs** on a live dev server: `/content/place/...` → 200
  `image/png` (the "Parque Castillo Splash Pad" card, on-brand navy/gold/cream,
  Oswald, frame + skyline); `/content/collection/food-truck-festivals` → 200 with
  6 real events listed; unknown slug → the small fallback card. Both eyeballed.
- **Tests +5** (1087 total): `placeCaptionFor` (name/kind/intro/`/places` link/
  hashtags, no duplicate major-city tag) and `collectionCaptionFor` (title/tagline/
  events/`/collections` link, honest-empty degrade).
- Gate: `tsc` clean · 1087/1087 · `npm run build` clean · `npm audit` 0.

## Known precision follow-up (flagged to Taren)
The **Food Truck Festivals** collection matches the query `"food truck"` across
title + description (`matchesQuery`), so a festival that merely *mentions* food
trucks — e.g. "Art and All That Jazz Festival", "Twin Cities Music and Movement
Festival" — surfaces on the card alongside true food-truck rallies. It's not
wrong (they do have food trucks) but it reads off-topic for a "Food Truck
Festivals" card. **Options if you want tighter:** (a) a title-scoped match for
this collection (most real food-truck festivals carry "food truck" in the title),
or (b) curate. Left as a product call — no silent change.

## Deploy steps
Merge to `main`; Vercel auto-deploys. No schema, no secret. The card routes are
`runtime = "nodejs"` on-demand (same as the existing OG/content routes). Use via
**Admin → Content** (auth-gated).

## Rollback
`git revert`. The routes + admin blocks + caption helpers are additive; reverting
removes the two new cards and leaves the event kit untouched.
