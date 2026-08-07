# Deploy — Places P1.3: wire-in (nav, footer, OG cards, docs)

*August 2026. Closes Phase 1 of the Places roadmap. P1.2 shipped the pages but
they were reachable only by URL/sitemap — a page nobody can find doesn't exist.
This makes Places discoverable and shareable.*

## What shipped

**Navigation.** "Places" now sits in the shared section nav
([TopBar](../../components/TopBar.tsx), after Collections) and in the site
footer ([SiteFooter](../../components/SiteFooter.tsx), after Collections) — so a
visitor arriving from Google onto any page can reach it, and it's one tap from
the homepage's own topbar surfaces.

**OG cards** for shares/Instagram, via the shared `OgCard` shell (props-only, no
DB — the build/runtime rules hold inside image routes too):
- [app/places/opengraph-image.tsx](../../app/places/opengraph-image.tsx) — the
  index card ("Places · Beaches, splash pads & more — mapped").
- [app/places/[kind]/opengraph-image.tsx](../../app/places/[kind]/opengraph-image.tsx)
  — per kind ("Splash Pads · Every one, mapped · Minneapolis–St. Paul"). Next
  auto-injects `og:image`/`twitter:image` from these colocated routes.

**Docs.** [docs/PLACES.md](../PLACES.md) — the subsystem doc: why registry-in-code,
the data model, the machine-readable season, the pages + why they can be static,
the numbered map, and how to add an entry or a kind.

## Verification (observed, not intended)

Driven live in the dev browser (on `/venues`, which wears the shared TopBar):
- Section nav reads **This Weekend · Ongoing · Collections · Places · Venues ·
  Neighborhoods · Cities** — Places links to `/places`. Footer includes the
  `/places` link.
- OG images render: `/places/opengraph-image` → **200 image/png (~30KB)**;
  `/places/beach/opengraph-image` → **200 image/png (~33KB)**. (The card uses the
  same shell already serving event/collection cards in production; the PNG bytes
  confirm satori rendered it without error. The pane was hidden, so the visual
  was not screenshotted — the shell is proven and the props are plain strings.)
- **Tests +2 (927/927):** tripwires — Places is in the nav + footer; both OG
  routes use the shared `OgCard` shell.
- **Gate:** `tsc` clean · 927/927 · `npm run build` clean (both OG routes built)
  · `npm audit` 0.

## Deploy steps

Push to `main`. Nav/footer edits + two OG routes + the doc. No schema, no env, no
deps. After deploy, the ops digest's Index-surface count reflects the (already
P1.2) sitemap URLs; the OG cards show when a Places link is shared.

## Verify checklist

- [ ] "Places" appears in the top nav on any non-homepage and in the footer.
- [ ] Sharing `/places` or `/places/splash-pad` shows the branded navy/gold card
      (Facebook/LinkedIn debugger, or the OG image URL directly).

## Rollback

`git revert`. Additive nav entries + two self-contained image routes + a doc.

## Phase 1 complete

Registry (P1.1) → pages (P1.2) → wire-in (P1.3). Places is live, discoverable,
and shareable, seeded with 6 beaches + 6 splash pads. **Next: P2** — more kinds
(pools, curated parks, the fall rink/sledding pair), the neighborhood
cross-linking strip, and the venue bridge (`music-venue` from the existing venue
registry). Also open: expand the seed toward the roadmap's full ~35 entries
(a Cowork-shaped curation pass).
