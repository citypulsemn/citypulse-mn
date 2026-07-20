# Deploy Guide — Roadmap 3.3: Social Cards (OG images)

**Every share is a free ad — if the link doesn't unfurl as a blank rectangle.** Two page types (events, collections) already had branded OG cards; 3.3 extends them to the three remaining money pages and factors the duplicated brand chrome into one shared shell. Now a text, a Slack paste, or an Instagram-story link to any venue, neighborhood, or the weekend page arrives as a navy-and-gold City Pulse card.

**Code-only deploy. No database step, no new secrets.**

---

## What shipped

**A shared card shell — `lib/brand/og-card.tsx`.** The event and collection routes had each hand-rolled the navy field, gold double-border, and skyline SVG — three more routes would have quadrupled that. `OgCard({ eyebrow, title, subtitle, titleSize })` now owns the frame; a new card is just three strings. It's props-only with **no DB import**, which is what lets the new routes stay off the database entirely.

**Three new `opengraph-image.tsx` routes**, each building its card from the static registry — never a query:
- **`/this-weekend`** — "TWIN CITIES / This Weekend / July 17–19", the label from `weekendDays()` date math (the one acceptable dynamic bit; it rolls weekly and caches like the page). Static route.
- **`/venues/[slug]`** — "UPCOMING AT / {venue name} / {city} · concerts, shows & events", name from the venue registry.
- **`/neighborhoods/[slug]`** — "WHAT'S ON IN / {label} / {blurb}", both from the neighborhood registry.

**Two robustness details:** unknown slugs render a City Pulse fallback card (a 200 image, never a broken preview), and long titles step down through title sizes so "Downtown St. Paul & Lowertown" doesn't clip.

## The runtime split (visible in the build)

```
○ /this-weekend/opengraph-image        (static — date-derived, cacheable)
ƒ /venues/[slug]/opengraph-image        (dynamic per slug)
ƒ /neighborhoods/[slug]/opengraph-image (dynamic per slug)
```

Node runtime, matching the two existing routes. Nothing here touches Postgres, so the build/runtime rules in ENGINEERING.md are satisfied by construction.

## Quality bar (all green)
- **Smoke, the part that matters for images:** every route fetched live → **200 + `content-type: image/png`**; the unknown-slug fallback returns a valid image, not a crash; the page `<head>` auto-injects the absolute `og:image` meta tag (Next wires `opengraph-image.tsx` into metadata for free — no manual tag needed).
- **One render inspected visually** — the venue card: navy field, gold double-frame, correct eyebrow/title/subtitle, skyline motif bottom-right. The shared shell renders true.
- 553 tests still green (OG routes have no meaningfully unit-testable logic — the spec says so; the render smoke is the real check) · tsc clean · build clean · 0 vulnerabilities · **archive parity 251=251**.

---

## Deploy

Unzip over the repo (parity-verified), commit (`Social cards: OG images for weekend/venues/neighborhoods (roadmap 3.3)`) → push.

## Verify (the OG-debugger step is the real one)

- [ ] After deploy, drop three URLs into an OG debugger — [opengraph.xyz](https://www.opengraph.xyz/) is quick, or LinkedIn's Post Inspector, or paste into a Slack DM to yourself:
  - `citypulsemn.com/this-weekend`
  - `citypulsemn.com/venues/first-avenue`
  - `citypulsemn.com/neighborhoods/northeast`
- [ ] Each should preview the navy-and-gold card, not a blank box.
- [ ] If a platform caches an old blank preview, its debugger has a "scrape again" button — social platforms cache OG data hard, so first shares of already-posted links may need one nudge.
- [ ] Post one to your Instagram story link sticker and confirm it looks like an ad for the site.

## Rollback
Roll back the deploy. Nothing was written anywhere; the two original OG cards are untouched.

---

## The board

Phase 2 ✓ · 3.1 ✓ · 3.2 ✓ · **3.3 ✓** — links now sell the site on every paste. Next: **3.4 — the digest growth loop** (a small piece: put the subscribe band where the readers already are — the weekend and venue pages — tagged by source so the ops digest can show you where signups actually come from). Then 3.5 vitals, and Phase 3 is done.
