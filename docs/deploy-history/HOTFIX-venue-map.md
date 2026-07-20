# HOTFIX — venue map centering (+ the promised magic-link honesty patch)

## 1. The map

**What you saw:** the pin sat in the upper half of the venue map instead of the middle.

**Why:** Mapbox pins are anchored at their **tip** — the coordinate is the pin's point, and the pin body extends upward from it. My URL centered the map on the coordinate itself, so the tip landed at dead center and the whole pin body floated above it. On a short, wide map that reads clearly as "not centered."

**The fix:** the map **center** is nudged ~25 style-pixels north (≈ 85 m at zoom 14, computed from the Web Mercator math, commented in `staticMapUrl`) so the **pin body** is visually centered. The pin itself has not moved a centimeter — it stays anchored at the true coordinates, so accuracy is untouched; only the framing changed. The rule is now a unit test: pin at exact coords, center 0.0004–0.0012° north.

## 2. Folded in: the magic-link honesty patch (promised after your 5.4 email incident)

Previously, if the restore email **couldn't be sent** — missing key, Resend rejection, network failure — the form still said "check your inbox." That was the no-enumeration rule over-applied: the generic message exists to hide whether an *address* is known, not whether *our mail pipe works*. A send failure is identical for every address, so reporting it leaks nothing.

Now: infra failures return an honest **"We couldn't send the email just now — mind trying again in a minute?"**, the server logs the reason, and (as before) the magic link itself is logged so an operator can hand it over. The address-privacy behavior is unchanged.

## Deploy
Unzip over the repo, commit (`Hotfix: venue map centering + honest send-failure`) → push.

## Verify
- [ ] Any venue page (e.g. `/venues/first-avenue`): the gold pin now sits in the visual middle of the map.
- [ ] Zoom the browser or view on the phone — pin stays centered (the nudge is zoom-locked to the map's own zoom, not the display size).
- [ ] Optional: temporarily rename `RESEND_API_KEY` in Vercel and request a keep-link → the form now says it couldn't send instead of pretending. (Rename it back.)

461 tests · typecheck clean · build clean · 0 vulnerabilities.
