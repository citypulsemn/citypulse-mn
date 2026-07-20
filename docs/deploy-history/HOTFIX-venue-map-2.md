# HOTFIX 2 — venue map layout (the fix your report actually asked for)

## Owning the sequence

Your first report — "the mapbox is not centered" — was about **where the map sits on the page**. I fixed the pin's framing *inside the image* instead (a real but secondary issue: Mapbox pins anchor at their tip). Your second report made the actual problem unambiguous: the map was a **640px block pinned to the left of a 1240px page column**, leaving a wall of dead space on its right on desktop. Phones never showed it because the column is narrower than the image. One symptom, two axes; I picked the wrong one first.

## The fix

The map is now a **full-width banner**, aligned edge-to-edge with the header and event cards like everything else on the page:

- **Source image upgraded to 1280×400@2x** (the API's max width) so it stays crisp at full column width.
- **`object-fit: cover`** center-crops it to the display box — the pin stays in the middle on any screen, desktop or phone (280px tall on desktop, 200px on mobile).
- The pin remains anchored at the venue's true coordinates, and the vertical framing nudge from the first hotfix still applies inside the image.

Verified with a rendered 1200px-wide screenshot this time — the axis I should have looked at first: the map spans the column exactly, centered with the page. The emitted URL was also inspected directly: pin longitude equals center longitude, so the pin renders at the horizontal center of the banner.

## Deploy
Unzip over the repo, commit (`Hotfix: venue map full-width banner`) → push.

## Verify
- [ ] `/venues/first-avenue` on desktop: the map spans the content column, no dead space to the right, pin in the middle.
- [ ] Same page on your phone: banner map, pin centered, 200px tall.

461 tests · typecheck clean · build clean · 0 vulnerabilities.
