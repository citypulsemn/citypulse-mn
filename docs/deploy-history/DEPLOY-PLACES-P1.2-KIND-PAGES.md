# Deploy — Places P1.2: the index + kind pages

*August 2026. Second Places item, built on P1.1's registry. The SEO money pages:
`/places` and `/places/[kind]`. First user-facing Places surface.*

## What shipped

**`/places` index** ([app/places/page.tsx](../../app/places/page.tsx)) — a card
per kind that has entries (via `kindsWithPlaces`), each showing the count and,
off-season, a "seasonal, closed now" tag. Honest emptiness: an unseeded kind
never appears.

**`/places/[kind]` kind pages** ([app/places/[kind]/page.tsx](../../app/places/[kind]/page.tsx))
— the indexable unit. Title tuned for the query ("Splash Pads in Minneapolis &
St. Paul — Every One, Mapped"), an editorial header paragraph
([lib/editorial.ts](../../lib/editorial.ts) `PLACES_KIND_INTRO`, Taren-editable),
a numbered static map, and the numbered list beneath. A closed-season banner
appears up top when nothing's open — never hiding the page. Canonical + sitemap
entry. Unknown or unseeded kinds `notFound()`.

**Components:**
[PlacesMap](../../components/PlacesMap.tsx) (numbered gold pins, auto-fit) and
[PlacesList](../../components/PlacesList.tsx) (numbered rows: name, cost badge,
neighborhood link + city, amenity tags, house-voice intro, source link). Both
take the same free-first-sorted array, so **pin N and list row N always match**.

**New pure helpers** ([lib/places.ts](../../lib/places.ts)): `placesStaticMapUrl`
(the multi-numbered-pin builder — distinct from event-view's single-pin
`staticMapUrl`, which I flagged in review; capped at `PLACES_MAP_MAX_PINS=30` for
Mapbox's URL-length limit) and `placesSeasonBanner`.

Plus the sitemap now lists `/places` + each seeded kind
([app/sitemap.ts](../../app/sitemap.ts)), and the CSS for all of it.

## Design decisions

- **Statically generated, not on-demand ISR.** Venue pages skip
  `generateStaticParams` because they're DB-backed (ENGINEERING rule 2 — the
  connection-pool stampede). Places read the **in-code registry, zero queries**,
  so build-time prerender is safe *and* better for evergreen SEO. Confirmed:
  the build prerendered `/places/beach` and `/places/splash-pad` as static (●).
  `revalidate = 3600` keeps the open/closed season banner fresh.
- **Static map, numbered.** One server-rendered `<img>` (zero JS, phone-first);
  the interactive map is P4.2, gated on a vitals check. Numbers are baked into
  the pins and repeated in the list.

## Verification (observed, not intended)

Driven live in the dev browser:
- **`/places`** → two cards, "Beaches · 6 spots" and "Splash Pads · 6 spots",
  linking to the kind pages; no "closed" tag (August → open).
- **`/places/beach`** → 6 free-first numbered rows (Bde Maka Ska … Phalen), the
  two southwest-lakes beaches carrying neighborhood links, correct source URLs,
  the editorial intro, and **no season banner** (correctly open in August).
- **`/places/splash-pad`** → 6 numbered rows with amenity tags rendering.
- **`/places/pool`** (unseeded) → **404**, as intended.
- **The map** renders nothing locally because there's no `NEXT_PUBLIC_MAPBOX_TOKEN`
  in dev — confirmed the venue pages' static map is *also* absent locally, so
  this is the same global graceful-null, not a Places bug. The unit test proves
  the numbered-pin URL builds correctly with a token; it renders in production.
- Only console 404 is the site-wide `/favicon.ico` (the browser's automatic
  request; the site serves icons via metadata — `icon.svg` is 200). Pre-existing
  on every page, unrelated to this change.
- **Tests +9 (925/925):** `placesStaticMapUrl` (pins numbered 1..N in list order,
  auto-fit, null without token/places, the pin cap) · `placesSeasonBanner`
  (null when open, plain closed banner naming the reopen point off-season) ·
  wiring tripwires (kind page `notFound()` + `generateStaticParams`; PlacesMap
  uses the builder; PlacesList numbers by position; both pages set a canonical).
- **Gate:** `tsc` clean · 925/925 · `npm run build` clean · `npm audit` 0.

## Deploy steps

Push to `main`. Routes + components + CSS + a 3-line sitemap add. No schema, no
env, no deps. Once live, the ops digest's Index-surface count ticks up (the new
sitemap URLs) — watch Monday's digest.

## Verify checklist

- [ ] `/places` lists Beaches and Splash Pads with counts.
- [ ] `/places/beach` and `/places/splash-pad` render the numbered list; in
      production the static map shows with matching numbered pins.
- [ ] `/places/pool` (or any unseeded kind) returns the branded 404.
- [ ] Sitemap (`/sitemap.xml`) includes `/places` and the two kind URLs.

## Rollback

`git revert`. Additive routes + components; the sitemap and editorial edits are
small and self-contained. `lib/places.ts` stays (P1.1).

## Next

**P1.3** — wire-in: a "Places" link in the shared nav/footer, OG cards for kind
pages (the `og-card` shell), and `docs/PLACES.md`. Then P2 (more kinds,
neighborhood cross-linking, the venue bridge).
